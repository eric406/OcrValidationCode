import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ocr/preprocess", () => ({
  imageElementToDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,test")
}));

describe("content autofill flow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    window.__OCR_AUTOFILL_DISABLE_AUTO_RUN__ = true;
    document.body.innerHTML = `
      <img id="codeImage" src="sample-code.png" />
      <input id="codeInput" />
      <button id="refresh" type="button">refresh</button>
    `;
  });

  function setRect(selector: string, rect: Partial<DOMRect>): void {
    const element = document.querySelector<HTMLElement>(selector);

    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    Object.defineProperty(element, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: rect.x ?? 0,
        y: rect.y ?? 0,
        width: rect.width ?? 120,
        height: rect.height ?? 32,
        top: rect.top ?? rect.y ?? 0,
        right: rect.right ?? ((rect.x ?? 0) + (rect.width ?? 120)),
        bottom: rect.bottom ?? ((rect.y ?? 0) + (rect.height ?? 32)),
        left: rect.left ?? rect.x ?? 0,
        toJSON: () => ({})
      })
    });
  }

  function setImageLoaded(selector: string, loaded = true): void {
    const element = document.querySelector<HTMLImageElement>(selector);

    if (!element) {
      throw new Error(`Image not found: ${selector}`);
    }

    Object.defineProperty(element, "complete", {
      configurable: true,
      get: () => loaded
    });
  }

  it("fills the configured input when OCR succeeds", async () => {
    setImageLoaded("#codeImage");
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      recognizedText: "A203"
    });

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
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("uses the default rule when no rule is stored", async () => {
    setImageLoaded("#codeImage");
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      recognizedText: "Z901"
    });

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            rule: null
          })
        }
      }
    });

    const { runAutoFill } = await import("../src/content/index");
    await runAutoFill("https://example.com/demo");

    expect((document.querySelector("#codeInput") as HTMLInputElement).value).toBe("Z901");
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("clicks refresh and retries once when the first OCR result is invalid", async () => {
    setImageLoaded("#codeImage");
    const refreshButton = document.querySelector<HTMLButtonElement>("#refresh");
    const refreshSpy = vi.fn();
    refreshButton?.addEventListener("click", refreshSpy);

    const sendMessage = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        recognizedText: "@"
      })
      .mockResolvedValueOnce({
        ok: true,
        recognizedText: "B204"
      });

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
              minLength: 2,
              maxLength: 6,
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

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect((document.querySelector("#codeInput") as HTMLInputElement).value).toBe("B204");
  });

  it("auto-detects the image and input when selectors are blank", async () => {
    setImageLoaded("#codeImage");
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      recognizedText: "C305"
    });

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            rule: {
              hostPattern: "",
              imageSelector: "",
              inputSelector: "",
              refreshSelector: "",
              characterPolicy: "alphanumeric",
              autoFillEnabled: true,
              autoRetryEnabled: false,
              maxRetries: 0
            }
          })
        }
      }
    });

    const { runAutoFill } = await import("../src/content/index");
    await runAutoFill("https://example.com/demo");

    expect((document.querySelector("#codeInput") as HTMLInputElement).value).toBe("C305");
  });

  it("prefers the closest detected image-input pair", async () => {
    document.body.innerHTML = `
      <img id="farImage" src="far.png" />
      <input id="farInput" />
      <img id="nearImage" src="near.png" />
      <input id="nearInput" />
    `;

    setRect("#farImage", { x: 0, y: 0, width: 100, height: 40 });
    setRect("#farInput", { x: 420, y: 0, width: 140, height: 32 });
    setRect("#nearImage", { x: 10, y: 120, width: 100, height: 40 });
    setRect("#nearInput", { x: 130, y: 122, width: 140, height: 32 });
    setImageLoaded("#farImage");
    setImageLoaded("#nearImage");

    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      recognizedText: "D406"
    });

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            rule: {
              hostPattern: "",
              imageSelector: "",
              inputSelector: "",
              refreshSelector: "",
              characterPolicy: "alphanumeric",
              autoFillEnabled: true,
              autoRetryEnabled: false,
              maxRetries: 0
            }
          })
        }
      }
    });

    const { runAutoFill } = await import("../src/content/index");
    await runAutoFill("https://example.com/demo");

    expect((document.querySelector("#nearInput") as HTMLInputElement).value).toBe("D406");
    expect((document.querySelector("#farInput") as HTMLInputElement).value).toBe("");
  });

  it("waits for the target image to finish loading before OCR", async () => {
    const imageElement = document.querySelector<HTMLImageElement>("#codeImage");

    if (!imageElement) {
      throw new Error("image not found");
    }

    let isLoaded = false;

    Object.defineProperty(imageElement, "complete", {
      configurable: true,
      get: () => isLoaded
    });

    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      recognizedText: "E507"
    });

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            rule: {
              hostPattern: "",
              imageSelector: "#codeImage",
              inputSelector: "#codeInput",
              refreshSelector: "",
              characterPolicy: "alphanumeric",
              autoFillEnabled: true,
              autoRetryEnabled: false,
              maxRetries: 0
            }
          })
        }
      }
    });

    const { runAutoFill } = await import("../src/content/index");
    const pending = runAutoFill("https://example.com/demo");

    expect(sendMessage).not.toHaveBeenCalled();

    isLoaded = true;
    imageElement.dispatchEvent(new Event("load"));
    await pending;

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect((document.querySelector("#codeInput") as HTMLInputElement).value).toBe("E507");
  });

  it("waits for the configured image selector to appear before running OCR", async () => {
    document.body.innerHTML = `
      <input id="codeInput" />
      <button id="refresh" type="button">refresh</button>
    `;

    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      recognizedText: "F608"
    });
    const releaseRuleRef: { current: null | (() => void) } = { current: null };
    const ruleLoaded = new Promise<void>((resolve) => {
      releaseRuleRef.current = resolve;
    });

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      storage: {
        local: {
          get: vi.fn().mockImplementation(async () => {
            await ruleLoaded;

            return {
              rule: {
                hostPattern: "",
                imageSelector: "#codeImage",
                inputSelector: "#codeInput",
                refreshSelector: "#refresh",
                characterPolicy: "alphanumeric",
                autoFillEnabled: true,
                autoRetryEnabled: false,
                maxRetries: 0
              }
            };
          })
        }
      }
    });

    const { runAutoFill } = await import("../src/content/index");
    const pending = runAutoFill("https://example.com/demo");

    expect(sendMessage).not.toHaveBeenCalled();
    if (!releaseRuleRef.current) {
      throw new Error("releaseRule not initialized");
    }

    releaseRuleRef.current();
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });

    const delayedImage = document.createElement("img");
    delayedImage.id = "codeImage";
    delayedImage.src = "sample-code.png";

    Object.defineProperty(delayedImage, "complete", {
      configurable: true,
      get: () => true
    });

    document.body.prepend(delayedImage);
    await pending;

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect((document.querySelector("#codeInput") as HTMLInputElement).value).toBe("F608");
  });
});
