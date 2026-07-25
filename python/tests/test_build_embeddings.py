"""Tests for the markdown chunking and embedding pipeline."""

import json
import os
import tempfile

import pytest

from build_embeddings import chunk_markdown, build_knowledge_json


# ── chunk_markdown tests ────────────────────────────────────────────────────


class TestChunkMarkdown:
    """Tests for splitting markdown text into overlapping token chunks."""

    def test_short_text_produces_single_chunk(self):
        text = "I am a QA engineer with five years of experience."
        chunks = chunk_markdown(text, max_tokens=200, overlap=50)
        assert len(chunks) == 1
        assert chunks[0]["text"] == text

    def test_long_text_produces_multiple_chunks(self):
        # ~400 tokens worth of text should produce at least 2 chunks at 200 max
        text = "Testing is important. " * 80
        chunks = chunk_markdown(text, max_tokens=200, overlap=50)
        assert len(chunks) >= 2

    def test_chunks_have_required_fields(self):
        text = "Playwright is a browser automation tool. " * 40
        chunks = chunk_markdown(text, max_tokens=200, overlap=50)
        for chunk in chunks:
            assert "text" in chunk
            assert "start" in chunk
            assert "end" in chunk
            assert isinstance(chunk["text"], str)
            assert isinstance(chunk["start"], int)
            assert isinstance(chunk["end"], int)

    def test_overlap_creates_shared_content(self):
        text = "Word " * 500  # long enough for multiple chunks
        chunks = chunk_markdown(text, max_tokens=100, overlap=30)
        if len(chunks) >= 2:
            # Last portion of chunk N should appear at start of chunk N+1
            end_of_first = chunks[0]["text"].split()[-10:]
            start_of_second = chunks[1]["text"].split()[:10]
            overlap_words = set(end_of_first) & set(start_of_second)
            assert len(overlap_words) > 0

    def test_empty_text_returns_empty_list(self):
        chunks = chunk_markdown("", max_tokens=200, overlap=50)
        assert chunks == []

    def test_whitespace_only_returns_empty_list(self):
        chunks = chunk_markdown("   \n\n  ", max_tokens=200, overlap=50)
        assert chunks == []

    def test_frontmatter_is_stripped(self):
        text = "---\ntitle: Test\ncategory: resume\ntags: [a]\n---\nActual content here."
        chunks = chunk_markdown(text, max_tokens=200, overlap=50)
        assert len(chunks) == 1
        assert "---" not in chunks[0]["text"]
        assert "Actual content here." in chunks[0]["text"]


# ── build_knowledge_json tests ──────────────────────────────────────────────


class TestBuildKnowledgeJson:
    """Tests for the full pipeline: read markdown, chunk, embed, write JSON."""

    def test_produces_valid_json_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a minimal knowledge structure
            resume_dir = os.path.join(tmpdir, "knowledge", "resume")
            os.makedirs(resume_dir)
            with open(os.path.join(resume_dir, "test.md"), "w") as f:
                f.write(
                    "---\ntitle: Test\ncategory: resume\n"
                    "tags: [test]\n---\n"
                    "I have five years of QA experience."
                )

            output_path = os.path.join(tmpdir, "knowledge.json")
            result = build_knowledge_json(
                os.path.join(tmpdir, "knowledge"), output_path
            )

            assert os.path.exists(output_path)
            with open(output_path) as f:
                data = json.load(f)
            assert "chunks" in data
            assert len(data["chunks"]) >= 1

    def test_each_chunk_has_384_dim_embedding(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            resume_dir = os.path.join(tmpdir, "knowledge", "resume")
            os.makedirs(resume_dir)
            with open(os.path.join(resume_dir, "test.md"), "w") as f:
                f.write(
                    "---\ntitle: Test\ncategory: resume\n"
                    "tags: [test]\n---\n"
                    "I build test automation infrastructure and tools."
                )

            output_path = os.path.join(tmpdir, "knowledge.json")
            build_knowledge_json(
                os.path.join(tmpdir, "knowledge"), output_path
            )

            with open(output_path) as f:
                data = json.load(f)

            for chunk in data["chunks"]:
                assert "embedding" in chunk
                assert len(chunk["embedding"]) == 384
                assert all(isinstance(v, float) for v in chunk["embedding"])

    def test_chunks_preserve_category_and_source(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            projects_dir = os.path.join(tmpdir, "knowledge", "projects")
            os.makedirs(projects_dir)
            with open(os.path.join(projects_dir, "runner.md"), "w") as f:
                f.write(
                    "---\ntitle: Test Runner\ncategory: projects\n"
                    "tags: [testing]\n---\n"
                    "An interactive test runner playground."
                )

            output_path = os.path.join(tmpdir, "knowledge.json")
            build_knowledge_json(
                os.path.join(tmpdir, "knowledge"), output_path
            )

            with open(output_path) as f:
                data = json.load(f)

            chunk = data["chunks"][0]
            assert chunk["category"] == "projects"
            assert chunk["source"] == "runner.md"

    def test_empty_directory_produces_empty_chunks(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            knowledge_dir = os.path.join(tmpdir, "knowledge")
            os.makedirs(knowledge_dir)
            output_path = os.path.join(tmpdir, "knowledge.json")
            build_knowledge_json(knowledge_dir, output_path)

            with open(output_path) as f:
                data = json.load(f)
            assert data["chunks"] == []
