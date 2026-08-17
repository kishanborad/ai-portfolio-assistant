# AI Portfolio Assistant

A browser-based AI chatbot that answers questions about my experience, projects, skills, and engineering philosophy. The language model runs entirely client-side — no server, no API keys, no data leaves the browser.

**Live demo:** [kishanborad.github.io/ai-portfolio-assistant](https://kishanborad.github.io/ai-portfolio-assistant/)

## How it works

Three-tier AI with graceful fallback:

1. **WebGPU** — Phi-3-mini via WebLLM (~800MB, cached after first download)
2. **WASM** — Qwen2-0.5B via Transformers.js (~400MB)
3. **Template** — FAQ-based pattern matching (instant, no download)

Knowledge retrieval uses pre-computed embeddings from a Python build pipeline. User queries are embedded at runtime via Transformers.js, and the top-5 relevant chunks are injected into the LLM's system prompt.

## Getting started

```bash
git clone https://github.com/kishanborad/ai-portfolio-assistant.git
cd ai-portfolio-assistant
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

- React 18 + TypeScript + Vite + Tailwind CSS
- WebLLM (WebGPU-accelerated LLM inference)
- Transformers.js (WASM-based embeddings and fallback LLM)
- Python (knowledge pipeline, embedding generation, pytest)
- Docker + GitHub Actions CI

## AI tools

Built with [Claude Code](https://claude.ai/code) as the AI copilot for code generation, agent-driven development, and automated testing workflows.

## Author

Kishan Borad
- [GitHub](https://github.com/kishanborad)
- [LinkedIn](https://linkedin.com/in/kishanborad27)

## License

MIT
