import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const publicDir = path.join(projectRoot, "public");
const workerSource = path.join(projectRoot, "node_modules", "tesseract.js", "dist", "worker.min.js");
const coreSource = path.join(projectRoot, "node_modules", "tesseract.js-core");
const workerTargetDir = path.join(publicDir, "tesseract");
const coreTargetDir = path.join(publicDir, "tesseract-core");
const tessdataTargetDir = path.join(publicDir, "tessdata");

async function ensureDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true });
}

async function ensureLangData() {
  const langTarget = path.join(tessdataTargetDir, "eng.traineddata.gz");

  try {
    await stat(langTarget);
    return;
  } catch {
    const response = await fetch("https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz");

    if (!response.ok) {
      throw new Error(`Failed to download eng traineddata: ${response.status}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(langTarget, bytes);
  }
}

await ensureDirectory(workerTargetDir);
await ensureDirectory(coreTargetDir);
await ensureDirectory(tessdataTargetDir);

await cp(workerSource, path.join(workerTargetDir, "worker.min.js"));
await cp(coreSource, coreTargetDir, { recursive: true });
await ensureLangData();
