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
// Usage: node scripts/upload-to-r2.js

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMOTES_DIR = join(__dirname, "..", "public", "emotes");

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
 * Check whether a key already exists in the R2 bucket.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function objectExists(key) {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch (err) {
    // 404 → not found; any other error we treat as not-found to be safe
    return false;
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

async function main() {
  if (!existsSync(EMOTES_DIR)) {
    console.error("❌ public/emotes/ directory not found.");
    process.exit(1);
  }

  const files = findGifs(EMOTES_DIR);
  console.log(`📦 Found ${files.length} GIF files.`);

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

  /** Upload a single file (checks existence first). */
  async function uploadOne(task) {
    const { filePath, key, size } = task;

    // Check if already uploaded
    const alreadyExists = await objectExists(key);
    if (alreadyExists) {
      skipped++;
      completed++;
      process.stdout.write(`\r  ⏭ skipped ${skipped}  |  ⬆ uploaded ${uploaded}  |  ${completed}/${tasks.length} complete`);
      return;
    }

    const body = readFileSync(filePath);
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: "image/gif",
        CacheControl: "public, max-age=31536000, immutable",
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
      console.error(`\n  ❌ ${task.key}: ${err.message}`);
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
