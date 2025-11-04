import axios from "axios";
import { config } from "@/config.js";
import {
  toolsToAnthropic,
  messagesToAnthropic,
  anthropicToolUseToUnified,
} from "./tools/converter.js";
import type { Message, ProviderResponse, Tool } from "./types.js";

type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number; // Calculated for consistency
};

type AnthropicResponse = {
  content: Array<{
    type: string;
    text?: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

export async function handleAnthropic(
  model: string,
  messages: Message[],
  tools?: Tool[]
): Promise<ProviderResponse> {
  const requestBody: any = {
    model,
    max_tokens: 512,
    messages: messagesToAnthropic(messages),
  };

  // Add tools if provided
  if (tools && tools.length > 0) {
    requestBody.tools = toolsToAnthropic(tools);
  }

  const response = await axios.post<AnthropicResponse>(
    "https://api.anthropic.com/v1/messages",
    requestBody,
    {
      headers: {
        "x-api-key": config.anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    }
  );

  const { content, usage } = response.data;

  // Extract text content and tool use
  const textContent =
    content.find((item: any) => item.type === "text")?.text || null;
  const toolCalls = anthropicToolUseToUnified(content);

  // Extract token usage - Anthropic provides input_tokens and output_tokens
  // Calculate total_tokens for consistency with cost tracker
  const tokenUsage: AnthropicUsage = {
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    total_tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
  };

  return {
    provider: "anthropic",
    message: {
      role: "assistant",
      content: textContent,
      tool_calls: toolCalls,
    },
    usage: tokenUsage,
  };
}
