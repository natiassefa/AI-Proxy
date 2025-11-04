import Fastify from "fastify";
import { registerChatRoute } from "./routes/chat.js";
import { registerHealthRoute } from "./routes/health.js";
import { logger } from "./utils/logger.js";
import { checkConfig } from "./config.js";

export const buildServer = async () => {
  const app = Fastify({ logger: false });
  app.register(registerHealthRoute);
  app.register(registerChatRoute, { prefix: "/v1" });
  return app;
};

export const startServer = async () => {
  const app = await buildServer();
  const port = Number(process.env.PORT) || 8080;
  checkConfig();
  try {
    await app.listen({ port, host: "0.0.0.0" });
    logger.info(`🚀 AI Proxy running on http://localhost:${port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};
