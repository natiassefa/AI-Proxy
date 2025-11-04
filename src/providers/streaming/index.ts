import type { Provider, Message, Tool } from "../types.js";
import type { FastifyReply } from "fastify";
import { handleOpenAIStream } from "./openai.js";
import { handleAnthropicStream } from "./anthropic.js";
import { handleMistralStream } from "./mistral.js";
import { setSSEHeaders, sendSSEError } from "@/utils/sse.js";
import { logger } from "@/utils/logger.js";

export async function handleStreamingRequest(
  provider: Provider,
  model: string,
  messages: Message[],
  res: FastifyReply,
  tools?: Tool[]
): Promise<void> {
  // Set SSE headers
  setSSEHeaders(res);

  try {
    switch (provider) {
      case "openai":
        await handleOpenAIStream(model, messages, res, tools);
        break;
      case "anthropic":
        await handleAnthropicStream(model, messages, res, tools);
        break;
      case "mistral":
        await handleMistralStream(model, messages, res, tools);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (err: any) {
    logger.error(`Streaming error for ${provider}:`, err);
    if (!res.raw.writableEnded) {
      sendSSEError(res, "Streaming failed", err.message);
    }
    throw err;
  }
}
