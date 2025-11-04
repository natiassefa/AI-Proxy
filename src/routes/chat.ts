import { FastifyInstance, FastifyReply } from "fastify";
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
import type { Message, Tool } from "@/providers/types.js";

// Update ChatSchema to include tools
const ToolSchema = z.object({
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.object({
      type: z.literal("object"),
      properties: z.record(z.any()),
      required: z.array(z.string()).optional(),
      additionalProperties: z.boolean().optional(),
    }),
  }),
});

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([
    z.string(),
    z.array(z.any()), // For Anthropic content blocks
    z.null(), // Allowed when assistant has tool_calls but no text content
  ]),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      })
    )
    .optional(),
  tool_call_id: z.string().optional(),
  name: z.string().optional(),
});

const ChatSchema = z.object({
  provider: z.enum(["openai", "anthropic", "mistral"]),
  model: z.string(),
  messages: z.array(MessageSchema),
  stream: z.boolean().optional(),
  tools: z.array(ToolSchema).optional(), // New optional field
  tool_results: z
    .array(
      z.object({
        tool_call_id: z.string(),
        content: z.string(),
        name: z.string().optional(),
      })
    )
    .optional(), // Optional: if provided with tool_calls in last message, auto-continue
  auto_execute_tools: z.boolean().optional(), // Whether to auto-continue with tool_results (default: false)
});

/**
 * Handle automatic tool continuation - continue conversation with tool results
 * This allows users to provide tool_results inline and have the server automatically
 * continue the conversation until the model provides a final answer
 */
async function handleAutoToolContinuation(
  provider: string,
  model: string,
  initialMessages: Message[],
  tools: Tool[] | undefined,
  res: FastifyReply,
  maxIterations: number = 10
): Promise<void> {
  let messages = [...initialMessages];
  let totalUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
  };
  let totalCost = null;
  let totalLatency = 0;
  const allToolCalls: any[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const startTime = Date.now();

    try {
      const response = await handleProviderRequest(
        provider as any,
        model,
        messages,
        tools
      );

      totalLatency += Date.now() - startTime;

      // Accumulate usage
      if (response.usage) {
        totalUsage.prompt_tokens =
          (totalUsage.prompt_tokens || 0) + (response.usage.prompt_tokens || 0);
        totalUsage.completion_tokens =
          (totalUsage.completion_tokens || 0) +
          (response.usage.completion_tokens || 0);
        totalUsage.input_tokens =
          (totalUsage.input_tokens || 0) + (response.usage.input_tokens || 0);
        totalUsage.output_tokens =
          (totalUsage.output_tokens || 0) + (response.usage.output_tokens || 0);
        totalUsage.total_tokens =
          (totalUsage.total_tokens || 0) + (response.usage.total_tokens || 0);
      }

      // Accumulate cost (use the latest cost calculation)
      if (response.cost) {
        totalCost = response.cost;
      }

      // Add assistant response to messages
      messages.push({
        role: "assistant",
        content: response.message.content,
        tool_calls: response.message.tool_calls,
      });

      // If there are tool calls, we need tool results to continue
      if (
        response.message.tool_calls &&
        response.message.tool_calls.length > 0
      ) {
        allToolCalls.push(...response.message.tool_calls);

        // No more tool results provided - return current response with tool calls
        // User needs to provide tool_results in next request
        return res.send({
          provider,
          message: response.message,
          usage: totalUsage,
          cost: totalCost,
          latency_ms: totalLatency,
          tool_calls: allToolCalls,
          iterations: iteration + 1,
          info: "Tool calls detected. Provide tool_results in next request with auto_execute_tools=true to continue.",
        });
      }

      // No more tool calls - return final response
      return res.send({
        provider,
        message: response.message,
        usage: totalUsage,
        cost: totalCost,
        latency_ms: totalLatency,
        tool_calls: allToolCalls.length > 0 ? allToolCalls : undefined,
        iterations: iteration + 1,
      });
    } catch (err: any) {
      logger.error("Error in auto tool continuation:", err);
      return res.status(500).send({
        error: "Tool continuation failed",
        detail: err.message,
        iteration,
      });
    }
  }

  // Max iterations reached
  return res.status(500).send({
    error: "Max tool continuation iterations reached",
    detail: `Exceeded maximum of ${maxIterations} iterations`,
    usage: totalUsage,
    cost: totalCost,
    latency_ms: totalLatency,
  });
}

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

    const {
      provider,
      model,
      messages,
      tools,
      tool_results,
      auto_execute_tools,
    } = parsed.data;

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
        await handleStreamingRequest(provider, model, messages, res, tools);
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
    // Update cache key to include tools (if present)
    const cacheKey =
      tools && tools.length > 0
        ? `${provider}:${model}:${JSON.stringify(messages)}:${JSON.stringify(
            tools
          )}`
        : `${provider}:${model}:${JSON.stringify(messages)}`;

    // Try to get from cache (returns null if Redis is not configured)
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info(`Cache hit for ${provider}:${model}`);
      return res.send(JSON.parse(cached));
    }

    try {
      // Handle automatic tool continuation if tool_results are provided
      // This allows users to provide tool results inline and have the server continue automatically
      if (auto_execute_tools && tool_results && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === "assistant" && lastMessage.tool_calls) {
          // Add tool results to messages and continue
          const messagesWithResults = [
            ...messages,
            ...tool_results.map((tr) => ({
              role: "tool" as const,
              tool_call_id: tr.tool_call_id,
              content: tr.content,
              name: tr.name,
            })),
          ];
          return await handleAutoToolContinuation(
            provider,
            model,
            messagesWithResults,
            tools,
            res
          );
        }
      }

      const response = await handleProviderRequest(
        provider,
        model,
        messages,
        tools
      );

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
