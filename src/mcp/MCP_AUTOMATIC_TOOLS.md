# Automatic MCP Tool Execution

The proxy now supports **automatic tool execution**! When you enable MCP tools in a chat request, the proxy will automatically execute tools when the AI model requests them.

## How It Works

1. **Enable MCP Tools**: Set `useMcpTools: true` in your chat request
2. **Model Requests Tools**: The AI model sees available MCP tools and can request them
3. **Automatic Execution**: The proxy automatically executes MCP tools via the MCP protocol
4. **Results Returned**: Tool results are sent back to the model
5. **Final Response**: The model generates a final response using the tool results

All of this happens automatically in a single request!

## Example Usage

### Basic Example

```bash
curl -X POST http://localhost:8080/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Read the file README.md and summarize it"}
    ],
    "useMcpTools": true
  }'
```

**What happens:**

1. Proxy includes MCP tools (e.g., `read_file`) in the request to OpenAI
2. OpenAI responds with a tool call: `read_file` with `{"path": "README.md"}`
3. Proxy automatically executes the tool via MCP
4. Proxy sends the file content back to OpenAI
5. OpenAI generates a summary using the file content
6. You get the final summary in the response

### Filesystem Server Example

With the filesystem MCP server, you can:

```bash
# List directory contents
curl -X POST http://localhost:8080/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "What files are in the current directory?"}
    ],
    "useMcpTools": true
  }'

# Read and analyze a file
curl -X POST http://localhost:8080/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Read package.json and tell me what dependencies are installed"}
    ],
    "useMcpTools": true
  }'

# Write a file
curl -X POST http://localhost:8080/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Create a file called test.txt with the content 'Hello World'"}
    ],
    "useMcpTools": true
  }'
```

### Multiple Tool Calls

The proxy can handle multiple tool calls in a single iteration:

```bash
curl -X POST http://localhost:8080/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Read both README.md and package.json and compare them"}
    ],
    "useMcpTools": true
  }'
```

The model can call multiple tools in parallel, and the proxy executes them all.

### Tool Execution Loop

The proxy automatically handles multi-step tool usage:

```bash
curl -X POST http://localhost:8080/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "List the files, then read the largest one and summarize it"}
    ],
    "useMcpTools": true
  }'
```

**Flow:**

1. First iteration: Model calls `list_directory`
2. Proxy executes it and returns results
3. Second iteration: Model calls `read_file` with the largest file
4. Proxy executes it and returns file content
5. Third iteration: Model generates summary using the file content
6. Final response returned

## Features

✅ **Automatic Tool Execution**: MCP tools are executed automatically when requested
✅ **Multi-Step Tool Usage**: Supports multiple tool calls in sequence
✅ **Parallel Tool Execution**: Handles multiple tools called simultaneously
✅ **Error Handling**: Gracefully handles tool execution errors
✅ **Usage Tracking**: Accumulates token usage across all iterations
✅ **Cost Tracking**: Tracks total cost across tool execution loop
✅ **Max Iterations**: Prevents infinite loops (max 10 iterations)

## Response Format

The response includes accumulated usage and cost:

```json
{
  "provider": "openai",
  "message": {
    "role": "assistant",
    "content": "The README.md file contains...",
    "tool_calls": null
  },
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 200,
    "total_tokens": 350
  },
  "cost": {
    "total_tokens": 350,
    "estimated_cost_usd": "0.003500",
    ...
  },
  "latency_ms": 2345
}
```

## Limitations

- **Streaming**: Tool execution is not yet supported in streaming mode
- **Non-MCP Tools**: Only MCP tools are automatically executed. Other tools must be executed by the client
- **Max Iterations**: Maximum of 10 tool execution iterations to prevent infinite loops
- **Caching**: Responses with tool execution are not cached (tool results may vary)

## Error Handling

If a tool execution fails:

```json
{
  "message": {
    "role": "assistant",
    "content": "I tried to read the file but encountered an error...",
    "tool_calls": null
  }
}
```

The error message is included in the tool result, and the model can handle it in its response.

## Supported Providers

All three providers support automatic tool execution:

- ✅ **OpenAI** (gpt-4o, gpt-4-turbo, etc.)
- ✅ **Anthropic** (claude-sonnet-4-5, claude-opus-4-1, etc.)
- ✅ **Mistral** (mistral-large, mistral-small, etc.)

## Next Steps

1. **Configure MCP Servers**: Set up your `mcp-servers.json` file
2. **Start the Proxy**: Run `pnpm dev`
3. **Test with Tools**: Try the examples above
4. **Check Available Tools**: Use `GET /v1/mcp/tools` to see what's available

Enjoy automatic tool execution! 🚀
