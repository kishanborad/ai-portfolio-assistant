import type { KnowledgeChunk } from '../types';

/**
 * Compute cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Fetch and parse the pre-computed knowledge.json file.
 */
export async function loadKnowledge(): Promise<KnowledgeChunk[]> {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
  const response = await fetch(`${base}knowledge.json`);
  if (!response.ok) {
    console.warn('Failed to load knowledge.json, using empty knowledge base');
    return [];
  }
  const data = await response.json();
  return data.chunks || [];
}

/**
 * Load the FAQ entries from the pre-built faq.json file.
 */
export async function loadFAQ(): Promise<unknown[]> {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
  const response = await fetch(`${base}faq.json`);
  if (!response.ok) {
    console.warn('Failed to load faq.json, using empty FAQ');
    return [];
  }
  return response.json();
}

/**
 * Embed a query and retrieve the top-K most relevant knowledge chunks
 * by cosine similarity against pre-computed embeddings.
 *
 * Uses Transformers.js to embed the query with all-MiniLM-L6-v2.
 * Returns the text content of the top-K matching chunks.
 */
export async function retrieveChunks(
  query: string,
  chunks: KnowledgeChunk[],
  topK: number = 5,
): Promise<string[]> {
  if (chunks.length === 0 || !query.trim()) {
    return [];
  }

  const { pipeline } = await import('@huggingface/transformers');
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    dtype: 'fp32',
  });

  const output = await embedder(query, { pooling: 'mean', normalize: true });
  const queryEmbedding: number[] = Array.from(output.data as Float32Array);

  const scored = chunks.map((chunk) => ({
    text: chunk.text,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.text);
}
