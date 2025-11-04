import type { Tool, ToolCall, Message } from "../types.js";

// Convert unified tool format to OpenAI format
export function toolsToOpenAI(tools: Tool[]): any[] {
  return tools.map((tool) => ({
    type: tool.type,
    function: tool.function,
  }));
}

// Convert unified tool format to Anthropic format
export function toolsToAnthropic(tools: Tool[]): any[] {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description || "",
    input_schema: tool.function.parameters,
  }));
}

// Convert unified tool format to Mistral format
export function toolsToMistral(tools: Tool[]): any[] {
  return tools.map((tool) => ({
    type: tool.type,
    function: tool.function,
  }));
}

// Convert OpenAI response tool calls to unified format
export function openAIToolCallsToUnified(
  choices: any[]
): ToolCall[] | undefined {
  const toolCalls = choices[0]?.message?.tool_calls;
  if (!toolCalls || toolCalls.length === 0) return undefined;

  return toolCalls.map((tc: any) => ({
    id: tc.id,
    type: tc.type,
    function: {
      name: tc.function.name,
      arguments: tc.function.arguments,
    },
  }));
}

// Convert Anthropic response tool use to unified format
export function anthropicToolUseToUnified(
  content: any[]
): ToolCall[] | undefined {
  const toolUses = content.filter((item: any) => item.type === "tool_use");
  if (toolUses.length === 0) return undefined;

  return toolUses.map((tu: any) => ({
    id: tu.id,
    type: "function",
    function: {
      name: tu.name,
      arguments: JSON.stringify(tu.input),
    },
  }));
}

// Convert Mistral response tool calls to unified format
export function mistralToolCallsToUnified(
  choices: any[]
): ToolCall[] | undefined {
  const toolCalls = choices[0]?.message?.tool_calls;
  if (!toolCalls || toolCalls.length === 0) return undefined;

  return toolCalls.map((tc: any) => ({
    id: tc.id,
    type: tc.type,
    function: {
      name: tc.function.name,
      arguments: tc.function.arguments,
    },
  }));
}

// Convert unified messages to OpenAI format
export function messagesToOpenAI(messages: Message[]): any[] {
  return messages.map((msg) => {
    const openAIMsg: any = {
      role: msg.role,
    };

    if (msg.role === "tool") {
      openAIMsg.content = msg.content;
      openAIMsg.tool_call_id = msg.tool_call_id;
    } else if (msg.role === "assistant" && msg.tool_calls) {
      openAIMsg.content = typeof msg.content === "string" ? msg.content : null;
      openAIMsg.tool_calls = msg.tool_calls.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: tc.function,
      }));
    } else {
      openAIMsg.content =
        typeof msg.content === "string" ? msg.content : msg.content;
    }

    return openAIMsg;
  });
}

// Convert unified messages to Anthropic format
export function messagesToAnthropic(messages: Message[]): any[] {
  return messages.map((msg) => {
    if (msg.role === "system") {
      return {
        role: "user",
        content:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
      };
    }

    if (msg.role === "tool") {
      // Anthropic uses tool_result content blocks
      return {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id!,
            content:
              typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content),
          },
        ],
      };
    }

    if (msg.role === "assistant" && msg.tool_calls) {
      // Convert tool calls to tool_use content blocks
      const content: any[] = [];
      if (typeof msg.content === "string" && msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      msg.tool_calls.forEach((tc) => {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      });
      return { role: "assistant", content };
    }

    // Regular user/assistant message
    if (Array.isArray(msg.content)) {
      return { role: msg.role, content: msg.content };
    }
    return { role: msg.role, content: msg.content };
  });
}

// Convert unified messages to Mistral format
export function messagesToMistral(messages: Message[]): any[] {
  return messages.map((msg) => {
    const mistralMsg: any = {
      role: msg.role,
    };

    if (msg.role === "tool") {
      mistralMsg.content = msg.content;
      mistralMsg.tool_call_id = msg.tool_call_id;
    } else if (msg.role === "assistant" && msg.tool_calls) {
      mistralMsg.content = typeof msg.content === "string" ? msg.content : null;
      mistralMsg.tool_calls = msg.tool_calls.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: tc.function,
      }));
    } else {
      mistralMsg.content =
        typeof msg.content === "string" ? msg.content : msg.content;
    }

    return mistralMsg;
  });
}
