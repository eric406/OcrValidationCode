import { beforeEach, describe, expect, it, vi } from "vitest";

const createWorkerMock = vi.fn();

vi.mock("tesseract.js", () => ({
  createWorker: createWorkerMock
}));

describe("recognizeCode", () => {
  beforeEach(() => {
    vi.resetModules();
    createWorkerMock.mockReset();
  });

  it("creates the OCR worker with local extension asset paths", async () => {
    const recognize = vi.fn().mockResolvedValue({
      data: { text: "A203" }
    });
    const terminate = vi.fn().mockResolvedValue(undefined);

    createWorkerMock.mockResolvedValue({
      recognize,
      terminate
    });

    vi.stubGlobal("chrome", {
      runtime: {
        getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`)
      }
    });

    const { recognizeCode } = await import("../src/ocr/recognize");
    const result = await recognizeCode("data:image/png;base64,test");

    expect(result).toBe("A203");
    expect(createWorkerMock).toHaveBeenCalledWith(
      "eng",
      undefined,
      expect.objectContaining({
        workerPath: "chrome-extension://test-id/tesseract/worker.min.js",
        corePath: "chrome-extension://test-id/tesseract-core",
        langPath: "chrome-extension://test-id/tessdata",
        workerBlobURL: false
      }),
    );
    expect(recognize).toHaveBeenCalledWith("data:image/png;base64,test");
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});
