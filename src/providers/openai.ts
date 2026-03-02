import { LLMProvider, StreamChunk } from './provider.interface.js';
import { ProviderRequest, ProviderResponse, Message, ToolCall } from '../types/index.js';
import { withRetry } from '../core/utils.js';

export class OpenAIProvider implements LLMProvider {
    protected apiKey: string;
    protected model: string;
    protected baseUrl: string;

    constructor(options: { apiKey: string; model?: string; baseUrl?: string }) {
        this.apiKey = options.apiKey;
        this.model = options.model || 'gpt-4o';
        this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    }

    async generate(request: ProviderRequest): Promise<ProviderResponse> {
        const response = await withRetry(async () => {
            const res = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: request.messages,
                    tools: request.tools,
                }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(`OpenAI API error: ${res.status} ${JSON.stringify(error)}`);
            }
            return res;
        });

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

    generateStream(request: ProviderRequest): AsyncIterable<any> {
        const self = this;
        return {
            async *[Symbol.asyncIterator]() {
                const response = await withRetry(async () => {
                    const res = await fetch(`${self.baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${self.apiKey}`,
                        },
                        body: JSON.stringify({
                            model: self.model,
                            messages: request.messages,
                            tools: request.tools,
                            stream: true,
                            stream_options: { include_usage: true }
                        }),
                    });

                    if (!res.ok) {
                        const error = await res.json();
                        throw new Error(`OpenAI API error: ${res.status} ${JSON.stringify(error)}`);
                    }
                    return res;
                });

                const reader = response.body?.getReader();
                if (!reader) throw new Error('No response body');

                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]') continue;
                        if (trimmed.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(trimmed.slice(6));
                                const chunk = data.choices[0]?.delta?.content || '';
                                const usage = data.usage;

                                yield {
                                    content: chunk,
                                    done: false,
                                    usage: usage ? {
                                        prompt_tokens: usage.prompt_tokens,
                                        completion_tokens: usage.completion_tokens
                                    } : undefined
                                };
                            } catch (e) {
                                // Ignore incomplete JSON
                            }
                        }
                    }
                }
                yield { content: '', done: true };
            }
        };
    }
}
