import { describe, expect, it } from "vitest";
import { createDefaultRule, findMatchingRule, normalizeRule } from "../src/shared/siteRules";
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

  it("matches any host when hostPattern is empty", () => {
    expect(
      findMatchingRule("https://other.com/demo", {
        ...baseRule,
        hostPattern: ""
      })?.imageSelector,
    ).toBe("#codeImage");
  });

  it("applies default limits and retries", () => {
    expect(
      normalizeRule({
        ...baseRule,
        minLength: undefined,
        maxLength: undefined,
        maxRetries: undefined
      }),
    ).toMatchObject({
      minLength: 1,
      maxLength: 12,
      maxRetries: 1
    });
  });

  it("creates an enabled blank default rule", () => {
    expect(createDefaultRule()).toMatchObject({
      hostPattern: "",
      imageSelector: "",
      inputSelector: "",
      refreshSelector: "",
      autoFillEnabled: true,
      autoRetryEnabled: true,
      minLength: 1,
      maxLength: 12,
      maxRetries: 1
    });
  });
});
