import { FastifyInstance } from "fastify";
import { z } from "zod";
import { logger } from "@/utils/logger.js";

export async function registerMCPRoute(app: FastifyInstance) {
  // List all available MCP tools
  app.get("/mcp/tools", async (req, res) => {
    const mcpManager = app.mcpManager;

    if (!mcpManager) {
      return res.status(503).send({
        error: "MCP not available",
        message: "No MCP servers configured",
      });
    }

    try {
      const tools = mcpManager.getTools();
      return res.send({
        tools: tools.map(({ server, tool }) => ({
          name: tool.name,
          description: tool.description,
          server,
          inputSchema: tool.inputSchema,
        })),
      });
    } catch (err: any) {
      logger.error("Error listing MCP tools:", err);
      return res.status(500).send({
        error: "Failed to list tools",
        detail: err.message,
      });
    }
  });

  // Get information about a specific tool
  app.get("/mcp/tools/:name", async (req, res) => {
    const mcpManager = app.mcpManager;
    const { name } = req.params as { name: string };

    if (!mcpManager) {
      return res.status(503).send({
        error: "MCP not available",
        message: "No MCP servers configured",
      });
    }

    try {
      const toolInfo = mcpManager.getTool(name);
      if (!toolInfo) {
        return res.status(404).send({
          error: "Tool not found",
          message: `Tool '${name}' not found in any MCP server`,
        });
      }

      return res.send({
        name: toolInfo.tool.name,
        description: toolInfo.tool.description,
        server: toolInfo.server,
        inputSchema: toolInfo.tool.inputSchema,
      });
    } catch (err: any) {
      logger.error(`Error getting tool ${name}:`, err);
      return res.status(500).send({
        error: "Failed to get tool",
        detail: err.message,
      });
    }
  });

  // List MCP servers and their status
  app.get("/mcp/servers", async (req, res) => {
    const mcpManager = app.mcpManager;

    if (!mcpManager) {
      return res.status(503).send({
        error: "MCP not available",
        message: "No MCP servers configured",
      });
    }

    try {
      const servers: Array<{
        name: string;
        state: string;
        info: { name: string; version: string } | null;
        toolCount: number;
      }> = [];

      // Get all tools grouped by server
      const tools = mcpManager.getTools();
      const serverToolCounts = new Map<string, number>();
      for (const { server } of tools) {
        serverToolCounts.set(server, (serverToolCounts.get(server) || 0) + 1);
      }

      // Get server info
      const serverEntries = mcpManager.getServers();
      for (const { name, client } of serverEntries) {
        servers.push({
          name,
          state: client.getState(),
          info: client.getServerInfo(),
          toolCount: serverToolCounts.get(name) || 0,
        });
      }

      return res.send({ servers });
    } catch (err: any) {
      logger.error("Error listing MCP servers:", err);
      return res.status(500).send({
        error: "Failed to list servers",
        detail: err.message,
      });
    }
  });

  // Helper function to get tools for a server
  async function getServerTools(serverName: string, res: any) {
    const mcpManager = app.mcpManager;

    if (!mcpManager) {
      return res.status(503).send({
        error: "MCP not available",
        message: "No MCP servers configured",
      });
    }

    try {
      // Check if server exists
      const server = mcpManager.getServer(serverName);
      if (!server) {
        return res.status(404).send({
          error: "Server not found",
          message: `MCP server '${serverName}' not found`,
        });
      }

      // Get tools for this server
      const serverTools = mcpManager.getToolsForServer(serverName);

      return res.send({
        server: serverName,
        state: server.getState(),
        info: server.getServerInfo(),
        tools: serverTools.map(({ tool }) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
        toolCount: serverTools.length,
      });
    } catch (err: any) {
      logger.error(`Error getting tools for server ${serverName}:`, err);
      return res.status(500).send({
        error: "Failed to get server tools",
        detail: err.message,
      });
    }
  }

  // Get tools for a specific server (shorter route: /mcp/:serverName/tools)
  app.get("/mcp/:serverName/tools", async (req, res) => {
    const { serverName } = req.params as { serverName: string };
    return getServerTools(serverName, res);
  });

  // Get tools for a specific server (longer route: /mcp/servers/:serverName/tools)
  app.get("/mcp/servers/:serverName/tools", async (req, res) => {
    const { serverName } = req.params as { serverName: string };
    return getServerTools(serverName, res);
  });

  // Call an MCP tool directly (for testing)
  const CallToolSchema = z.object({
    arguments: z.record(z.any()).optional(),
  });

  app.post("/mcp/tools/:name/call", async (req, res) => {
    const mcpManager = app.mcpManager;
    const { name } = req.params as { name: string };

    if (!mcpManager) {
      return res.status(503).send({
        error: "MCP not available",
        message: "No MCP servers configured",
      });
    }

    const parsed = CallToolSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).send({
        error: "Invalid request",
        details: parsed.error.format(),
      });
    }

    try {
      const result = await mcpManager.callTool(name, parsed.data.arguments);
      return res.send(result);
    } catch (err: any) {
      logger.error(`Error calling tool ${name}:`, err);
      return res.status(500).send({
        error: "Tool execution failed",
        detail: err.message,
      });
    }
  });
}
