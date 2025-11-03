/**
 * Cost calculator for Anthropic models
 */

import type { TokenUsage } from "@/providers/types.js";
import type { CostResult, PricingRates } from "../types.js";
import { getAnthropicPricing } from "../pricing/anthropic.js";

/**
 * Calculate cost for Anthropic models
 * Uses separate input and output token pricing
 */
export function calculateAnthropicCost(
  model: string,
  usage: TokenUsage
): CostResult | null {
  const pricing = getAnthropicPricing(model);
  if (!pricing) return null;

  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const totalTokens = usage.total_tokens || inputTokens + outputTokens;

  // Calculate costs per million tokens
  const inputCost = (inputTokens / 1_000_000) * pricing.input_per_mtok;
  const outputCost = (outputTokens / 1_000_000) * pricing.output_per_mtok;
  const totalCost = inputCost + outputCost;

  return {
    total_tokens: totalTokens,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: totalCost.toFixed(6),
    input_cost_usd: inputCost > 0 ? inputCost.toFixed(6) : undefined,
    output_cost_usd: outputCost > 0 ? outputCost.toFixed(6) : undefined,
  };
}
