import { createDefaultRule } from "../shared/siteRules";
import type { SiteRule } from "../shared/types";

const formElement = document.querySelector<HTMLFormElement>("#ruleForm");
const statusElement = document.querySelector<HTMLParagraphElement>("#status");

function readCheckbox(name: string): boolean {
  const input = formElement?.elements.namedItem(name);
  return input instanceof HTMLInputElement ? input.checked : false;
}

function readNumber(name: string, fallbackValue: number): number {
  const input = formElement?.elements.namedItem(name);

  if (!(input instanceof HTMLInputElement)) {
    return fallbackValue;
  }

  const parsedValue = Number(input.value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

function setInputValue(name: string, value: string | number | undefined): void {
  const input = formElement?.elements.namedItem(name);

  if (input instanceof HTMLInputElement) {
    input.value = value == null ? "" : String(value);
  }
}

function setCheckboxValue(name: string, checked: boolean): void {
  const input = formElement?.elements.namedItem(name);

  if (input instanceof HTMLInputElement) {
    input.checked = checked;
  }
}

async function loadStoredRule(): Promise<void> {
  if (!formElement) {
    return;
  }

  const result = await chrome.storage.local.get("rule");
  const rule = (result.rule as SiteRule | undefined) ?? createDefaultRule();

  setInputValue("hostPattern", rule.hostPattern);
  setInputValue("imageSelector", rule.imageSelector);
  setInputValue("inputSelector", rule.inputSelector);
  setInputValue("refreshSelector", rule.refreshSelector);
  setInputValue("minLength", rule.minLength);
  setInputValue("maxLength", rule.maxLength);
  setInputValue("maxRetries", rule.maxRetries);
  setCheckboxValue("autoFillEnabled", rule.autoFillEnabled);
  setCheckboxValue("autoRetryEnabled", rule.autoRetryEnabled);
}

if (!formElement || !statusElement) {
  throw new Error("options_ui_not_found");
}

formElement.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(formElement);
  const rule: SiteRule = {
    hostPattern: String(formData.get("hostPattern") ?? "").trim(),
    imageSelector: String(formData.get("imageSelector") ?? "").trim(),
    inputSelector: String(formData.get("inputSelector") ?? "").trim(),
    refreshSelector: String(formData.get("refreshSelector") ?? "").trim() || undefined,
    characterPolicy: "alphanumeric",
    minLength: readNumber("minLength", 1),
    maxLength: readNumber("maxLength", 12),
    autoFillEnabled: readCheckbox("autoFillEnabled"),
    autoRetryEnabled: readCheckbox("autoRetryEnabled"),
    maxRetries: readNumber("maxRetries", 1)
  };

  await chrome.storage.local.set({ rule });
  statusElement.textContent = "Rule saved";
});

void loadStoredRule().catch((error: Error) => {
  statusElement.textContent = `Load failed: ${error.message}`;
});
