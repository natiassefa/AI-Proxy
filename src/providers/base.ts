import { handleOpenAI } from "./openai.js";
import { handleAnthropic } from "./anthropic.js";
import { handleMistral } from "./mistral.js";
import { trackCost, type CostResult } from "@/utils/costTracker/index.js";
import type { Message, Provider, ProviderResponse } from "./types.js";

// Export streaming handler
export { handleStreamingRequest } from "./streaming/index.js";

type ProviderResult = ProviderResponse & {
  cost: CostResult | null;
  latency_ms: number;
};

export async function handleProviderRequest(
  provider: Provider,
  model: string,
  messages: Message[]
): Promise<ProviderResult> {
  const start = Date.now();
  let result: ProviderResponse;

  switch (provider) {
    case "openai":
      result = await handleOpenAI(model, messages);
      break;
    case "anthropic":
      result = await handleAnthropic(model, messages);
      break;
    case "mistral":
      result = await handleMistral(model, messages);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  const duration = Date.now() - start;
  const cost = trackCost(provider, result.usage, model);

  return {
    ...result,
    cost,
    latency_ms: duration,
  };
}
