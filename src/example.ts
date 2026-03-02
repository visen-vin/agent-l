import { runAgent, OpenRouterProvider, ToolRegistry, LocalRetriever, ShellTool, SystemInfoTool } from './index.js';

async function main() {
    const provider = new OpenRouterProvider({
        apiKey: process.env.OPENROUTER_API_KEY || 'sk-mock-key',
    });

    const registry = new ToolRegistry();
    registry.register(ShellTool.definition);
    registry.register(SystemInfoTool.definition);

    const retriever = new LocalRetriever({ topK: 2, threshold: 0.5 });

    const messages: any[] = [
        { role: 'user', content: 'What is the current directory and what files are in it?' },
    ];

    console.log("Running Shell Agent...");

    try {
        const response = await runAgent(provider, {
            messages,
            onStream: (chunk) => process.stdout.write(chunk),
            onToolStart: (tool) => console.log(`\n[Tool Start]: ${tool.function.name}`),
            onToolEnd: (tool, res) => console.log(`[Tool End]: ${tool.function.name}`),
        }, registry);

        console.log("\n\nAgent Response:", response.content);
    } catch (e: any) {
        console.log("Finished:", e.message);
    }
}

// main().catch(console.error);
console.log("Semantic Memory Example Ready.");
