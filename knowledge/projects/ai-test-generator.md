---
title: AI Test Generator
category: projects
tags: [ai, test, generator, webllm, webgpu, playwright, cypress, nlp]
---

The AI Test Generator lets you describe what to test in plain English or record your clicks, then an in-browser LLM writes categorized test code, runs it live against a sandbox, and exports to Playwright or Cypress format. The model runs entirely on your device via WebGPU.

I built it to bridge the gap between manual QA descriptions and executable test scripts. You type something like "verify the login form rejects empty passwords" and the tool generates a structured test with assertions, runs it against a sandboxed demo app, and shows pass/fail results. You can also record interactions by clicking through the sandbox and the tool converts those clicks into test steps.

The LLM runs locally using WebLLM and WebGPU — no server calls, no API keys. The generated tests are editable in a Monaco code editor and can be exported as Playwright or Cypress scripts ready to drop into a CI pipeline.

Tech stack: TypeScript, React, Vite, WebLLM, WebGPU, Monaco Editor. The repo includes GitHub Actions CI for builds and type checks.
