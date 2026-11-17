import type { SuggestionChip } from '../types';

/**
 * Suggestion chips shown when an answer carries none of its own, so
 * every response ends with somewhere useful to go next. Shared by the
 * template engine and the orchestrator so all response paths offer
 * the same next steps.
 */
export const DEFAULT_SUGGESTIONS: SuggestionChip[] = [
  { label: 'Tell me about your experience', query: 'Tell me about your experience' },
  { label: 'Show me your projects', query: 'Show me your projects' },
  { label: "What's your tech stack?", query: "What's your tech stack?" },
];
