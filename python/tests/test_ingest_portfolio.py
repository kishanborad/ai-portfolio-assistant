"""Tests for the portfolio ingestion pipeline.

All fixtures are inline. No network access and no token are used:
the sync tests stub out the GitHub fetch.
"""

import json
import os

import ingest_portfolio
import pytest
from ingest_portfolio import (
    merge_keyword_map,
    parse_ts_array,
    publication_markdown,
    role_markdown,
    sanitize,
)
from knowledge_validator import validate_frontmatter

TS_FIXTURE = """
import type { Experience } from '../types';
// a comment line that must be skipped
export const experiences: Experience[] = [
  {
    title: 'Software Engineer in Test',
    company_name: 'Prudential Financial',
    icon: prudentail,
    date: 'Jul 2025 - Present',
    points: [
      { text: 'Built the team\\'s Playwright suite.', lens: 'qa' },
      { text: "Wrote \\"quoted\\" API tests.", lens: 'qa' },
    ],
  },
];
"""

PLAYGROUNDS_FIXTURE = """
export const playgrounds: Playground[] = [
  {
    id: 'ai-assistant',
    title: 'Local AI Portfolio Assistant',
    track: 'dev',
    blurb: 'Ask questions in your browser.',
    tech: ['TypeScript', 'WebGPU'],
    status: 'live',
    github: 'https://github.com/kishanborad/ai-portfolio-assistant',
    demoUrl: 'https://example.invalid/demo',
  },
  {
    id: 'retired-widget',
    title: 'Retired Widget',
    track: 'qa',
    blurb: 'No longer live.',
    tech: ['Python'],
    status: 'archived',
    github: 'https://example.invalid/repo',
    demoUrl: 'https://example.invalid/demo2',
  },
];
"""

PUBLICATIONS_FIXTURE = """
export const publications: Project[] = [
  {
    id: 'project-1',
    name: 'Methods for Sentiment Analysis: A Literature Study',
    category: 'Research Paper',
    description: 'A study of methods.',
    tags: [{ name: 'research', color: 'blue-text-gradient' }],
    demo: 'https://www.viva-technology.org/New/IJRI/2018/8.html',
  },
  {
    id: 'project-2',
    name: 'Quantum Computing: An Ability to Change the World',
    category: 'Technology Review',
    description: 'An exploration.',
    tags: [{ name: 'quantum-computing', color: 'green-text-gradient' }],
    demo: 'https://online.fliphtml5.com/orpc/lugh/#p=22',
  },
];
"""

TECHNOLOGIES_FIXTURE = """
export const technologies: Technology[] = [
  { id: 'java', name: 'Java', icon: java, group: 'software' },
  { id: 'bash', name: 'Bash', icon: bash, group: 'qa' },
];
"""

OVERRIDES = {
    "roles": {"Prudential Financial": {"date": "Jul 2025 - Aug 2026"}},
    "project_blurbs": {
        "ai-assistant": "Ask questions in your browser. "
        "Questions are logged anonymously to improve answers."
    },
    "publications": {
        "project-1": {
            "authors": ["Shiv Dhar", "Suyog Pednekar", "Kishan Borad",
                        "Ashwini Save"],
            "venue": "VIVA-Tech IJRI Vol 1 Issue 1",
            "date": "October 2018",
            "doi": "10.11242/viva-tech.01.01.08",
        }
    },
}

FIXTURES = {
    "frontend/src/constants/experiences.ts": TS_FIXTURE,
    "frontend/src/constants/playgrounds.ts": PLAYGROUNDS_FIXTURE,
    "frontend/src/constants/publications.ts": PUBLICATIONS_FIXTURE,
    "frontend/src/constants/technologies.ts": TECHNOLOGIES_FIXTURE,
}


def _write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(content)


class TestParser:
    def test_nested_objects_escapes_comments_and_type_annotation(self):
        items = parse_ts_array(TS_FIXTURE)
        assert len(items) == 1
        role = items[0]
        assert role["company_name"] == "Prudential Financial"
        assert role["icon"] == "prudentail"
        assert len(role["points"]) == 2
        assert role["points"][0]["text"] == "Built the team's Playwright suite."
        assert role["points"][1]["text"] == 'Wrote "quoted" API tests.'

    def test_missing_array_raises(self):
        with pytest.raises(ValueError):
            parse_ts_array("export const empty = {};")

    def test_unterminated_string_raises(self):
        with pytest.raises(ValueError):
            parse_ts_array("const x = ['oops];")


class TestSanitize:
    def test_removes_banned_characters(self):
        assert sanitize("a \u2014 b") == "a, b"
        assert sanitize("2019\u20132022") == "2019-2022"
        assert sanitize("across \u007e50 devices") == "across about 50 devices"


class TestGenerators:
    def test_role_markdown_uses_override_date_and_valid_frontmatter(self, tmp_path):
        role = parse_ts_array(TS_FIXTURE)[0]
        path = str(tmp_path / "prudential.md")
        _write(path, role_markdown(role, "Jul 2025 - Aug 2026"))
        assert validate_frontmatter(path)["valid"] is True
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
        assert "Jul 2025 - Aug 2026" in text
        assert "Present" not in text
        assert ingest_portfolio.GENERATED_LINE in text

    def test_publication_verified_carries_authors_and_doi(self):
        pub = parse_ts_array(PUBLICATIONS_FIXTURE)[0]
        text = publication_markdown(pub, OVERRIDES["publications"]["project-1"])
        assert "Shiv Dhar" in text and "Ashwini Save" in text
        assert "VIVA-Tech IJRI Vol 1 Issue 1" in text
        assert "October 2018" in text
        assert "10.11242/viva-tech.01.01.08" in text

    def test_publication_unverified_states_no_authors_or_date(self):
        pub = parse_ts_array(PUBLICATIONS_FIXTURE)[1]
        text = publication_markdown(pub, None)
        assert "The site card shows no authors or date." in text
        assert "Shiv Dhar" not in text
        assert "2018" not in text
        assert "fliphtml5" in text


class TestKeywordMapMerge:
    def test_preserves_existing_dedupes_and_appends(self, tmp_path):
        path = str(tmp_path / "keyword-map.json")
        existing = [{"target": "Tell me Contact", "tokens": ["hire"]}]
        _write(path, json.dumps(existing, indent=2) + "\n")
        added = merge_keyword_map(path, [
            {"target": "Tell me Contact", "tokens": ["hire"]},
            {"target": "Tell me Contact", "tokens": ["github", "linkedin"]},
        ])
        with open(path, encoding="utf-8") as handle:
            entries = json.load(handle)
        assert entries[0] == existing[0]
        assert len(entries) == 2
        assert len(added) == 1
        added_again = merge_keyword_map(path, [
            {"target": "Tell me Contact", "tokens": ["github", "linkedin"]},
        ])
        assert added_again == []

