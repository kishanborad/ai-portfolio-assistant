"""Benchmark retrieval accuracy against known query-answer pairs.

Embeds queries using sentence-transformers, retrieves top-5 chunks from
knowledge.json, and checks whether the expected source file appears in
the results. Reports recall@5.

Usage:
    python similarity_benchmark.py --knowledge-json ../public/knowledge.json
"""

import argparse
import json

import numpy as np

DEFAULT_QUERIES = [
    {"query": "Tell me about your QA experience", "expected_source": "experience.md"},
    {"query": "What tools do you use?", "expected_source": "skills.md"},
    {"query": "How does the test runner work?", "expected_source": "test-runner.md"},
    {"query": "What is your testing philosophy?", "expected_source": "testing.md"},
    {"query": "Tell me about yourself", "expected_source": "about.md"},
    {"query": "What are your goals?", "expected_source": "goals.md"},
    {"query": "Event streaming playground", "expected_source": "event-stream.md"},
    {"query": "Visual regression testing", "expected_source": "visual-regression.md"},
]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a_np = np.array(a)
    b_np = np.array(b)
    dot = np.dot(a_np, b_np)
    norm = np.linalg.norm(a_np) * np.linalg.norm(b_np)
    if norm == 0:
        return 0.0
    return float(dot / norm)


def run_benchmark(
    knowledge_json: str,
    queries: list[dict] | None = None,
    top_k: int = 5,
) -> dict:
    """Run retrieval benchmark.

    Args:
        knowledge_json: Path to knowledge.json with pre-computed embeddings.
        queries: List of {"query": str, "expected_source": str}. Uses defaults
                 if not provided.
        top_k: Number of top results to consider.

    Returns:
        {"recall_at_5": float, "results": [{"query", "expected_source", "found", "top_sources"}]}
    """
    if queries is None:
        queries = DEFAULT_QUERIES

    with open(knowledge_json, encoding="utf-8") as f:
        data = json.load(f)

    chunks = data["chunks"]
    if not chunks:
        return {
            "recall_at_5": 0.0,
            "results": [
                {
                    "query": q["query"],
                    "expected_source": q["expected_source"],
                    "found": False,
                    "top_sources": [],
                }
                for q in queries
            ],
        }

    # Load embedding model
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("all-MiniLM-L6-v2")

    results = []
    hits = 0

    for query_info in queries:
        query_embedding = model.encode(
            query_info["query"], normalize_embeddings=True
        ).tolist()

        scored = []
        for chunk in chunks:
            score = cosine_similarity(query_embedding, chunk["embedding"])
            scored.append((score, chunk["source"]))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_sources = [s[1] for s in scored[:top_k]]

        found = query_info["expected_source"] in top_sources
        if found:
            hits += 1

        results.append({
            "query": query_info["query"],
            "expected_source": query_info["expected_source"],
            "found": found,
            "top_sources": top_sources,
        })

    return {
        "recall_at_5": round(hits / len(queries), 3) if queries else 0.0,
        "results": results,
    }


def main():
    parser = argparse.ArgumentParser(description="Benchmark retrieval accuracy")
    parser.add_argument(
        "--knowledge-json", default="../public/knowledge.json"
    )
    args = parser.parse_args()

    result = run_benchmark(args.knowledge_json)
    print(f"Recall@5: {result['recall_at_5']:.1%}")
    for r in result["results"]:
        status = "HIT" if r["found"] else "MISS"
        print(f"  [{status}] {r['query']}")
        print(f"          Expected: {r['expected_source']}")
        print(f"          Got: {r['top_sources']}")


if __name__ == "__main__":
    main()
