import { ProviderRequest, ProviderResponse } from '../types/index.js';

export interface StreamChunk {
    content: string;
    done: boolean;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
    };
}

export interface LLMProvider {
    generate(request: ProviderRequest): Promise<ProviderResponse>;
    generateStream?(request: ProviderRequest): AsyncIterable<StreamChunk>;
}
