# OCR Auto-Fill Root Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension at the repository root that performs local offline OCR on a configured `<img>` verification code and fills a configured input on matching sites.

**Architecture:** Use Vite + TypeScript with a background service worker for OCR orchestration, a content script for DOM automation and retry control, a small options page for the single global rule, and shared helpers for rule matching and OCR text normalization. Inject on all sites, but guard all behavior behind the stored rule and host matching.

**Tech Stack:** Chrome Extension Manifest V3, Vite, TypeScript, `@crxjs/vite-plugin`, `tesseract.js`, Vitest, jsdom

---

## File Structure

- `package.json` — extension package manifest and scripts
- `tsconfig.json` — TypeScript config for app, tests, and Vite config
- `vite.config.ts` — Vite build config with CRX plugin and Vitest config
- `src/manifest.ts` — Manifest V3 definition
- `src/background/index.ts` — OCR message handler
- `src/content/index.ts` — DOM autofill and retry flow
- `src/ocr/preprocess.ts` — image to data URL conversion
- `src/ocr/recognize.ts` — `tesseract.js` adapter
- `src/options/index.html` — options shell
- `src/options/main.ts` — single-rule editor wiring
- `src/shared/types.ts` — single-rule types
- `src/shared/siteRules.ts` — rule normalization and host matching
- `src/shared/ocrText.ts` — OCR normalization and validation
- `tests/siteRules.test.ts` — rule helper tests
- `tests/ocrText.test.ts` — OCR text tests
- `tests/contentFlow.test.ts` — content-script behavior tests
- `public/manual-test.html` — manual verification page
- `README.md` — setup and usage

## Task 1: Scaffold the root extension project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/manifest.ts`
- Create: `src/background/index.ts`
- Create: `src/content/index.ts`
- Create: `src/options/index.html`
- Create: `src/options/main.ts`

- [ ] **Step 1: Write the package manifest**

```json
{
  "name": "ocr-autofill-extension",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "tesseract.js": "^6.0.1"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.31",
    "@types/jsdom": "^21.1.7",
    "jsdom": "^24.1.3",
    "typescript": "^5.8.2",
    "vite": "^6.3.5",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 2: Write TypeScript and Vite config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["DOM", "ES2022"],
    "strict": true,
    "noEmit": true,
    "types": ["chrome", "vitest/globals"],
    "skipLibCheck": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

```ts
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest";

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  test: {
    environment: "jsdom"
  }
});
```

- [ ] **Step 3: Write initial manifest and entry points**

```ts
import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "OCR Auto Fill",
  version: "0.1.0",
  permissions: ["storage"],
  host_permissions: ["<all_urls>"],
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle"
    }
  ],
  options_page: "src/options/index.html"
});
```

```ts
chrome.runtime.onInstalled.addListener(() => {
  console.info("OCR Auto Fill installed");
});
```

```ts
console.info("OCR Auto Fill content script loaded");
```

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OCR Auto Fill Options</title>
  </head>
  <body>
    <div id="app">OCR Auto Fill options</div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts
const rootElement = document.querySelector<HTMLDivElement>("#app");

if (rootElement) {
  rootElement.textContent = "OCR Auto Fill options";
}
```

## Task 2: Add and verify rule helper behavior with TDD

**Files:**
- Create: `tests/siteRules.test.ts`
- Create: `src/shared/types.ts`
- Create: `src/shared/siteRules.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { findMatchingRule, normalizeRule } from "../src/shared/siteRules";
import type { SiteRule } from "../src/shared/types";

describe("site rule resolution", () => {
  const baseRule: SiteRule = {
    hostPattern: "example.com",
    imageSelector: "#codeImage",
    inputSelector: "#codeInput",
    refreshSelector: "#refresh",
    characterPolicy: "alphanumeric",
    autoFillEnabled: true,
    autoRetryEnabled: true,
    maxRetries: 1
  };

  it("matches an exact host", () => {
    expect(findMatchingRule("https://example.com/demo", baseRule)?.hostPattern).toBe("example.com");
  });

  it("returns null for a different host", () => {
    expect(findMatchingRule("https://other.com/demo", baseRule)).toBeNull();
  });

  it("applies default limits and retries", () => {
    expect(normalizeRule({
      ...baseRule,
      minLength: undefined,
      maxLength: undefined,
      maxRetries: undefined
    })).toMatchObject({
      minLength: 1,
      maxLength: 12,
      maxRetries: 1
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- siteRules`
Expected: FAIL because `src/shared/siteRules.ts` and `src/shared/types.ts` do not exist

- [ ] **Step 3: Write minimal implementation**

```ts
export type CharacterPolicy = "alphanumeric";

export interface SiteRule {
  hostPattern: string;
  imageSelector: string;
  inputSelector: string;
  refreshSelector?: string;
  characterPolicy: CharacterPolicy;
  minLength?: number;
  maxLength?: number;
  autoFillEnabled: boolean;
  autoRetryEnabled: boolean;
  maxRetries?: number;
}

export interface NormalizedSiteRule extends SiteRule {
  minLength: number;
  maxLength: number;
  maxRetries: number;
}
```

```ts
import type { NormalizedSiteRule, SiteRule } from "./types";

const DEFAULT_MIN_LENGTH = 1;
const DEFAULT_MAX_LENGTH = 12;
const DEFAULT_MAX_RETRIES = 1;

export function normalizeRule(rule: SiteRule): NormalizedSiteRule {
  return {
    ...rule,
    minLength: rule.minLength ?? DEFAULT_MIN_LENGTH,
    maxLength: rule.maxLength ?? DEFAULT_MAX_LENGTH,
    maxRetries: rule.maxRetries ?? DEFAULT_MAX_RETRIES
  };
}

export function hostMatches(hostname: string, pattern: string): boolean {
  return hostname === pattern || hostname.endsWith(`.${pattern}`);
}

export function findMatchingRule(url: string, rule: SiteRule | null): NormalizedSiteRule | null {
  if (!rule?.autoFillEnabled) {
    return null;
  }

  return hostMatches(new URL(url).hostname, rule.hostPattern) ? normalizeRule(rule) : null;
}
```

## Task 3: Add OCR text normalization with TDD

**Files:**
- Create: `tests/ocrText.test.ts`
- Create: `src/shared/ocrText.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { normalizeOcrText } from "../src/shared/ocrText";

describe("normalizeOcrText", () => {
  it("removes spaces and punctuation", () => {
    expect(normalizeOcrText(" A2- 0!3 ", 1, 10)).toBe("A203");
  });

  it("returns null when too short", () => {
    expect(normalizeOcrText("@", 2, 6)).toBeNull();
  });

  it("returns null when too long", () => {
    expect(normalizeOcrText("ABCDEFGHIJKLM", 1, 12)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- ocrText`
Expected: FAIL because `src/shared/ocrText.ts` does not exist

- [ ] **Step 3: Write minimal implementation**

```ts
export function normalizeOcrText(rawText: string, minLength: number, maxLength: number): string | null {
  const sanitizedText = rawText.replace(/[^a-z0-9]/gi, "").trim();

  if (sanitizedText.length < minLength || sanitizedText.length > maxLength) {
    return null;
  }

  return sanitizedText;
}
```

## Task 4: Add background OCR pipeline

**Files:**
- Create: `src/ocr/preprocess.ts`
- Create: `src/ocr/recognize.ts`
- Modify: `src/background/index.ts`

- [ ] **Step 1: Write minimal image preprocessing helper**

```ts
export async function imageElementToDataUrl(imageElement: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = imageElement.naturalWidth || imageElement.width;
  canvas.height = imageElement.naturalHeight || imageElement.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("image_capture_failed");
  }

  context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
```

- [ ] **Step 2: Write OCR adapter and message handler**

```ts
import { createWorker } from "tesseract.js";

export async function recognizeCode(dataUrl: string): Promise<string> {
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(dataUrl);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}
```

```ts
import { recognizeCode } from "../ocr/recognize";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ocr:recognize" || typeof message.dataUrl !== "string") {
    return undefined;
  }

  void recognizeCode(message.dataUrl)
    .then((recognizedText) => sendResponse({ ok: true, recognizedText }))
    .catch((error: Error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
```

## Task 5: Add content autofill flow with TDD

**Files:**
- Create: `tests/contentFlow.test.ts`
- Modify: `src/content/index.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("content autofill flow", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <img id="codeImage" src="sample-code.png" />
      <input id="codeInput" />
      <button id="refresh"></button>
    `;
  });

  it("fills the configured input when OCR succeeds", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, recognizedText: "A203" });

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            rule: {
              hostPattern: "example.com",
              imageSelector: "#codeImage",
              inputSelector: "#codeInput",
              refreshSelector: "#refresh",
              characterPolicy: "alphanumeric",
              autoFillEnabled: true,
              autoRetryEnabled: true,
              maxRetries: 1
            }
          })
        }
      }
    });

    const { runAutoFill } = await import("../src/content/index");
    await runAutoFill("https://example.com/demo");

    expect((document.querySelector("#codeInput") as HTMLInputElement).value).toBe("A203");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- contentFlow`
Expected: FAIL because `runAutoFill` is not implemented

- [ ] **Step 3: Write minimal implementation**

```ts
import { imageElementToDataUrl } from "../ocr/preprocess";
import { normalizeOcrText } from "../shared/ocrText";
import { findMatchingRule } from "../shared/siteRules";
import type { SiteRule } from "../shared/types";

async function loadRule(): Promise<SiteRule | null> {
  const result = await chrome.storage.local.get("rule");
  return result.rule ?? null;
}

function dispatchInputEvents(inputElement: HTMLInputElement): void {
  inputElement.dispatchEvent(new Event("input", { bubbles: true }));
  inputElement.dispatchEvent(new Event("change", { bubbles: true }));
}

export async function runAutoFill(currentUrl = window.location.href): Promise<void> {
  const rule = findMatchingRule(currentUrl, await loadRule());

  if (!rule) {
    return;
  }

  const imageElement = document.querySelector(rule.imageSelector);
  const inputElement = document.querySelector<HTMLInputElement>(rule.inputSelector);

  if (!(imageElement instanceof HTMLImageElement)) {
    throw new Error("image_not_found");
  }

  if (!inputElement) {
    throw new Error("input_not_found");
  }

  const dataUrl = await imageElementToDataUrl(imageElement);
  const response = await chrome.runtime.sendMessage({ type: "ocr:recognize", dataUrl });

  if (!response?.ok) {
    throw new Error(response?.error ?? "ocr_failed");
  }

  const normalizedText = normalizeOcrText(response.recognizedText, rule.minLength, rule.maxLength);

  if (!normalizedText) {
    throw new Error("result_invalid");
  }

  inputElement.value = normalizedText;
  dispatchInputEvents(inputElement);
}
```

## Task 6: Add options UI, manual page, and README

**Files:**
- Modify: `src/options/index.html`
- Modify: `src/options/main.ts`
- Create: `public/manual-test.html`
- Create: `README.md`

- [ ] **Step 1: Write options UI**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OCR Auto Fill Options</title>
  </head>
  <body>
    <main>
      <h1>OCR Auto Fill</h1>
      <form id="ruleForm">
        <label>Host Pattern <input id="hostPattern" name="hostPattern" required /></label>
        <label>Image Selector <input id="imageSelector" name="imageSelector" required /></label>
        <label>Input Selector <input id="inputSelector" name="inputSelector" required /></label>
        <label>Refresh Selector <input id="refreshSelector" name="refreshSelector" /></label>
        <label>Min Length <input id="minLength" name="minLength" type="number" min="1" value="1" /></label>
        <label>Max Length <input id="maxLength" name="maxLength" type="number" min="1" value="12" /></label>
        <label>Enable Auto Fill <input id="autoFillEnabled" name="autoFillEnabled" type="checkbox" checked /></label>
        <label>Enable Retry <input id="autoRetryEnabled" name="autoRetryEnabled" type="checkbox" checked /></label>
        <label>Max Retries <input id="maxRetries" name="maxRetries" type="number" min="0" value="1" /></label>
        <button type="submit">Save Rule</button>
      </form>
      <p id="status"></p>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Write options persistence**

```ts
import type { SiteRule } from "../shared/types";

const formElement = document.querySelector<HTMLFormElement>("#ruleForm");
const statusElement = document.querySelector<HTMLParagraphElement>("#status");

if (!formElement || !statusElement) {
  throw new Error("options_ui_not_found");
}

formElement.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(formElement);
  const rule: SiteRule = {
    hostPattern: String(formData.get("hostPattern") ?? ""),
    imageSelector: String(formData.get("imageSelector") ?? ""),
    inputSelector: String(formData.get("inputSelector") ?? ""),
    refreshSelector: String(formData.get("refreshSelector") ?? "") || undefined,
    characterPolicy: "alphanumeric",
    minLength: Number(formData.get("minLength") ?? 1),
    maxLength: Number(formData.get("maxLength") ?? 12),
    autoFillEnabled: formData.get("autoFillEnabled") === "on",
    autoRetryEnabled: formData.get("autoRetryEnabled") === "on",
    maxRetries: Number(formData.get("maxRetries") ?? 1)
  };

  await chrome.storage.local.set({ rule });
  statusElement.textContent = "Rule saved";
});
```

## Task 7: Final verification

**Files:**
- Verify: project root

- [ ] **Step 1: Run full verification**

Run: `npm install`
Expected: dependencies install successfully and `package-lock.json` is created

Run: `npm run typecheck`
Expected: PASS with no TypeScript errors

Run: `npm run test`
Expected: PASS with all tests green

Run: `npm run build`
Expected: PASS and `dist/` contains a loadable extension bundle
