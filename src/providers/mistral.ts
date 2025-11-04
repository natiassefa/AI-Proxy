import axios from "axios";
import { config } from "@/config.js";
import type { Message, ProviderResponse, ToolCall } from "./types.js";
import type { Tool } from "@/utils/mcpToolConverter.js";

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
        type: "function";
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
    messages: messages.map((msg) => {
      const msgObj: any = {
        role: msg.role,
        content: msg.content,
      };
      if (msg.tool_calls) {
        msgObj.tool_calls = msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: tc.function,
        }));
      }
      if (msg.tool_call_id) {
        msgObj.tool_call_id = msg.tool_call_id;
      }
      if (msg.name) {
        msgObj.name = msg.name;
      }
      return msgObj;
    }),
  };

  // Add tools if provided
  if (tools && tools.length > 0) {
    requestBody.tools = tools;
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
  const message = choices?.[0]?.message;

  // Extract token usage
  const tokenUsage: MistralUsage = {
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
  };

  // Extract tool calls if present
  const toolCalls: ToolCall[] | undefined = message?.tool_calls?.map((tc) => ({
    id: tc.id,
    type: tc.type,
    function: {
      name: tc.function.name,
      arguments: tc.function.arguments,
    },
  }));

  return {
    provider: "mistral",
    message: {
      role: message?.role || "assistant",
      content: message?.content ?? null,
      tool_calls: toolCalls,
    },
    usage: tokenUsage,
  };
}
