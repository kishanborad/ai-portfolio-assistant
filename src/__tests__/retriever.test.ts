import { describe, it, expect } from 'vitest';
import { cosineSimilarity, rankChunks, RETRIEVAL_SIMILARITY_THRESHOLD } from '../ai/retriever';
import type { KnowledgeChunk } from '../types';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 0, 0, 1];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0, 0];
    const b = [0, 1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('handles zero vectors gracefully', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('computes correct similarity for non-trivial vectors', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    // dot = 32, |a| = sqrt(14) ≈ 3.742, |b| = sqrt(77) ≈ 8.775
    // cosine = 32 / (3.742 * 8.775) ≈ 0.9746
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.9746, 3);
  });
});

describe('rankChunks', () => {
  const chunk = (
    text: string,
    source: string,
    category: string,
    embedding: number[],
  ): KnowledgeChunk => ({ text, source, category, embedding });

  it('drops chunks below the similarity threshold', () => {
    const chunks = [
      chunk('matching chunk', 'skills.md', 'resume', [1, 0]),
      chunk('unrelated chunk', 'goals.md', 'personality', [0, 1]),
    ];
    const result = rankChunks([1, 0], chunks, 'skills');
    expect(result).toEqual(['matching chunk']);
  });

  it('returns an empty list when nothing reaches the threshold', () => {
    const chunks = [chunk('unrelated chunk', 'goals.md', 'personality', [0, 1])];
    expect(rankChunks([1, 0], chunks, 'weather today')).toEqual([]);
  });

  it('lifts a chunk whose source matches the query above a higher-cosine chunk', () => {
    const chunks = [
      chunk('generic chunk', 'skills.md', 'resume', [0.9, 0.4359]),
      chunk('goals chunk', 'goals.md', 'personality', [0.7, 0.7141]),
    ];
    // cosine 0.9 vs 0.7, but the goals chunk gets the full metadata
    // boost (query token "goals" matches its source), so it ranks first.
    const result = rankChunks([1, 0], chunks, 'What are your goals?');
    expect(result).toEqual(['goals chunk', 'generic chunk']);
  });

  it('boosts chunks whose category matches the query', () => {
    const chunks = [
      chunk('generic chunk', 'education.md', 'resume', [0.8, 0.6]),
      chunk('project chunk', 'test-runner.md', 'projects', [0.7, 0.7141]),
    ];
    // "projects" matches the category for half the query tokens, so
    // the project chunk (0.7 + 0.15) wins over the generic chunk (0.8).
    const result = rankChunks([1, 0], chunks, 'Show me your projects');
    expect(result[0]).toBe('project chunk');
  });

  it('respects topK', () => {
    const chunks = [
      chunk('one', 'a.md', 'resume', [1, 0]),
      chunk('two', 'b.md', 'resume', [1, 0]),
      chunk('three', 'c.md', 'resume', [1, 0]),
    ];
    expect(rankChunks([1, 0], chunks, 'anything', 2)).toHaveLength(2);
  });

  it('exposes a threshold between off-topic and on-topic scores', () => {
    expect(RETRIEVAL_SIMILARITY_THRESHOLD).toBe(0.15);
  });
});
