/**
 * Mistral AI model pricing (per million tokens)
 * Source: https://mistral.ai/pricing#api-pricing
 * Note: Pricing may vary and is subject to change. Check official page for latest rates.
 */

import type { PricingRates } from "../types.js";

export const MISTRAL_PRICING: Record<string, PricingRates> = {
  // Mistral Large series
  "mistral-large": { input_per_mtok: 2.0, output_per_mtok: 6.0 },
  "mistral-large-latest": { input_per_mtok: 2.0, output_per_mtok: 6.0 },
  "mistral-large-2407": { input_per_mtok: 2.0, output_per_mtok: 6.0 },
  "mistral-large-2402": { input_per_mtok: 2.0, output_per_mtok: 6.0 },

  // Mistral Small series
  "mistral-small": { input_per_mtok: 0.2, output_per_mtok: 0.6 },
  "mistral-small-latest": { input_per_mtok: 0.2, output_per_mtok: 0.6 },
  "mistral-small-2409": { input_per_mtok: 0.2, output_per_mtok: 0.6 },
  "mistral-small-2402": { input_per_mtok: 0.2, output_per_mtok: 0.6 },

  // Mistral Medium (if available)
  "mistral-medium": { input_per_mtok: 0.6, output_per_mtok: 1.8 },
  "mistral-medium-latest": { input_per_mtok: 0.6, output_per_mtok: 1.8 },
  "mistral-medium-2402": { input_per_mtok: 0.6, output_per_mtok: 1.8 },

  // Mistral Nemo series
  "mistral-nemo": { input_per_mtok: 0.15, output_per_mtok: 0.15 },
  "mistral-nemo-latest": { input_per_mtok: 0.15, output_per_mtok: 0.15 },

  // Pixtral series (multimodal)
  pixtral: { input_per_mtok: 0.15, output_per_mtok: 0.15 },
  "pixtral-12b": { input_per_mtok: 0.15, output_per_mtok: 0.15 },
  "pixtral-latest": { input_per_mtok: 0.15, output_per_mtok: 0.15 },

  // Codestral series (code models)
  codestral: { input_per_mtok: 0.2, output_per_mtok: 0.6 },
  "codestral-latest": { input_per_mtok: 0.2, output_per_mtok: 0.6 },
  "codestral-mamba": { input_per_mtok: 0.2, output_per_mtok: 0.6 },

  // Legacy models (if still supported)
  "mistral-tiny": { input_per_mtok: 0.14, output_per_mtok: 0.14 },
  "mistral-7b": { input_per_mtok: 0.14, output_per_mtok: 0.14 },
};

/**
 * Get Mistral pricing for a model
 * Handles model name variations and aliases
 */
export function getMistralPricing(model: string): PricingRates | null {
  const modelLower = model.toLowerCase();

  // Try exact match first
  if (MISTRAL_PRICING[modelLower]) {
    return MISTRAL_PRICING[modelLower];
  }

  // Try pattern matching for model families
  if (modelLower.includes("mistral-large")) {
    return MISTRAL_PRICING["mistral-large"];
  }
  if (modelLower.includes("mistral-small")) {
    return MISTRAL_PRICING["mistral-small"];
  }
  if (modelLower.includes("mistral-medium")) {
    return MISTRAL_PRICING["mistral-medium"];
  }
  if (modelLower.includes("mistral-nemo")) {
    return MISTRAL_PRICING["mistral-nemo"];
  }
  if (modelLower.includes("pixtral")) {
    return MISTRAL_PRICING["pixtral-12b"];
  }
  if (modelLower.includes("codestral")) {
    return MISTRAL_PRICING["codestral"];
  }
  if (
    modelLower.includes("mistral-tiny") ||
    modelLower.includes("mistral-7b")
  ) {
    return MISTRAL_PRICING["mistral-tiny"];
  }

  // Default fallback to Mistral Small pricing
  return MISTRAL_PRICING["mistral-small"];
}
