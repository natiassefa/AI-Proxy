import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getToolSupport,
  getModelToolMetadata,
  supportsTools,
  getModelsWithToolSupport,
} from "@/providers/tools/metadata.js";
import { logger } from "@/utils/logger.js";
import {
  getSchemaDescription,
  getSchemaAsJSON,
} from "@/utils/schemaFormatter.js";

const ToolQuerySchema = z.object({
  provider: z.enum(["openai", "anthropic", "mistral"]),
  model: z.string().optional(), // Optional - if not provided, return all models for provider
});

export async function registerToolsRoute(app: FastifyInstance) {
  // Get tool support for specific model
  app.get("/tools", async (req, res) => {
    const query = (req.query as { provider?: string; model?: string }) || {};

    const parsed = ToolQuerySchema.safeParse({
      provider: query.provider,
      model: query.model,
    });

    if (!parsed.success) {
      return res.status(400).send({
        error: "Invalid request",
        details: parsed.error.format(),
        expectedSchema: {
          structure: getSchemaAsJSON(ToolQuerySchema),
          example: {
            provider: "openai",
            model: "gpt-4o",
          },
        },
      });
    }

    const { provider, model } = parsed.data;

    try {
      // If model is provided, return metadata for that specific model
      if (model) {
        const metadata = getModelToolMetadata(provider, model);

        if (!metadata) {
          return res.status(404).send({
            error: "Model not found",
            provider,
            model,
            message: `No metadata available for ${provider}:${model}. This model may not be supported or may not have tool support information.`,
          });
        }

        return res.send({
          provider: metadata.provider,
          model: metadata.model,
          support: metadata.support,
        });
      }

      // If model is not provided, return all models with tool support for the provider
      const models = getModelsWithToolSupport(provider);

      return res.send({
        provider,
        models: models.map((modelName) => {
          const metadata = getModelToolMetadata(provider, modelName);
          return {
            model: modelName,
            support: metadata?.support || null,
          };
        }),
      });
    } catch (err: any) {
      logger.error("Error fetching tool metadata:", err);
      return res.status(500).send({
        error: "Failed to fetch tool metadata",
        detail: err.message,
      });
    }
  });

  // Alternative route: /tools/:provider/:model
  app.get("/tools/:provider/:model", async (req, res) => {
    const params = req.params as { provider: string; model: string };

    const parsed = ToolQuerySchema.safeParse({
      provider: params.provider,
      model: params.model,
    });

    if (!parsed.success) {
      return res.status(400).send({
        error: "Invalid request",
        details: parsed.error.format(),
      });
    }

    const { provider, model } = parsed.data;

    try {
      const metadata = getModelToolMetadata(provider, model!);

      if (!metadata) {
        return res.status(404).send({
          error: "Model not found",
          provider,
          model,
          message: `No metadata available for ${provider}:${model}. This model may not be supported or may not have tool support information.`,
        });
      }

      return res.send({
        provider: metadata.provider,
        model: metadata.model,
        support: metadata.support,
      });
    } catch (err: any) {
      logger.error("Error fetching tool metadata:", err);
      return res.status(500).send({
        error: "Failed to fetch tool metadata",
        detail: err.message,
      });
    }
  });
}
