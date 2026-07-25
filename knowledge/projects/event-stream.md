---
title: Event-Stream Playground
category: projects
tags: [event-stream, kafka, events, streaming, real-time, playground]
---

The Event-Stream Playground is a living diagram of a Kafka-style event streaming system. You can produce event bursts, pause consumers, watch partition lag grow in real time, kill a service and see retries kick in — all visualized on an animated canvas.

I built this to internalize how distributed event systems actually behave under pressure. The frontend renders producers, topics with partitions, consumer groups, and a dead-letter queue. The Python backend simulates the full event lifecycle with configurable throughput, failure injection, and consumer group rebalancing.

The architecture uses a Specification-Driven Development approach — each component has a formal spec that the implementation follows. Python handles event production, consumption logic, partition assignment, and failure simulation. The frontend connects via a real-time bridge and renders the state on canvas.

Tech stack: Python, Kafka concepts, Docker, TypeScript, Canvas API. The repo includes comprehensive Python tests, shell scripts for setup and demo runs, and GitHub Actions CI.
