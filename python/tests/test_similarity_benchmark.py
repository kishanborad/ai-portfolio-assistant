"""Tests for the similarity benchmark."""

import json
import os
import tempfile

from similarity_benchmark import run_benchmark


class TestRunBenchmark:
    """Tests for retrieval accuracy measurement."""

    def test_returns_recall_at_5(self):
        # Build a minimal knowledge.json with pre-computed embeddings
        with tempfile.TemporaryDirectory() as tmpdir:
            knowledge_path = os.path.join(tmpdir, "knowledge.json")

            # Create knowledge.json with dummy embeddings
            chunks = [
                {
                    "text": "I have five years of QA experience.",
                    "category": "resume",
                    "source": "experience.md",
                    "embedding": [0.1] * 384,
                },
                {
                    "text": "I built a test runner playground.",
                    "category": "projects",
                    "source": "test-runner.md",
                    "embedding": [0.2] * 384,
                },
            ]
            with open(knowledge_path, "w") as f:
                json.dump({"chunks": chunks}, f)

            queries = [
                {"query": "QA experience", "expected_source": "experience.md"},
            ]

            result = run_benchmark(knowledge_path, queries)

        assert "recall_at_5" in result
        assert isinstance(result["recall_at_5"], float)
        assert 0.0 <= result["recall_at_5"] <= 1.0

    def test_results_list_matches_queries(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            knowledge_path = os.path.join(tmpdir, "knowledge.json")
            chunks = [
                {
                    "text": "Testing philosophy content.",
                    "category": "philosophy",
                    "source": "testing.md",
                    "embedding": [0.3] * 384,
                },
            ]
            with open(knowledge_path, "w") as f:
                json.dump({"chunks": chunks}, f)

            queries = [
                {"query": "testing approach", "expected_source": "testing.md"},
                {"query": "my skills", "expected_source": "skills.md"},
            ]

            result = run_benchmark(knowledge_path, queries)

        assert len(result["results"]) == 2
        for r in result["results"]:
            assert "query" in r
            assert "expected_source" in r
            assert "found" in r
            assert "top_sources" in r
