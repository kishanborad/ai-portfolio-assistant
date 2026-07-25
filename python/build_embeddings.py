"""Build knowledge.json from markdown files using sentence-transformers.

Reads markdown files from the knowledge/ directory, chunks them into
~200-token segments with overlap, embeds each chunk using all-MiniLM-L6-v2,
and writes the result to public/knowledge.json.

Usage:
    python build_embeddings.py --knowledge-dir ../knowledge --output ../public/knowledge.json
"""

import argparse
import json
import os
import re
import sys

import numpy as np
import tiktoken
import yaml


# ── frontmatter parsing ────────────────────────────────────────────────────

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Extract YAML frontmatter and return (metadata, body)."""
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}, text
    raw_meta = match.group(1)
    metadata = yaml.safe_load(raw_meta) or {}
    body = text[match.end():]
    return metadata, body


# ── chunking ────────────────────────────────────────────────────────────────

def chunk_markdown(
    text: str,
    max_tokens: int = 200,
    overlap: int = 50,
) -> list[dict]:
    """Split markdown text into overlapping token-bounded chunks.

    Strips YAML frontmatter before chunking. Returns a list of dicts
    with keys: text, start, end (character offsets into the body).
    """
    _, body = parse_frontmatter(text)
    body = body.strip()
    if not body:
        return []

    enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(body)

    if len(tokens) <= max_tokens:
        return [{"text": body, "start": 0, "end": len(body)}]

    chunks = []
    pos = 0
    step = max_tokens - overlap

    while pos < len(tokens):
        chunk_tokens = tokens[pos : pos + max_tokens]
        chunk_text = enc.decode(chunk_tokens).strip()

        if chunk_text:
            # Find approximate character offsets
            start_char = len(enc.decode(tokens[:pos]))
            end_char = start_char + len(chunk_text)
            chunks.append({
                "text": chunk_text,
                "start": start_char,
                "end": end_char,
            })

        pos += step

    return chunks


# ── embedding ───────────────────────────────────────────────────────────────

def load_embedding_model():
    """Load the sentence-transformers model for embedding."""
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer("all-MiniLM-L6-v2")


def embed_texts(model, texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts, returning 384-dim vectors as lists of floats."""
    embeddings = model.encode(texts, normalize_embeddings=True)
    return [vec.tolist() for vec in embeddings]


# ── pipeline ────────────────────────────────────────────────────────────────

def build_knowledge_json(
    knowledge_dir: str,
    output_path: str,
    max_tokens: int = 200,
    overlap: int = 50,
) -> dict:
    """Read all markdown files, chunk, embed, and write knowledge.json.

    Returns the output data structure for inspection.
    """
    all_chunks = []

    for root, _dirs, files in os.walk(knowledge_dir):
        for fname in sorted(files):
            if not fname.endswith(".md"):
                continue

            filepath = os.path.join(root, fname)
            with open(filepath, encoding="utf-8") as f:
                text = f.read()

            metadata, _ = parse_frontmatter(text)
            category = metadata.get("category", os.path.basename(root))

            raw_chunks = chunk_markdown(text, max_tokens=max_tokens, overlap=overlap)

            for chunk in raw_chunks:
                all_chunks.append({
                    "text": chunk["text"],
                    "category": category,
                    "source": fname,
                })

    # Embed all chunk texts in one batch
    if all_chunks:
        model = load_embedding_model()
        texts = [c["text"] for c in all_chunks]
        embeddings = embed_texts(model, texts)

        for chunk, embedding in zip(all_chunks, embeddings):
            chunk["embedding"] = embedding

    output_data = {"chunks": all_chunks}

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    return output_data


# ── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Build knowledge.json from markdown files"
    )
    parser.add_argument(
        "--knowledge-dir",
        default="../knowledge",
        help="Path to the knowledge/ directory",
    )
    parser.add_argument(
        "--output",
        default="../public/knowledge.json",
        help="Output path for knowledge.json",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=200,
        help="Maximum tokens per chunk",
    )
    parser.add_argument(
        "--overlap",
        type=int,
        default=50,
        help="Token overlap between chunks",
    )
    args = parser.parse_args()

    print(f"Reading knowledge from: {args.knowledge_dir}")
    result = build_knowledge_json(
        args.knowledge_dir, args.output, args.max_tokens, args.overlap
    )
    print(f"Wrote {len(result['chunks'])} chunks to: {args.output}")


if __name__ == "__main__":
    main()
