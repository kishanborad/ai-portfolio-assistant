import type { ResponseMeta, Tier, TierState, FAQEntry, SuggestionChip, KnowledgeChunk } from '../types';
import { detectTier } from './tierDetector';
import { TemplateEngine, WebGPUEngine, WASMEngine } from './engines';
import { loadKnowledge, loadFAQ, loadKeywordMap, retrieveChunks, warmEmbedder } from './retriever';

const SYSTEM_PROMPT_TEMPLATE = `You are speaking as Kishan Borad, an Associate Product Owner and Scrum Master with 7 years of QA and delivery experience and an MS in Computer Science (2024). Answer questions about your experience, projects, skills, and philosophy in first person. Be friendly and specific. Use the following context from your knowledge base to inform your answers:

{context}

If the context doesn't cover the question, say so honestly and suggest the user reach out on LinkedIn (https://linkedin.com/in/kishanborad27), GitHub (https://github.com/kishanborad), or by email (borad.kishan0@gmail.com).`;

/**
 * Orchestrator manages the three-tier AI pipeline:
 * 1. Detects the best available tier on init
 * 2. Loads template engine immediately for instant responses
 * 3. Loads LLM in background, swaps when ready
 * 4. Routes queries to the appropriate engine
 */
export class Orchestrator {
  private tierState: TierState = {
    current: 'template',
    status: 'detecting',
    progress: 0,
    label: 'Detecting capabilities...',
  };

  private templateEngine: TemplateEngine | null = null;
  private webgpuEngine: WebGPUEngine | null = null;
  private wasmEngine: WASMEngine | null = null;
  private knowledge: KnowledgeChunk[] = [];
  private detectedTier: Tier = 'template';
  private listeners: Array<(state: TierState) => void> = [];

  getTierState(): TierState {
    return { ...this.tierState };
  }

  onTierChange(listener: (state: TierState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private updateTier(partial: Partial<TierState>) {
    this.tierState = { ...this.tierState, ...partial };
    for (const listener of this.listeners) {
      listener(this.getTierState());
    }
  }

  /**
   * Initialize the orchestrator:
   * 1. Load FAQ for template engine (instant)
   * 2. Detect best available tier
   * 3. Start loading LLM in background if available
   */
  async init(): Promise<void> {
    // Load FAQ, knowledge, and the keyword map in parallel
    const [faqData, knowledgeData, keywordMap] = await Promise.all([
      loadFAQ().catch(() => []),
      loadKnowledge().catch(() => []),
      loadKeywordMap().catch(() => []),
    ]);

    this.templateEngine = new TemplateEngine(faqData as FAQEntry[], keywordMap);
    this.knowledge = knowledgeData;

    // Detect tier
    this.detectedTier = await detectTier();

    // Warm the embedder while the LLM loads so the first LLM-tier
    // query does not pay the embedding model download on top of
    // generation. Template-only devices skip this entirely.
    if (this.detectedTier !== 'template') {
      warmEmbedder();
    }

    if (this.detectedTier === 'webgpu') {
      this.updateTier({
        current: 'template',
        status: 'loading',
        label: 'Loading AI model...',
        progress: 0,
      });
      this.loadWebGPU();
    } else if (this.detectedTier === 'wasm') {
      this.updateTier({
        current: 'template',
        status: 'loading',
        label: 'Loading AI model (WASM)...',
        progress: 0,
      });
      this.loadWASM();
    } else {
      this.updateTier({
        current: 'template',
        status: 'ready',
        label: 'Template mode',
        progress: 100,
      });
    }
  }

  private async loadWebGPU(): Promise<void> {
    try {
      this.webgpuEngine = new WebGPUEngine();
      await this.webgpuEngine.load((progress) => {
        this.updateTier({
          progress,
          label: `AI model loading... ${progress}%`,
        });
      });
      this.updateTier({
        current: 'webgpu',
        status: 'ready',
        progress: 100,
        label: 'AI powered',
      });
    } catch (err) {
      console.warn('WebGPU engine failed to load, trying WASM tier:', err);
      this.updateTier({
        current: 'template',
        status: 'loading',
        label: 'Loading AI model (WASM)...',
        progress: 0,
      });
      this.loadWASM();
    }
  }

  private async loadWASM(): Promise<void> {
    try {
      this.wasmEngine = new WASMEngine();
      await this.wasmEngine.load((progress) => {
        this.updateTier({
          progress,
          label: `AI model loading... ${progress}%`,
        });
      });
      this.updateTier({
        current: 'wasm',
        status: 'ready',
        progress: 100,
        label: 'AI powered',
      });
    } catch (err) {
      console.warn('WASM engine failed to load, staying on template:', err);
      this.updateTier({
        current: 'template',
        status: 'ready',
        label: 'Template mode',
        progress: 100,
      });
    }
  }

  /**
   * Send a user query and receive response chunks.
   * Yields {type: 'token', content} during streaming,
   * then {type: 'done', content, suggestions, meta} at the end.
   *
   * A question the template engine matches is answered at once on
   * every tier, without waiting for model generation: the match is
   * already the right information. Only unmatched questions reach
   * the model tiers.
   */
  async *send(
    query: string,
  ): AsyncGenerator<{
    type: 'token' | 'done';
    content: string;
    suggestions: SuggestionChip[];
    meta?: ResponseMeta;
  }> {
    const templateResult = this.templateEngine?.respond(query);
    if (templateResult?.matched) {
      yield {
        type: 'done',
        content: templateResult.answer,
        suggestions: templateResult.suggestions,
        meta: {
          tier: this.tierState.current,
          route: 'template',
          templateScore: templateResult.score,
          fallback: false,
        },
      };
      return;
    }
    const templateScore = templateResult?.score ?? null;

    // Retrieval only feeds the LLM system prompt, so skip it when the
    // template engine will answer: the template engine never sees the
    // retrieved context, and running retrieval would pay embedding
    // setup for nothing.
    const willUseLLM =
      (this.tierState.current === 'webgpu' && this.webgpuEngine !== null) ||
      (this.tierState.current === 'wasm' && this.wasmEngine !== null);

    let contextText = '';
    if (willUseLLM && this.knowledge.length > 0) {
      try {
        const chunks = await retrieveChunks(query, this.knowledge, 5);
        contextText = chunks.join('\n\n');
      } catch {
        // Retrieval failed, proceed without context
      }
    }

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{context}', contextText || 'No additional context available.');

    // Route to the current engine
    if (this.tierState.current === 'webgpu' && this.webgpuEngine) {
      // Bridge the engine's token callback into yielded chunks so the
      // first words reach the UI as they are generated instead of
      // waiting for the whole answer. The queue and wake-up resolver
      // below turn the callback into an async iterator: each delta
      // wakes the drain loop, which yields it immediately.
      const deltas: string[] = [];
      let wake: (() => void) | null = null;
      let settled = false;
      let failed = false;
      void this.webgpuEngine
        .generate(query, systemPrompt, (delta) => {
          deltas.push(delta);
          wake?.();
        })
        .then(
          () => {
            settled = true;
            wake?.();
          },
          () => {
            failed = true;
            settled = true;
            wake?.();
          },
        );

      let fullResponse = '';
      for (;;) {
        while (deltas.length > 0) {
          const delta = deltas.shift()!;
          fullResponse += delta;
          yield { type: 'token', content: delta, suggestions: [] };
        }
        if (settled) break;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }

      if (failed && fullResponse === '') {
        // Nothing streamed: fall back to the template answer.
        const result = templateResult ?? this.templateEngine?.respond(query);
        if (result) {
          yield {
            type: 'done',
            content: result.answer,
            suggestions: result.suggestions,
            meta: { tier: 'webgpu', route: 'template-fallback', templateScore, fallback: true },
          };
        }
        return;
      }

      yield {
        type: 'done',
        content: fullResponse,
        suggestions: [],
        meta: { tier: 'webgpu', route: 'webgpu', templateScore, fallback: false },
      };
      return;
    }

    if (this.tierState.current === 'wasm' && this.wasmEngine) {
      try {
        const response = await this.wasmEngine.generate(query, systemPrompt, () => {});
        yield {
          type: 'done',
          content: response,
          suggestions: [],
          meta: { tier: 'wasm', route: 'wasm', templateScore, fallback: false },
        };
        return;
      } catch {
        // Fall back to template
      }
    }

    // Template fallback
    if (templateResult) {
      yield {
        type: 'done',
        content: templateResult.answer,
        suggestions: templateResult.suggestions,
        meta: {
          tier: this.tierState.current,
          route: this.tierState.current === 'template' ? 'template' : 'template-fallback',
          templateScore,
          fallback: true,
        },
      };
    }
  }
}
