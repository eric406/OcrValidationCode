import { createWorker } from "tesseract.js";

function getLocalTesseractPaths() {
  return {
    workerPath: chrome.runtime.getURL("tesseract/worker.min.js"),
    corePath: chrome.runtime.getURL("tesseract-core"),
    langPath: chrome.runtime.getURL("tessdata"),
    workerBlobURL: false
  };
}

export async function recognizeCode(dataUrl: string): Promise<string> {
  const worker = await createWorker("eng", undefined, getLocalTesseractPaths());

  try {
    const result = await worker.recognize(dataUrl);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}
