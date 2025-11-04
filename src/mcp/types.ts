/**
 * MCP Protocol Types
 * Based on Model Context Protocol specification
 */

// JSON-RPC 2.0 base types
export type JSONRPCRequest = {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: any;
};

export type JSONRPCResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: JSONRPCError;
};

export type JSONRPCError = {
  code: number;
  message: string;
  data?: any;
};

// MCP Protocol Methods
export type MCPMethod =
  | "initialize"
  | "tools/list"
  | "tools/call"
  | "resources/list"
  | "resources/read"
  | "prompts/list"
  | "prompts/get";

// MCP Initialize
export type MCPInitializeParams = {
  protocolVersion: string;
  capabilities: {
    roots?: {
      listChanged?: boolean;
    };
    sampling?: Record<string, any>;
  };
  clientInfo: {
    name: string;
    version: string;
  };
};

export type MCPInitializeResult = {
  protocolVersion: string;
  capabilities: {
    tools?: {
      listChanged?: boolean;
    };
    resources?: {
      subscribe?: boolean;
      listChanged?: boolean;
    };
    prompts?: {
      listChanged?: boolean;
    };
    sampling?: Record<string, any>;
  };
  serverInfo: {
    name: string;
    version: string;
  };
};

// MCP Tools
export type MCPTool = {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

export type MCPListToolsResult = {
  tools: MCPTool[];
};

export type MCPCallToolParams = {
  name: string;
  arguments?: Record<string, any>;
};

export type MCPCallToolResult = {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
};

// MCP Resources (optional, for future use)
export type MCPResource = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};

export type MCPListResourcesResult = {
  resources: MCPResource[];
};

// MCP Server Configuration
export type MCPServerConfig = {
  name: string;
  transport: "stdio" | "sse" | "http";
  command?: string; // For stdio transport
  args?: string[]; // For stdio transport
  env?: Record<string, string>; // For stdio transport
  url?: string; // For HTTP/SSE transport
  headers?: Record<string, string>; // For HTTP/SSE transport
  timeout?: number; // Optional timeout in milliseconds (default: 30000)
  reconnectDelay?: number; // For SSE: initial reconnect delay in ms (default: 1000)
  maxReconnectAttempts?: number; // For SSE: max reconnect attempts (default: 5)
};

// MCP Client State
export type MCPClientState =
  | "disconnected"
  | "connecting"
  | "initializing"
  | "ready"
  | "error";
