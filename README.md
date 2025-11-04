# 🧠 AI Proxy Server

A unified Node.js API gateway for **OpenAI**, **Anthropic**, and **Mistral** with intelligent caching, comprehensive cost tracking, and error normalization. Built with TypeScript and Fastify.

## ✨ Features

- **Multi-Provider Support**: Unified interface for OpenAI, Anthropic (Claude), and Mistral AI
- **Streaming Support (SSE)**: Real-time token streaming using Server-Sent Events for all providers
- **Intelligent Caching**: Optional Redis caching to reduce API costs and improve response times
- **Cost Tracking**: Detailed per-model cost tracking with breakdowns for input/output tokens
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Normalized error responses with helpful schema validation
- **Hot Reloading**: Development server with automatic reload on file changes
- **Request Validation**: Zod schema validation with human-readable error messages

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- API keys for at least one provider (OpenAI, Anthropic, or Mistral)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd AI-Proxy

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
```

### Configuration

Edit your `.env` file with your API keys:

```env
# Server Configuration
PORT=8080

# AI Provider API Keys (at least one required)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here

# Optional: Redis Cache Configuration
# For local Redis with Docker:
REDIS_URL=redis://localhost:6379
```

### Running the Server

```bash
# Development mode (with hot reloading)
pnpm dev

# Production mode
pnpm build
pnpm start
```

The server will start on `http://localhost:8080` (or your configured port).

## 📦 Optional: Redis Caching Setup

Caching is **completely optional**. The server works perfectly without Redis, but enabling it can significantly reduce API costs and improve response times for repeated requests.

### Using Docker (Recommended)

The easiest way to run Redis locally is with Docker:

```bash
# Run Redis in a Docker container
docker run -d \
  --name redis-aiproxy \
  -p 6379:6379 \
  redis:7-alpine

# Or with Docker Compose (create docker-compose.yml):
```

**docker-compose.yml:**

```yaml
version: "3.8"
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

Then run:

```bash
docker-compose up -d
```

Once Redis is running, add to your `.env`:

```env
REDIS_URL=redis://localhost:6379
```

The cache will automatically:

- Cache responses for 10 minutes (600 seconds)
- Reduce redundant API calls
- Improve response times for cached requests

**Note**: If `REDIS_URL` is not set, the server will work normally without caching - no errors, no warnings, just direct API calls.

## 📡 API Usage

### Health Check

```bash
curl http://localhost:8080/
```

Response:

```json
{
  "status": "ok",
  "service": "AI Proxy"
}
```

### Chat Completions

**Non-Streaming (default):**

```bash
curl -X POST http://localhost:8080/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### Streaming Responses (SSE)

Stream responses using Server-Sent Events (SSE) for real-time token delivery:

**Request:**

```bash
curl -N -H "Accept: text/event-stream" \
  "http://localhost:8080/v1/chat?stream=true" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Tell me a story"}]
  }'
```

**Or with `stream` in the request body:**

```bash
curl -N -H "Accept: text/event-stream" \
  "http://localhost:8080/v1/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Tell me a story"}],
    "stream": true
  }'
```

**Response (SSE format):**

```
event: chunk
data: {"content":"Once","role":"assistant"}

event: chunk
data: {"content":" upon","role":"assistant"}

event: chunk
data: {"content":" a","role":"assistant"}

event: done
data: {"usage":{"prompt_tokens":10,"completion_tokens":150,"total_tokens":160},"cost":{"total_tokens":160,"estimated_cost_usd":"0.001600",...},"latency_ms":2345}
```

**JavaScript Client Example:**

```javascript
// Note: EventSource only supports GET requests, so for POST you'll need fetch or a library
const response = await fetch("http://localhost:8080/v1/chat?stream=true", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    provider: "openai",
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split("\n\n");

  for (const line of lines) {
    if (line.startsWith("event: chunk")) {
      const dataLine = lines[lines.indexOf(line) + 1];
      if (dataLine && dataLine.startsWith("data: ")) {
        const data = JSON.parse(dataLine.slice(6));
        console.log(data.content); // Accumulate content
      }
    } else if (line.startsWith("event: done")) {
      const dataLine = lines[lines.indexOf(line) + 1];
      if (dataLine && dataLine.startsWith("data: ")) {
        const data = JSON.parse(dataLine.slice(6));
        console.log("Usage:", data.usage);
        console.log("Cost:", data.cost);
      }
    }
  }
}
```

**Python Client Example:**

```python
import requests
import json

url = "http://localhost:8080/v1/chat?stream=true"
data = {
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}]
}

response = requests.post(url, json=data, stream=True)

for line in response.iter_lines():
    if line:
        line = line.decode('utf-8')
        if line.startswith('data: '):
            try:
                data = json.loads(line[6:])
                print(data)
            except json.JSONDecodeError:
                pass
```

**Important Notes:**

- **Streaming requests are not cached** - Each streaming request makes a fresh API call
- The `stream` parameter can be passed as a query parameter (`?stream=true`) or in the request body (`"stream": true`)
- Use `curl -N` flag to disable buffering and see chunks in real-time
- **Postman and similar tools may buffer** the entire response - use `curl -N` or browser EventSource for real streaming
- **Anthropic streaming**: Usage data is not available in streaming mode (will show zeros) - use non-streaming requests for accurate token counts

### Supported Providers and Models

**OpenAI:**

- `gpt-4o`, `gpt-4o-mini`
- `gpt-4-turbo`, `gpt-4`
- `gpt-3.5-turbo`
- `o1`, `o1-mini`, `o3`, `o3-mini`

**Anthropic:**

- `claude-sonnet-4-5`, `claude-haiku-4-5`, `claude-opus-4-1`
- Legacy: `claude-sonnet-4`, `claude-3-7-sonnet`, etc.

**Mistral:**

- `mistral-large`, `mistral-small`, `mistral-medium`
- `mistral-nemo`, `pixtral-12b`, `codestral`

### Response Format

```json
{
  "provider": "openai",
  "message": {
    "role": "assistant",
    "content": "Hello! I'm doing well, thank you for asking..."
  },
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 25,
    "total_tokens": 35
  },
  "cost": {
    "total_tokens": 35,
    "input_tokens": 10,
    "output_tokens": 25,
    "estimated_cost_usd": "0.000350",
    "input_cost_usd": "0.000025",
    "output_cost_usd": "0.000250"
  },
  "latency_ms": 1234
}
```

### Error Handling

If validation fails, you'll get a helpful error response:

```json
{
  "error": "Invalid request",
  "details": {
    "provider": {
      "_errors": ["Required"]
    }
  },
  "expectedSchema": {
    "structure": {
      "type": "object",
      "properties": {
        "provider": {
          "type": "enum",
          "options": ["openai", "anthropic", "mistral"]
        },
        "model": { "type": "string" },
        "messages": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "role": {
                "type": "enum",
                "options": ["system", "user", "assistant"]
              },
              "content": { "type": "string" }
            }
          }
        }
      }
    },
    "description": "provider: enum: openai | anthropic | mistral\nmodel: string\nmessages: array of:\n  role: enum: system | user | assistant\n  content: string",
    "example": {
      "provider": "openai",
      "model": "gpt-4-turbo",
      "messages": [{ "role": "user", "content": "Hello" }]
    }
  }
}
```

## 🏗️ Project Structure

```
src/
├── config.ts              # Environment configuration
├── index.ts               # Application entry point
├── server.ts              # Fastify server setup
├── providers/             # AI provider implementations
│   ├── base.ts           # Provider routing logic
│   ├── types.ts          # Shared provider types
│   ├── openai.ts         # OpenAI integration
│   ├── anthropic.ts      # Anthropic integration
│   └── mistral.ts        # Mistral integration
├── routes/                # API routes
│   ├── chat.ts           # Chat completions endpoint
│   └── health.ts         # Health check endpoint
└── utils/                 # Utility modules
    ├── cache.ts          # Redis caching
    ├── costTracker/      # Cost tracking module
    │   ├── index.ts      # Main cost tracker
    │   ├── types.ts      # Cost types
    │   ├── pricing/      # Provider pricing data
    │   └── calculators/  # Cost calculation logic
    ├── logger.ts         # Winston logger
    └── schemaFormatter.ts # Schema validation helpers
```

## 💰 Cost Tracking

The cost tracker provides detailed per-model pricing:

- **OpenAI**: Comprehensive pricing for all GPT models, O1/O3 series
- **Anthropic**: Claude Sonnet, Haiku, and Opus models
- **Mistral**: Large, Small, Medium, Nemo, Pixtral, and Codestral models

Costs are calculated based on:

- Separate input/output token pricing
- Per-million-token rates
- Detailed breakdowns in responses

## 🛠️ Development

```bash
# Development with hot reloading
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Type checking
pnpm tsc --noEmit
```

### Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify
- **Validation**: Zod
- **Caching**: Redis (ioredis)
- **Logging**: Winston
- **HTTP Client**: Axios

## 🤝 Contributing

We welcome contributions! This project is designed to be extensible and easy to contribute to.

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow the existing code style and patterns
4. **Add tests**: If applicable, add tests for new functionality
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**: Describe your changes and why they're valuable

### Areas for Contribution

- **New Providers**: Add support for additional AI providers (Cohere, Google, etc.)
- **Pricing Updates**: Keep pricing data current as providers update their rates
- **Features**: Caching improvements, rate limiting, request queuing, etc.
- **Documentation**: Improve docs, add examples, tutorials
- **Testing**: Add unit tests, integration tests, E2E tests
- **Performance**: Optimize caching, reduce latency, improve throughput
- **Error Handling**: Better error messages, retry logic, circuit breakers

### Code Style

- Use TypeScript with strict mode
- Follow existing patterns and conventions
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions focused and modular

### Questions?

Feel free to open an issue for:

- Bug reports
- Feature requests
- Questions about implementation
- Documentation improvements

## 📝 License

[Add your license here]

## 🙏 Acknowledgments

- OpenAI, Anthropic, and Mistral for their excellent AI APIs
- The Fastify team for the amazing web framework
- All contributors who help improve this project

---

**Made with ❤️ for the AI community**
