import axios from "axios";
import { config } from "@/config.js";
import type { Message, ProviderResponse } from "./types.js";

type OpenAIUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type OpenAIResponse = {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  usage: OpenAIUsage;
};

export async function handleOpenAI(
  model: string,
  messages: Message[]
): Promise<ProviderResponse> {
  const response = await axios.post<OpenAIResponse>(
    "https://api.openai.com/v1/chat/completions",
    { model, messages },
    {
      headers: {
        Authorization: `Bearer ${config.openaiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  const { choices, usage } = response.data;

  // Extract token usage - OpenAI provides prompt_tokens, completion_tokens, and total_tokens
  const tokenUsage: OpenAIUsage = {
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
  };

  return {
    provider: "openai",
    message: choices?.[0]?.message || { role: "assistant", content: "" },
    usage: tokenUsage,
  };
}
