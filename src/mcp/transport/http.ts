import axios, { AxiosInstance, AxiosError } from "axios";
import { MCPClient } from "../client.js";
import type { JSONRPCRequest, MCPServerConfig } from "../types.js";
import { logger } from "@/utils/logger.js";

export class HTTPMCPClient extends MCPClient {
  private httpClient: AxiosInstance | null = null;
  private baseUrl: string;

  constructor(config: MCPServerConfig) {
    super(config);
    if (!config.url) {
      throw new Error("HTTP transport requires 'url' in config");
    }
    this.baseUrl = config.url;
  }

  async connect(): Promise<void> {
    const timeout = this.config.timeout || 30000;

    // Create axios instance with base URL and headers
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: timeout,
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers,
      },
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          // Server responded with error status
          logger.error(
            `HTTP MCP server ${this.config.name} error: ${error.response.status} ${error.response.statusText}`
          );
        } else if (error.request) {
          // Request made but no response received
          logger.error(
            `HTTP MCP server ${this.config.name} request failed: ${error.message}`
          );
        } else {
          // Error setting up request
          logger.error(
            `HTTP MCP server ${this.config.name} setup error: ${error.message}`
          );
        }
        return Promise.reject(error);
      }
    );

    logger.info(`HTTP MCP client connected to ${this.baseUrl}`);
  }

  protected async sendMessage(request: JSONRPCRequest): Promise<void> {
    if (!this.httpClient) {
      throw new Error("HTTP client not connected");
    }

    if (this.getState() !== "ready" && this.getState() !== "initializing") {
      throw new Error(`Cannot send message in state: ${this.getState()}`);
    }

    try {
      const response = await this.httpClient.post("", request);
      const responseData = response.data;

      // Handle JSON-RPC response
      if (responseData && typeof responseData === "object") {
        this.handleResponse(responseData);
      } else {
        logger.warn(
          `Invalid response format from HTTP MCP server ${this.config.name}`
        );
      }
    } catch (err: any) {
      // Enhanced error handling
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError;

        // Handle timeout
        if (
          axiosError.code === "ECONNABORTED" ||
          axiosError.message.includes("timeout")
        ) {
          logger.error(
            `HTTP request timeout for ${this.config.name} after ${
              this.config.timeout || 30000
            }ms`
          );
          throw new Error(
            `Request timeout after ${this.config.timeout || 30000}ms`
          );
        }

        // Handle network errors
        if (!axiosError.response) {
          logger.error(
            `Network error for ${this.config.name}: ${axiosError.message}`
          );
          this.setState("error");
          throw new Error(`Network error: ${axiosError.message}`);
        }

        // Handle HTTP errors
        const status = axiosError.response.status;
        if (status >= 500) {
          logger.error(`Server error for ${this.config.name}: ${status}`);
        } else if (status === 401 || status === 403) {
          logger.error(
            `Authentication error for ${this.config.name}: ${status}`
          );
        } else {
          logger.error(`HTTP error for ${this.config.name}: ${status}`);
        }

        // Try to parse JSON-RPC error from response
        if (axiosError.response.data) {
          try {
            const errorData = axiosError.response.data as any;
            if (errorData.error) {
              this.handleResponse({
                jsonrpc: "2.0",
                id: request.id,
                error: errorData.error,
              });
              return;
            }
          } catch (parseErr) {
            // Ignore parse errors
          }
        }

        throw new Error(
          `HTTP request failed: ${axiosError.message} (${status})`
        );
      }
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.httpClient = null;
    await super.disconnect();
  }
}
