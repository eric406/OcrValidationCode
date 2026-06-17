import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const manifestPath = path.join(process.cwd(), "dist", "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const extraResources = {
  matches: ["<all_urls>"],
  resources: ["tesseract/worker.min.js", "tesseract-core/*", "tessdata/*"],
  use_dynamic_url: false
};

const existing = Array.isArray(manifest.web_accessible_resources)
  ? manifest.web_accessible_resources
  : [];

manifest.web_accessible_resources = [...existing, extraResources];

await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
