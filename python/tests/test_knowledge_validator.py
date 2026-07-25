"""Tests for the knowledge base validator."""

import os
import tempfile

from knowledge_validator import validate_frontmatter, validate_knowledge_dir


class TestValidateFrontmatter:
    """Tests for single-file frontmatter validation."""

    def test_valid_frontmatter_passes(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("---\ntitle: Test\ncategory: resume\ntags: [a, b]\n---\nContent.")
            f.flush()
            result = validate_frontmatter(f.name)
        os.unlink(f.name)
        assert result["valid"] is True
        assert result["errors"] == []
        assert result["metadata"]["title"] == "Test"

    def test_missing_title_fails(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("---\ncategory: resume\ntags: [a]\n---\nContent.")
            f.flush()
            result = validate_frontmatter(f.name)
        os.unlink(f.name)
        assert result["valid"] is False
        assert any("title" in e for e in result["errors"])

    def test_missing_category_fails(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("---\ntitle: Test\ntags: [a]\n---\nContent.")
            f.flush()
            result = validate_frontmatter(f.name)
        os.unlink(f.name)
        assert result["valid"] is False
        assert any("category" in e for e in result["errors"])

    def test_missing_tags_fails(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("---\ntitle: Test\ncategory: resume\n---\nContent.")
            f.flush()
            result = validate_frontmatter(f.name)
        os.unlink(f.name)
        assert result["valid"] is False
        assert any("tags" in e for e in result["errors"])

    def test_no_frontmatter_fails(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("Just content, no frontmatter.")
            f.flush()
            result = validate_frontmatter(f.name)
        os.unlink(f.name)
        assert result["valid"] is False


class TestValidateKnowledgeDir:
    """Tests for directory-level validation with coverage report."""

    def test_reports_coverage_by_category(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            for cat in ("resume", "projects"):
                cat_dir = os.path.join(tmpdir, cat)
                os.makedirs(cat_dir)
                with open(os.path.join(cat_dir, "file.md"), "w") as f:
                    f.write(
                        f"---\ntitle: T\ncategory: {cat}\n"
                        f"tags: [x]\n---\nContent."
                    )

            result = validate_knowledge_dir(tmpdir)

        assert result["total"] == 2
        assert result["valid"] == 2
        assert result["coverage"]["resume"] == 1
        assert result["coverage"]["projects"] == 1

    def test_counts_invalid_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            os.makedirs(os.path.join(tmpdir, "resume"))
            with open(os.path.join(tmpdir, "resume", "bad.md"), "w") as f:
                f.write("No frontmatter here.")

            result = validate_knowledge_dir(tmpdir)

        assert result["total"] == 1
        assert result["valid"] == 0
