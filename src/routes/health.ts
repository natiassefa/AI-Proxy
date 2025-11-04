import { FastifyInstance } from "fastify";
import { logger } from "@/utils/logger.js";

export async function registerHealthRoute(app: FastifyInstance) {
  app.get("/", async (req, res) => {
    logger.info(`Health check requested by ${req.ip}`);
    const mcpStatus = app.mcpManager
      ? {
          enabled: true,
          serverCount: app.mcpManager.getServers().length,
          toolCount: app.mcpManager.getTools().length,
        }
      : { enabled: false };

    return res.send({
      status: "ok",
      service: "AI Proxy",
      mcp: mcpStatus,
    });
  });
}
