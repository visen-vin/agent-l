import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@xenova/transformers';
import { ContextRetriever, Message } from '../types/index.js';

export class QdrantRetriever implements ContextRetriever {
    private client: QdrantClient;
    private extractor: any = null;
    private collectionName: string;
    private modelName: string;
    private topK: number;
    private threshold: number;

    constructor(options: {
        url?: string;
        apiKey?: string;
        collectionName?: string;
        modelName?: string;
        topK?: number;
        threshold?: number;
    } = {}) {
        this.client = new QdrantClient({
            url: options.url || 'http://localhost:6333',
            apiKey: options.apiKey,
        });
        this.collectionName = options.collectionName || 'agent_messages';
        this.modelName = options.modelName || 'Xenova/all-MiniLM-L6-v2';
        this.topK = options.topK || 3;
        this.threshold = options.threshold || 0.4;
    }

    private async init() {
        if (!this.extractor) {
            this.extractor = await pipeline('feature-extraction', this.modelName);
        }

        // Ensure collection exists
        const collections = await this.client.getCollections();
        const exists = collections.collections.some(c => c.name === this.collectionName);

        if (!exists) {
            // MiniLM-L6-v2 produces 384-dimensional vectors
            await this.client.createCollection(this.collectionName, {
                vectors: {
                    size: 384,
                    distance: 'Cosine'
                }
            });
        }
    }

    private async getEmbedding(text: string): Promise<number[]> {
        await this.init();
        const output = await this.extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data as Float32Array);
    }

    async retrieve(query: string, fullHistory: Message[]): Promise<Message[]> {
        await this.init();

        // 1. Sync history to Qdrant (Simple upsert for this SDK)
        // In a real app, you'd only upsert new messages. 
        // Here we'll use a hash or content as ID to avoid duplicates.
        const points = await Promise.all(fullHistory.map(async (msg, idx) => {
            const vector = await this.getEmbedding(msg.content);
            return {
                id: this.generateId(msg.content + msg.role + idx),
                vector,
                payload: { ...msg }
            };
        }));

        await this.client.upsert(this.collectionName, { points });

        // 2. Search
        const queryVector = await this.getEmbedding(query);
        const searchResult = await this.client.search(this.collectionName, {
            vector: queryVector,
            limit: this.topK,
            with_payload: true,
            score_threshold: this.threshold
        });

        return searchResult.map(res => res.payload as unknown as Message);
    }

    private generateId(str: string): string {
        // Simple deterministic ID generation for demonstration
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        const absHash = Math.abs(hash).toString(16);
        return "00000000-0000-0000-0000-" + absHash.padStart(12, '0');
    }
}
