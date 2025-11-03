import axios from "axios";
import { config } from "@/config.js";
import type { Message, ProviderResponse } from "./types.js";

type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number; // Calculated for consistency
};

type AnthropicResponse = {
  content: Array<{
    type: string;
    text: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

export async function handleAnthropic(
  model: string,
  messages: Message[]
): Promise<ProviderResponse> {
  const response = await axios.post<AnthropicResponse>(
    "https://api.anthropic.com/v1/messages",
    { model, max_tokens: 512, messages },
    {
      headers: {
        "x-api-key": config.anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    }
  );

  const { content, usage } = response.data;

  // Extract token usage - Anthropic provides input_tokens and output_tokens
  // Calculate total_tokens for consistency with cost tracker
  const tokenUsage: AnthropicUsage = {
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    total_tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
  };

  // Anthropic returns content as an array of objects with text
  const messageContent = content?.[0]?.text || "";

  return {
    provider: "anthropic",
    message: {
      role: "assistant",
      content: messageContent,
    },
    usage: tokenUsage,
  };
}
