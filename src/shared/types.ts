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
