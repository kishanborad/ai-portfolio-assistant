---
title: AI Portfolio Assistant
category: projects
tags: [ai, chatbot, LLM, WebGPU, WASM, transformers, RAG, browser]
---

This chatbot is the AI Portfolio Assistant, a browser-based chatbot that answers questions about my experience, projects, and skills. It runs a small language model (Phi-3) entirely in your browser and grounds every answer in a fixed knowledge base about my background. Questions are logged anonymously to improve answers.

It uses a three-tier approach: if your device supports WebGPU, it loads Phi-3-mini via WebLLM for real-time streaming responses. If only WASM is available, it falls back to Qwen2-0.5B via Transformers.js. And if neither works or while models are downloading, it uses FAQ-based template matching for instant responses.

Yes, I use RAG (Retrieval-Augmented Generation). A Python build script pre-embeds my knowledge base into 384-dimensional vectors using sentence-transformers. At runtime your question is embedded in the browser, and the top-5 most relevant chunks are injected into the model's system prompt as context. That retrieved context is where my answers come from.

The assistant speaks in first person as me — friendly and specific, referencing real projects and tools by name. It's designed for recruiters, hiring managers, and anyone curious about my background. It is my newest project, last pushed in November 2026, and my only starred repo.

I built it with React, TypeScript, Vite, and Tailwind CSS on the frontend, WebLLM and Transformers.js for the models, and a Python pipeline for the knowledge base, embeddings, and tests. The repo notes it was built with Claude Code as the AI copilot for code generation and testing workflows.

How accurate are my answers? They are accurate because they come from a fixed knowledge base of verified material about my background. That grounding in real projects, tools, and numbers is what keeps them accurate. But I am a small model running in a browser, so if something matters for a hiring decision, verify it directly with me through the contact channels.
