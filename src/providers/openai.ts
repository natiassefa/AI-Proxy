import axios from "axios";
import { config } from "@/config.js";
import {
  toolsToOpenAI,
  messagesToOpenAI,
  openAIToolCallsToUnified,
} from "./tools/converter.js";
import type { Message, ProviderResponse, Tool } from "./types.js";

type OpenAIUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type OpenAIResponse = {
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
  usage: OpenAIUsage;
};

export async function handleOpenAI(
  model: string,
  messages: Message[],
  tools?: Tool[]
): Promise<ProviderResponse> {
  const requestBody: any = {
    model,
    messages: messagesToOpenAI(messages),
  };

  // Add tools if provided
  if (tools && tools.length > 0) {
    requestBody.tools = toolsToOpenAI(tools);
  }

  const response = await axios.post<OpenAIResponse>(
    "https://api.openai.com/v1/chat/completions",
    requestBody,
    {
      headers: {
        Authorization: `Bearer ${config.openaiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  const { choices, usage } = response.data;
  const message = choices?.[0]?.message || { role: "assistant", content: "" };

  // Extract tool calls if present
  const toolCalls = openAIToolCallsToUnified(choices);

  // Extract content (may be null if only tool calls)
  const content = message.content || null;

  // Extract token usage - OpenAI provides prompt_tokens, completion_tokens, and total_tokens
  const tokenUsage: OpenAIUsage = {
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
  };

  return {
    provider: "openai",
    message: {
      role: message.role,
      content: content,
      tool_calls: toolCalls,
    },
    usage: tokenUsage,
  };
}
