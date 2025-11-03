/**
 * Shared types for cost tracking
 */

export type CostResult = {
  total_tokens: number;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost_usd: string;
  input_cost_usd?: string;
  output_cost_usd?: string;
};

export type PricingRates = {
  input_per_mtok: number; // Cost per million input tokens
  output_per_mtok: number; // Cost per million output tokens
};
