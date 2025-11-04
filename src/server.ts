import Fastify from "fastify";
import { registerChatRoute } from "./routes/chat.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerMCPRoute } from "./routes/mcp.js";
import { logger } from "./utils/logger.js";
import { checkConfig, config } from "./config.js";
import { MCPManager } from "./mcp/manager.js";

let mcpManager: MCPManager | null = null;

export const buildServer = async () => {
  const app = Fastify({ logger: false });
  app.register(registerHealthRoute);
  app.register(registerChatRoute, { prefix: "/v1" });
  app.register(registerMCPRoute, { prefix: "/v1" });

  // Initialize MCP Manager if servers are configured
  if (config.mcpServers && config.mcpServers.length > 0) {
    mcpManager = new MCPManager();
    try {
      await mcpManager.initializeServers(config.mcpServers);
    } catch (err: any) {
      logger.error(`Failed to initialize MCP servers: ${err.message}`);
    }
  }

  // Store MCP manager in app context for route access
  app.decorate("mcpManager", mcpManager);

  return app;
};

export const startServer = async () => {
  const app = await buildServer();
  const port = Number(process.env.PORT) || 8080;
  checkConfig();

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down server...");
    if (mcpManager) {
      await mcpManager.shutdown();
    }
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  try {
    await app.listen({ port, host: "0.0.0.0" });
    logger.info(`🚀 AI Proxy running on http://localhost:${port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

// Extend Fastify types for MCP manager
declare module "fastify" {
  interface FastifyInstance {
    mcpManager: MCPManager | null;
  }
}
