/**
 * Shared types for all AI providers
 */

import type { CostResult } from "@/utils/costTracker/types.js";

// Tool definition (unified format)
export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
      additionalProperties?: boolean;
    };
  };
};

// Tool call (from assistant)
export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
};

// Tool result (from client)
export type ToolResult = {
  tool_call_id: string;
  role: "tool";
  content: string;
  name?: string; // Optional, for Anthropic compatibility
};

// Extended message content (can be string, tool-related content, or null)
export type MessageContent =
  | string
  | null // null is allowed when assistant has tool_calls but no text content
  | Array<{
      type: "text" | "tool_use" | "tool_result";
      text?: string;
      tool_use_id?: string;
      name?: string;
      input?: Record<string, any>;
      content?: string;
    }>;

// Extended message type (backward compatible)
export type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: MessageContent;
  tool_calls?: ToolCall[]; // OpenAI/Mistral format
  tool_call_id?: string; // For tool role messages
  name?: string; // For tool role messages
};

export type Provider = "openai" | "anthropic" | "mistral";

// Extended provider response with tool calls
export type ProviderResponse = {
  provider: string;
  message: {
    role: string;
    content: string | null; // Can be null if only tool calls
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
  tool_calls?: ToolCall[];
};

export type StreamingErrorEvent = {
  error: string;
  detail?: string;
};
