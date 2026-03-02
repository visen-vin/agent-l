# Agent-L 🚀🤖

**High-Performance, Production-Grade Agentic Engine.** 

Agent-L is a lightweight, deterministic SDK designed to replace bloated agent frameworks (like OpenClaw). It's optimized for speed (Parallel Tools), efficiency (Tree Shaking Memory), and power (Local Shell Access).

## Key Features

- **⚡ Parallel Tool Execution**: Concurrently execute multiple tool calls using `Promise.all`.
- **🌳 Tree Shaking Context**: Intelligent pruning that always keeps System Prompt + relevant memories + recent flow.
- **🧠 Semantic Memory**: Zero-cost local embeddings or persistent Qdrant storage.
- **🐚 Local Shell Access**: Sandboxed or direct terminal execution capabilities.
- **🛡️ Production Grade**: Auto-retry with exponential backoff, SSE streaming, and observability hooks.
- **🔌 Multi-Channel**: Built-in support for Telegram and Webhooks.

## Installation

```bash
npm install agentl
```

## Quick Start

```typescript
import { runAgent, OpenRouterProvider, ToolRegistry, ShellTool } from 'agentl';

const provider = new OpenRouterProvider({ apiKey: 'YOUR_API_KEY' });
const registry = new ToolRegistry();
registry.register(ShellTool.definition);

const response = await runAgent(provider, {
  messages: [{ role: 'user', content: 'List files in the current directory' }],
  onStream: (chunk) => process.stdout.write(chunk),
}, registry);

console.log(response.content);
```

## Advanced Usage

### Telegram Bot
```typescript
import { TelegramConnector } from 'agentl';

const tg = new TelegramConnector(process.env.TG_TOKEN, provider, registry);
tg.launch();
```

### Docker Deployment
```bash
docker-compose up --build
```

## License
MIT
