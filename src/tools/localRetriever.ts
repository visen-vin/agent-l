import { pipeline } from '@xenova/transformers';
import { ContextRetriever, Message } from '../types/index.js';

export class LocalRetriever implements ContextRetriever {
    private extractor: any = null;
    private modelName: string;
    private topK: number;
    private threshold: number;
    private embeddingsCache: Map<string, number[]> = new Map();

    constructor(options: {
        modelName?: string;
        topK?: number;
        threshold?: number;
    } = {}) {
        this.modelName = options.modelName || 'Xenova/all-MiniLM-L6-v2';
        this.topK = options.topK || 3;
        this.threshold = options.threshold || 0.4;
    }

    private async init() {
        if (!this.extractor) {
            this.extractor = await pipeline('feature-extraction', this.modelName);
        }
    }

    protected async getEmbedding(text: string): Promise<number[]> {
        if (this.embeddingsCache.has(text)) {
            return this.embeddingsCache.get(text)!;
        }

        await this.init();
        const output = await this.extractor(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data as Float32Array);
        this.embeddingsCache.set(text, embedding);
        return embedding;
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        let dotProduct = 0;
        let mA = 0;
        let mB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i]! * b[i]!;
            mA += a[i]! * a[i]!;
            mB += b[i]! * b[i]!;
        }
        return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
    }

    async retrieve(query: string, fullHistory: Message[]): Promise<Message[]> {
        if (fullHistory.length === 0) return [];

        const queryEmbedding = await this.getEmbedding(query);

        // Filter history to find relevant messages (excluding system and very recent ones handled by window)
        const candidates = fullHistory.filter(m => m.role !== 'system');

        const scored = await Promise.all(candidates.map(async (msg) => {
            const msgEmbedding = await this.getEmbedding(msg.content);
            const score = this.cosineSimilarity(queryEmbedding, msgEmbedding);
            return { msg, score };
        }));

        return scored
            .filter(s => s.score >= this.threshold)
            .sort((a, b) => b.score - a.score)
            .slice(0, this.topK)
            .map(s => s.msg);
    }
}
