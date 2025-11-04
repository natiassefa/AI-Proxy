import type { Provider, Tool } from "../types.js";

export type ToolSupportInfo = {
  supported: boolean;
  max_tools?: number; // Maximum number of tools allowed (if applicable)
  recommended_tools?: number; // Recommended number of tools for optimal performance
  notes?: string; // Any model-specific notes or limitations
  streaming_supported?: boolean; // Whether tools work in streaming mode
  available_tools?: Tool[]; // Example/recommended tools that users can use
};

export type ModelToolMetadata = {
  provider: Provider;
  model: string;
  support: ToolSupportInfo;
};

// Common example tools that can be used with models
// These are example/recommended tools - users can define their own tools
const COMMON_EXAMPLE_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state, e.g. San Francisco, CA",
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit",
          },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for information",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
          max_results: {
            type: "number",
            description: "Maximum number of results to return",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Perform mathematical calculations",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "Mathematical expression to evaluate",
          },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email message",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Recipient email address",
          },
          subject: {
            type: "string",
            description: "Email subject",
          },
          body: {
            type: "string",
            description: "Email body content",
          },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stock_price",
      description: "Get the current stock price for a symbol",
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "Stock ticker symbol (e.g. AAPL, GOOGL)",
          },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Get the current date and time",
      parameters: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description: "Timezone (e.g. UTC, America/New_York)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a calendar event",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Event title",
          },
          start_time: {
            type: "string",
            description: "Event start time (ISO 8601 format)",
          },
          end_time: {
            type: "string",
            description: "Event end time (ISO 8601 format)",
          },
          description: {
            type: "string",
            description: "Event description",
          },
        },
        required: ["title", "start_time", "end_time"],
      },
    },
  },
];

// Model-specific tool support metadata
// This should be maintained as new models are released
const MODEL_TOOL_METADATA: Record<string, ModelToolMetadata> = {
  // OpenAI Models
  "openai:gpt-4o": {
    provider: "openai",
    model: "gpt-4o",
    support: {
      supported: true,
      max_tools: 128, // OpenAI's limit
      recommended_tools: 20,
      streaming_supported: true,
      notes: "Full tool calling support with streaming",
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "openai:gpt-4o-mini": {
    provider: "openai",
    model: "gpt-4o-mini",
    support: {
      supported: true,
      max_tools: 128,
      recommended_tools: 20,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "openai:gpt-4-turbo": {
    provider: "openai",
    model: "gpt-4-turbo",
    support: {
      supported: true,
      max_tools: 128,
      recommended_tools: 20,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "openai:gpt-4": {
    provider: "openai",
    model: "gpt-4",
    support: {
      supported: true,
      max_tools: 128,
      recommended_tools: 20,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "openai:gpt-3.5-turbo": {
    provider: "openai",
    model: "gpt-3.5-turbo",
    support: {
      supported: true,
      max_tools: 128,
      recommended_tools: 20,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  // Note: o1, o1-mini, o3, o3-mini don't support tools
  "openai:o1": {
    provider: "openai",
    model: "o1",
    support: {
      supported: false,
      notes: "o1 models do not support function calling",
    },
  },
  "openai:o1-mini": {
    provider: "openai",
    model: "o1-mini",
    support: {
      supported: false,
      notes: "o1 models do not support function calling",
    },
  },
  "openai:o3": {
    provider: "openai",
    model: "o3",
    support: {
      supported: false,
      notes: "o3 models do not support function calling",
    },
  },
  "openai:o3-mini": {
    provider: "openai",
    model: "o3-mini",
    support: {
      supported: false,
      notes: "o3 models do not support function calling",
    },
  },

  // Anthropic Models
  "anthropic:claude-sonnet-4-5": {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    support: {
      supported: true,
      max_tools: 2048, // Anthropic's limit
      recommended_tools: 50,
      streaming_supported: true,
      notes:
        "Full tool use support with streaming. Uses content blocks format.",
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "anthropic:claude-haiku-4-5": {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    support: {
      supported: true,
      max_tools: 2048,
      recommended_tools: 50,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "anthropic:claude-opus-4-1": {
    provider: "anthropic",
    model: "claude-opus-4-1",
    support: {
      supported: true,
      max_tools: 2048,
      recommended_tools: 50,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "anthropic:claude-sonnet-4": {
    provider: "anthropic",
    model: "claude-sonnet-4",
    support: {
      supported: true,
      max_tools: 2048,
      recommended_tools: 50,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "anthropic:claude-3-7-sonnet": {
    provider: "anthropic",
    model: "claude-3-7-sonnet",
    support: {
      supported: true,
      max_tools: 2048,
      recommended_tools: 50,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },

  // Mistral Models
  "mistral:mistral-large": {
    provider: "mistral",
    model: "mistral-large",
    support: {
      supported: true,
      max_tools: 64, // Mistral's limit (approximate)
      recommended_tools: 10,
      streaming_supported: true,
      notes: "Full function calling support with streaming",
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "mistral:mistral-small": {
    provider: "mistral",
    model: "mistral-small",
    support: {
      supported: true,
      max_tools: 64,
      recommended_tools: 10,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "mistral:mistral-medium": {
    provider: "mistral",
    model: "mistral-medium",
    support: {
      supported: true,
      max_tools: 64,
      recommended_tools: 10,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "mistral:mistral-nemo": {
    provider: "mistral",
    model: "mistral-nemo",
    support: {
      supported: true,
      max_tools: 64,
      recommended_tools: 10,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "mistral:pixtral-12b": {
    provider: "mistral",
    model: "pixtral-12b",
    support: {
      supported: true,
      max_tools: 64,
      recommended_tools: 10,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
  "mistral:codestral": {
    provider: "mistral",
    model: "codestral",
    support: {
      supported: true,
      max_tools: 64,
      recommended_tools: 10,
      streaming_supported: true,
      available_tools: COMMON_EXAMPLE_TOOLS,
    },
  },
};

/**
 * Get tool support information for a specific provider and model
 */
export function getToolSupport(
  provider: Provider,
  model: string
): ToolSupportInfo | null {
  const key = `${provider}:${model}`;
  const metadata = MODEL_TOOL_METADATA[key];
  return metadata?.support || null;
}

/**
 * Get full metadata for a specific provider and model
 */
export function getModelToolMetadata(
  provider: Provider,
  model: string
): ModelToolMetadata | null {
  const key = `${provider}:${model}`;
  return MODEL_TOOL_METADATA[key] || null;
}

/**
 * Check if a model supports tools
 */
export function supportsTools(provider: Provider, model: string): boolean {
  const support = getToolSupport(provider, model);
  return support?.supported === true;
}

/**
 * Get all models that support tools for a provider
 */
export function getModelsWithToolSupport(provider: Provider): string[] {
  return Object.values(MODEL_TOOL_METADATA)
    .filter((meta) => meta.provider === provider && meta.support.supported)
    .map((meta) => meta.model);
}
