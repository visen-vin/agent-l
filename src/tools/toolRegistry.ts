import { ToolDefinition, ToolCall } from '../types/index.js';

export class ToolRegistry {
    private tools: Map<string, ToolDefinition> = new Map();

    register(tool: ToolDefinition) {
        this.tools.set(tool.name, tool);
    }

    getTool(name: string): ToolDefinition | undefined {
        return this.tools.get(name);
    }

    async execute(toolCall: ToolCall): Promise<any> {
        const tool = this.getTool(toolCall.function.name);
        if (!tool) {
            throw new Error(`Tool ${toolCall.function.name} not found`);
        }

        try {
            const args = JSON.parse(toolCall.function.arguments);
            return await tool.execute(args);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Invalid JSON arguments for tool ${toolCall.function.name}: ${toolCall.function.arguments}`);
            }
            throw error;
        }
    }

    getToolDefinitions(): any[] {
        return Array.from(this.tools.values()).map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.schema,
            }
        }));
    }
}
