/**
 * OpenAI model pricing (per million tokens)
 * Source: https://openai.com/api/pricing/
 * Note: Pricing may vary by region and is subject to change. Check official page for latest rates.
 */

import type { PricingRates } from "../types.js";

export const OPENAI_PRICING: Record<string, PricingRates> = {
  // GPT-4o series (latest)
  "gpt-4o": { input_per_mtok: 2.5, output_per_mtok: 10.0 },
  "gpt-4o-2024-08-06": { input_per_mtok: 2.5, output_per_mtok: 10.0 },
  "gpt-4o-mini": { input_per_mtok: 0.15, output_per_mtok: 0.6 },
  "gpt-4o-mini-2024-07-18": { input_per_mtok: 0.15, output_per_mtok: 0.6 },

  // GPT-4 Turbo series
  "gpt-4-turbo": { input_per_mtok: 10.0, output_per_mtok: 30.0 },
  "gpt-4-turbo-2024-04-09": { input_per_mtok: 10.0, output_per_mtok: 30.0 },
  "gpt-4-turbo-preview": { input_per_mtok: 10.0, output_per_mtok: 30.0 },

  // GPT-4 series
  "gpt-4": { input_per_mtok: 30.0, output_per_mtok: 60.0 },
  "gpt-4-0613": { input_per_mtok: 30.0, output_per_mtok: 60.0 },
  "gpt-4-32k": { input_per_mtok: 60.0, output_per_mtok: 120.0 },
  "gpt-4-32k-0613": { input_per_mtok: 60.0, output_per_mtok: 120.0 },

  // GPT-3.5 Turbo series
  "gpt-3.5-turbo": { input_per_mtok: 0.5, output_per_mtok: 1.5 },
  "gpt-3.5-turbo-0125": { input_per_mtok: 0.5, output_per_mtok: 1.5 },
  "gpt-3.5-turbo-1106": { input_per_mtok: 1.0, output_per_mtok: 2.0 },
  "gpt-3.5-turbo-16k": { input_per_mtok: 3.0, output_per_mtok: 4.0 },

  // O1 series (reasoning models)
  o1: { input_per_mtok: 15.0, output_per_mtok: 60.0 },
  "o1-preview": { input_per_mtok: 15.0, output_per_mtok: 60.0 },
  "o1-mini": { input_per_mtok: 3.0, output_per_mtok: 12.0 },
  "o1-mini-2024-09-12": { input_per_mtok: 3.0, output_per_mtok: 12.0 },

  // O3 series
  o3: { input_per_mtok: 15.0, output_per_mtok: 60.0 },
  "o3-mini": { input_per_mtok: 3.0, output_per_mtok: 12.0 },
};

/**
 * Get OpenAI pricing for a model
 * Handles model name variations and aliases
 */
export function getOpenAIPricing(model: string): PricingRates | null {
  const modelLower = model.toLowerCase();

  // Try exact match first
  if (OPENAI_PRICING[modelLower]) {
    return OPENAI_PRICING[modelLower];
  }

  // Try pattern matching for model families
  if (modelLower.startsWith("gpt-4o")) {
    if (modelLower.includes("mini")) {
      return OPENAI_PRICING["gpt-4o-mini"];
    }
    return OPENAI_PRICING["gpt-4o"];
  }
  if (modelLower.startsWith("gpt-4-turbo")) {
    return OPENAI_PRICING["gpt-4-turbo"];
  }
  if (modelLower.startsWith("gpt-4")) {
    if (modelLower.includes("32k")) {
      return OPENAI_PRICING["gpt-4-32k"];
    }
    return OPENAI_PRICING["gpt-4"];
  }
  if (modelLower.startsWith("gpt-3.5-turbo")) {
    if (modelLower.includes("16k")) {
      return OPENAI_PRICING["gpt-3.5-turbo-16k"];
    }
    return OPENAI_PRICING["gpt-3.5-turbo"];
  }
  if (modelLower.startsWith("o1")) {
    if (modelLower.includes("mini")) {
      return OPENAI_PRICING["o1-mini"];
    }
    return OPENAI_PRICING["o1"];
  }
  if (modelLower.startsWith("o3")) {
    if (modelLower.includes("mini")) {
      return OPENAI_PRICING["o3-mini"];
    }
    return OPENAI_PRICING["o3"];
  }

  // Default fallback to GPT-4o pricing
  return OPENAI_PRICING["gpt-4o"];
}
