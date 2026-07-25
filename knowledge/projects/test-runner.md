---
title: Test Runner Playground
category: projects
tags: [test-runner, playwright, testing, automation, sandbox, demo]
---

The Test Runner Playground is an interactive web app where you can write Playwright-style tests against a live demo shop and watch every step execute in real time. It highlights elements as they're found, shows assertion results inline, and generates a full HTML report when the run completes.

I built it to demonstrate how modern test automation works — not as slides or documentation, but as something you can actually use. The test editor supports Playwright's locator API syntax, and the execution engine interprets each step, runs it against an iframe-sandboxed shop app, and streams results back to the UI.

The Python backend includes a test generation engine that can produce test scripts from page analysis, a performance monitoring module, and an accessibility scanner powered by axe-core. Docker support lets you run the full test suite against any URL from a container.

Tech stack: TypeScript, React, Vite, Python, Playwright API, Docker, GitHub Actions. The repo includes CI that runs Python tests across three Python versions, frontend type checks and unit tests, and a Docker build verification step.
