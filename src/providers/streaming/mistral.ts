import axios from "axios";
import { Readable } from "stream";
import { config } from "@/config.js";
import { toolsToMistral, messagesToMistral } from "../tools/converter.js";
import type { Message, Tool } from "../types.js";
import type { FastifyReply } from "fastify";
import { sendSSEChunk, sendSSEEnd, sendSSEError } from "@/utils/sse.js";
import { logger } from "@/utils/logger.js";
import { trackCost } from "@/utils/costTracker/index.js";
import type { CostResult } from "@/utils/costTracker/types.js";

type MistralStreamChunk = {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    index: number;
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export async function handleMistralStream(
  model: string,
  messages: Message[],
  res: FastifyReply,
  tools?: Tool[]
): Promise<void> {
  const startTime = Date.now();
  logger.info(`Starting Mistral stream for model ${model}`);

  // Validate API key
  if (!config.mistralKey) {
    logger.error("Mistral API key is missing");
    sendSSEError(
      res,
      "Configuration error",
      "Mistral API key is not configured"
    );
    return;
  }

  try {
    const requestBody: any = {
      model,
      messages: messagesToMistral(messages),
      stream: true,
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestBody.tools = toolsToMistral(tools);
    }

    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${config.mistralKey}`,
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

      logger.error(`Mistral API error (${response.status}):`, errorMessage);
      sendSSEError(res, "Provider request failed", errorMessage);
      return;
    }

    let accumulatedContent = "";
    let accumulatedToolCalls: any[] = [];
    let usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    } | null = null;

    const stream = response.data as Readable;

    return new Promise<void>((resolve, reject) => {
      let buffer = "";

      stream.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue;
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              const duration = Date.now() - startTime;
              const finalUsage = usage || {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
              };
              const cost: CostResult | null = trackCost(
                "mistral",
                finalUsage,
                model
              );
              const finalToolCalls =
                accumulatedToolCalls.length > 0
                  ? accumulatedToolCalls.map((tc: any) => ({
                      id: tc.id,
                      type: tc.type,
                      function: tc.function,
                    }))
                  : undefined;
              logger.info(
                `Completed Mistral stream, tokens: ${
                  finalUsage.total_tokens
                }, cost: ${cost?.estimated_cost_usd || "N/A"}`
              );
              sendSSEEnd(res, {
                usage: finalUsage,
                cost,
                latency_ms: duration,
                tool_calls: finalToolCalls,
              });
              resolve();
              return;
            }

            try {
              const parsed: MistralStreamChunk = JSON.parse(data);

              // Handle content chunks
              if (parsed.choices?.[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                accumulatedContent += content;
                sendSSEChunk(res, {
                  content,
                  role: parsed.choices[0].delta.role || "assistant",
                });
              }

              // Handle tool call chunks
              if (parsed.choices?.[0]?.delta?.tool_calls) {
                const toolCallDelta = parsed.choices[0].delta.tool_calls;
                toolCallDelta.forEach((delta: any) => {
                  const index = delta.index;
                  if (!accumulatedToolCalls[index]) {
                    accumulatedToolCalls[index] = {
                      id: delta.id || "",
                      type: delta.type || "function",
                      function: { name: "", arguments: "" },
                    };
                  }
                  if (delta.function?.name) {
                    accumulatedToolCalls[index].function.name +=
                      delta.function.name;
                  }
                  if (delta.function?.arguments) {
                    accumulatedToolCalls[index].function.arguments +=
                      delta.function.arguments;
                  }
                  if (delta.id) {
                    accumulatedToolCalls[index].id = delta.id;
                  }

                  // Send tool call chunk event
                  sendSSEChunk(
                    res,
                    {
                      type: "tool_call_delta",
                      tool_call_index: index,
                      delta: delta,
                    },
                    "tool_call"
                  );
                });
              }

              if (parsed.usage) {
                usage = parsed.usage;
              }
            } catch (err) {
              logger.warn("Failed to parse Mistral stream chunk:", err);
            }
          }
        }
      });

      stream.on("error", (err) => {
        logger.error("Mistral stream error:", err);
        sendSSEError(res, "Stream error", err.message);
        reject(err);
      });

      stream.on("end", () => {
        if (!res.raw.writableEnded) {
          const duration = Date.now() - startTime;
          const finalUsage = usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          };
          const cost: CostResult | null = trackCost(
            "mistral",
            finalUsage,
            model
          );
          const finalToolCalls =
            accumulatedToolCalls.length > 0
              ? accumulatedToolCalls.map((tc: any) => ({
                  id: tc.id,
                  type: tc.type,
                  function: tc.function,
                }))
              : undefined;
          logger.info(
            `Completed Mistral stream, tokens: ${
              finalUsage.total_tokens
            }, cost: ${cost?.estimated_cost_usd || "N/A"}`
          );
          sendSSEEnd(res, {
            usage: finalUsage,
            cost,
            latency_ms: duration,
            tool_calls: finalToolCalls,
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
    logger.error("Mistral streaming request failed:", err);

    // Provide more detailed error information
    let errorMessage = err.message || "Unknown error";
    if (err.response) {
      errorMessage =
        err.response.data?.error?.message ||
        err.response.statusText ||
        errorMessage;
      logger.error("Mistral API error details:", {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data,
      });
    }

    sendSSEError(res, "Provider request failed", errorMessage);
    return;
  }
}
