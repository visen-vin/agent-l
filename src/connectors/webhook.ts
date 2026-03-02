import { LLMProvider } from '../providers/provider.interface.js';
import { runAgent } from '../core/runAgent.js';
import { ToolRegistry } from '../tools/toolRegistry.js';

export class WebhookConnector {
    constructor(private provider: LLMProvider, private registry: ToolRegistry) { }

    async handleIncoming(payload: any): Promise<any> {
        const { messages, webhook_url } = payload;

        const response = await runAgent(this.provider, {
            messages,
        }, this.registry);

        if (webhook_url) {
            // Outgoing notification
            try {
                await fetch(webhook_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'success',
                        result: response
                    })
                });
            } catch (e) {
                console.error('Failed to send outgoing webhook:', e);
            }
        }

        return response;
    }
}
