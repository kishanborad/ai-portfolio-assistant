"""Tests for the chunk analyzer."""

import os
import tempfile

from chunk_analyzer import analyze_chunks


class TestAnalyzeChunks:
    """Tests for token distribution and coverage analysis."""

    def test_reports_total_chunks(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            os.makedirs(os.path.join(tmpdir, "resume"))
            with open(os.path.join(tmpdir, "resume", "test.md"), "w") as f:
                f.write(
                    "---\ntitle: T\ncategory: resume\ntags: [a]\n---\n"
                    "Content here with enough words to form a chunk."
                )

            result = analyze_chunks(tmpdir)

        assert result["total_chunks"] >= 1

    def test_reports_by_category(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            for cat in ("resume", "projects"):
                os.makedirs(os.path.join(tmpdir, cat))
                with open(os.path.join(tmpdir, cat, "file.md"), "w") as f:
                    f.write(
                        f"---\ntitle: T\ncategory: {cat}\ntags: [x]\n---\n"
                        f"Content for {cat} category."
                    )

            result = analyze_chunks(tmpdir)

        assert "resume" in result["by_category"]
        assert "projects" in result["by_category"]

    def test_token_stats_have_min_max_mean(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            os.makedirs(os.path.join(tmpdir, "resume"))
            with open(os.path.join(tmpdir, "resume", "test.md"), "w") as f:
                f.write(
                    "---\ntitle: T\ncategory: resume\ntags: [a]\n---\n"
                    "Some content for analysis. " * 20
                )

            result = analyze_chunks(tmpdir)

        stats = result["token_stats"]
        assert "min" in stats
        assert "max" in stats
        assert "mean" in stats
        assert stats["min"] <= stats["mean"] <= stats["max"]

    def test_detects_coverage_gaps(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            # Only resume, missing projects/philosophy/personality
            os.makedirs(os.path.join(tmpdir, "resume"))
            with open(os.path.join(tmpdir, "resume", "test.md"), "w") as f:
                f.write(
                    "---\ntitle: T\ncategory: resume\ntags: [a]\n---\n"
                    "Content."
                )

            result = analyze_chunks(tmpdir)

        assert len(result["coverage_gaps"]) > 0
