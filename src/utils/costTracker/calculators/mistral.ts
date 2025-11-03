/**
 * Cost calculator for Mistral models
 */

import type { TokenUsage } from "@/providers/types.js";
import type { CostResult } from "../types.js";
import { getMistralPricing } from "../pricing/mistral.js";

/**
 * Calculate cost for Mistral models
 * Uses separate prompt (input) and completion (output) token pricing
 * Mistral uses prompt_tokens and completion_tokens (similar to OpenAI)
 */
export function calculateMistralCost(
  model: string,
  usage: TokenUsage
): CostResult | null {
  const pricing = getMistralPricing(model);
  if (!pricing) return null;

  // Mistral uses prompt_tokens and completion_tokens (similar to OpenAI)
  const inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
  const outputTokens = usage.completion_tokens || usage.output_tokens || 0;
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
