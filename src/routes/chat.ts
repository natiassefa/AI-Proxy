import { FastifyInstance } from "fastify";
import { z } from "zod";
import { handleProviderRequest } from "@/providers/base.js";
import { cache } from "@/utils/cache.js";
import { logger } from "@/utils/logger.js";
import {
  getSchemaDescription,
  getSchemaAsJSON,
} from "@/utils/schemaFormatter.js";

const ChatSchema = z.object({
  provider: z.enum(["openai", "anthropic", "mistral"]),
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    })
  ),
});

export async function registerChatRoute(app: FastifyInstance) {
  app.post("/chat", async (req, res) => {
    const parsed = ChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).send({
        error: "Invalid request",
        details: parsed.error.format(),
        expectedSchema: {
          structure: getSchemaAsJSON(ChatSchema),
          example: {
            provider: "openai",
            model: "gpt-4-turbo",
            messages: [{ role: "user", content: "Hello" }],
          },
        },
      });
    }

    const { provider, model, messages } = parsed.data;
    const cacheKey = `${provider}:${model}:${JSON.stringify(messages)}`;

    // Try to get from cache (returns null if Redis is not configured)
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info(`Cache hit for ${provider}:${model}`);
      return res.send(JSON.parse(cached));
    }

    try {
      const response = await handleProviderRequest(provider, model, messages);

      // Try to cache the response (does nothing if Redis is not configured)
      await cache.set(cacheKey, JSON.stringify(response), 600);

      return res.send(response);
    } catch (err: any) {
      logger.error(err);
      return res
        .status(500)
        .send({ error: "Provider request failed", detail: err.message });
    }
  });
}
