import { spawn, ChildProcess } from "child_process";
import { MCPClient } from "../client.js";
import type { JSONRPCRequest, MCPServerConfig } from "../types.js";
import { logger } from "@/utils/logger.js";

export class StdioMCPClient extends MCPClient {
  private process: ChildProcess | null = null;
  private messageBuffer = "";

  async connect(): Promise<void> {
    if (!this.config.command) {
      throw new Error("Stdio transport requires 'command' in config");
    }

    const command = this.config.command;
    const args = this.config.args || [];
    const env = {
      ...process.env,
      ...this.config.env,
    };

    logger.info(`Starting MCP server: ${command} ${args.join(" ")}`);

    this.process = spawn(command, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Handle stdout (MCP messages)
    // MCP uses NDJSON (newline-delimited JSON), where each complete JSON object
    // is on its own line. We need to accumulate data and parse complete messages.
    this.process.stdout?.on("data", (data: Buffer) => {
      this.messageBuffer += data.toString();

      // Process complete messages (those ending with \n)
      while (true) {
        const newlineIndex = this.messageBuffer.indexOf("\n");
        if (newlineIndex === -1) {
          // No complete message yet, wait for more data
          break;
        }

        // Extract the line (excluding the newline)
        const line = this.messageBuffer.slice(0, newlineIndex);
        this.messageBuffer = this.messageBuffer.slice(newlineIndex + 1);

        // Only process non-empty lines
        if (line.trim()) {
          try {
            this.handleMessage(line);
          } catch (err: any) {
            logger.error(`Failed to handle MCP message: ${err.message}`);
          }
        }
      }
    });

    // Handle stderr (logging)
    this.process.stderr?.on("data", (data: Buffer) => {
      logger.debug(`MCP server ${this.config.name} stderr: ${data.toString()}`);
    });

    // Handle process exit
    this.process.on("exit", (code, signal) => {
      logger.warn(
        `MCP server ${this.config.name} exited with code ${code}, signal ${signal}`
      );
      this.setState("disconnected");
      this.emit("disconnect");
    });

    // Handle process errors
    this.process.on("error", (err) => {
      logger.error(
        `MCP server ${this.config.name} process error: ${err.message}`
      );
      this.setState("error");
      this.emit("error", err);
    });

    // Wait a bit for process to start
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  protected async sendMessage(request: JSONRPCRequest): Promise<void> {
    if (!this.process || !this.process.stdin) {
      throw new Error("MCP server process not connected");
    }

    const message = JSON.stringify(request) + "\n";
    this.process.stdin.write(message);
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.messageBuffer = "";
    await super.disconnect();
  }
}
