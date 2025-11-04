import axios from "axios";
import { config } from "@/config.js";
import type { Message, ProviderResponse, ToolCall } from "./types.js";
import type { Tool } from "@/utils/mcpToolConverter.js";

type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number; // Calculated for consistency
};

type AnthropicResponse = {
  content: Array<{
    type: string;
    text?: string;
    tool_use?: {
      id: string;
      name: string;
      input: Record<string, any>;
    };
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
  // Convert messages to Anthropic format
  const anthropicMessages = messages.map((msg) => {
    if (msg.role === "tool") {
      // Anthropic uses tool_result content blocks
      return {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id!,
            content: msg.content,
          },
        ],
      };
    }
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // This shouldn't happen in Anthropic format, but handle it
      return {
        role: msg.role,
        content: msg.content,
      };
    }
    return {
      role: msg.role,
      content: msg.content,
    };
  });

  const requestBody: any = {
    model,
    max_tokens: 512,
    messages: anthropicMessages,
  };

  // Convert tools to Anthropic format
  if (tools && tools.length > 0) {
    requestBody.tools = tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }));
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

  // Extract token usage
  const tokenUsage: AnthropicUsage = {
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    total_tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
  };

  // Extract text content and tool calls
  let messageContent: string | null = null;
  const toolCalls: ToolCall[] = [];

  for (const block of content) {
    if (block.type === "text" && block.text) {
      messageContent = (messageContent || "") + block.text;
    } else if (block.type === "tool_use" && block.tool_use) {
      toolCalls.push({
        id: block.tool_use.id,
        type: "function",
        function: {
          name: block.tool_use.name,
          arguments: JSON.stringify(block.tool_use.input),
        },
      });
    }
  }

  return {
    provider: "anthropic",
    message: {
      role: "assistant",
      content: messageContent,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    },
    usage: tokenUsage,
  };
}
