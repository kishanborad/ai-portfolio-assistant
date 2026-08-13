---
title: SQL Analytics Workbench
category: projects
tags: [sql, analytics, workbench, duckdb, wasm, database, query, data]
---

The SQL Analytics Workbench is a browser-based SQL editor backed by DuckDB compiled to WebAssembly. You write queries against a preloaded dataset and get instant results rendered as tables or charts — no backend, no database server, nothing to install.

I built it to show that serious data analysis can happen entirely client-side. DuckDB-WASM handles the query engine, so the SQL dialect supports window functions, CTEs, aggregations, and joins at full speed. The UI includes a Monaco-based editor with syntax highlighting and a results panel that switches between tabular and chart views.

The project runs entirely in the browser. There's no server, no API keys, and no data leaves the user's machine. It's deployed on GitHub Pages as a static site.

Tech stack: TypeScript, React, Vite, DuckDB-WASM, SQL, Monaco Editor. The repo includes CI via GitHub Actions for type checks and build verification.
