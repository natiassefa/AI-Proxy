/**
 * Anthropic model pricing (per million tokens)
 * Source: https://docs.claude.com/en/docs/about-claude/models/overview
 */

import type { PricingRates } from "../types.js";

export const ANTHROPIC_PRICING: Record<string, PricingRates> = {
  // Latest models
  "claude-sonnet-4-5": { input_per_mtok: 3.0, output_per_mtok: 15.0 },
  "claude-haiku-4-5": { input_per_mtok: 1.0, output_per_mtok: 5.0 },
  "claude-opus-4-1": { input_per_mtok: 15.0, output_per_mtok: 75.0 },
  // Legacy models
  "claude-sonnet-4": { input_per_mtok: 3.0, output_per_mtok: 15.0 },
  "claude-3-7-sonnet": { input_per_mtok: 3.0, output_per_mtok: 15.0 },
  "claude-opus-4": { input_per_mtok: 15.0, output_per_mtok: 75.0 },
  "claude-3-5-haiku": { input_per_mtok: 0.8, output_per_mtok: 4.0 },
  "claude-3-haiku": { input_per_mtok: 0.25, output_per_mtok: 1.25 },
  // Aliases (fallback to latest)
  "claude-sonnet-4-5-20250929": { input_per_mtok: 3.0, output_per_mtok: 15.0 },
  "claude-haiku-4-5-20251001": { input_per_mtok: 1.0, output_per_mtok: 5.0 },
  "claude-opus-4-1-20250805": { input_per_mtok: 15.0, output_per_mtok: 75.0 },
};

/**
 * Get Anthropic pricing for a model
 * Handles model name variations and aliases
 */
export function getAnthropicPricing(model: string): PricingRates | null {
  const modelLower = model.toLowerCase();

  // Try exact match first
  if (ANTHROPIC_PRICING[modelLower]) {
    return ANTHROPIC_PRICING[modelLower];
  }

  // Try pattern matching for model families
  if (modelLower.includes("sonnet-4")) {
    return ANTHROPIC_PRICING["claude-sonnet-4-5"];
  }
  if (modelLower.includes("haiku-4")) {
    return ANTHROPIC_PRICING["claude-haiku-4-5"];
  }
  if (modelLower.includes("opus-4")) {
    return ANTHROPIC_PRICING["claude-opus-4-1"];
  }
  if (modelLower.includes("sonnet-3")) {
    return ANTHROPIC_PRICING["claude-3-7-sonnet"];
  }
  if (modelLower.includes("haiku-3")) {
    // Try to match 3.5 vs 3
    if (modelLower.includes("3.5") || modelLower.includes("3-5")) {
      return ANTHROPIC_PRICING["claude-3-5-haiku"];
    }
    return ANTHROPIC_PRICING["claude-3-haiku"];
  }

  // Default fallback to Sonnet 4.5 pricing
  return ANTHROPIC_PRICING["claude-sonnet-4-5"];
}
