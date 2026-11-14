import { useState } from 'react';

export function ProblemBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 bg-chip border-b border-line text-[11px] text-muted">
      <div className="flex items-center gap-3 min-w-0">
        <span className="shrink-0 px-2 py-0.5 rounded bg-status/10 text-status font-medium uppercase tracking-wider text-[10px]">Free</span>
        <span className="truncate">
          AI chatbots like Tidio or Intercom cost $29-99/mo and send data to their servers.
          This runs a real LLM entirely in your browser (WebGPU, WASM, then template fallback). No API keys, no backend. Your questions and answers stay local; model weights and fonts are downloaded from content delivery networks.
        </span>
      </div>
      <button onClick={() => setDismissed(true)} className="shrink-0 text-dimmed hover:text-muted cursor-pointer" aria-label="Dismiss">✕</button>
    </div>
  );
}
