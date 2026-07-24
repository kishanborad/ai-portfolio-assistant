export type Tier = 'webgpu' | 'wasm' | 'template';

export type TierStatus = 'detecting' | 'loading' | 'ready' | 'error';

export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  tier: Tier;
  timestamp: number;
}

export interface SuggestionChip {
  label: string;
  query: string;
}

export interface KnowledgeChunk {
  text: string;
  category: string;
  source: string;
  embedding: number[];
}

export interface FAQEntry {
  question: string;
  answer: string;
  keywords: string[];
  category: string;
  suggestions: SuggestionChip[];
}

export interface TierState {
  current: Tier;
  status: TierStatus;
  progress: number;
  label: string;
}
