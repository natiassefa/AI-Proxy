# 🧠 AI Proxy Server (Enhanced Version)

A unified Node.js API gateway for OpenAI, Anthropic, and Mistral with caching, cost tracking, and error normalization.

## 🚀 Run Locally

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Example Request

```bash
curl -X POST http://localhost:8080/v1/chat   -H "Content-Type: application/json"   -d '{
    "provider": "openai",
    "model": "gpt-4-turbo",
    "messages": [{"role":"user","content":"Hello"}]
  }'
```
