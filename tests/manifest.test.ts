// @vitest-environment node
import { describe, expect, it } from "vitest";

import manifest from "../src/manifest";

describe("extension manifest", () => {
  it("allows wasm in extension pages for offscreen OCR", async () => {
    const resolvedManifest = await manifest;
    const finalManifest = resolvedManifest as {
      content_security_policy?: {
        extension_pages?: string;
      };
    };

    expect(finalManifest.content_security_policy?.extension_pages).toContain("'wasm-unsafe-eval'");
  });
});
