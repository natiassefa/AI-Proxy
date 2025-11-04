import axios from "axios";
import { config } from "@/config.js";
import {
  toolsToMistral,
  messagesToMistral,
  mistralToolCallsToUnified,
} from "./tools/converter.js";
import type { Message, ProviderResponse, Tool } from "./types.js";

type MistralUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type MistralResponse = {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
  usage: MistralUsage;
};

export async function handleMistral(
  model: string,
  messages: Message[],
  tools?: Tool[]
): Promise<ProviderResponse> {
  const requestBody: any = {
    model,
    messages: messagesToMistral(messages),
  };

  // Add tools if provided
  if (tools && tools.length > 0) {
    requestBody.tools = toolsToMistral(tools);
  }

  const response = await axios.post<MistralResponse>(
    "https://api.mistral.ai/v1/chat/completions",
    requestBody,
    {
      headers: {
        Authorization: `Bearer ${config.mistralKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  const { choices, usage } = response.data;
  const message = choices?.[0]?.message || { role: "assistant", content: "" };

  // Extract tool calls if present
  const toolCalls = mistralToolCallsToUnified(choices);

  // Extract content (may be null if only tool calls)
  const content = message.content || null;

  // Extract token usage - Mistral provides prompt_tokens, completion_tokens, and total_tokens
  const tokenUsage: MistralUsage = {
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
  };

  return {
    provider: "mistral",
    message: {
      role: message.role,
      content: content,
      tool_calls: toolCalls,
    },
    usage: tokenUsage,
  };
}
