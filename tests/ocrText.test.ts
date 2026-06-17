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
