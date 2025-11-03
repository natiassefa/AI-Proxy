import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 8080,
  openaiKey: process.env.OPENAI_API_KEY,
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  mistralKey: process.env.MISTRAL_API_KEY,
  redisUrl: process.env.REDIS_URL,
};

export function checkConfig() {
  if (!config.anthropicKey && !config.mistralKey && !config.openaiKey) {
    throw new Error("No API keys provided");
  }
}
