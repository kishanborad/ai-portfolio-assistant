import type { Tier, TierState, FAQEntry, SuggestionChip, KnowledgeChunk } from '../types';
import { detectTier } from './tierDetector';
import { TemplateEngine, WebGPUEngine, WASMEngine } from './engines';
import { loadKnowledge, loadFAQ, retrieveChunks } from './retriever';

const SYSTEM_PROMPT_TEMPLATE = `You are speaking as Kishan Borad, a QA Engineer and Developer. Answer questions about your experience, projects, skills, and philosophy in first person. Be friendly and specific. Use the following context from your knowledge base to inform your answers:

{context}

If the context doesn't cover the question, say so honestly and suggest the user reach out directly.`;

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
    // Load FAQ and knowledge in parallel
    const [faqData, knowledgeData] = await Promise.all([
      loadFAQ().catch(() => []),
      loadKnowledge().catch(() => []),
    ]);

    this.templateEngine = new TemplateEngine(faqData as FAQEntry[]);
    this.knowledge = knowledgeData;

    // Detect tier
    this.detectedTier = await detectTier();

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
      console.warn('WebGPU engine failed to load, staying on template:', err);
      this.updateTier({
        current: 'template',
        status: 'ready',
        label: 'Template mode',
        progress: 100,
      });
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
   * then {type: 'done', content, suggestions} at the end.
   */
  async *send(
    query: string,
  ): AsyncGenerator<{ type: 'token' | 'done'; content: string; suggestions: SuggestionChip[] }> {
    // Try RAG retrieval for context
    let contextText = '';
    if (this.knowledge.length > 0) {
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
      let fullResponse = '';
      try {
        fullResponse = await this.webgpuEngine.generate(query, systemPrompt, () => {
          // Yielded below after the full response
        });
      } catch {
        // Fall back to template
        const result = this.templateEngine!.respond(query);
        yield { type: 'done', content: result.answer, suggestions: result.suggestions };
        return;
      }

      yield { type: 'done', content: fullResponse, suggestions: [] };
      return;
    }

    if (this.tierState.current === 'wasm' && this.wasmEngine) {
      try {
        const response = await this.wasmEngine.generate(query, systemPrompt, () => {});
        yield { type: 'done', content: response, suggestions: [] };
        return;
      } catch {
        // Fall back to template
      }
    }

    // Template fallback
    if (this.templateEngine) {
      const result = this.templateEngine.respond(query);
      yield { type: 'done', content: result.answer, suggestions: result.suggestions };
    }
  }
}
