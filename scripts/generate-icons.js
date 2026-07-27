// @ts-check
// Generate PWA icons from the SVG favicon
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const svgBuffer = readFileSync(join(PUBLIC_DIR, "favicon.svg"));

async function generate() {
  await sharp(svgBuffer).resize(192, 192).png().toFile(join(PUBLIC_DIR, "icon-192.png"));
  console.log("✅ Generated icon-192.png");

  await sharp(svgBuffer).resize(512, 512).png().toFile(join(PUBLIC_DIR, "icon-512.png"));
  console.log("✅ Generated icon-512.png");
}

generate().catch((err) => {
  console.error("❌ Failed to generate icons:", err);
  process.exit(1);
});
