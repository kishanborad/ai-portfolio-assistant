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

describe('tryTemplate fast path', () => {
  it('returns null before init, when no template engine is loaded', () => {
    const orch = new Orchestrator();
    expect(orch.tryTemplate('Tell me about your experience')).toBeNull();
  });

  it('returns the answer and score for a matching question', async () => {
    const orch = new Orchestrator();
    await orch.init();
    const fast = orch.tryTemplate('Tell me about your experience');
    expect(fast).not.toBeNull();
    expect(fast?.answer).toBe('Five years of QA.');
    expect(fast?.score).toBeGreaterThanOrEqual(3);
    // The mock entry carries no suggestions, so the fast path must
    // still offer the default chips after the answer.
    expect(fast?.suggestions.length).toBeGreaterThan(0);
  });

  it('returns null when nothing matches', async () => {
    const orch = new Orchestrator();
    await orch.init();
    expect(orch.tryTemplate('What does Muse do?')).toBeNull();
  });

  it('agrees with send() on matched questions', async () => {
    const orch = new Orchestrator();
    await orch.init();
    const fast = orch.tryTemplate('Tell me about your experience');
    const chunks: Array<{ type: string; content: string; meta?: { templateScore?: number | null } }> = [];
    for await (const chunk of orch.send('Tell me about your experience')) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('done');
    expect(chunks[0].content).toBe(fast?.answer);
    expect(chunks[0].meta?.templateScore).toBe(fast?.score);
  });
});
