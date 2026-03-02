import express from 'express';
import cors from 'cors';
import { runAgent, OpenRouterProvider, ToolRegistry, ShellTool, SystemInfoTool } from './index.js';
import { TelegramConnector } from './connectors/telegram.js';

const app = express();
app.use(cors());
app.use(express.json());

const provider = new OpenRouterProvider({
    apiKey: process.env.OPENROUTER_API_KEY || '',
});

const registry = new ToolRegistry();
registry.register(ShellTool.definition);
registry.register(SystemInfoTool.definition);

// Initialize Telegram if token is provided
const tgToken = process.env.TELEGRAM_BOT_TOKEN;
if (tgToken) {
    const tg = new TelegramConnector(tgToken, provider, registry);
    tg.launch();
}

app.post('/chat', async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
    }

    // Set headers for SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const result = await runAgent(provider, {
            messages,
            onStream: (chunk) => {
                res.write(`data: ${JSON.stringify({ type: 'content', delta: chunk })}\n\n`);
            },
            onToolStart: (tool) => {
                res.write(`data: ${JSON.stringify({ type: 'tool_start', tool: tool.function.name })}\n\n`);
            },
            onToolEnd: (tool, output) => {
                res.write(`data: ${JSON.stringify({ type: 'tool_end', tool: tool.function.name, output })}\n\n`);
            }
        }, registry);

        res.write(`data: ${JSON.stringify({ type: 'done', result })}\n\n`);
        res.end();
    } catch (error: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});

app.post('/webhook', async (req, res) => {
    try {
        const { messages, webhook_url } = req.body;
        const response = await runAgent(provider, { messages }, registry);

        if (webhook_url) {
            fetch(webhook_url, {
                method: 'POST',
                body: JSON.stringify({ result: response })
            }).catch(console.error);
        }

        res.json(response);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`OpenClaw-SDK Server running on port ${PORT}`);
});
