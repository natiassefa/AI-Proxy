import { MCPClient } from "../client.js";
import { StdioMCPClient } from "./stdio.js";
import { HTTPMCPClient } from "./http.js";
import { SSEMCPClient } from "./sse.js";
import type { MCPServerConfig } from "../types.js";
import { logger } from "@/utils/logger.js";

export function createMCPClient(config: MCPServerConfig): MCPClient {
  switch (config.transport) {
    case "stdio":
      return new StdioMCPClient(config);
    case "http":
      return new HTTPMCPClient(config);
    case "sse":
      return new SSEMCPClient(config);
    default:
      throw new Error(`Unknown transport type: ${config.transport}`);
  }
}
