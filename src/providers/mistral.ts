import axios from "axios";
import { config } from "@/config.js";
import type { Message, ProviderResponse } from "./types.js";

type MistralUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type MistralResponse = {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  usage: MistralUsage;
};

export async function handleMistral(
  model: string,
  messages: Message[]
): Promise<ProviderResponse> {
  const response = await axios.post<MistralResponse>(
    "https://api.mistral.ai/v1/chat/completions",
    { model, messages },
    {
      headers: {
        Authorization: `Bearer ${config.mistralKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  const { choices, usage } = response.data;

  // Extract token usage - Mistral provides prompt_tokens, completion_tokens, and total_tokens
  const tokenUsage: MistralUsage = {
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
  };

  return {
    provider: "mistral",
    message: choices?.[0]?.message || { role: "assistant", content: "" },
    usage: tokenUsage,
  };
}
