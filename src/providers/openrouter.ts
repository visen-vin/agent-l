import { OpenAIProvider } from './openai.js';
import { ProviderRequest, ProviderResponse, Message, ToolCall } from '../types/index.js';

export class OpenRouterProvider extends OpenAIProvider {
    private siteUrl?: string;
    private siteName?: string;

    constructor(options: {
        apiKey: string;
        model?: string;
        siteUrl?: string;
        siteName?: string;
    }) {
        super({
            apiKey: options.apiKey,
            model: options.model || 'google/gemini-2.0-flash-001',
            baseUrl: 'https://openrouter.ai/api/v1',
        });
        this.siteUrl = options.siteUrl;
        this.siteName = options.siteName;
    }

    override async generate(request: ProviderRequest): Promise<ProviderResponse> {
        const originalGenerate = super.generate.bind(this);

        // We need to inject the extra headers. Since OpenAIProvider uses fetch internally,
        // we can either rewrite generate or modify how it handles headers.
        // For now, to keep it 'minimal', we'll just rewrite the fetch part for OpenRouter.

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(this as any).apiKey}`,
        };

        if (this.siteUrl) headers['HTTP-Referer'] = this.siteUrl;
        if (this.siteName) headers['X-Title'] = this.siteName;

        const response = await fetch(`${(this as any).baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: (this as any).model,
                messages: request.messages,
                tools: request.tools,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        const choice = data.choices[0];

        const message: Message = {
            role: choice.message.role,
            content: choice.message.content || '',
        };

        if (choice.message.tool_calls) {
            message.tool_calls = choice.message.tool_calls as ToolCall[];
        }

        const result: ProviderResponse = {
            message,
        };

        if (data.usage) {
            result.usage = {
                prompt_tokens: data.usage.prompt_tokens,
                completion_tokens: data.usage.completion_tokens,
            };
        }

        return result;
    }
}
