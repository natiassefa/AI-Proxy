import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import type { MCPServerConfig } from "./mcp/types.js";
import { logger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export let config = {
  port: process.env.PORT || 8080,
  openaiKey: process.env.OPENAI_API_KEY,
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  mistralKey: process.env.MISTRAL_API_KEY,
  redisUrl: process.env.REDIS_URL,
  // MCP servers configuration - reads from mcp-servers.json at root level
  mcpServers: loadMCPServers(),
};

function loadMCPServers(): MCPServerConfig[] {
  // Try to read from mcp-servers.json file first
  try {
    // Get root directory - works for both dev (src/) and production (dist/)
    // In dev: __dirname = src/, go up one level
    // In prod: __dirname = dist/, go up one level
    const rootDir = join(__dirname, "..");
    const configPath = join(rootDir, "mcp-servers.json");

    const fileContent = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(fileContent);

    if (!Array.isArray(parsed)) {
      logger.warn("mcp-servers.json must contain a JSON array");
      return [];
    }

    logger.info(`Loaded ${parsed.length} MCP server(s) from mcp-servers.json`);
    return parsed as MCPServerConfig[];
  } catch (err: any) {
    // If file doesn't exist or can't be read, that's okay - MCP is optional
    if (err.code === "ENOENT") {
      logger.debug("mcp-servers.json not found, MCP servers disabled");
    } else {
      logger.warn(`Failed to load mcp-servers.json: ${err.message}`);
    }
    return [];
  }
}

export function checkConfig() {
  if (!config.anthropicKey && !config.mistralKey && !config.openaiKey) {
    throw new Error("No API keys provided");
  }
}

export function loadConfig() {
  config = {
    port: process.env.PORT || 8080,
    openaiKey: process.env.OPENAI_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    mistralKey: process.env.MISTRAL_API_KEY,
    redisUrl: process.env.REDIS_URL,
    mcpServers: loadMCPServers(),
  };
  return config;
}
