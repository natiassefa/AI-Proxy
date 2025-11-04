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
import {
  mcpToolToUnified,
  mcpToolResultToProviderResult,
} from "@/utils/mcpToolConverter.js";
import type { Message, ToolCall } from "@/providers/types.js";

const ChatSchema = z.object({
  provider: z.enum(["openai", "anthropic", "mistral"]),
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant", "tool"]),
      content: z.string(),
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
    })
  ),
  stream: z.boolean().optional(),
  tools: z.array(z.any()).optional(),
  useMcpTools: z.boolean().optional(),
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

    const { provider, model, messages, tools, useMcpTools } = parsed.data;
    const mcpManager = app.mcpManager;

    // Collect tools from request and MCP
    let allTools = tools || [];

    // Add MCP tools if requested and available
    if (useMcpTools && mcpManager) {
      const mcpTools = mcpManager.getTools();
      const unifiedMcpTools = mcpTools.map(({ tool }) =>
        mcpToolToUnified(tool)
      );
      allTools = [...allTools, ...unifiedMcpTools];
    }

    // Helper function to check if tool is from MCP
    function isMCPTool(toolName: string): boolean {
      if (!mcpManager) return false;
      return mcpManager.getTool(toolName) !== undefined;
    }

    // Helper function to execute tool calls
    async function executeToolCalls(toolCalls: ToolCall[]): Promise<Message[]> {
      const toolResults: Message[] = [];

      for (const toolCall of toolCalls) {
        const { id, function: func } = toolCall;
        const toolName = func.name;
        let toolArgs: Record<string, any> = {};

        try {
          toolArgs = JSON.parse(func.arguments);
        } catch (err: any) {
          logger.warn(
            `Invalid JSON in tool arguments for ${toolName}: ${err.message}`
          );
          toolResults.push({
            role: "tool",
            content: `Error: Invalid JSON in tool arguments: ${err.message}`,
            tool_call_id: id,
            name: toolName,
          });
          continue;
        }

        // Check if this is an MCP tool
        if (isMCPTool(toolName)) {
          try {
            const mcpResult = await mcpManager!.callTool(toolName, toolArgs);
            const content = mcpToolResultToProviderResult(mcpResult);
            toolResults.push({
              role: "tool",
              content,
              tool_call_id: id,
              name: toolName,
            });
          } catch (err: any) {
            logger.error(
              `Error executing MCP tool ${toolName}: ${err.message}`
            );
            toolResults.push({
              role: "tool",
              content: `Error executing MCP tool: ${err.message}`,
              tool_call_id: id,
              name: toolName,
            });
          }
        } else {
          // Not an MCP tool - client should execute it
          toolResults.push({
            role: "tool",
            content: `Error: Tool '${toolName}' is not an MCP tool and must be executed by the client`,
            tool_call_id: id,
            name: toolName,
          });
        }
      }

      return toolResults;
    }

    // Route to streaming handler if requested
    // Note: Tool execution in streaming is not yet implemented
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

    // Non-streaming logic with tool execution loop
    const MAX_TOOL_ITERATIONS = 10; // Prevent infinite loops
    let currentMessages: Message[] = [...messages];
    let iteration = 0;
    let totalUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };
    let totalCost = null;
    let totalLatency = 0;

    try {
      while (iteration < MAX_TOOL_ITERATIONS) {
        iteration++;
        const start = Date.now();

        // Build cache key (exclude tools for now as they change)
        const cacheKey = `${provider}:${model}:${JSON.stringify(
          currentMessages
        )}:${JSON.stringify(allTools)}`;

        // Try to get from cache (only on first iteration)
        if (iteration === 1) {
          const cached = await cache.get(cacheKey);
          if (cached) {
            logger.info(`Cache hit for ${provider}:${model}`);
            return res.send(JSON.parse(cached));
          }
        }

        // Call provider
        const response = await handleProviderRequest(
          provider,
          model,
          currentMessages,
          allTools.length > 0 ? allTools : undefined
        );

        totalLatency += Date.now() - start;
        totalCost = response.cost;

        // Accumulate usage
        if (response.usage.prompt_tokens) {
          totalUsage.prompt_tokens += response.usage.prompt_tokens;
        }
        if (response.usage.completion_tokens) {
          totalUsage.completion_tokens += response.usage.completion_tokens;
        }
        if (response.usage.input_tokens) {
          totalUsage.input_tokens += response.usage.input_tokens;
        }
        if (response.usage.output_tokens) {
          totalUsage.output_tokens += response.usage.output_tokens;
        }
        if (response.usage.total_tokens) {
          totalUsage.total_tokens += response.usage.total_tokens;
        }

        // Add assistant message to conversation
        currentMessages.push({
          role: "assistant",
          content: response.message.content || "",
          tool_calls: response.message.tool_calls,
        });

        // Check if there are tool calls to execute
        if (
          response.message.tool_calls &&
          response.message.tool_calls.length > 0
        ) {
          logger.info(
            `Executing ${response.message.tool_calls.length} tool call(s) for ${provider}:${model}`
          );

          // Execute tool calls
          const toolResults = await executeToolCalls(
            response.message.tool_calls
          );

          // Add tool results to conversation
          currentMessages.push(...toolResults);

          // Continue loop to get model's response to tool results
          continue;
        }

        // No tool calls - return final response
        // Cache the final result (only if no tools were used)
        if (iteration === 1 && allTools.length === 0) {
          await cache.set(cacheKey, JSON.stringify(response), 600);
        }

        return res.send({
          ...response,
          usage: totalUsage,
          cost: totalCost,
          latency_ms: totalLatency,
        });
      }

      // If we've hit max iterations, return the last response
      logger.warn(
        `Max tool iterations (${MAX_TOOL_ITERATIONS}) reached for ${provider}:${model}`
      );
      return res.status(500).send({
        error: "Max tool iterations reached",
        message:
          "The conversation exceeded the maximum number of tool execution iterations",
      });
    } catch (err: any) {
      logger.error(err);
      return res
        .status(500)
        .send({ error: "Provider request failed", detail: err.message });
    }
  });
}
