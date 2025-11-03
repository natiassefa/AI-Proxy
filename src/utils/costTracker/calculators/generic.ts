/**
 * Generic cost calculator for providers without detailed pricing
 */

import type { Provider, TokenUsage } from "@/providers/types.js";
import type { CostResult } from "../types.js";

/**
 * Calculate cost for other providers (Mistral, or fallback)
 * Uses simple per-token pricing as fallback
 */
export function calculateGenericCost(
  provider: Provider,
  usage: TokenUsage
): CostResult | null {
  // Rough per-1K token cost in USD (fallback rates)
  const rates: Record<Provider, number> = {
    openai: 0.002,
    anthropic: 0.0015, // This shouldn't be used, but kept for backwards compatibility
    mistral: 0.001,
  };

  const totalTokens =
    usage.total_tokens ||
    usage.input_tokens ||
    usage.prompt_tokens ||
    usage.completion_tokens ||
    0;

  const cost = (totalTokens / 1000) * (rates[provider] || 0);

  return {
    total_tokens: totalTokens,
    estimated_cost_usd: cost.toFixed(6),
  };
}
