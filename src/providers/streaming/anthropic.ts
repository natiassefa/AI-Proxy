import axios from "axios";
import { Readable } from "stream";
import { config } from "@/config.js";
import { toolsToAnthropic, messagesToAnthropic } from "../tools/converter.js";
import type { Message, Tool } from "../types.js";
import type { FastifyReply } from "fastify";
import { sendSSEChunk, sendSSEEnd, sendSSEError } from "@/utils/sse.js";
import { logger } from "@/utils/logger.js";
import { trackCost } from "@/utils/costTracker/index.js";
import type { CostResult } from "@/utils/costTracker/types.js";

type AnthropicStreamEvent =
  | {
      type: "message_start";
      message: { id: string; type: string; role: string };
    }
  | {
      type: "content_block_start";
      index: number;
      content_block: {
        type: string;
        id?: string;
        name?: string;
      };
    }
  | {
      type: "content_block_delta";
      index: number;
      delta: {
        type: string;
        text?: string;
      };
    }
  | { type: "content_block_stop"; index: number }
  | {
      type: "message_delta";
      delta: { stop_reason?: string; stop_sequence?: string };
    }
  | {
      type: "message_stop";
      stop_reason?: string;
      usage?: { input_tokens: number; output_tokens: number };
    };

export async function handleAnthropicStream(
  model: string,
  messages: Message[],
  res: FastifyReply,
  tools?: Tool[]
): Promise<void> {
  const startTime = Date.now();
  logger.info(`Starting Anthropic stream for model ${model}`);

  // Validate API key
  if (!config.anthropicKey) {
    logger.error("Anthropic API key is missing");
    sendSSEError(
      res,
      "Configuration error",
      "Anthropic API key is not configured"
    );
    return;
  }

  try {
    const requestBody: any = {
      model,
      max_tokens: 4096,
      messages: messagesToAnthropic(messages),
      stream: true, // Explicitly enable streaming
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestBody.tools = toolsToAnthropic(tools);
    }

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      requestBody,
      {
        headers: {
          "x-api-key": config.anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        responseType: "stream",
        validateStatus: () => true, // Don't throw on any status
      }
    );

    // Check for HTTP errors
    if (response.status !== 200) {
      let errorMessage = `Request failed with status code ${response.status}`;

      // Try to read error response body
      try {
        const errorData: Buffer[] = [];
        response.data.on("data", (chunk: Buffer) => errorData.push(chunk));
        await new Promise<void>((resolve) => {
          response.data.on("end", resolve);
        });
        const errorBody = Buffer.concat(errorData).toString();
        if (errorBody) {
          try {
            const parsedError = JSON.parse(errorBody);
            errorMessage =
              parsedError.error?.message || parsedError.message || errorMessage;
          } catch {
            errorMessage = errorBody || errorMessage;
          }
        }
      } catch (parseErr) {
        logger.warn("Could not parse error response:", parseErr);
      }

      logger.error(`Anthropic API error (${response.status}):`, errorMessage);
      sendSSEError(res, "Provider request failed", errorMessage);
      return;
    }

    let accumulatedContent = "";
    let accumulatedToolCalls: any[] = [];
    let usage: { input_tokens: number; output_tokens: number } | null = null;

    const stream = response.data as Readable;

    return new Promise<void>((resolve, reject) => {
      let buffer = "";
      let currentEventType: string | null = null;

      stream.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue;

          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
            logger.debug(`Anthropic event type: ${currentEventType}`);
            continue;
          }

          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            try {
              const parsed: AnthropicStreamEvent = JSON.parse(data);
              logger.debug(`Anthropic stream event: ${parsed.type}`);

              // Handle text content
              if (parsed.type === "content_block_delta" && parsed.delta.text) {
                accumulatedContent += parsed.delta.text;
                sendSSEChunk(res, {
                  content: parsed.delta.text,
                  role: "assistant",
                });
              }

              // Handle tool use start
              if (
                parsed.type === "content_block_start" &&
                parsed.content_block?.type === "tool_use"
              ) {
                accumulatedToolCalls.push({
                  id: parsed.content_block.id || "",
                  name: parsed.content_block.name || "",
                  inputRaw: "",
                });
                sendSSEChunk(
                  res,
                  {
                    type: "tool_use_start",
                    tool_use_id: parsed.content_block.id,
                    name: parsed.content_block.name,
                  },
                  "tool_call"
                );
              }

              // Handle tool use delta
              if (
                parsed.type === "content_block_delta" &&
                parsed.delta?.type === "input_json_delta"
              ) {
                const toolUseIndex = accumulatedToolCalls.length - 1;
                if (toolUseIndex >= 0 && parsed.delta.text) {
                  // Accumulate JSON input
                  if (!accumulatedToolCalls[toolUseIndex].inputRaw) {
                    accumulatedToolCalls[toolUseIndex].inputRaw = "";
                  }
                  accumulatedToolCalls[toolUseIndex].inputRaw +=
                    parsed.delta.text;

                  sendSSEChunk(
                    res,
                    {
                      type: "tool_use_delta",
                      tool_use_id: accumulatedToolCalls[toolUseIndex].id,
                      delta: parsed.delta.text,
                    },
                    "tool_call"
                  );
                }
              }

              // Capture usage from message_stop event
              // Note: Anthropic's streaming API may not include usage in message_stop
              // Usage is typically only available in non-streaming responses
              if (parsed.type === "message_stop") {
                logger.info(
                  "Anthropic message_stop event received:",
                  JSON.stringify(parsed, null, 2)
                );
                if (parsed.usage) {
                  usage = parsed.usage;
                  logger.info("Anthropic usage captured:", usage);
                } else {
                  logger.warn(
                    "Anthropic message_stop event has no usage property. This is expected in streaming mode - usage is only available in non-streaming responses."
                  );
                  logger.debug(
                    "Full message_stop event:",
                    JSON.stringify(parsed, null, 2)
                  );
                  logger.debug("Raw data line:", data);
                }

                const duration = Date.now() - startTime;

                // If we have usage, use it; otherwise note that usage is unavailable
                // In streaming mode, Anthropic doesn't provide usage data
                const finalUsage = usage
                  ? {
                      input_tokens: usage.input_tokens,
                      output_tokens: usage.output_tokens,
                      total_tokens: usage.input_tokens + usage.output_tokens,
                    }
                  : {
                      // Usage unavailable in streaming mode - would need non-streaming request to get usage
                      input_tokens: 0,
                      output_tokens: 0,
                      total_tokens: 0,
                    };

                logger.info("Final usage data being sent:", finalUsage);

                // Calculate cost (note: usage may be zeros for Anthropic streaming)
                const cost: CostResult | null = usage
                  ? trackCost(
                      "anthropic",
                      {
                        input_tokens: usage.input_tokens,
                        output_tokens: usage.output_tokens,
                        total_tokens: usage.input_tokens + usage.output_tokens,
                      },
                      model
                    )
                  : null;

                // Parse accumulated tool calls
                const finalToolCalls = accumulatedToolCalls.map((tu: any) => {
                  try {
                    const input = tu.inputRaw ? JSON.parse(tu.inputRaw) : {};
                    return {
                      id: tu.id,
                      type: "function",
                      function: {
                        name: tu.name,
                        arguments: JSON.stringify(input),
                      },
                    };
                  } catch {
                    return {
                      id: tu.id,
                      type: "function",
                      function: {
                        name: tu.name,
                        arguments: JSON.stringify({}),
                      },
                    };
                  }
                });

                if (usage) {
                  logger.info(
                    `Completed Anthropic stream, tokens: ${
                      finalUsage.total_tokens
                    }, cost: ${cost?.estimated_cost_usd || "N/A"}`
                  );
                } else {
                  logger.info(
                    `Completed Anthropic stream (usage unavailable in streaming mode)`
                  );
                }

                sendSSEEnd(res, {
                  usage: finalUsage,
                  cost,
                  latency_ms: duration,
                  tool_calls:
                    finalToolCalls.length > 0 ? finalToolCalls : undefined,
                });
                resolve();
                return;
              }
            } catch (err) {
              logger.warn(
                "Failed to parse Anthropic stream chunk:",
                err,
                "Raw data:",
                data
              );
            }
          }
        }
      });

      stream.on("error", (err) => {
        logger.error("Anthropic stream error:", err);
        sendSSEError(res, "Stream error", err.message);
        reject(err);
      });

      stream.on("end", () => {
        if (!res.raw.writableEnded && !usage) {
          const duration = Date.now() - startTime;
          const finalUsage = {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
          };
          logger.info(
            `Completed Anthropic stream (usage unavailable in streaming mode)`
          );
          sendSSEEnd(res, {
            usage: finalUsage,
            cost: null,
            latency_ms: duration,
          });
        }
        resolve();
      });

      res.raw.on("close", () => {
        stream.destroy();
        resolve();
      });
    });
  } catch (err: any) {
    logger.error("Anthropic streaming request failed:", err);

    // Provide more detailed error information
    let errorMessage = err.message || "Unknown error";
    if (err.response) {
      errorMessage =
        err.response.data?.error?.message ||
        err.response.statusText ||
        errorMessage;
      logger.error("Anthropic API error details:", {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data,
      });
    }

    sendSSEError(res, "Provider request failed", errorMessage);
    return;
  }
}
