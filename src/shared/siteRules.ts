import type { NormalizedSiteRule, SiteRule } from "./types";

const DEFAULT_MIN_LENGTH = 1;
const DEFAULT_MAX_LENGTH = 12;
const DEFAULT_MAX_RETRIES = 1;

export function createDefaultRule(): SiteRule {
  return {
    hostPattern: "",
    imageSelector: "",
    inputSelector: "",
    refreshSelector: "",
    characterPolicy: "alphanumeric",
    minLength: DEFAULT_MIN_LENGTH,
    maxLength: DEFAULT_MAX_LENGTH,
    autoFillEnabled: true,
    autoRetryEnabled: true,
    maxRetries: DEFAULT_MAX_RETRIES
  };
}

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

  const normalizedRule = normalizeRule(rule);
  const hostPattern = normalizedRule.hostPattern.trim();

  if (hostPattern === "") {
    return normalizedRule;
  }

  return hostMatches(new URL(url).hostname, hostPattern) ? normalizedRule : null;
}
