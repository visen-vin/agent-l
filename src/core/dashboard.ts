import express from 'express';
import cors from 'cors';
import { LLMProvider } from '../providers/provider.interface.js';
import { runAgent } from './runAgent.js';
import { ToolRegistry } from '../tools/toolRegistry.js';

/**
 * AgentLServer - A built-in, zero-config web dashboard and API server.
 */
export class AgentLServer {
    private app: express.Application;

    constructor(
        private provider: LLMProvider,
        private registry: ToolRegistry,
        private options: { port?: number; title?: string } = {}
    ) {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
    }

    private setupRoutes() {
        // API Endpoint for Chat
        this.app.post('/api/chat', async (req, res) => {
            const { messages } = req.body;
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            try {
                await runAgent(this.provider, {
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
                }, this.registry);
                res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
                res.end();
            } catch (error: any) {
                res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
                res.end();
            }
        });

        // Serve Embedded UI (HTML/CSS/JS)
        this.app.get('/', (req, res) => {
            res.send(this.getEmbeddedHTML());
        });
    }

    public listen(port?: number) {
        const finalPort = port || this.options.port || 3000;
        this.app.listen(finalPort, () => {
            console.log(`🚀 Agent-L Dashboard running at http://localhost:${finalPort}`);
        });
    }

    private getEmbeddedHTML() {
        const title = this.options.title || 'Agent-L | Console';
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Outfit:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root { --bg-color: #0d1117; --glass-bg: rgba(255, 255, 255, 0.03); --glass-border: rgba(255, 255, 255, 0.08); --accent: #58a6ff; --text: #c9d1d9; --text-dim: #8b949e; }
        body { font-family: 'Inter', sans-serif; background: var(--bg-color); color: var(--text); height: 100vh; margin: 0; display: flex; justify-content: center; align-items: center; background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0); background-size: 40px 40px; }
        .dashboard { width: 90%; max-width: 1000px; height: 85vh; background: var(--glass-bg); backdrop-filter: blur(12px); border: 1px solid var(--glass-border); border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.5); }
        .header { padding: 20px 30px; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; }
        .header h1 { font-family: 'Outfit', sans-serif; margin: 0; font-size: 1.5rem; }
        .header h1 span { color: var(--accent); }
        .chat-box { flex: 1; overflow-y: auto; padding: 30px; display: flex; flex-direction: column; gap: 15px; }
        .msg { padding: 12px 18px; border-radius: 12px; max-width: 85%; font-size: 0.95rem; line-height: 1.6; }
        .msg.user { align-self: flex-end; background: var(--accent); color: #000; font-weight: 500; }
        .msg.assistant { align-self: flex-start; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); }
        .tool { font-family: 'Cascadia Code', monospace; font-size: 0.8rem; color: #ffd700; background: rgba(0,0,0,0.4); padding: 10px; border-radius: 8px; border-left: 3px solid #ffd700; margin: 5px 0; }
        .input-area { padding: 25px 30px; border-top: 1px solid var(--glass-border); display: flex; gap: 12px; }
        input { flex: 1; background: rgba(255,255,255,0.04); border: 1px solid var(--glass-border); border-radius: 10px; padding: 14px 20px; color: #fff; outline: none; transition: 0.2s; }
        input:focus { border-color: var(--accent); background: rgba(255,255,255,0.06); }
        button { background: var(--accent); color: #000; border: none; border-radius: 10px; padding: 0 25px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        button:hover { filter: brightness(1.1); transform: translateY(-1px); }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>Agent-L <span>Console</span></h1>
            <div id="status" style="font-size: 0.8rem; color: var(--text-dim)">Ready</div>
        </div>
        <div id="chat" class="chat-box">
             <div class="msg assistant">Welcome. System initialized. How can I help?</div>
        </div>
        <div class="input-area">
            <input type="text" id="input" placeholder="Type instructions..." autofocus>
            <button onclick="send()">Send</button>
        </div>
    </div>
    <script>
        const chat = document.getElementById('chat');
        const input = document.getElementById('input');
        const status = document.getElementById('status');
        let history = [];

        function add(role, text) {
            const div = document.createElement('div');
            div.className = 'msg ' + role;
            div.innerText = text;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
            return div;
        }

        function log(text) {
            const div = document.createElement('div');
            div.className = 'tool';
            div.innerText = '⚙️ ' + text;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }

        async function send() {
            const text = input.value.trim();
            if (!text) return;
            add('user', text);
            history.push({ role: 'user', content: text });
            input.value = '';
            status.innerText = 'Thinking...';
            
            const assistDiv = add('assistant', '');
            let content = '';

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\\n');
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = JSON.parse(line.substring(6));
                    if (data.type === 'content') { content += data.delta; assistDiv.innerText = content; }
                    else if (data.type === 'tool_start') { log('Executing ' + data.tool); status.innerText = 'Running tool: ' + data.tool; }
                    else if (data.type === 'done') { history.push({ role: 'assistant', content }); status.innerText = 'Ready'; }
                }
            }
        }
        input.addEventListener('keypress', e => e.key === 'ENTER' && send());
    </script>
</body>
</html>`;
    }
}
