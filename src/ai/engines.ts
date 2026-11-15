import type { FAQEntry, KeywordMapEntry, SuggestionChip } from '../types';
import { STOPWORDS } from './retriever';

// ── Template Engine (Tier 3) ───────────────────────────────────────────────

/**
 * Minimum score for a query to match an FAQ entry. A keyword match
 * scores 2 and a question-token match scores 1, so 3 requires at
 * least one keyword match plus a question-token match (or equivalent),
 * and common words alone can never win a match.
 */
const MATCH_THRESHOLD = 3;

/**
 * Score added to a FAQ entry when the query hits one of its keyword
 * map mappings. Exactly the match threshold, so a paraphrase that
 * shares no keywords with its entry still matches, while an entry
 * with real keyword overlap still outscores a merely mapped one.
 */
const ALIAS_BOOST = 3;

/**
 * FAQ-based template matching engine.
 * Tokenizes the query, drops stopwords, and scores against FAQ entries
 * by keyword overlap with a small bonus for question similarity,
 * returning the best-matching pre-written answer.
 */
export class TemplateEngine {
  private entries: FAQEntry[];
  private keywordMap: KeywordMapEntry[];

  constructor(entries: FAQEntry[], keywordMap: KeywordMapEntry[] = []) {
    this.entries = entries;
    this.keywordMap = keywordMap;
  }

  /**
   * Tokenize a string into lowercase words, stripping punctuation.
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  /**
   * Score a query against an FAQ entry.
   * Keyword overlap is the primary signal, with a small bonus for
   * question similarity.
   */
  private score(queryTokens: string[], entry: FAQEntry): number {
    const entryKeywords = new Set(entry.keywords.map((k) => k.toLowerCase()));
    const questionTokens = new Set(this.tokenize(entry.question));

    let score = 0;

    for (const token of queryTokens) {
      if (entryKeywords.has(token)) {
        score += 2;
      }
      if (questionTokens.has(token)) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * FAQ questions whose keyword-map mappings hit this query. Token
   * mappings match against the raw query words, so mappings can use
   * words the stopword filter would otherwise remove, and phrase
   * mappings match the query text itself.
   */
  private aliasTargets(query: string): Set<string> {
    const rawTokens = new Set(this.tokenize(query));
    const flatQuery = ` ${query.toLowerCase().replace(/[^\w\s]/g, ' ')} `;
    const targets = new Set<string>();
    for (const mapping of this.keywordMap) {
      const tokenHit = mapping.tokens?.some((t) => rawTokens.has(t.toLowerCase()));
      const phraseHit =
        mapping.phrase !== undefined && flatQuery.includes(` ${mapping.phrase.toLowerCase()} `);
      if (tokenHit || phraseHit) {
        targets.add(mapping.target);
      }
    }
    return targets;
  }

  /**
   * Find the best-matching FAQ entry for a query.
   * Returns a fallback response if no match scores above threshold.
   * The result carries the winning score and whether it matched, so
   * callers can route on match quality and log the outcome.
   */
  respond(query: string): {
    answer: string;
    suggestions: SuggestionChip[];
    score: number;
    matched: boolean;
  } {
    const queryTokens = this.tokenize(query).filter((t) => !STOPWORDS.has(t));
    const boosted = this.aliasTargets(query);

    // A query of only common words still matches when a keyword-map
    // phrase names it, such as "who are you".
    if (queryTokens.length === 0 && boosted.size === 0) {
      return {
        answer:
          "I didn't catch that — could you rephrase? You can ask about my experience, projects, skills, or engineering philosophy.",
        suggestions: [
          { label: 'Tell me about your experience', query: 'Tell me about your experience' },
          { label: 'Show me your projects', query: 'Show me your projects' },
        ],
        score: 0,
        matched: false,
      };
    }

    let bestEntry: FAQEntry | null = null;
    let bestScore = 0;

    for (const entry of this.entries) {
      const s = this.score(queryTokens, entry) + (boosted.has(entry.question) ? ALIAS_BOOST : 0);
      if (s > bestScore) {
        bestScore = s;
        bestEntry = entry;
      }
    }

    if (!bestEntry || bestScore < MATCH_THRESHOLD) {
      return {
        answer:
          "I don't have specific details on that topic, but you can reach me on LinkedIn at https://linkedin.com/in/kishanborad27, on GitHub at https://github.com/kishanborad, or by email at borad.kishan0@gmail.com. I'm happy to chat about my experience, projects, or technical skills.",
        suggestions: [
          { label: 'Tell me about your experience', query: 'Tell me about your experience' },
          { label: "What's your tech stack?", query: "What's your tech stack?" },
        ],
        score: bestScore,
        matched: false,
      };
    }

    return {
      answer: bestEntry.answer,
      suggestions: bestEntry.suggestions,
      score: bestScore,
      matched: true,
    };
  }
}

// ── WebGPU Engine (Tier 1) ─────────────────────────────────────────────────

/**
 * WebGPU-powered LLM engine using WebLLM.
 * Loads Phi-3-mini-4k-instruct with q4f16_1 quantization (about 2.2 GB
 * download, 3,672 MB VRAM required).
 * Streams tokens during generation.
 */
export class WebGPUEngine {
  private engine: unknown = null;

  async load(onProgress: (progress: number) => void): Promise<void> {
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
    this.engine = await CreateMLCEngine('Phi-3-mini-4k-instruct-q4f16_1-MLC', {
      initProgressCallback: (report: { progress: number }) => {
        onProgress(Math.round(report.progress * 100));
      },
    });
  }

  async generate(
    prompt: string,
    systemPrompt: string,
    onToken: (token: string) => void,
  ): Promise<string> {
    if (!this.engine) {
      throw new Error('WebGPU engine not loaded');
    }

    const engine = this.engine as {
      chat: {
        completions: {
          create: (params: {
            messages: Array<{ role: string; content: string }>;
            stream: boolean;
          }) => AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>;
        };
      };
    };

    const stream = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        onToken(delta);
      }
    }

    return fullResponse;
  }
}

// ── WASM Engine (Tier 2) ──────────────────────────────────────────────────

/**
 * WASM-powered LLM engine using Transformers.js.
 * Loads Qwen2-0.5B-Instruct ONNX model (~400MB).
 * Non-streaming — generates full response then returns.
 */
export class WASMEngine {
  private generator: unknown = null;

  async load(onProgress: (progress: number) => void): Promise<void> {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;

    onProgress(10);
    this.generator = await pipeline('text-generation', 'Qwen/Qwen2-0.5B-Instruct', {
      dtype: 'q4',
      progress_callback: (progressInfo: unknown) => {
        const data = progressInfo as { progress?: number } | undefined;
        if (data?.progress !== undefined) {
          onProgress(Math.round(10 + data.progress * 0.9));
        }
      },
    });
    onProgress(100);
  }

  async generate(
    prompt: string,
    systemPrompt: string,
    _onToken: (token: string) => void,
  ): Promise<string> {
    if (!this.generator) {
      throw new Error('WASM engine not loaded');
    }

    const gen = this.generator as (
      messages: Array<{ role: string; content: string }>,
      options: { max_new_tokens: number },
    ) => Promise<Array<{ generated_text: Array<{ content: string }> }>>;

    const result = await gen(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      { max_new_tokens: 512 },
    );

    const lastMessage = result[0]?.generated_text?.[result[0].generated_text.length - 1];
    return lastMessage?.content ?? '';
  }
}
