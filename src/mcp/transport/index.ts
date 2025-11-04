import { MCPClient } from "../client.js";
import { StdioMCPClient } from "./stdio.js";
import type { MCPServerConfig } from "../types.js";
import { logger } from "@/utils/logger.js";

export function createMCPClient(config: MCPServerConfig): MCPClient {
  switch (config.transport) {
    case "stdio":
      return new StdioMCPClient(config);
    case "sse":
    case "http":
      throw new Error(`Transport ${config.transport} not yet implemented`);
    default:
      throw new Error(`Unknown transport type: ${config.transport}`);
  }
}
