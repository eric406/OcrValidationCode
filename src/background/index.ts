const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/index.html";

let creatingOffscreenDocument: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
    documentUrls: [offscreenUrl]
  });

  if (contexts.length > 0) {
    return;
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["WORKERS", "BLOBS"],
      justification: "Run local OCR away from page CSP restrictions"
    }).finally(() => {
      creatingOffscreenDocument = null;
    });
  }

  await creatingOffscreenDocument;
}

chrome.runtime.onInstalled.addListener(() => {
  console.info("OCR Auto Fill installed");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target === "offscreen" || message?.type !== "ocr:recognize" || typeof message.dataUrl !== "string") {
    return undefined;
  }

  void (async () => {
    await ensureOffscreenDocument();
    const response = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "ocr:recognize",
      dataUrl: message.dataUrl
    });
    sendResponse(response);
  })().catch((error: Error) => {
    sendResponse({ ok: false, error: error.message });
  });

  return true;
});
