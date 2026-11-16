import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  systemPrompt: '',
}));

vi.mock('../ai/tierDetector', () => ({
  detectTier: vi.fn().mockResolvedValue('webgpu'),
  hasWebGPU: vi.fn().mockResolvedValue(true),
  hasWASM: vi.fn().mockReturnValue(true),
}));

vi.mock('../ai/engines', () => ({
  TemplateEngine: class {
    respond() { return { answer: 'generic fallback', suggestions: [], score: 0, matched: false }; }
  },
  WebGPUEngine: class {
    load = vi.fn().mockResolvedValue(undefined);
    generate(prompt: string, systemPrompt: string, onToken: (token: string) => void) {
      mocks.systemPrompt = systemPrompt;
      return mocks.generate(prompt, systemPrompt, onToken);
    }
  },
  WASMEngine: class {
    load = vi.fn();
    generate = vi.fn();
  },
}));

// Fake embedder: Playwright questions embed next to the Playwright
// chunk, everything else embeds orthogonally to every chunk, so the
// real rankChunks and threshold decide whether the gate fires.
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(
    async (text: string) => ({
      data: text.toLowerCase().includes('playwright') ? [1, 0, 0] : [0, 0, 1],
    }),
  ),
}));

const CHUNKS = [
  { text: 'Playwright context', category: 'resume', source: 'playwright.md', embedding: [1, 0, 0] },
  { text: 'About context', category: 'personality', source: 'about.md', embedding: [0, 1, 0] },
];

vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
  if (url.includes('faq.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  if (url.includes('knowledge.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ chunks: CHUNKS }) });
  return Promise.resolve({ ok: false });
}));

import { Orchestrator } from '../ai/orchestrator';

async function waitForWebGPU(orch: Orchestrator, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = orch.getTierState();
    if (state.current === 'webgpu' && state.status === 'ready') return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for webgpu tier, got ${JSON.stringify(orch.getTierState())}`);
}

describe('retrieval floor gate', () => {
  it('yields the fallback without calling the model when nothing is retrieved', async () => {
    const orch = new Orchestrator();
    await orch.init();
    await waitForWebGPU(orch);

    const chunks: Array<{ type: string; content: string }> = [];
    for await (const chunk of orch.send('What does Muse do?')) chunks.push(chunk);

    expect(mocks.generate).not.toHaveBeenCalled();
    expect(chunks).toEqual([
      {
        type: 'done',
        content: 'generic fallback',
        suggestions: [],
        meta: { tier: 'webgpu', route: 'template-fallback', templateScore: 0, fallback: true },
      },
    ]);
  });

  it('calls the model with retrieved context when a chunk clears the floor', async () => {
    mocks.generate.mockReset();
    mocks.generate.mockImplementation(async (_prompt, _systemPrompt, onToken) => {
      onToken('model answer');
      return 'model answer';
    });
    const orch = new Orchestrator();
    await orch.init();
    await waitForWebGPU(orch);

    const chunks: Array<{ type: string; content: string }> = [];
    for await (const chunk of orch.send('What is your Playwright experience?')) chunks.push(chunk);

    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.systemPrompt).toContain('Playwright context');
    expect(chunks.map((c) => c.type)).toEqual(['token', 'done']);
    expect(chunks[chunks.length - 1]).toEqual({
      type: 'done',
      content: 'model answer',
      suggestions: [],
      meta: { tier: 'webgpu', route: 'webgpu', templateScore: 0, fallback: false },
    });
  });
});
