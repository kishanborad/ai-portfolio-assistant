"""Analyze knowledge base chunks for token distribution and coverage.

Reports statistics about chunk sizes, category distribution, and
identifies gaps in knowledge coverage.

Usage:
    python chunk_analyzer.py --knowledge-dir ../knowledge
"""

import argparse
import os
import statistics

import tiktoken
from build_embeddings import chunk_markdown, parse_frontmatter

EXPECTED_CATEGORIES = {"resume", "projects", "philosophy", "personality"}


def analyze_chunks(knowledge_dir: str, max_tokens: int = 200, overlap: int = 50) -> dict:
    """Analyze chunks from all knowledge files.

    Returns {
        "total_chunks": int,
        "by_category": {category: int},
        "token_stats": {"min": int, "max": int, "mean": float, "median": float},
        "coverage_gaps": [str],
    }
    """
    enc = tiktoken.get_encoding("cl100k_base")
    by_category: dict[str, int] = {}
    token_counts: list[int] = []

    for root, _dirs, files in os.walk(knowledge_dir):
        for fname in sorted(files):
            if not fname.endswith(".md"):
                continue

            filepath = os.path.join(root, fname)
            with open(filepath, encoding="utf-8") as f:
                text = f.read()

            metadata, _ = parse_frontmatter(text)
            category = metadata.get("category", os.path.basename(root))
            chunks = chunk_markdown(text, max_tokens=max_tokens, overlap=overlap)

            by_category[category] = by_category.get(category, 0) + len(chunks)

            for chunk in chunks:
                tokens = enc.encode(chunk["text"])
                token_counts.append(len(tokens))

    # Token statistics
    if token_counts:
        token_stats = {
            "min": min(token_counts),
            "max": max(token_counts),
            "mean": round(statistics.mean(token_counts), 1),
            "median": round(statistics.median(token_counts), 1),
        }
    else:
        token_stats = {"min": 0, "max": 0, "mean": 0.0, "median": 0.0}

    # Coverage gaps
    found_categories = set(by_category.keys())
    gaps = sorted(EXPECTED_CATEGORIES - found_categories)

    return {
        "total_chunks": sum(by_category.values()),
        "by_category": by_category,
        "token_stats": token_stats,
        "coverage_gaps": gaps,
    }


def main():
    parser = argparse.ArgumentParser(description="Analyze knowledge chunks")
    parser.add_argument("--knowledge-dir", default="../knowledge")
    args = parser.parse_args()

    result = analyze_chunks(args.knowledge_dir)
    print(f"Total chunks: {result['total_chunks']}")
    print(f"By category: {result['by_category']}")
    print(f"Token stats: {result['token_stats']}")
    if result["coverage_gaps"]:
        print(f"Coverage gaps: {result['coverage_gaps']}")
    else:
        print("No coverage gaps detected.")


if __name__ == "__main__":
    main()
