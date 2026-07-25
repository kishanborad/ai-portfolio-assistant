---
title: Visual Regression Lab
category: projects
tags: [visual-regression, pixel-diff, testing, canvas, python, PIL]
---

The Visual Regression Lab lets you compare two builds of the same UI pixel by pixel. You select a scenario, the tool renders baseline and candidate versions in hidden iframes, captures them to canvas, and runs a Python-powered diff algorithm (PIL/Pillow via Pyodide) to produce a highlighted diff image with a pass/fail gate.

You can tune the color distance threshold, set a mismatch percentage gate, draw ignore regions to exclude dynamic content, and customize the diff highlight color. There's also a custom upload mode where you drop in your own baseline and candidate images.

The Python diff engine runs entirely in the browser using Pyodide — no server needed. The tool also generates ready-to-use Docker and GitHub Actions configurations for integrating visual regression into CI pipelines.

Tech stack: Python, Canvas API, Docker, GitHub Actions, CSS. The preset scenarios demonstrate real CSS regression classes like color shifts, font changes, spacing drift, and layout breaks.
