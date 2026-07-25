"""Export knowledge base content to JSON Resume format.

Reads the resume-category knowledge files and produces a JSON Resume
(https://jsonresume.org/schema/) compatible output.

Usage:
    python export_resume.py --knowledge-dir ../knowledge --output resume.json
"""

import argparse
import json
import os
import re

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def _read_knowledge_files(knowledge_dir: str) -> dict[str, str]:
    """Read all markdown files and return {filename: body} mapping."""
    files = {}
    for root, _dirs, filenames in os.walk(knowledge_dir):
        for fname in sorted(filenames):
            if not fname.endswith(".md"):
                continue
            filepath = os.path.join(root, fname)
            with open(filepath, encoding="utf-8") as f:
                text = f.read()
            match = FRONTMATTER_RE.match(text)
            body = text[match.end():].strip() if match else text.strip()
            files[fname] = body
    return files


def export_json_resume(knowledge_dir: str) -> dict:
    """Build a JSON Resume structure from knowledge files.

    Returns a dict conforming to the JSON Resume schema with basics,
    skills, projects, and meta sections populated from the knowledge base.
    """
    files = _read_knowledge_files(knowledge_dir)

    # Extract skills from skills.md if available
    skills_text = files.get("skills.md", "")
    skill_keywords = []
    for line in skills_text.split("\n"):
        line = line.strip()
        if line and not line.startswith("#"):
            # Extract tool/language names (capitalized words)
            words = re.findall(r"[A-Z][a-zA-Z+#.]*(?:\s[A-Z][a-zA-Z+#.]*)*", line)
            skill_keywords.extend(words)

    # Deduplicate while preserving order
    seen = set()
    unique_skills = []
    for s in skill_keywords:
        if s.lower() not in seen:
            seen.add(s.lower())
            unique_skills.append(s)

    resume = {
        "basics": {
            "name": "Kishan Borad",
            "label": "QA Engineer & Developer",
            "summary": files.get("about.md", "")[:500],
            "url": "https://kishanborad.com",
            "profiles": [
                {
                    "network": "GitHub",
                    "url": "https://github.com/kishanborad",
                },
                {
                    "network": "LinkedIn",
                    "url": "https://www.linkedin.com/in/kishanborad27/",
                },
            ],
        },
        "skills": [
            {
                "name": "QA & Test Automation",
                "keywords": unique_skills[:15] if unique_skills else [
                    "Python", "TypeScript", "Playwright", "Selenium",
                    "pytest", "Vitest", "Docker", "GitHub Actions",
                ],
            },
        ],
        "projects": [],
        "meta": {
            "version": "v1.0.0",
            "canonical": "https://kishanborad.com/resume.json",
        },
    }

    # Add projects from knowledge files
    project_files = {
        k: v for k, v in files.items()
        if k in ("test-runner.md", "event-stream.md", "visual-regression.md", "ai-assistant.md")
    }
    for fname, body in project_files.items():
        name = fname.replace(".md", "").replace("-", " ").title()
        summary = body.split("\n")[0][:200] if body else ""
        resume["projects"].append({
            "name": name,
            "description": summary,
            "url": f"https://github.com/kishanborad/{fname.replace('.md', '')}",
        })

    return resume


def write_resume_json(knowledge_dir: str, output_path: str) -> dict:
    """Export JSON Resume and write to file."""
    resume = export_json_resume(knowledge_dir)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(resume, f, indent=2)

    return resume


def main():
    parser = argparse.ArgumentParser(description="Export to JSON Resume format")
    parser.add_argument("--knowledge-dir", default="../knowledge")
    parser.add_argument("--output", default="resume.json")
    args = parser.parse_args()

    resume = write_resume_json(args.knowledge_dir, args.output)
    print(f"Exported resume with {len(resume['skills'][0]['keywords'])} skills → {args.output}")


if __name__ == "__main__":
    main()
