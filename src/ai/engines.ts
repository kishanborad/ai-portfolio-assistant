import type { FAQEntry, SuggestionChip } from '../types';

// ── Template Engine (Tier 3) ───────────────────────────────────────────────

/**
 * FAQ-based template matching engine.
 * Tokenizes the query, scores against FAQ entries by keyword overlap
 * and category weight, returns the best-matching pre-written answer.
 */
export class TemplateEngine {
  private entries: FAQEntry[];

  constructor(entries: FAQEntry[]) {
    this.entries = entries;
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
   * Find the best-matching FAQ entry for a query.
   * Returns a fallback response if no match scores above threshold.
   */
  respond(query: string): { answer: string; suggestions: SuggestionChip[] } {
    const queryTokens = this.tokenize(query);

    if (queryTokens.length === 0) {
      return {
        answer:
          "I didn't catch that — could you rephrase? You can ask about my experience, projects, skills, or engineering philosophy.",
        suggestions: [
          { label: 'Tell me about your experience', query: 'Tell me about your experience' },
          { label: 'Show me your projects', query: 'Show me your projects' },
        ],
      };
    }

    let bestEntry: FAQEntry | null = null;
    let bestScore = 0;

    for (const entry of this.entries) {
      const s = this.score(queryTokens, entry);
      if (s > bestScore) {
        bestScore = s;
        bestEntry = entry;
      }
    }

    if (!bestEntry || bestScore < 1) {
      return {
        answer:
          "I don't have specific details on that topic, but feel free to reach out to me directly. I'm happy to chat about my experience, projects, or technical skills.",
        suggestions: [
          { label: 'Tell me about your experience', query: 'Tell me about your experience' },
          { label: "What's your tech stack?", query: "What's your tech stack?" },
        ],
      };
    }

    return {
      answer: bestEntry.answer,
      suggestions: bestEntry.suggestions,
    };
  }
}

// ── WebGPU Engine (Tier 1) ─────────────────────────────────────────────────

/**
 * WebGPU-powered LLM engine using WebLLM.
 * Loads Phi-3-mini-4k-instruct with q4f16_1 quantization (~800MB).
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
