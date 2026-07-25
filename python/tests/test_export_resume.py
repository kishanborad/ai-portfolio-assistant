"""Tests for the JSON Resume exporter."""

import os
import tempfile

from export_resume import export_json_resume, write_resume_json


class TestExportJsonResume:
    """Tests for JSON Resume format generation."""

    def test_returns_required_fields(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            os.makedirs(os.path.join(tmpdir, "resume"))
            with open(os.path.join(tmpdir, "resume", "experience.md"), "w") as f:
                f.write(
                    "---\ntitle: Experience\ncategory: resume\n"
                    "tags: [experience]\n---\n"
                    "Five years of QA automation."
                )
            with open(os.path.join(tmpdir, "resume", "skills.md"), "w") as f:
                f.write(
                    "---\ntitle: Skills\ncategory: resume\n"
                    "tags: [skills]\n---\n"
                    "Python, TypeScript, Playwright."
                )

            result = export_json_resume(tmpdir)

        assert "basics" in result
        assert result["basics"]["name"] == "Kishan Borad"
        assert "skills" in result
        assert "meta" in result

    def test_round_trip_serialization(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            knowledge_dir = os.path.join(tmpdir, "knowledge")
            os.makedirs(os.path.join(knowledge_dir, "resume"))
            with open(os.path.join(knowledge_dir, "resume", "skills.md"), "w") as f:
                f.write(
                    "---\ntitle: Skills\ncategory: resume\n"
                    "tags: [skills]\n---\n"
                    "Docker, GitHub Actions."
                )

            output_path = os.path.join(tmpdir, "resume.json")
            write_resume_json(knowledge_dir, output_path)

            assert os.path.exists(output_path)
            import json
            with open(output_path) as f:
                data = json.load(f)
            assert data["basics"]["name"] == "Kishan Borad"
