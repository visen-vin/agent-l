import { Telegraf } from 'telegraf';
import { LLMProvider } from '../providers/provider.interface.js';
import { runAgent } from '../core/runAgent.js';
import { ToolRegistry } from '../tools/toolRegistry.js';
import { Message } from '../types/index.js';

export class TelegramConnector {
    private bot: Telegraf;
    private sessions: Map<number, Message[]> = new Map();

    constructor(token: string, private provider: LLMProvider, private registry: ToolRegistry) {
        this.bot = new Telegraf(token);
        this.setupRoutes();
    }

    private setupRoutes() {
        this.bot.on('text', async (ctx) => {
            const chatId = ctx.chat.id;
            const userMessage = ctx.message.text;

            // Get or initialize session
            let history = this.sessions.get(chatId) || [];
            history.push({ role: 'user', content: userMessage });

            try {
                await ctx.sendChatAction('typing');

                const response = await runAgent(this.provider, {
                    messages: history,
                    onStream: async (chunk) => {
                        // For telegram, we can't really stream "typing" easily without editing messages, 
                        // so we'll just wait for the full response for now or use a buffer.
                    },
                }, this.registry);

                // Update history with assistant response
                history.push({ role: 'assistant', content: response.content });
                // Keep history manageable (simple sliding window for connector as fallback)
                if (history.length > 50) history = history.slice(-50);
                this.sessions.set(chatId, history);

                await ctx.reply(response.content);
            } catch (error: any) {
                console.error('Telegram error:', error);
                await ctx.reply(`Error: ${error.message}`);
            }
        });
    }

    public launch() {
        this.bot.launch();
        console.log('Telegram Bot launched');
    }

    public stop(reason: string) {
        this.bot.stop(reason);
    }
}
