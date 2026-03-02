# minimal-agent-sdk

A minimal, deterministic, single-agent loop SDK for Node.js.

## Fast, Zero-Dependency Core
Under 500 lines of code. No heavy frameworks. Full control.

## Installation
```bash
npm install minimal-agent-sdk
```

## 20-Line Example
```typescript
import { runAgent, OpenAIProvider, ToolRegistry } from 'minimal-agent-sdk';

const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
const registry = new ToolRegistry();

registry.register({
  name: 'get_weather',
  description: 'Get weather for a city',
  schema: { type: 'object', properties: { city: { type: 'string' } } },
  execute: async ({ city }) => `Sunny in ${city}, 25°C`,
});

const response = await runAgent(provider, {
  messages: [{ role: 'user', content: 'What is the weather in London?' }],
  system: 'You are a helpful weather assistant.',
}, registry);

console.log(response.content);
// Output: The weather in London is sunny and 25°C.
```

## Features
- ✅ Deterministic single-agent loop
- ✅ Tool calling
- ✅ Pluggable LLM providers (OpenAI included)
- ✅ **Semantic Retrieval (Memory)**: Inject relevant past context based on query (Local or Qdrant).
- ✅ **Qdrant Integration**: Connect to persistent Vector DB in Docker.
- ✅ **Context Pruning**: "Tree Shaking" (1 + Middle + 2) strategy.
- ✅ Zero external framework dependency
- ✅ Fully typed

## License
MIT
# agent-l
