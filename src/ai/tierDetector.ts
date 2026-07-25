import type { Tier } from '../types';

/**
 * Check if the browser supports WebGPU.
 * Returns false in Node/test environments where navigator.gpu is undefined.
 */
export async function hasWebGPU(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !(navigator as unknown as { gpu?: unknown }).gpu) {
    return false;
  }
  try {
    const gpu = (navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu;
    const adapter = await gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Check if the browser supports WebAssembly.
 */
export function hasWASM(): boolean {
  try {
    return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
  } catch {
    return false;
  }
}

/**
 * Detect the best available AI tier for this device.
 * Priority: webgpu > wasm > template
 */
export async function detectTier(): Promise<Tier> {
  if (await hasWebGPU()) {
    return 'webgpu';
  }
  if (hasWASM()) {
    return 'wasm';
  }
  return 'template';
}
