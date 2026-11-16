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
    sync,
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


class TestSync:
    def _run(self, tmp_path, monkeypatch, fixtures=None):
        monkeypatch.setattr(
            ingest_portfolio, "fetch_github_file",
            lambda path, token: (fixtures or FIXTURES)[path])
        knowledge = str(tmp_path / "knowledge")
        public = str(tmp_path / "public")
        keyword_path = os.path.join(public, "keyword-map.json")
        if not os.path.exists(keyword_path):
            _write(keyword_path, "[]\n")
        return sync(knowledge, public, OVERRIDES, "fake-token"), knowledge, public

    def test_full_pass_creates_files_flags_conflicts_and_maps(self, tmp_path, monkeypatch):
        report, knowledge, public = self._run(tmp_path, monkeypatch)
        assert "role Prudential Financial" in report["added"]
        assert "project ai-assistant" in report["added"]
        assert len(report["conflicts"]) == 2
        assert any("Prudential" in c for c in report["conflicts"])
        assert any("ai-assistant" in c for c in report["conflicts"])
        assert "retired-widget" not in str(report["added"])
        assert len(report["keyword_added"]) == 4
        with open(os.path.join(public, "keyword-map.json"), encoding="utf-8") as handle:
            entries = json.load(handle)
        targets = {entry["target"] for entry in entries}
        assert "Tell me about your Prudential Financial" in targets
        assert "Tell me about Local AI Portfolio Assistant" in targets
        assert report["grid"] == [("Java", "software"), ("Bash", "qa")]
        role_path = os.path.join(knowledge, "resume", "prudential.md")
        assert validate_frontmatter(role_path)["valid"] is True

    def test_second_pass_is_a_noop(self, tmp_path, monkeypatch):
        self._run(tmp_path, monkeypatch)
        report, _, _ = self._run(tmp_path, monkeypatch)
        assert report["added"] == []
        assert report["changed"] == []
        assert report["removed"] == []
        assert report["keyword_added"] == []

    def test_hand_maintained_files_are_never_touched(self, tmp_path, monkeypatch):
        role_path = os.path.join(str(tmp_path), "knowledge", "resume",
                                 "prudential.md")
        _write(role_path, "---\ntitle: Prudential Financial\ncategory: resume\n"
                          "tags: [prudential]\n---\n\nHand written.\n")
        report, _, _ = self._run(tmp_path, monkeypatch)
        assert "role Prudential Financial" in report["skipped"]
        with open(role_path, encoding="utf-8") as handle:
            assert handle.read().endswith("Hand written.\n")

    def test_generated_file_for_removed_element_is_deleted(self, tmp_path, monkeypatch):
        report, knowledge, _ = self._run(tmp_path, monkeypatch)
        assert "project ai-assistant" in report["added"]
        gone = dict(FIXTURES)
        gone["frontend/src/constants/playgrounds.ts"] = (
            PLAYGROUNDS_FIXTURE.replace("'live'", "'archived'"))
        report2, _, _ = self._run(tmp_path, monkeypatch, fixtures=gone)
        assert os.path.join("projects", "ai-assistant.md") in report2["removed"]
        assert not os.path.exists(
            os.path.join(knowledge, "projects", "ai-assistant.md"))

    def test_empty_parse_fails_closed(self, tmp_path, monkeypatch):
        empty = dict(FIXTURES)
        empty["frontend/src/constants/experiences.ts"] = "const x = [];"
        with pytest.raises(RuntimeError):
            self._run(tmp_path, monkeypatch, fixtures=empty)


    def test_keyword_targets_derive_from_file_titles(self, tmp_path, monkeypatch):
        ul_fixture = """
export const experiences: Experience[] = [
  {
    title: 'QA Engineer',
    company_name: 'UL Solutions Inc',
    date: 'Jul 2024 - Jun 2025',
    points: [{ text: 'Built reporting tools.', lens: 'qa' }],
  },
];
"""
        fixtures = dict(FIXTURES)
        fixtures["frontend/src/constants/experiences.ts"] = ul_fixture
        base = str(tmp_path)
        _write(os.path.join(base, "knowledge", "resume", "ul-solutions.md"),
               "---\ntitle: UL Solutions\ncategory: resume\ntags: [ul]\n---\n\nHand written.\n")
        _write(os.path.join(base, "knowledge", "resume", "viva-tech-paper.md"),
               "---\ntitle: Methods for Sentiment Analysis\ncategory: resume\ntags: [paper]\n---\n\nHand written.\n")
        _write(os.path.join(base, "knowledge", "projects", "ai-assistant.md"),
               "---\ntitle: AI Portfolio Assistant\ncategory: projects\ntags: [ai]\n---\n\nHand written.\n")
        _write(os.path.join(base, "knowledge", "personality", "contact.md"),
               "---\ntitle: Contact\ncategory: personality\ntags: [contact]\n---\n\nHand written.\n")
        overrides = dict(OVERRIDES)
        overrides["covered_publications"] = {"project-1": "viva-tech-paper.md"}
        monkeypatch.setattr(ingest_portfolio, "fetch_github_file",
                            lambda path, token: fixtures[path])
        knowledge = os.path.join(base, "knowledge")
        public = os.path.join(base, "public")
        _write(os.path.join(public, "keyword-map.json"), "[]\n")
        report = sync(knowledge, public, overrides, "fake-token")
        assert not os.path.exists(os.path.join(
            knowledge, "resume", "sentiment-analysis-literature-study.md"))
        assert any("viva-tech-paper.md" in n for n in report["notes"])
        with open(os.path.join(public, "keyword-map.json"), encoding="utf-8") as handle:
            entries = json.load(handle)
        targets = {entry["target"] for entry in entries}
        assert "Tell me about your UL Solutions" in targets
        assert "Tell me about your UL Solutions Inc" not in targets
        assert "Tell me about your Methods for Sentiment Analysis" in targets
        assert ("Tell me about your Methods for Sentiment Analysis: "
                "A Literature Study") not in targets
        project_entries = [e for e in entries
                           if e["target"] == "Tell me about AI Portfolio Assistant"]
        phrases = {e["phrase"] for e in project_entries}
        assert phrases == {"local ai portfolio assistant", "ai portfolio assistant"}
        contact_entries = [e for e in entries if e["target"] == "Tell me Contact"]
        token_entry = next(e for e in contact_entries if "tokens" in e)
        assert set(token_entry["tokens"]) == {"contact", "reach", "touch", "email"}
        assert any(e.get("phrase") == "get in touch" for e in contact_entries)
        assert all("github" not in e.get("tokens", [])
                   and "linkedin" not in e.get("tokens", [])
                   for e in contact_entries)


class TestMain:
    def test_missing_token_fails_closed(self, monkeypatch, capsys):
        monkeypatch.delenv("PORTFOLIO_PAT", raising=False)
        assert ingest_portfolio.main([]) == 2
        assert "PORTFOLIO_PAT" in capsys.readouterr().err
