import { LLMProvider } from '../providers/provider.interface.js';
import { ToolRegistry } from '../tools/toolRegistry.js';
import { AgentRequest, AgentResponse, Message, ProviderResponse } from '../types/index.js';

export async function agentLoop(
    provider: LLMProvider,
    request: AgentRequest,
    toolRegistry: ToolRegistry
): Promise<AgentResponse> {
    const messages: Message[] = [...request.messages];

    if (request.system && !messages.some(m => m.role === 'system')) {
        messages.unshift({ role: 'system', content: request.system });
    }

    let total_prompt_tokens = 0;
    let total_completion_tokens = 0;

    while (true) {
        // Context Management (Tree Shaking: 1 + Middle + 2)
        let contextMessages: Message[] = [];

        if (messages.length > 0) {
            const systemMessage = messages[0]?.role === 'system' ? messages[0] : undefined;
            const recentMessages = messages.slice(-2); // Always keep last 2 for flow

            // Middle messages are those between system (if exists) and the last 2
            const middleStart = systemMessage ? 1 : 0;
            const middleEnd = Math.max(middleStart, messages.length - 2);
            const middleMessages = messages.slice(middleStart, middleEnd);

            let relevantMiddle: Message[] = [];
            if (request.retriever && middleMessages.length > 0) {
                const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
                if (lastUserMessage) {
                    relevantMiddle = await request.retriever.retrieve(lastUserMessage.content, middleMessages);
                }
            } else if (request.maxContextMessages && messages.length > request.maxContextMessages) {
                // Fallback to sliding window for middle if no retriever but limit exists
                const limit = Math.max(0, request.maxContextMessages - (systemMessage ? 1 : 0) - recentMessages.length);
                relevantMiddle = middleMessages.slice(-limit);
            } else {
                relevantMiddle = middleMessages;
            }

            // Final combination: System + Relevant Middle + Recent
            // De-duplicate recent if it overlaps with relevantMiddle (though unlikely with slice logic)
            contextMessages = systemMessage ? [systemMessage, ...relevantMiddle] : [...relevantMiddle];

            // Append recent messages, ensuring no duplicates
            for (const rm of recentMessages) {
                if (!contextMessages.includes(rm)) {
                    contextMessages.push(rm);
                }
            }
        } else {
            contextMessages = [...messages];
        }

        let response: ProviderResponse;

        if (request.onStream && provider.generateStream) {
            let fullContent = '';
            let finalUsage: any = undefined;

            for await (const chunk of provider.generateStream({
                messages: contextMessages,
                tools: toolRegistry.getToolDefinitions(),
            })) {
                if (chunk.content) {
                    fullContent += chunk.content;
                    request.onStream(chunk.content);
                }
                if (chunk.usage) {
                    finalUsage = chunk.usage;
                }
            }

            response = {
                message: { role: 'assistant', content: fullContent },
                usage: finalUsage
            };
        } else {
            response = await provider.generate({
                messages: contextMessages,
                tools: toolRegistry.getToolDefinitions(),
            });
        }

        if (response.usage) {
            total_prompt_tokens += response.usage.prompt_tokens;
            total_completion_tokens += response.usage.completion_tokens;
        }

        const assistantMessage = response.message;
        messages.push(assistantMessage);

        if (response.message.tool_calls && response.message.tool_calls.length > 0) {
            const toolResults = await Promise.all(
                response.message.tool_calls.map(async (toolCall) => {
                    try {
                        if (request.onToolStart) request.onToolStart(toolCall);
                        const result = await toolRegistry.execute(toolCall);
                        if (request.onToolEnd) request.onToolEnd(toolCall, result);
                        return {
                            role: 'tool' as const,
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(result),
                        };
                    } catch (error: any) {
                        if (request.onToolEnd) request.onToolEnd(toolCall, { error: error.message });
                        return {
                            role: 'tool' as const,
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({ error: error.message }),
                        };
                    }
                })
            );

            messages.push(...toolResults);
            continue;
        } else {
            return {
                content: response.message.content,
                messages,
                usage: {
                    total_prompt_tokens,
                    total_completion_tokens,
                },
            };
        }
    }
}
