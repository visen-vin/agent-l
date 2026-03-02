import { describe, it, expect, vi } from 'vitest';
import { ToolRegistry } from './tools/toolRegistry.js';
import { agentLoop } from './core/agentLoop.js';
import { LLMProvider } from './providers/provider.interface.js';

describe('ToolRegistry', () => {
    it('should register and execute tools', async () => {
        const registry = new ToolRegistry();
        const mockExecute = vi.fn().mockResolvedValue('World');

        registry.register({
            name: 'hello',
            description: 'says hello',
            schema: {},
            execute: mockExecute,
        });

        const result = await registry.execute({
            id: '1',
            type: 'function',
            function: { name: 'hello', arguments: '{}' },
        });

        expect(result).toBe('World');
        expect(mockExecute).toHaveBeenCalled();
    });
});

describe('agentLoop', () => {
    it('should terminate the loop when no tool calls are present', async () => {
        const mockProvider: LLMProvider = {
            generate: vi.fn().mockResolvedValue({
                message: { role: 'assistant', content: 'Hello!' },
                usage: { prompt_tokens: 10, completion_tokens: 5 },
            }),
        };

        const registry = new ToolRegistry();
        const result = await agentLoop(mockProvider, { messages: [{ role: 'user', content: 'Hi' }] }, registry);

        expect(result.content).toBe('Hello!');
        expect(result.usage?.total_prompt_tokens).toBe(10);
        expect(mockProvider.generate).toHaveBeenCalledTimes(1);
    });

    it('should execute tool calls and continue the loop', async () => {
        let callCount = 0;
        const mockProvider: LLMProvider = {
            generate: vi.fn().mockImplementation(async () => {
                callCount++;
                if (callCount === 1) {
                    return {
                        message: {
                            role: 'assistant',
                            content: '',
                            tool_calls: [{ id: 'tc1', type: 'function', function: { name: 'getTime', arguments: '{}' } }],
                        },
                        usage: { prompt_tokens: 10, completion_tokens: 5 },
                    };
                }
                return {
                    message: { role: 'assistant', content: 'The time is 10:00 AM' },
                    usage: { prompt_tokens: 20, completion_tokens: 10 },
                };
            }),
        };

        const registry = new ToolRegistry();
        registry.register({
            name: 'getTime',
            description: 'gets the time',
            schema: {},
            execute: async () => '10:00 AM',
        });

        const result = await agentLoop(mockProvider, { messages: [{ role: 'user', content: 'Tell me the time' }] }, registry);

        expect(result.content).toBe('The time is 10:00 AM');
        expect(result.usage?.total_prompt_tokens).toBe(30);
        expect(mockProvider.generate).toHaveBeenCalledTimes(2);
        expect(result.messages.some(m => m.role === 'tool' && m.content === '"10:00 AM"')).toBe(true);
    });

    it('should prune context messages when maxContextMessages is exceeded', async () => {
        const mockProvider: LLMProvider = {
            generate: vi.fn().mockResolvedValue({
                message: { role: 'assistant', content: 'Pruned!' },
            }),
        };

        const messages: import('./types/index.js').Message[] = [
            { role: 'system', content: 'Sys' },
            { role: 'user', content: 'msg1' },
            { role: 'assistant', content: 'msg2' },
            { role: 'user', content: 'msg3' },
            { role: 'assistant', content: 'msg4' },
            { role: 'user', content: 'msg5' },
        ];

        const registry = new ToolRegistry();
        // Max 4 messages total (System + 1 Middle + 2 Recent)
        await agentLoop(mockProvider, { messages, maxContextMessages: 4 }, registry);

        const lastCall = vi.mocked(mockProvider.generate).mock.calls[0]![0];
        expect(lastCall.messages).toHaveLength(4);
        expect(lastCall.messages[0]?.role).toBe('system');
        expect(lastCall.messages[1]?.content).toBe('msg3'); // Top of middle window (pruned 1,2)
        expect(lastCall.messages[2]?.content).toBe('msg4'); // Last 2
        expect(lastCall.messages[3]?.content).toBe('msg5'); // Last 2
    });

    it('should use ContextRetriever to inject relevant messages from the middle of history', async () => {
        const mockProvider: LLMProvider = {
            generate: vi.fn().mockResolvedValue({
                message: { role: 'assistant', content: 'I remember!' },
            }),
        };

        const mockRetriever = {
            retrieve: vi.fn().mockResolvedValue([{ role: 'user', content: 'Old relevant secret' }]),
        };

        const messages: import('./types/index.js').Message[] = [
            { role: 'system', content: 'Sys' },
            { role: 'user', content: 'Part of middle 1' },
            { role: 'assistant', content: 'Part of middle 2' },
            { role: 'user', content: 'Flow 1' },
            { role: 'assistant', content: 'Flow 2' },
            { role: 'user', content: 'What was the secret?' },
        ];

        const registry = new ToolRegistry();
        await agentLoop(mockProvider, { messages, retriever: mockRetriever }, registry);

        const lastCall = vi.mocked(mockProvider.generate).mock.calls[0]![0];
        // Should have: System + Retired + Flow 1 + Flow 2 + Question
        // Actually the logic is: System + Retired + Last 2 (Flow 2 + Question)
        expect(lastCall.messages[0]?.role).toBe('system');
        expect(lastCall.messages[1]?.content).toBe('Old relevant secret');
        expect(lastCall.messages[2]?.content).toBe('Flow 2');
        expect(lastCall.messages[3]?.content).toBe('What was the secret?');
    });

    it('should execute tool calls in parallel', async () => {
        let callCount = 0;
        const mockProvider: LLMProvider = {
            generate: vi.fn().mockResolvedValue({
                message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                        { id: '1', type: 'function', function: { name: 't1', arguments: '{}' } },
                        { id: '2', type: 'function', function: { name: 't2', arguments: '{}' } }
                    ]
                } as any,
            }),
        };

        const registry = new ToolRegistry();
        registry.register({
            name: 't1',
            description: 't1',
            schema: { type: 'object', properties: {} },
            execute: async () => {
                callCount++;
                await new Promise(r => setTimeout(r, 10));
                return 'r1';
            }
        });
        registry.register({
            name: 't2',
            description: 't2',
            schema: { type: 'object', properties: {} },
            execute: async () => {
                callCount++;
                await new Promise(r => setTimeout(r, 10));
                return 'r2';
            }
        });

        // We'll mock generate to return no tools on second call to terminate loop
        vi.mocked(mockProvider.generate).mockResolvedValueOnce({
            message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                    { id: '1', type: 'function', function: { name: 't1', arguments: '{}' } },
                    { id: '2', type: 'function', function: { name: 't2', arguments: '{}' } }
                ]
            } as any,
        }).mockResolvedValue({
            message: { role: 'assistant', content: 'Done' },
        });

        await agentLoop(mockProvider, { messages: [] }, registry);
        expect(callCount).toBe(2);
    });

    it('should support streaming responses', async () => {
        const mockProvider: any = {
            generateStream: async function* () {
                yield { content: 'He', done: false };
                yield { content: 'llo', done: false };
                yield { content: '', done: true, usage: { prompt_tokens: 5, completion_tokens: 5 } };
            }
        };

        const onStream = vi.fn();
        const result = await agentLoop(mockProvider, {
            messages: [{ role: 'user', content: 'Hi' }],
            onStream
        }, new ToolRegistry());

        expect(onStream).toHaveBeenCalledTimes(2);
        expect(result.content).toBe('Hello');
    });
});

describe('LocalRetriever', () => {
    it('should correctly filter and sort messages by similarity', async () => {
        // We'll mock the internal methods to avoid downloading models in tests
        const retriever = new (class extends (await import('./tools/localRetriever.js')).LocalRetriever {
            // @ts-ignore
            protected override async getEmbedding(text: string) {
                if (text === 'apple') return [1, 0];
                if (text === 'fruit') return [0.9, 0.1];
                if (text === 'car') return [0, 1];
                return [0, 0];
            }
        })();

        const history: import('./types/index.js').Message[] = [
            { role: 'user', content: 'fruit' },
            { role: 'user', content: 'car' },
        ];

        const results = await retriever.retrieve('apple', history);
        expect(results).toHaveLength(1);
        expect(results[0]?.content).toBe('fruit');
    });
});
