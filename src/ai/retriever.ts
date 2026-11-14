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
 * Minimum combined score for a chunk to be returned as context.
 * Measured score separation on this corpus: on-topic queries score
 * 0.20 to 0.56 at top-1, off-topic probes score 0.05 to 0.12.
 */
export const RETRIEVAL_SIMILARITY_THRESHOLD = 0.15;

/**
 * Weight of the keyword-overlap boost added to the cosine score.
 * The boost uses chunk metadata (category and source filename), not
 * chunk text: metadata tokens are the discriminating signal on this
 * small corpus, while text overlap misleads generic queries.
 */
const KEYWORD_BOOST_WEIGHT = 0.3;

/**
 * Common words ignored when matching queries to content, both for the
 * retrieval keyword boost and for template matching. Kept in one place
 * so both engines filter the same way.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
  'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from',
  'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
  'further', 'once', 'here', 'there', 'all', 'any', 'both', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just',
  'should', 'now', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he',
  'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'having', 'do', 'does', 'did', 'doing', 'would', 'could',
  'ought', 'tell', 'please',
]);

/**
 * Tokenize text into lowercase content words: punctuation stripped,
 * single-character words and stopwords removed.
 */
export function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Metadata tokens for a chunk: its category plus the words in its
 * source filename stem (for example, "test-runner.md" gives
 * "test" and "runner").
 */
function metadataTokens(chunk: KnowledgeChunk): Set<string> {
  const stem = chunk.source.replace(/\.md$/, '');
  const parts = [chunk.category, ...stem.toLowerCase().split(/[^a-z0-9]+/)];
  return new Set(parts.filter((p) => p.length > 1));
}

/**
 * Fraction of the unique query content tokens that appear in the
 * chunk metadata. Returns 0 when the query has no content tokens.
 */
function metadataOverlap(queryTokens: string[], chunk: KnowledgeChunk): number {
  const unique = new Set(queryTokens);
  if (unique.size === 0) {
    return 0;
  }
  const meta = metadataTokens(chunk);
  let matched = 0;
  for (const token of unique) {
    if (meta.has(token)) {
      matched++;
    }
  }
  return matched / unique.size;
}

/**
 * Rank chunks for a query embedding: cosine similarity plus a
 * metadata keyword boost, keeping only chunks at or above the
 * similarity threshold, best first, up to topK.
 */
export function rankChunks(
  queryEmbedding: number[],
  chunks: KnowledgeChunk[],
  query: string,
  topK: number = 5,
): string[] {
  const queryTokens = contentTokens(query);
  const scored = chunks.map((chunk) => ({
    text: chunk.text,
    score:
      cosineSimilarity(queryEmbedding, chunk.embedding) +
      KEYWORD_BOOST_WEIGHT * metadataOverlap(queryTokens, chunk),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((s) => s.score >= RETRIEVAL_SIMILARITY_THRESHOLD)
    .slice(0, topK)
    .map((s) => s.text);
}

type EmbedderFn = (
  text: string,
  options: { pooling: string; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;

// One shared embedding pipeline for the lifetime of the page. Creating
// a pipeline per query pays ONNX session setup every time.
let embedderPromise: Promise<EmbedderFn> | null = null;

async function getEmbedder(): Promise<EmbedderFn> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        dtype: 'fp32',
      });
      return embedder as unknown as EmbedderFn;
    })();
    // If loading fails, clear the cache so a later query retries
    // instead of reusing a rejected promise.
    embedderPromise.catch(() => {
      embedderPromise = null;
    });
  }
  return embedderPromise;
}

/**
 * Embed a query and retrieve the top-K most relevant knowledge chunks.
 *
 * Uses Transformers.js to embed the query with all-MiniLM-L6-v2, then
 * ranks chunks by cosine similarity plus a metadata keyword boost,
 * dropping chunks below the similarity threshold.
 * Returns the text content of the matching chunks, best first.
 */
export async function retrieveChunks(
  query: string,
  chunks: KnowledgeChunk[],
  topK: number = 5,
): Promise<string[]> {
  if (chunks.length === 0 || !query.trim()) {
    return [];
  }

  const embedder = await getEmbedder();
  const output = await embedder(query, { pooling: 'mean', normalize: true });
  const queryEmbedding: number[] = Array.from(output.data);

  return rankChunks(queryEmbedding, chunks, query, topK);
}
