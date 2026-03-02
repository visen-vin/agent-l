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
        const title = this.options.title || 'AgentL | Intelligence Console';
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #050505;
            --surface: rgba(255, 255, 255, 0.03);
            --border: rgba(255, 255, 255, 0.08);
            --accent: #00ff88;
            --accent-glow: rgba(0, 255, 136, 0.2);
            --text: #ffffff;
            --text-dim: #a1a1a1;
            --user-msg: rgba(255, 255, 255, 0.05);
        }

        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            background: var(--bg);
            color: var(--text);
            font-family: 'Plus Jakarta Sans', sans-serif;
            height: 100vh;
            display: flex;
            overflow: hidden;
        }

        /* Abstract Background */
        .bg-mesh {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: 
                radial-gradient(circle at 0% 0%, rgba(0, 255, 136, 0.05) 0%, transparent 50%),
                radial-gradient(circle at 100% 100%, rgba(0, 150, 255, 0.05) 0%, transparent 50%);
            z-index: -1;
        }

        .container {
            display: flex;
            width: 100%;
            height: 100%;
        }

        /* Sidebar */
        .sidebar {
            width: 280px;
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(20px);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            padding: 24px;
        }

        .logo { font-size: 20px; font-weight: 700; margin-bottom: 40px; display: flex; align-items: center; gap: 10px; }
        .logo span { color: var(--accent); text-shadow: 0 0 20px var(--accent-glow); }
        
        .nav-item {
            padding: 12px 16px;
            border-radius: 10px;
            margin-bottom: 8px;
            cursor: pointer;
            font-size: 14px;
            color: var(--text-dim);
            transition: 0.2s;
            display: flex; align-items: center; gap: 12px;
        }
        .nav-item.active { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
        .nav-item:hover { color: var(--text); background: rgba(255,255,255,0.02); }

        /* Chat Area */
        .chat-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            position: relative;
        }

        .chat-header {
            height: 70px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 40px;
            border-bottom: 1px solid var(--border);
            backdrop-filter: blur(10px);
        }

        .status-pill {
            display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim);
            padding: 6px 14px; background: var(--surface); border-radius: 100px; border: 1px solid var(--border);
        }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); }

        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 40px;
            display: flex;
            flex-direction: column;
            gap: 32px;
        }

        .msg-row { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 800px; margin: 0 auto; }
        .msg-row.user { align-items: flex-end; }
        .msg-row.assistant { align-items: flex-start; }

        .bubble {
            padding: 16px 20px;
            border-radius: 16px;
            font-size: 15px;
            line-height: 1.6;
            max-width: 100%;
        }
        .msg-row.user .bubble { background: var(--surface); border: 1px solid var(--border); }
        .msg-row.assistant .bubble { background: transparent; }

        .label { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 4px; }

        /* Tool Cards */
        .tool-call {
            background: rgba(0, 255, 136, 0.03);
            border: 1px solid rgba(0, 255, 136, 0.1);
            padding: 12px 16px;
            border-radius: 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            display: flex; align-items: center; gap: 12px;
            margin: 8px 0;
            color: var(--accent);
            animation: slideIn 0.3s ease-out;
        }
        .tool-icon { width: 14px; height: 14px; }

        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* Input Zone */
        .input-wrap {
            padding: 30px 40px 40px;
            display: flex;
            justify-content: center;
        }
        .input-container {
            width: 100%;
            max-width: 800px;
            position: relative;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 6px;
            display: flex; align-items: center;
            transition: 0.3s;
        }
        .input-container:focus-within {
            border-color: var(--accent);
            background: rgba(255, 255, 255, 0.04);
            box-shadow: 0 0 30px rgba(0, 255, 136, 0.05);
        }

        input {
            flex: 1;
            background: transparent;
            border: none;
            color: white;
            padding: 16px 20px;
            font-size: 15px;
            outline: none;
            font-family: inherit;
        }

        .send-btn {
            width: 44px; height: 44px;
            background: var(--accent);
            border: none; border-radius: 14px;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: 0.2s;
            margin-right: 6px;
        }
        .send-btn:hover { transform: scale(1.05); filter: brightness(1.1); }
        .send-btn:active { transform: scale(0.95); }
        .send-btn svg { width: 20px; height: 20px; color: black; }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
    </style>
</head>
<body>
    <div class="bg-mesh"></div>
    <div class="container">
        <aside class="sidebar">
            <div class="logo"><span>AgentL</span> Intelligence</div>
            <div class="nav-item active">
                 💬 Intelligence Console
            </div>
            <div class="nav-item">
                 🛠 Built-in Tools
            </div>
            <div class="nav-item">
                 ⚙️ Settings
            </div>
        </aside>

        <main class="chat-main">
            <header class="chat-header">
                <div style="font-weight: 600; color: var(--text-dim)">Autonomous Instance</div>
                <div class="status-pill"><div class="status-dot"></div> System Active</div>
            </header>

            <div class="messages" id="chat">
                <!-- Welcome -->
                <div class="msg-row assistant">
                    <div class="label">System</div>
                    <div class="bubble">I am initialized and ready for autonomous task execution. What is the objective?</div>
                </div>
            </div>

            <div class="input-wrap">
                <div class="input-container">
                    <input type="text" id="userInput" placeholder="Define objective..." autofocus autocomplete="off">
                    <button class="send-btn" id="sendBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </div>
            </div>
        </main>
    </div>

    <script>
        const chat = document.getElementById('chat');
        const input = document.getElementById('userInput');
        const sendBtn = document.getElementById('sendBtn');
        let history = [];

        function append(role, text = '', isTool = false) {
            const row = document.createElement('div');
            row.className = isTool ? 'tool-call' : 'msg-row ' + role;
            
            if (isTool) {
                row.innerHTML = '⚡ <span>' + text + '</span>';
            } else {
                row.innerHTML = '<div class="label">' + (role === 'user' ? 'Operator' : 'Agent') + '</div><div class="bubble">' + text + '</div>';
            }
            
            chat.appendChild(row);
            chat.scrollTop = chat.scrollHeight;
            return row.querySelector('.bubble') || row.querySelector('span');
        }

        async function step() {
            const query = input.value.trim();
            if (!query) return;

            input.value = '';
            append('user', query);
            history.push({ role: 'user', content: query });

            const assistBubble = append('assistant', '');
            let fullText = '';
            
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: history })
                });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\\n\\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.type === 'content') {
                                fullText += data.delta;
                                assistBubble.innerText = fullText;
                                chat.scrollTop = chat.scrollHeight;
                            } else if (data.type === 'tool_start') {
                                append('assistant', 'Invoking ' + data.tool + '...', true);
                            } else if (data.type === 'done') {
                                history.push({ role: 'assistant', content: fullText });
                            } else if (data.type === 'error') {
                                append('assistant', 'Error: ' + data.message);
                            }
                        } catch (e) { }
                    }
                }
            } catch (err) {
                append('assistant', 'Connection failed.');
            }
        }

        sendBtn.onclick = step;
        input.onkeydown = e => e.key === 'Enter' && step();
    </script>
</body>
</html>`;
    }
}
