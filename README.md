# AI Portfolio Assistant

A browser-based AI chatbot that answers questions about my experience, projects, skills, and engineering philosophy. The language model runs entirely client-side — no server, no API keys, no data leaves the browser.

## How it works

Three-tier AI with graceful fallback:

1. **WebGPU** — Phi-3-mini via WebLLM (~800MB, cached after first download)
2. **WASM** — Qwen2-0.5B via Transformers.js (~400MB)
3. **Template** — FAQ-based pattern matching (instant, no download)

Knowledge retrieval uses pre-computed embeddings from a Python build pipeline. User queries are embedded at runtime via Transformers.js, and the top-5 relevant chunks are injected into the LLM's system prompt.

## Quick start

```bash
bash scripts/setup.sh
npm run dev
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/setup.sh` | Install all dependencies (Node + Python) |
| `scripts/test.sh` | Run frontend + Python tests |
| `scripts/build-knowledge.sh` | Build knowledge.json from markdown files |
| `scripts/deploy.sh` | Build and deploy to GitHub Pages |
| `scripts/docker-run.sh` | Run in Docker container |

## Tech stack

TypeScript, React, Vite, Tailwind CSS, WebLLM, Transformers.js, Python, Docker, GitHub Actions
