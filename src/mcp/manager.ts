import { EventEmitter } from "events";
import { createMCPClient } from "./transport/index.js";
import type { MCPServerConfig, MCPTool } from "./types.js";
import { logger } from "@/utils/logger.js";
import type { MCPClient } from "./client.js";

export class MCPManager extends EventEmitter {
  private clients = new Map<string, MCPClient>();
  private tools = new Map<string, { server: string; tool: MCPTool }>();

  async initializeServers(configs: MCPServerConfig[]): Promise<void> {
    logger.info(`Initializing ${configs.length} MCP server(s)`);

    for (const config of configs) {
      try {
        const client = createMCPClient(config);
        await client.initialize();
        this.clients.set(config.name, client);

        // Register tools
        const serverTools = client.getTools();
        for (const tool of serverTools) {
          this.tools.set(tool.name, { server: config.name, tool });
        }

        logger.info(
          `MCP server ${config.name} initialized with ${serverTools.length} tools`
        );
      } catch (err: any) {
        logger.error(
          `Failed to initialize MCP server ${config.name}: ${err.message}`
        );
        // Continue with other servers
      }
    }

    logger.info(
      `MCP Manager initialized: ${this.clients.size} server(s), ${this.tools.size} tool(s)`
    );
  }

  getTools(): Array<{ server: string; tool: MCPTool }> {
    return Array.from(this.tools.values());
  }

  getToolsForServer(
    serverName: string
  ): Array<{ server: string; tool: MCPTool }> {
    return Array.from(this.tools.values()).filter(
      (item) => item.server === serverName
    );
  }

  getTool(name: string): { server: string; tool: MCPTool } | undefined {
    return this.tools.get(name);
  }

  async callTool(name: string, args?: Record<string, any>): Promise<any> {
    const toolInfo = this.tools.get(name);
    if (!toolInfo) {
      throw new Error(`Tool not found: ${name}`);
    }

    const client = this.clients.get(toolInfo.server);
    if (!client) {
      throw new Error(`MCP server not found: ${toolInfo.server}`);
    }

    const startTime = Date.now();
    logger.info(`Calling MCP tool: ${name}`, { args });

    try {
      const result = await client.callTool(name, args);
      const duration = Date.now() - startTime;
      logger.info(`MCP tool ${name} completed in ${duration}ms`);
      return result;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      logger.error(
        `MCP tool ${name} failed after ${duration}ms: ${err.message}`,
        {
          tool: name,
          error: err.message,
        }
      );
      throw err;
    }
  }

  getServer(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  getServers(): Array<{ name: string; client: MCPClient }> {
    return Array.from(this.clients.entries()).map(([name, client]) => ({
      name,
      client,
    }));
  }

  async shutdown(): Promise<void> {
    logger.info("Shutting down MCP Manager");
    for (const [name, client] of this.clients) {
      try {
        await client.disconnect();
      } catch (err: any) {
        logger.error(`Error disconnecting MCP server ${name}: ${err.message}`);
      }
    }
    this.clients.clear();
    this.tools.clear();
  }
}
