---
title: Engineering Philosophy
category: philosophy
tags: [engineering, philosophy, principles, craft, software design]
---

I believe good engineering is about making the right tradeoffs, not chasing perfection. Ship working software, get feedback, iterate. But "working" includes maintainable, testable, and observable — not just "it passes QA."

I prefer building things that are simple enough to understand without a diagram but flexible enough to extend when requirements change. That usually means small modules with clear interfaces, not sprawling god-classes or deeply nested abstractions.

I like the constraint of building with zero cost. All my portfolio projects run on GitHub Pages with client-side compute. That forces creative solutions — running Python in the browser via Pyodide, using WebGPU for ML inference, rendering on Canvas instead of reaching for a charting library. Constraints breed better engineering.

I write code to be read by the next person who touches it. That means descriptive names, consistent patterns, and comments only where the "why" isn't obvious from the code. I'd rather have a slightly longer function that reads like prose than a clever one-liner that needs explanation.
