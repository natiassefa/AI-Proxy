/**
 * Shared types for all AI providers
 */

import type { CostResult } from "@/utils/costTracker/types.js";
import type { Tool } from "@/utils/mcpToolConverter.js";

export type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
};

export type Provider = "openai" | "anthropic" | "mistral";

export type ProviderResponse = {
  provider: string;
  message: {
    role: string;
    content: string | null;
    tool_calls?: ToolCall[];
  };
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
