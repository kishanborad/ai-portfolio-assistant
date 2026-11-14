---
title: AI Portfolio Assistant
category: projects
tags: [ai, chatbot, LLM, WebGPU, WASM, transformers, RAG, browser]
---

The AI Portfolio Assistant is a browser-based chatbot that answers questions about my experience, projects, and skills using a language model running entirely client-side. No server, no API keys, no data leaves the browser.

It uses a three-tier approach: if your device supports WebGPU, it loads Phi-3-mini via WebLLM for real-time streaming responses. If only WASM is available, it falls back to Qwen2-0.5B via Transformers.js. And if neither works or while models are downloading, it uses FAQ-based template matching for instant responses.

The knowledge retrieval pipeline uses RAG (Retrieval-Augmented Generation). A Python build script pre-embeds my knowledge base into 384-dimensional vectors using sentence-transformers. At runtime, your question gets embedded via Transformers.js, and the top-5 most relevant chunks are injected into the LLM's system prompt as context.

The assistant speaks in first person as me — friendly and specific, referencing real projects and tools by name. It's designed for recruiters, hiring managers, and anyone curious about my background.
