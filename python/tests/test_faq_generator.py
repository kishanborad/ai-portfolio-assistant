"""Tests for the FAQ generator."""

import json
import os
import tempfile

import pytest

from faq_generator import generate_faq, write_faq_json


class TestGenerateFaq:
    """Tests for FAQ pair generation from knowledge files."""

    def test_generates_faq_entries_from_knowledge(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            os.makedirs(os.path.join(tmpdir, "resume"))
            with open(os.path.join(tmpdir, "resume", "experience.md"), "w") as f:
                f.write(
                    "---\ntitle: Experience\ncategory: resume\n"
                    "tags: [experience, work, QA]\n---\n"
                    "I have five years of QA automation experience. "
                    "My core tools are Playwright and Selenium."
                )

            faqs = generate_faq(tmpdir)

        assert len(faqs) >= 1
        assert all("question" in faq for faq in faqs)
        assert all("answer" in faq for faq in faqs)

    def test_faq_entries_have_required_fields(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            os.makedirs(os.path.join(tmpdir, "projects"))
            with open(os.path.join(tmpdir, "projects", "runner.md"), "w") as f:
                f.write(
                    "---\ntitle: Test Runner\ncategory: projects\n"
                    "tags: [testing, playwright]\n---\n"
                    "An interactive test runner playground."
                )

            faqs = generate_faq(tmpdir)

        for faq in faqs:
            assert isinstance(faq["question"], str)
            assert isinstance(faq["answer"], str)
            assert isinstance(faq["keywords"], list)
            assert isinstance(faq["category"], str)
            assert isinstance(faq["suggestions"], list)

    def test_faq_categories_match_source(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            os.makedirs(os.path.join(tmpdir, "philosophy"))
            with open(os.path.join(tmpdir, "philosophy", "testing.md"), "w") as f:
                f.write(
                    "---\ntitle: Testing Philosophy\ncategory: philosophy\n"
                    "tags: [testing, philosophy]\n---\n"
                    "I treat test automation as infrastructure."
                )

            faqs = generate_faq(tmpdir)

        assert all(faq["category"] == "philosophy" for faq in faqs)


class TestWriteFaqJson:
    """Tests for writing FAQ data to JSON file."""

    def test_writes_valid_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            knowledge_dir = os.path.join(tmpdir, "knowledge")
            os.makedirs(os.path.join(knowledge_dir, "resume"))
            with open(os.path.join(knowledge_dir, "resume", "skills.md"), "w") as f:
                f.write(
                    "---\ntitle: Skills\ncategory: resume\n"
                    "tags: [skills, python]\n---\n"
                    "My primary languages are Python and TypeScript."
                )

            output_path = os.path.join(tmpdir, "faq.json")
            write_faq_json(knowledge_dir, output_path)

            assert os.path.exists(output_path)
            with open(output_path) as f:
                data = json.load(f)
            assert isinstance(data, list)
            assert len(data) >= 1
