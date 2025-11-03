import Redis from "ioredis";
import { config } from "@/config.js";
import { logger } from "@/utils/logger.js";

const client: Redis | null = config.redisUrl
  ? new Redis(config.redisUrl)
  : null;

export const cache = {
  async get(key: string): Promise<string | null> {
    if (!client) return null;
    try {
      return await client.get(key);
    } catch (err) {
      logger.error("Redis GET error:", err);
      return null;
    }
  },
  async set(key: string, value: string, ttlSec: number = 3600): Promise<void> {
    if (!client) return;
    try {
      await client.setex(key, ttlSec, value);
    } catch (err) {
      logger.error("Redis SET error:", err);
    }
  },
};
