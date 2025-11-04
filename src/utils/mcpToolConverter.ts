import type { MCPTool } from "@/mcp/types.js";

// Tool type for provider compatibility (unified format)
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

/**
 * Convert MCP tool to unified Tool format (for provider conversion)
 */
export function mcpToolToUnified(mcpTool: MCPTool): Tool {
  return {
    type: "function",
    function: {
      name: mcpTool.name,
      description: mcpTool.description || "",
      parameters: mcpTool.inputSchema,
    },
  };
}

/**
 * Convert MCP tool result to provider tool result format
 */
export function mcpToolResultToProviderResult(mcpResult: {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}): string {
  // Extract text content from MCP result
  const textContents = mcpResult.content
    .filter((item) => item.type === "text")
    .map((item) => item.text || "")
    .join("\n");

  if (textContents) {
    return textContents;
  }

  // If no text, return JSON representation
  return JSON.stringify(mcpResult.content, null, 2);
}
