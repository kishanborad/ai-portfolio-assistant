---
title: Testing Philosophy
category: philosophy
tags: [testing, philosophy, quality, automation, strategy, principles]
---

I think of test automation as infrastructure, not an afterthought. A test suite should be a system you can reason about — with its own architecture, performance budget, and maintenance plan. When tests are slow, flaky, or hard to understand, I treat that as a bug in the test infrastructure, not an acceptable cost of doing business.

My approach follows a few principles. First, test at the right level — unit tests for logic, integration tests for boundaries, end-to-end tests for critical paths. Don't over-index on any single layer. Second, tests should be deterministic. If a test flakes, I don't retry it and move on — I fix the root cause, whether that's a race condition, an implicit dependency, or a fragile selector.

Third, test code deserves the same quality bar as production code. That means clear naming, no duplication, proper abstractions, and code review. If your test file is 2,000 lines of copy-pasted boilerplate, you have a design problem.

I'm also a strong believer in visual regression testing and accessibility testing as first-class citizens in the CI pipeline, not optional extras that run occasionally.

Constraints breed better engineering. All my portfolio projects run client-side at zero cost, which forces creative solutions: Python in the browser via Pyodide, ML inference via WebGPU, rendering on Canvas instead of reaching for a charting library.

More about my philosophy: three ideas guide me. First, test automation is infrastructure with its own architecture and maintenance plan. Second, constraints breed better engineering: all my portfolio projects run client-side at zero cost, which forces creative solutions. Third, visual regression and accessibility testing belong as first-class citizens in CI, not optional extras.
