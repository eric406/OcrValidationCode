import { recognizeCode } from "../ocr/recognize";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen" || message?.type !== "ocr:recognize" || typeof message.dataUrl !== "string") {
    return undefined;
  }

  void recognizeCode(message.dataUrl)
    .then((recognizedText) => sendResponse({ ok: true, recognizedText }))
    .catch((error: Error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
