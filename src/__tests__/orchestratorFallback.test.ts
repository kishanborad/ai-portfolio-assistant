import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  webgpuLoad: vi.fn(),
  wasmLoad: vi.fn(),
}));

vi.mock('../ai/tierDetector', () => ({
  detectTier: vi.fn().mockResolvedValue('webgpu'),
  hasWebGPU: vi.fn().mockResolvedValue(true),
  hasWASM: vi.fn().mockReturnValue(true),
}));

vi.mock('../ai/engines', () => ({
  TemplateEngine: class {
    respond() {
      return { answer: 'template answer', suggestions: [] };
    }
  },
  WebGPUEngine: class {
    load = mocks.webgpuLoad;
    generate = vi.fn();
  },
  WASMEngine: class {
    load = mocks.wasmLoad;
    generate = vi.fn();
  },
}));

vi.stubGlobal(
  'fetch',
  vi.fn().mockImplementation((url: string) => {
    if (url.includes('faq.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (url.includes('knowledge.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ chunks: [] }) });
    }
    return Promise.resolve({ ok: false });
  }),
);

import { Orchestrator } from '../ai/orchestrator';

async function waitForTier(
  orch: Orchestrator,
  current: string,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (orch.getTierState().current === current && orch.getTierState().status === 'ready') {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for tier ${current}, got ${JSON.stringify(orch.getTierState())}`);
}

describe('Orchestrator fallback chain', () => {
  beforeEach(() => {
    mocks.webgpuLoad.mockReset();
    mocks.wasmLoad.mockReset();
  });

  it('falls back to the WASM tier when WebGPU fails to load', async () => {
    mocks.webgpuLoad.mockRejectedValueOnce(new Error('no WebGPU adapter'));
    mocks.wasmLoad.mockResolvedValueOnce(undefined);

    const orch = new Orchestrator();
    await orch.init();
    await waitForTier(orch, 'wasm');

    expect(mocks.webgpuLoad).toHaveBeenCalledTimes(1);
    expect(mocks.wasmLoad).toHaveBeenCalledTimes(1);
    expect(orch.getTierState().current).toBe('wasm');
  });

  it('falls back to template when both WebGPU and WASM fail', async () => {
    mocks.webgpuLoad.mockRejectedValueOnce(new Error('no WebGPU adapter'));
    mocks.wasmLoad.mockRejectedValueOnce(new Error('no WASM model'));

    const orch = new Orchestrator();
    await orch.init();
    await waitForTier(orch, 'template');

    expect(mocks.webgpuLoad).toHaveBeenCalledTimes(1);
    expect(mocks.wasmLoad).toHaveBeenCalledTimes(1);
    expect(orch.getTierState().current).toBe('template');
    expect(orch.getTierState().status).toBe('ready');
  });
});
