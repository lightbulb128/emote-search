// @ts-check
// Upload all GIFs from public/emotes/ to Cloudflare R2.
// R2 is S3-compatible, so we use the AWS SDK with a custom endpoint.
//
// Required env vars:
//   R2_ACCOUNT_ID       - Cloudflare account ID
//   R2_ACCESS_KEY_ID    - R2 access key
//   R2_SECRET_ACCESS_KEY - R2 secret key
//   R2_BUCKET_NAME      - R2 bucket name (e.g. "emotes")
//   R2_PUBLIC_URL        - Public base URL (e.g. "https://pub-xxx.r2.dev")
//
// Usage:
//   node scripts/upload-to-r2.js                 # upload every GIF
//   node scripts/upload-to-r2.js 30              # only GIFs modified in the last 30 minutes
//   node scripts/upload-to-r2.js --minutes=30    # same thing
//
// npm equivalent: `npm run upload -- 30`

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMOTES_DIR = join(__dirname, "..", "public", "emotes");

/**
 * Parse the optional "minutes" argument.
 *
 * Accepts `--minutes=30`, `--minutes 30`, `-m 30`, or a bare positional number (`30`).
 * @param {string[]} argv
 * @returns {number | undefined} lookback window in minutes, or undefined for "no filter"
 */
function parseMinutesArg(argv) {
  /** @type {string | undefined} */
  let raw;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eqMatch = /^--?minutes?=(.+)$/.exec(arg);
    if (eqMatch) {
      raw = eqMatch[1];
      break;
    }
    if (arg === "--minutes" || arg === "-m") {
      raw = argv[i + 1];
      break;
    }
    if (/^\d+(\.\d+)?$/.test(arg)) {
      raw = arg;
      break;
    }
  }

  if (raw === undefined) {
    return undefined;
  }

  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.error(`❌ Invalid minutes value: "${raw}". Expected a positive number.`);
    process.exit(1);
  }
  return minutes;
}

const minutesArg = parseMinutesArg(process.argv.slice(2));

const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌ Missing env vars: ${missing.join(", ")}`);
  console.error("   Set them before running this script.");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Return the stored SHA-256 hash for a key, if one exists.
 * @param {string} key
 * @returns {Promise<string | undefined>}
 */
async function getObjectHash(key) {
  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      })
    );
    return response.Metadata?.sha256;
  } catch (err) {
    const requestError = /** @type {{ $metadata?: { httpStatusCode?: number } }} */ (err);
    const statusCode = requestError.$metadata?.httpStatusCode;
    if (statusCode === 404) {
      return undefined;
    }
    throw err;
  }
}

/**
 * Recursively find all .gif files under a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function findGifs(dir) {
  /** @type {string[]} */
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findGifs(full));
    } else if (entry.name.endsWith(".gif")) {
      results.push(full);
    }
  }
  return results;
}

const CONCURRENCY = 10; // parallel uploads

/**
 * Format the useful, non-sensitive details from an AWS SDK request error.
 * @param {unknown} err
 * @returns {string}
 */
function describeRequestError(err) {
  const requestError = /** @type {{ name?: string, message?: string, $metadata?: { httpStatusCode?: number, requestId?: string } }} */ (err);
  const details = [requestError.name ?? "Unknown error"];
  if (requestError.$metadata?.httpStatusCode) {
    details.push(`HTTP ${requestError.$metadata.httpStatusCode}`);
  }
  if (requestError.$metadata?.requestId) {
    details.push(`request ID ${requestError.$metadata.requestId}`);
  }
  return details.join(", ");
}

async function main() {
  if (!existsSync(EMOTES_DIR)) {
    console.error("❌ public/emotes/ directory not found.");
    process.exit(1);
  }

  const allFiles = findGifs(EMOTES_DIR);
  console.log(`📦 Found ${allFiles.length} GIF files.`);

  // Optionally keep only files whose modification time is within the lookback window.
  let files = allFiles;
  if (minutesArg !== undefined) {
    const cutoff = Date.now() - minutesArg * 60 * 1000;
    files = allFiles.filter((filePath) => {
      const mtime = statSync(filePath).mtimeMs;
      return mtime >= cutoff;
    });
    console.log(
      `🕒 Modified in the last ${minutesArg} minute(s): ${files.length} of ${allFiles.length} file(s).`
    );
    if (files.length === 0) {
      console.log("\n✅ Nothing to upload — no files modified in that window.");
      return;
    }
  }

  // Pre-compute metadata for all files
  const tasks = files.map((filePath) => {
    const key = relative(join(EMOTES_DIR, ".."), filePath).replace(/\\/g, "/");
    const size = statSync(filePath).size;
    return { filePath, key, size };
  });

  const totalSize = tasks.reduce((sum, t) => sum + t.size, 0);
  console.log(`   Total: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   Concurrency: ${CONCURRENCY}\n`);

  let uploaded = 0;
  let skipped = 0;
  let completed = 0;

  /** Upload a single file when its content differs from R2. */
  async function uploadOne(task) {
    const { filePath, key, size } = task;
    const body = readFileSync(filePath);
    const sha256 = createHash("sha256").update(body).digest("hex");

    const remoteHash = await getObjectHash(key);
    if (remoteHash === sha256) {
      skipped++;
      completed++;
      process.stdout.write(`\r  ⏭ skipped ${skipped}  |  ⬆ uploaded ${uploaded}  |  ${completed}/${tasks.length} complete`);
      return;
    }

    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: "image/gif",
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: { sha256 },
      })
    );

    uploaded++;
    completed++;
    process.stdout.write(`\r  ⏭ skipped ${skipped}  |  ⬆ uploaded ${uploaded}  |  ${completed}/${tasks.length} complete`);
  }

  // Worker pool: process tasks with limited concurrency
  const pool = new Set();
  for (const task of tasks) {
    const promise = uploadOne(task).catch((err) => {
      console.error(`\n  ❌ ${task.key}: ${describeRequestError(err)}`);
      skipped++;
      completed++;
    });
    pool.add(promise);
    promise.finally(() => pool.delete(promise));

    // Wait if pool is full
    if (pool.size >= CONCURRENCY) {
      await Promise.race(pool);
    }
  }

  // Wait for remaining tasks
  await Promise.all(pool);

  console.log(`\n\n✅ Done: ${uploaded} uploaded, ${skipped} skipped`);
  console.log(`   Total: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   Public URL: ${process.env.R2_PUBLIC_URL}/emotes/<character>/<file>`);
}

main().catch((err) => {
  console.error("❌ Upload failed:", err);
  process.exit(1);
});
