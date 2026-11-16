---
title: AI Document Intelligence
category: projects
tags: [document, ocr, ner, classification, tesseract, transformers]
---

AI Document Intelligence is a browser-based document intelligence wizard that runs OCR, named entity recognition, and document classification entirely in the browser, with zero backend. You upload a document and walk through OCR, entity recognition, and classification steps. It is not one of the six projects featured on my portfolio site.

OCR runs via a Tesseract worker and named entity recognition via a Transformers.js worker, both client-side. Document classification supports custom category training, and the core services have tests.

It exports results as JSON, annotated text, and zip archives.
