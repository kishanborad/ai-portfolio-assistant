---
title: Projects Overview
category: projects
tags: [projects, portfolio, overview, demos, flagship, newest, oldest]
---

My portfolio site features six projects: the Local AI Portfolio Assistant, the SQL Analytics Workbench, the Event-Stream Playground, the Test Runner Playground, the Visual Regression Lab, and the AI Test Generator. I have built ten public repos in total on GitHub; the other four are Kanha (a desktop-style AI assistant), AI Document Intelligence, the Bug Hunt Playground, and a sentiment analysis system. They all run client-side in the browser with no server, and they are all public on my GitHub.

Which project should you look at first? The AI Portfolio Assistant, the chatbot you are using right now. It is my most recent project and my only starred repo. For QA evidence, look at the AI Test Generator next: it writes and runs categorized tests.

Yes, all six projects featured on my portfolio site have live demos, and each demo link was verified to resolve and render. Kanha and AI Document Intelligence have Vercel deployments linked in their repo metadata, but I have not verified those load, so if one fails, the repo README has the setup steps to run it yourself.

I learn by building. Each playground exists because I wanted to understand something deeply enough to teach it, and they all run client-side on GitHub Pages with zero hosting cost. That constraint forces creative solutions: Python in the browser via Pyodide, ML inference via WebGPU, rendering on Canvas instead of reaching for a charting library.

The difference between the AI Test Generator and the Test Runner Playground: the generator writes test code for you, turning plain-English descriptions or recorded clicks into categorized tests with an in-browser LLM and exporting them to Playwright or Cypress, while the runner executes tests, letting you write Playwright-style tests against a demo shop and watch each step run live with reports. One generates, the other runs.

Which of my projects use AI? Five of them use AI or language models: the AI Portfolio Assistant runs Phi-3-mini or Qwen2-0.5B in the browser; the AI Test Generator runs an in-browser LLM via WebLLM and WebGPU; Kanha connects to 7 LLM providers; AI Document Intelligence uses Transformers.js for named entity recognition; and the sentiment analysis system combines an MSP model with a convolutional neural network.

What is my newest project? The AI Portfolio Assistant, last pushed in November 2026. My oldest project is the sentiment analysis system from June 2025. The other eight playgrounds were built in July and August 2026.

What about the other project? The full set on GitHub is: AI Portfolio Assistant, AI Test Generator, Test Runner Playground, Visual Regression Lab, SQL Analytics Workbench, Event-Stream Playground, Kanha, AI Document Intelligence, Bug Hunt Playground, and sentiment analysis. My portfolio site features the first six of those. Name any of them and I'll describe what it does, why I built it, and how it works.
