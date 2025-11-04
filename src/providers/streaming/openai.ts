import axios from "axios";
import { Readable } from "stream";
import { config } from "@/config.js";
import type { Message } from "../types.js";
import type { FastifyReply } from "fastify";
import { sendSSEChunk, sendSSEEnd, sendSSEError } from "@/utils/sse.js";
import { logger } from "@/utils/logger.js";
import { trackCost } from "@/utils/costTracker/index.js";
import type { CostResult } from "@/utils/costTracker/types.js";

type OpenAIStreamChunk = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
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

export async function handleOpenAIStream(
  model: string,
  messages: Message[],
  res: FastifyReply
): Promise<void> {
  const startTime = Date.now();
  logger.info(`Starting OpenAI stream for model ${model}`);

  // Validate API key
  if (!config.openaiKey) {
    logger.error("OpenAI API key is missing");
    sendSSEError(
      res,
      "Configuration error",
      "OpenAI API key is not configured"
    );
    return;
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model,
        messages,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${config.openaiKey}`,
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

      logger.error(`OpenAI API error (${response.status}):`, errorMessage);
      sendSSEError(res, "Provider request failed", errorMessage);
      return;
    }

    let accumulatedContent = "";
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
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === "") continue;
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              // Stream complete, send final event with usage
              const duration = Date.now() - startTime;
              const finalUsage = usage || {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
              };
              const cost: CostResult | null = trackCost(
                "openai",
                finalUsage,
                model
              );
              logger.info(
                `Completed OpenAI stream, tokens: ${
                  finalUsage.total_tokens
                }, cost: ${cost?.estimated_cost_usd || "N/A"}`
              );
              sendSSEEnd(res, {
                usage: finalUsage,
                cost,
                latency_ms: duration,
              });
              resolve();
              return;
            }

            try {
              const parsed: OpenAIStreamChunk = JSON.parse(data);

              if (parsed.choices?.[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                accumulatedContent += content;
                sendSSEChunk(res, {
                  content,
                  role: parsed.choices[0].delta.role || "assistant",
                });
              }

              // Collect usage if present (usually in final chunk)
              if (parsed.usage) {
                usage = parsed.usage;
              }
            } catch (err) {
              logger.warn("Failed to parse OpenAI stream chunk:", err);
            }
          }
        }
      });

      stream.on("error", (err) => {
        logger.error("OpenAI stream error:", err);
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
            "openai",
            finalUsage,
            model
          );
          sendSSEEnd(res, {
            usage: finalUsage,
            cost,
            latency_ms: duration,
          });
        }
        resolve();
      });

      // Handle client disconnect
      res.raw.on("close", () => {
        stream.destroy();
        resolve();
      });
    });
  } catch (err: any) {
    logger.error("OpenAI streaming request failed:", err);

    // Provide more detailed error information
    let errorMessage = err.message || "Unknown error";
    if (err.response) {
      errorMessage =
        err.response.data?.error?.message ||
        err.response.statusText ||
        errorMessage;
      logger.error("OpenAI API error details:", {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data,
      });
    }

    sendSSEError(res, "Provider request failed", errorMessage);
    return;
  }
}
