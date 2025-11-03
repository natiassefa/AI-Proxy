/**
 * Cost Tracker Module
 *
 * Main entry point for cost tracking functionality.
 * Provides unified interface for calculating costs across different AI providers.
 */

import type { Provider, TokenUsage } from "@/providers/types.js";
import { calculateAnthropicCost } from "./calculators/anthropic.js";
import { calculateOpenAICost } from "./calculators/openai.js";
import { calculateMistralCost } from "./calculators/mistral.js";
import { calculateGenericCost } from "./calculators/generic.js";
import type { CostResult } from "./types.js";

export type { CostResult } from "./types.js";

/**
 * Track cost for a provider request
 *
 * @param provider - The AI provider (openai, anthropic, mistral)
 * @param usage - Token usage information from the API response
 * @param model - Optional model name for accurate per-model pricing
 * @returns CostResult with detailed cost breakdown, or null if usage is invalid
 */
export function trackCost(
  provider: Provider,
  usage: TokenUsage | null | undefined,
  model?: string
): CostResult | null {
  if (!usage) return null;

  // Use comprehensive pricing for Anthropic
  if (provider === "anthropic" && model) {
    return calculateAnthropicCost(model, usage);
  }

  // Use comprehensive pricing for OpenAI
  if (provider === "openai" && model) {
    return calculateOpenAICost(model, usage);
  }

  // Use comprehensive pricing for Mistral
  if (provider === "mistral" && model) {
    return calculateMistralCost(model, usage);
  }

  // Fallback to generic pricing for other providers or when model is not provided
  return calculateGenericCost(provider, usage);
}
