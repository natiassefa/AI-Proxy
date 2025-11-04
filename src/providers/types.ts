/**
 * Shared types for all AI providers
 */

import type { CostResult } from "@/utils/costTracker/types.js";

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type Provider = "openai" | "anthropic" | "mistral";

export type ProviderResponse = {
  provider: string;
  message: { role: string; content: string };
  usage: TokenUsage;
};

export type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

export type StreamingChunk = {
  content: string;
  role: string;
};

export type StreamingDoneEvent = {
  usage: TokenUsage;
  cost: CostResult | null;
  latency_ms: number;
};

export type StreamingErrorEvent = {
  error: string;
  detail?: string;
};
