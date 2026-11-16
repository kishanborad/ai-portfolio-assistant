import { describe, it, expect, vi } from 'vitest';
import { isOffTopic } from '../ai/offTopicGuard';

describe('isOffTopic', () => {
  it.each([
    'What does Muse do?',
    'Tell me about Muse',
    'What does ChatGPT do?',
    "What's the weather like tomorrow?",
    'Tell me a joke about cats',
    'Can you write me a poem about the ocean?',
    'What is the weather forecast?',
  ])('guards %s', (query) => {
    expect(isOffTopic(query)).toBe(true);
  });

  it.each([
    'What does Kishan do?',
    'What does the SQL workbench do?',
    'Tell me about your experience',
    'What does the assistant do?',
    'Have you used ChatGPT?',
    "What's his experience with Playwright?",
    'How many projects has Kishan worked on so far?',
    'What does Kishan think about Muse?',
    '',
  ])('does not guard %s', (query) => {
    expect(isOffTopic(query)).toBe(false);
  });
});

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));

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
    generate = mocks.generate;
  },
  WASMEngine: class {
    load = vi.fn();
    generate = vi.fn();
  },
}));

vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
  if (url.includes('faq.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  if (url.includes('knowledge.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ chunks: [] }) });
  return Promise.resolve({ ok: false });
}));

import { Orchestrator } from '../ai/orchestrator';

async function waitForWebGPU(orch: Orchestrator): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const state = orch.getTierState();
    if (state.current === 'webgpu' && state.status === 'ready') return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('timed out waiting for webgpu tier');
}

describe('off-topic guard in send()', () => {
  it('yields the fallback without calling the model for a guarded question', async () => {
    const orch = new Orchestrator();
    await orch.init();
    await waitForWebGPU(orch);
    const chunks: Array<{ type: string; content: string }> = [];
    for await (const chunk of orch.send('What does Muse do?')) chunks.push(chunk);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('generic fallback');
  });

  it('does not guard a portfolio question naming the same product', async () => {
    mocks.generate.mockReset();
    mocks.generate.mockImplementation(async (_p: string, _s: string, onToken: (t: string) => void) => {
      onToken('model answer');
      return 'model answer';
    });
    const orch = new Orchestrator();
    await orch.init();
    await waitForWebGPU(orch);
    for await (const _c of orch.send('What does Kishan think about Muse?')) { /* drain */ }
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
});
