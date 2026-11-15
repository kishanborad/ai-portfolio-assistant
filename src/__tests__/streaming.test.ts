import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateImpl: null as null | ((prompt: string, systemPrompt: string, onToken: (token: string) => void) => Promise<string>),
  generateResolved: false,
}));

vi.mock('../ai/tierDetector', () => ({
  detectTier: vi.fn().mockResolvedValue('webgpu'),
  hasWebGPU: vi.fn().mockResolvedValue(true),
  hasWASM: vi.fn().mockReturnValue(true),
}));

vi.mock('../ai/engines', () => ({
  TemplateEngine: class {
    respond() { return { answer: 'template answer', suggestions: [] }; }
  },
  WebGPUEngine: class {
    load = vi.fn().mockResolvedValue(undefined);
    generate(prompt: string, systemPrompt: string, onToken: (token: string) => void) {
      return mocks.generateImpl!(prompt, systemPrompt, onToken);
    }
  },
  WASMEngine: class { load = vi.fn(); generate = vi.fn(); },
}));

vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
  if (url.includes('faq.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  if (url.includes('knowledge.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ chunks: [] }) });
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

describe('Orchestrator WebGPU streaming', () => {
  it('yields tokens as they are generated, before generation finishes', async () => {
    mocks.generateResolved = false;
    mocks.generateImpl = async (_prompt, _systemPrompt, onToken) => {
      onToken('Hello');
      await new Promise((resolve) => setTimeout(resolve, 20));
      onToken(' world');
      mocks.generateResolved = true;
      return 'Hello world';
    };

    const orch = new Orchestrator();
    await orch.init();
    await waitForWebGPU(orch);

    const chunks: Array<{ type: string; content: string }> = [];
    let sawTokenBeforeResolve = false;
    for await (const chunk of orch.send('Hi')) {
      if (chunk.type === 'token' && !mocks.generateResolved) sawTokenBeforeResolve = true;
      chunks.push(chunk);
    }

    expect(sawTokenBeforeResolve).toBe(true);
    expect(chunks.map((c) => c.type)).toEqual(['token', 'token', 'done']);
    expect(chunks.map((c) => c.content)).toEqual(['Hello', ' world', 'Hello world']);
  });

  it('falls back to the template answer when generation fails before any token', async () => {
    mocks.generateImpl = async () => { throw new Error('generation failed'); };

    const orch = new Orchestrator();
    await orch.init();
    await waitForWebGPU(orch);

    const chunks: Array<{ type: string; content: string }> = [];
    for await (const chunk of orch.send('Hi')) chunks.push(chunk);

    expect(chunks).toEqual([{ type: 'done', content: 'template answer', suggestions: [] }]);
  });
});
