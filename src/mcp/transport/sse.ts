import axios, { AxiosInstance, AxiosError } from "axios";
import EventSource from "eventsource";
import { MCPClient } from "../client.js";
import type { JSONRPCRequest, MCPServerConfig } from "../types.js";
import { logger } from "@/utils/logger.js";

export class SSEMCPClient extends MCPClient {
  private httpClient: AxiosInstance | null = null;
  private eventSource: EventSource | null = null;
  private baseUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  constructor(config: MCPServerConfig) {
    super(config);
    if (!config.url) {
      throw new Error("SSE transport requires 'url' in config");
    }
    this.baseUrl = config.url;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
    this.reconnectDelay = config.reconnectDelay || 1000;
  }

  async connect(): Promise<void> {
    // Create axios instance for HTTP POST requests (upstream)
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers,
      },
    });

    // Establish SSE connection for downstream messages
    await this.connectSSE();

    logger.info(`SSE MCP client connected to ${this.baseUrl}`);
  }

  private async connectSSE(): Promise<void> {
    // Close existing connection if any
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Build SSE URL (typically same as base URL or base URL + /sse)
    const sseUrl = this.baseUrl.endsWith("/sse")
      ? this.baseUrl
      : `${this.baseUrl}/sse`;

    // Prepare headers for EventSource
    // Note: EventSource in Node.js doesn't support custom headers directly
    // The eventsource library may support headers via options, but we'll document this limitation
    const headers: Record<string, string> = {
      ...this.config.headers,
    };

    const options: any = {};

    // Try to set headers if eventsource library supports it
    // The eventsource library may support headers via the 'headers' option
    if (Object.keys(headers).length > 0) {
      // Some EventSource implementations support headers via options
      // Check if the library supports it
      try {
        // The eventsource library supports headers via options.headers
        options.headers = headers;
      } catch (err) {
        // If not supported, log a warning
        logger.debug(
          `SSE headers may not be fully supported: ${JSON.stringify(headers)}`
        );
      }
    }

    try {
      this.eventSource = new EventSource(sseUrl, options);

      // Handle SSE messages
      this.eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data =
            typeof event.data === "string"
              ? event.data
              : JSON.stringify(event.data);
          const message = JSON.parse(data);
          this.handleMessage(JSON.stringify(message));
        } catch (err: any) {
          logger.error(`Failed to parse SSE message: ${err.message}`);
        }
      };

      // Wait for connection to establish with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("SSE connection timeout"));
        }, 10000); // 10 second timeout for connection

        this.eventSource!.onopen = () => {
          clearTimeout(timeout);
          logger.info(`SSE connection opened for ${this.config.name}`);
          this.reconnectAttempts = 0;
          resolve();
        };

        this.eventSource!.onerror = (error: Event) => {
          clearTimeout(timeout);
          if (this.eventSource?.readyState === EventSource.CONNECTING) {
            reject(new Error("SSE connection failed"));
          }
        };
      });

      // Set up error handler after connection is established
      this.eventSource.onerror = (error: Event) => {
        logger.error(`SSE connection error for ${this.config.name}:`, error);

        // If connection is closed, attempt to reconnect
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.handleReconnect();
        }
      };
    } catch (err: any) {
      logger.error(`Failed to establish SSE connection: ${err.message}`);
      throw err;
    }
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(
        `SSE reconnection failed after ${this.maxReconnectAttempts} attempts for ${this.config.name}`
      );
      this.setState("error");
      this.emit("error", new Error("SSE reconnection failed"));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    logger.warn(
      `SSE connection lost for ${this.config.name}, attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.connectSSE();
    } catch (err: any) {
      logger.error(`SSE reconnection attempt failed: ${err.message}`);
      // Will trigger another reconnect attempt
      this.handleReconnect();
    }
  }

  protected async sendMessage(request: JSONRPCRequest): Promise<void> {
    if (!this.httpClient) {
      throw new Error("HTTP client not connected");
    }

    try {
      // Send JSON-RPC request via HTTP POST (upstream)
      const response = await this.httpClient.post("", request);
      const responseData = response.data;

      // For SSE, responses may come via SSE stream, but some implementations
      // also return immediate responses via HTTP POST response
      // Handle both cases
      if (responseData && typeof responseData === "object") {
        // If response has jsonrpc field, it's a JSON-RPC response
        if (responseData.jsonrpc === "2.0") {
          this.handleResponse(responseData);
        }
      }
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError;
        throw new Error(
          `HTTP POST failed: ${axiosError.message} (${
            axiosError.response?.status || "no status"
          })`
        );
      }
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.httpClient = null;
    this.reconnectAttempts = 0;
    await super.disconnect();
  }
}
