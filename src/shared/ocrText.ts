export function normalizeOcrText(rawText: string, minLength: number, maxLength: number): string | null {
  const sanitizedText = rawText.replace(/[^a-z0-9]/gi, "").trim();

  if (sanitizedText.length < minLength || sanitizedText.length > maxLength) {
    return null;
  }

  return sanitizedText;
}
