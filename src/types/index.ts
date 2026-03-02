export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  schema: object;
  execute(args: any): Promise<any>;
}

export interface ProviderRequest {
  messages: Message[];
  tools?: any[]; // Simplified for the interface
}

export interface ProviderResponse {
  message: Message;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface ContextRetriever {
  retrieve(query: string, fullHistory: Message[]): Promise<Message[]>;
}

export interface AgentRequest {
  messages: Message[];
  system?: string;
  maxContextMessages?: number;
  retriever?: ContextRetriever;
  onStream?: (chunk: string) => void;
  onToolStart?: (toolCall: ToolCall) => void;
  onToolEnd?: (toolCall: ToolCall, result: any) => void;
}

export interface AgentResponse {
  content: string;
  messages: Message[];
  usage?: {
    total_prompt_tokens: number;
    total_completion_tokens: number;
  };
}
