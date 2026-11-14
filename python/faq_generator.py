"""Generate FAQ pairs from knowledge base markdown files.

Reads each knowledge file and produces question/answer pairs suitable
for the template-based fallback tier (Tier 3). Questions are derived
from the file's title, category, and tags. Answers are the first
paragraph or a condensed version of the content.

Usage:
    python faq_generator.py --knowledge-dir ../knowledge --output ../public/faq.json
"""

import argparse
import json
import os
import re

import yaml

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)

# Category-specific question templates
QUESTION_TEMPLATES: dict[str, list[str]] = {
    "resume": [
        "Tell me about your {title}",
        "What is your {title}?",
    ],
    "projects": [
        "Tell me about {title}",
        "What is {title}?",
        "How does {title} work?",
    ],
    "philosophy": [
        "What is your {title}?",
        "Tell me about your approach to {tag_topic}",
    ],
    "personality": [
        "Tell me {title}",
        "What are your {title}?",
    ],
}

# Starter / overview questions added regardless of content
STARTER_FAQS = [
    {
        "question": "Tell me about your experience",
        "answer": (
            "I've been working in QA automation and software development "
            "for about five years. My focus is building test infrastructure "
            "that teams rely on daily — Playwright and Selenium tests, CI "
            "pipelines, visual regression, and actionable reporting. "
            "Want to know about a specific role or project?"
        ),
        "keywords": ["experience", "work", "career", "background", "resume"],
        "category": "resume",
        "suggestions": [
            {"label": "What's your tech stack?", "query": "What's your tech stack?"},
            {"label": "Show me your projects", "query": "Tell me about your projects"},
        ],
    },
    # "Show me your projects" is generated dynamically — see _build_projects_overview()
    {
        "question": "What's your tech stack?",
        "answer": (
            "My primary languages are Python and TypeScript. For testing: "
            "Playwright, Selenium, pytest, Vitest, axe-core, PIL/Pillow. "
            "For infrastructure: Docker, GitHub Actions, shell scripting. "
            "Frontend: React, Tailwind CSS, Vite, Canvas API, WebAssembly. "
            "I also work with REST APIs, JSON Schema validation, and "
            "event streaming concepts."
        ),
        "keywords": ["tech", "stack", "tools", "languages", "skills", "technologies"],
        "category": "resume",
        "suggestions": [
            {"label": "Tell me about your experience", "query": "Tell me about your experience"},
            {"label": "What's your testing philosophy?", "query": "What is your testing philosophy?"},
        ],
    },
]


def _build_projects_overview(knowledge_dir: str) -> dict:
    """Build 'Show me your projects' FAQ from actual knowledge files."""
    projects_dir = os.path.join(knowledge_dir, "projects")
    titles: list[str] = []
    if not os.path.isdir(projects_dir):
        return {
            "question": "Show me your projects",
            "answer": "I've built interactive playgrounds that run in the browser. Want details?",
            "keywords": ["projects", "portfolio", "built", "playground", "work", "demos"],
            "category": "projects",
            "suggestions": [],
        }
    for fname in sorted(os.listdir(projects_dir)):
        if not fname.endswith(".md"):
            continue
        with open(os.path.join(projects_dir, fname), encoding="utf-8") as f:
            text = f.read()
        match = FRONTMATTER_RE.match(text)
        if match:
            meta = yaml.safe_load(match.group(1)) or {}
            titles.append(meta.get("title", fname.replace(".md", "")))

    count = len(titles)
    answer = (
        f"I've built {count} interactive playgrounds that run in the browser "
        f"with no server or signup needed. Want details on any of them?"
    )

    suggestions = []
    for title in titles[:4]:
        words = title.split()
        label = " ".join(words[:3]) if len(words) > 3 else title
        suggestions.append({"label": label, "query": f"Tell me about {title}"})

    return {
        "question": "Show me your projects",
        "answer": answer,
        "keywords": ["projects", "portfolio", "built", "playground", "work", "demos"],
        "category": "projects",
        "suggestions": suggestions,
    }


def _extract_first_paragraph(body: str) -> str:
    """Get the first meaningful paragraph from markdown body."""
    lines = body.strip().split("\n")
    paragraph_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped and paragraph_lines:
            break
        if stripped and not stripped.startswith("#"):
            paragraph_lines.append(stripped)
    return " ".join(paragraph_lines)


def _tags_to_keywords(tags: list[str]) -> list[str]:
    """Expand tags into keyword variants."""
    keywords = []
    for tag in tags:
        keywords.append(tag.lower())
        # Split hyphenated tags
        if "-" in tag:
            keywords.extend(tag.lower().split("-"))
    return list(set(keywords))


def generate_faq(knowledge_dir: str) -> list[dict]:
    """Generate FAQ entries from all markdown files in knowledge_dir."""
    faqs = []

    for root, _dirs, files in os.walk(knowledge_dir):
        for fname in sorted(files):
            if not fname.endswith(".md"):
                continue

            filepath = os.path.join(root, fname)
            with open(filepath, encoding="utf-8") as f:
                text = f.read()

            match = FRONTMATTER_RE.match(text)
            if not match:
                continue

            metadata = yaml.safe_load(match.group(1)) or {}
            body = text[match.end():].strip()

            title = metadata.get("title", fname.replace(".md", ""))
            category = metadata.get("category", os.path.basename(root))
            tags = metadata.get("tags", [])

            answer = _extract_first_paragraph(body)
            if not answer:
                continue

            keywords = _tags_to_keywords(tags)
            keywords.append(title.lower())

            templates = QUESTION_TEMPLATES.get(category, ["Tell me about {title}"])

            for template in templates:
                tag_topic = tags[0] if tags else title.lower()
                question = template.format(title=title, tag_topic=tag_topic)
                faqs.append({
                    "question": question,
                    "answer": answer,
                    "keywords": keywords,
                    "category": category,
                    "suggestions": [],
                })

    return faqs


def write_faq_json(knowledge_dir: str, output_path: str) -> list[dict]:
    """Generate FAQs and write to JSON file, including starter FAQs."""
    projects_overview = _build_projects_overview(knowledge_dir)
    faqs = STARTER_FAQS + [projects_overview] + generate_faq(knowledge_dir)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(faqs, f, indent=2)

    return faqs


def main():
    parser = argparse.ArgumentParser(description="Generate FAQ from knowledge base")
    parser.add_argument("--knowledge-dir", default="../knowledge")
    parser.add_argument("--output", default="../public/faq.json")
    args = parser.parse_args()

    faqs = write_faq_json(args.knowledge_dir, args.output)
    print(f"Generated {len(faqs)} FAQ entries → {args.output}")


if __name__ == "__main__":
    main()
