import { EventEmitter } from "events";
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPListToolsResult,
  MCPCallToolParams,
  MCPCallToolResult,
  MCPTool,
  MCPServerConfig,
  MCPClientState,
} from "./types.js";
import { logger } from "@/utils/logger.js";

export class MCPClient extends EventEmitter {
  private state: MCPClientState = "disconnected";
  private requestIdCounter = 0;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  >();
  private serverInfo: { name: string; version: string } | null = null;
  private tools: MCPTool[] = [];
  protected config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
  }

  getState(): MCPClientState {
    return this.state;
  }

  getServerInfo(): { name: string; version: string } | null {
    return this.serverInfo;
  }

  getTools(): MCPTool[] {
    return [...this.tools];
  }

  protected setState(state: MCPClientState) {
    this.state = state;
    this.emit("stateChange", state);
  }

  protected async sendRequest(method: string, params?: any): Promise<any> {
    const id = ++this.requestIdCounter;
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.sendMessage(request).catch((err) => {
        this.pendingRequests.delete(id);
        reject(err);
      });
    });
  }

  protected handleResponse(response: JSONRPCResponse) {
    const { id, result, error } = response;

    if (id === null || id === undefined) {
      logger.warn("Received response without ID");
      return;
    }

    const pending = this.pendingRequests.get(id);
    if (!pending) {
      logger.warn(`Received response for unknown request ID: ${id}`);
      return;
    }

    this.pendingRequests.delete(id);

    if (error) {
      pending.reject(
        new Error(`MCP Error: ${error.message} (code: ${error.code})`)
      );
    } else {
      pending.resolve(result);
    }
  }

  protected async sendMessage(request: JSONRPCRequest): Promise<void> {
    throw new Error("sendMessage must be implemented by transport subclass");
  }

  protected handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      if ("method" in message) {
        // This is a notification or request from server
        this.handleServerRequest(message);
      } else {
        // This is a response
        this.handleResponse(message as JSONRPCResponse);
      }
    } catch (err: any) {
      logger.error(`Failed to parse MCP message: ${err.message}`);
    }
  }

  protected handleServerRequest(request: JSONRPCRequest): void {
    // Handle notifications and requests from server
    // For now, just log them
    logger.debug(`Received server request: ${request.method}`);
  }

  async initialize(maxRetries = 3): Promise<void> {
    if (this.state !== "disconnected") {
      throw new Error(`Cannot initialize in state: ${this.state}`);
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.setState("connecting");

        await this.connect();

        this.setState("initializing");

        const params: MCPInitializeParams = {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "ai-proxy",
            version: "0.2.0",
          },
        };

        const result = (await this.sendRequest(
          "initialize",
          params
        )) as MCPInitializeResult;
        this.serverInfo = result.serverInfo;

        // Send initialized notification
        await this.sendMessage({
          jsonrpc: "2.0",
          id: null,
          method: "notifications/initialized",
        });

        await this.refreshTools();
        this.setState("ready");
        logger.info(
          `MCP server ${this.config.name} initialized: ${this.serverInfo.name} v${this.serverInfo.version}`
        );
        return; // Success
      } catch (err: any) {
        lastError = err;
        this.setState("error");
        if (attempt < maxRetries) {
          logger.warn(
            `MCP server ${this.config.name} initialization attempt ${attempt} failed, retrying...`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        } else {
          logger.error(
            `Failed to initialize MCP server ${this.config.name}: ${err.message}`
          );
        }
      }
    }

    throw lastError || new Error("Initialization failed");
  }

  async refreshTools(): Promise<void> {
    try {
      const result = (await this.sendRequest(
        "tools/list"
      )) as MCPListToolsResult;
      this.tools = result.tools || [];
      logger.info(
        `MCP server ${this.config.name} has ${this.tools.length} tools`
      );
    } catch (err: any) {
      logger.error(
        `Failed to refresh tools from ${this.config.name}: ${err.message}`
      );
      this.tools = [];
    }
  }

  async callTool(
    name: string,
    args?: Record<string, any>,
    timeout = 30000
  ): Promise<MCPCallToolResult> {
    if (this.state !== "ready") {
      throw new Error(`Cannot call tool in state: ${this.state}`);
    }

    const params: MCPCallToolParams = {
      name,
      arguments: args,
    };

    // Implement timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Tool call timeout")), timeout);
    });

    const requestPromise = this.sendRequest(
      "tools/call",
      params
    ) as Promise<MCPCallToolResult>;

    return Promise.race([requestPromise, timeoutPromise]);
  }

  async connect(): Promise<void> {
    throw new Error("connect must be implemented by transport subclass");
  }

  async disconnect(): Promise<void> {
    this.setState("disconnected");
    this.pendingRequests.clear();
  }
}
