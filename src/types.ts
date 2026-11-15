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

/**
 * A paraphrase mapping: when a query contains one of the tokens or
 * the phrase, the target FAQ entry gets a matching boost. Targets
 * are FAQ question strings and must exist in faq.json.
 */
export interface KeywordMapEntry {
  tokens?: string[];
  phrase?: string;
  target: string;
}

export type ResponseRoute = 'template' | 'webgpu' | 'wasm' | 'template-fallback';

/**
 * Routing outcome attached to the final chunk of an answer, so the
 * question log can record which path answered each question.
 */
export interface ResponseMeta {
  tier: Tier;
  route: ResponseRoute;
  templateScore: number | null;
  fallback: boolean;
}
