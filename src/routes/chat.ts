import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  handleProviderRequest,
  handleStreamingRequest,
} from "@/providers/base.js";
import { cache } from "@/utils/cache.js";
import { logger } from "@/utils/logger.js";
import { sendSSEError } from "@/utils/sse.js";
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
  stream: z.boolean().optional(),
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

    // Detect streaming request
    const queryStream = (req.query as { stream?: string | boolean })?.stream;
    const isStreaming =
      queryStream === "true" ||
      queryStream === true ||
      parsed.data.stream === true;

    const { provider, model, messages } = parsed.data;

    // Route to streaming handler if requested
    if (isStreaming) {
      // Set a reasonable timeout (e.g., 5 minutes)
      req.raw.setTimeout(5 * 60 * 1000);

      req.raw.on("timeout", () => {
        logger.warn(`Streaming request timeout for ${provider}:${model}`);
        if (!res.raw.writableEnded) {
          sendSSEError(
            res,
            "Request timeout",
            "Stream exceeded maximum duration"
          );
        }
      });

      try {
        await handleStreamingRequest(provider, model, messages, res);
      } catch (err: any) {
        logger.error("Streaming error:", err);
        if (!res.raw.writableEnded) {
          return res.status(500).send({
            error: "Streaming failed",
            detail: err.message,
          });
        }
      }
      return; // Streaming handles its own response
    }

    // Existing non-streaming logic (unchanged)
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
