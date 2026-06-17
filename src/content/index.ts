import { imageElementToDataUrl } from "../ocr/preprocess";
import { normalizeOcrText } from "../shared/ocrText";
import { createDefaultRule, findMatchingRule } from "../shared/siteRules";
import type { SiteRule } from "../shared/types";

declare global {
  interface Window {
    __OCR_AUTOFILL_DISABLE_AUTO_RUN__?: boolean;
  }
}

interface DebugDetail {
  detail?: string;
  status: string;
}

async function loadRule(): Promise<SiteRule> {
  const result = await chrome.storage.local.get("rule");
  return result.rule ?? createDefaultRule();
}

function emitDebugStatus(status: string, detail?: string): void {
  document.documentElement.dataset.ocrAutofillStatus = status;

  if (detail) {
    document.documentElement.dataset.ocrAutofillDetail = detail;
  } else {
    delete document.documentElement.dataset.ocrAutofillDetail;
  }

  document.dispatchEvent(
    new CustomEvent<DebugDetail>("ocr-autofill-debug", {
      detail: { status, detail }
    }),
  );
}

async function waitForImageReady(imageElement: HTMLImageElement): Promise<void> {
  if (imageElement.complete) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const handleLoad = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error("image_capture_failed"));
    };

    const cleanup = () => {
      imageElement.removeEventListener("load", handleLoad);
      imageElement.removeEventListener("error", handleError);
    };

    imageElement.addEventListener("load", handleLoad, { once: true });
    imageElement.addEventListener("error", handleError, { once: true });
  });
}

function hasSelector(selector: string | undefined): selector is string {
  return typeof selector === "string" && selector.trim() !== "";
}

function isCandidateInput(element: Element): element is HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) {
    return false;
  }

  const inputType = (element.getAttribute("type") ?? "text").toLowerCase();
  return inputType === "text" || inputType === "";
}

function isVisibleElement(element: HTMLElement): boolean {
  if (element.hidden) {
    return false;
  }

  const style = window.getComputedStyle(element);

  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  return true;
}

function getElementCenter(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function getDistanceBetween(imageElement: HTMLImageElement, inputElement: HTMLInputElement): number {
  const imageCenter = getElementCenter(imageElement);
  const inputCenter = getElementCenter(inputElement);
  const deltaX = imageCenter.x - inputCenter.x;
  const deltaY = imageCenter.y - inputCenter.y;

  return Math.hypot(deltaX, deltaY);
}

function findClosestImageInputPair():
  | {
      imageElement: HTMLImageElement;
      inputElement: HTMLInputElement;
    }
  | null {
  const imageCandidates = Array.from(document.querySelectorAll("img")).filter((element) =>
    isVisibleElement(element),
  );
  const inputCandidates = Array.from(document.querySelectorAll("input")).filter((element) =>
    isCandidateInput(element) && isVisibleElement(element),
  );

  let bestPair:
    | {
        imageElement: HTMLImageElement;
        inputElement: HTMLInputElement;
        distance: number;
      }
    | null = null;

  for (const imageElement of imageCandidates) {
    for (const inputElement of inputCandidates) {
      const distance = getDistanceBetween(imageElement, inputElement);

      if (!bestPair || distance < bestPair.distance) {
        bestPair = {
          imageElement,
          inputElement,
          distance
        };
      }
    }
  }

  if (!bestPair) {
    return null;
  }

  return {
    imageElement: bestPair.imageElement,
    inputElement: bestPair.inputElement
  };
}

function resolveTargets(rule: SiteRule): {
  imageElement: HTMLImageElement | null;
  inputElement: HTMLInputElement | null;
} {
  const selectedImage = hasSelector(rule.imageSelector) ? document.querySelector(rule.imageSelector) : null;
  const selectedInput = hasSelector(rule.inputSelector)
    ? document.querySelector<HTMLInputElement>(rule.inputSelector)
    : null;

  if (selectedImage instanceof HTMLImageElement && selectedInput instanceof HTMLInputElement) {
    return { imageElement: selectedImage, inputElement: selectedInput };
  }

  const detectedPair = findClosestImageInputPair();

  return {
    imageElement: selectedImage instanceof HTMLImageElement ? selectedImage : detectedPair?.imageElement ?? null,
    inputElement: selectedInput instanceof HTMLInputElement ? selectedInput : detectedPair?.inputElement ?? null
  };
}

function dispatchInputEvents(inputElement: HTMLInputElement): void {
  inputElement.dispatchEvent(new Event("input", { bubbles: true }));
  inputElement.dispatchEvent(new Event("change", { bubbles: true }));
}

async function waitForRetry(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

type OcrResponse =
  | {
      ok: true;
      recognizedText: string;
    }
  | {
      ok: false;
      error?: string;
    };

async function requestRecognition(dataUrl: string): Promise<string> {
  const response = (await chrome.runtime.sendMessage({
    type: "ocr:recognize",
    dataUrl
  })) as OcrResponse;

  if (!response?.ok) {
    throw new Error(response?.error ?? "ocr_failed");
  }

  return response.recognizedText;
}

async function attemptFill(
  imageElement: HTMLImageElement,
  inputElement: HTMLInputElement,
  minLength: number,
  maxLength: number,
): Promise<boolean> {
  await waitForImageReady(imageElement);
  const dataUrl = await imageElementToDataUrl(imageElement);
  const recognizedText = await requestRecognition(dataUrl);
  const normalizedText = normalizeOcrText(recognizedText, minLength, maxLength);

  if (!normalizedText) {
    return false;
  }

  inputElement.value = normalizedText;
  dispatchInputEvents(inputElement);
  return true;
}

export async function runAutoFill(currentUrl = window.location.href): Promise<void> {
  emitDebugStatus("loading_rule");
  const rule = findMatchingRule(currentUrl, await loadRule());

  if (!rule) {
    emitDebugStatus("rule_not_found");
    return;
  }

  emitDebugStatus("rule_loaded");
  const { imageElement, inputElement } = resolveTargets(rule);

  if (!(imageElement instanceof HTMLImageElement)) {
    emitDebugStatus("image_not_found");
    throw new Error("image_not_found");
  }

  if (!inputElement) {
    emitDebugStatus("input_not_found");
    throw new Error("input_not_found");
  }

  emitDebugStatus("targets_resolved");
  let retries = 0;

  while (true) {
    emitDebugStatus("ocr_running", `attempt:${retries + 1}`);
    const filled = await attemptFill(imageElement, inputElement, rule.minLength, rule.maxLength);

    if (filled) {
      emitDebugStatus("filled");
      return;
    }

    if (!rule.autoRetryEnabled || retries >= rule.maxRetries) {
      emitDebugStatus("result_invalid");
      throw new Error("result_invalid");
    }

    const refreshElement = rule.refreshSelector
      ? document.querySelector<HTMLElement>(rule.refreshSelector)
      : null;

    if (!refreshElement) {
      emitDebugStatus("refresh_not_found");
      throw new Error("refresh_not_found");
    }

    emitDebugStatus("retrying", `attempt:${retries + 1}`);
    refreshElement.click();
    retries += 1;
    await waitForRetry();
  }
}

if (!window.__OCR_AUTOFILL_DISABLE_AUTO_RUN__) {
  void runAutoFill().catch((error: Error) => {
    emitDebugStatus("failed", error.message);
    console.warn("OCR Auto Fill failed", error.message);
  });
}
