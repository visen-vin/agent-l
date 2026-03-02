import { LLMProvider } from '../providers/provider.interface.js';
import { ToolRegistry } from '../tools/toolRegistry.js';
import { AgentRequest, AgentResponse } from '../types/index.js';
import { agentLoop } from './agentLoop.js';

export async function runAgent(
    provider: LLMProvider,
    request: AgentRequest,
    toolRegistry: ToolRegistry = new ToolRegistry()
): Promise<AgentResponse> {
    return agentLoop(provider, request, toolRegistry);
}
