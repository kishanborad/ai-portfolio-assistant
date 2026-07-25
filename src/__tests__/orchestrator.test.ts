import { describe, it, expect, vi } from 'vitest';

// Mock the tier detector to control test behavior
vi.mock('../ai/tierDetector', () => ({
  detectTier: vi.fn().mockResolvedValue('template'),
  hasWebGPU: vi.fn().mockResolvedValue(false),
  hasWASM: vi.fn().mockReturnValue(true),
}));

// Mock fetch for loading FAQ/knowledge
vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
  if (url.includes('faq.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        {
          question: 'Tell me about your experience',
          answer: 'Five years of QA.',
          keywords: ['experience', 'work'],
          category: 'resume',
          suggestions: [],
        },
      ]),
    });
  }
  if (url.includes('knowledge.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ chunks: [] }),
    });
  }
  return Promise.resolve({ ok: false });
}));

import { Orchestrator } from '../ai/orchestrator';

describe('Orchestrator', () => {
  it('starts in detecting state', () => {
    const orch = new Orchestrator();
    const state = orch.getTierState();
    expect(state.status).toBe('detecting');
  });

  it('initializes to template tier when no WebGPU/WASM model available', async () => {
    const orch = new Orchestrator();
    await orch.init();
    const state = orch.getTierState();
    expect(state.current).toBe('template');
    expect(state.status).toBe('ready');
  });

  it('responds using template engine after init', async () => {
    const orch = new Orchestrator();
    await orch.init();

    const chunks: Array<{ type: string; content: string }> = [];
    for await (const chunk of orch.send('Tell me about your experience')) {
      chunks.push(chunk);
    }

    const done = chunks.find((c) => c.type === 'done');
    expect(done).toBeDefined();
    expect(done!.content).toContain('QA');
  });
});
