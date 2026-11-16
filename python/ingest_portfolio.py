"""Ingest portfolio content into the assistant knowledge base.

Fetches the portfolio repo data files through the GitHub API and
regenerates the knowledge files this pipeline owns: one file per
role, one per live playground, and one per publication. Confirmed
facts from ingest_overrides.json win over site text, and every
override applied is flagged in the drift report.

Only files carrying the generated marker are overwritten. Files
without the marker are hand maintained: the script never touches
them. Generated files whose element left the portfolio are
deleted. The technology grid is reported in the drift report only
and is never ingested as skill claims. Demo and repo URLs are
withheld pending the G3 decision. Publication descriptions and
tags are withheld pending the G2 decision.

Usage:
    PORTFOLIO_PAT=<token> python ingest_portfolio.py \
        --knowledge-dir ../knowledge --public-dir ../public \
        --drift-report drift-report.md
"""

import base64
import json
import urllib.error
import urllib.request

REPO = "kishanborad/kishanborad-portfolio"
SOURCE_FILES = {
    "experiences": "frontend/src/constants/experiences.ts",
    "playgrounds": "frontend/src/constants/playgrounds.ts",
    "publications": "frontend/src/constants/publications.ts",
    "technologies": "frontend/src/constants/technologies.ts",
}
GENERATED_LINE = "generated: ingest_portfolio"

ROLE_FILES = {"Prudential Financial": "prudential.md",
              "UL Solutions Inc": "ul-solutions.md",
              "iSchoolConnect": "ischoolconnect.md",
              "Quantiphi Inc": "quantiphi.md"}
ROLE_TOKENS = {"Prudential Financial": ["prudential"],
               "UL Solutions Inc": ["ul"],
               "iSchoolConnect": ["ischoolconnect"],
               "Quantiphi Inc": ["quantiphi"]}
PROJECT_FILES = {"ai-assistant": "ai-assistant.md",
                 "sql-workbench": "sql-workbench.md",
                 "event-stream": "event-stream.md",
                 "test-runner": "test-runner.md",
                 "visual-diff": "visual-regression.md",
                 "ai-test-generator": "ai-test-generator.md"}
PUBLICATION_FILES = {"project-1": "sentiment-analysis-literature-study.md",
                     "project-2": "quantum-computing-review.md",
                     "project-3": "sentiment-analysis-neural-network.md",
                     "project-4": "decision-tree-preprocessing.md",
                     "project-5": "augmented-reality-review.md"}
PUBLICATION_PHRASES = {"project-1": "sentiment analysis",
                       "project-2": "quantum computing",
                       "project-3": "neural network",
                       "project-4": "decision tree",
                       "project-5": "augmented reality"}
FAQ_QUESTION = {"resume": "Tell me about your {title}",
                "projects": "Tell me about {title}",
                "personality": "Tell me {title}"}
UNDECIDED = [
    "G2: publication descriptions and tags: ingest descriptions, tags, or neither. Withheld for now.",
    "G3: demo and repo URLs for playgrounds: bare URL, tracking stripped, or link text only. Withheld for now.",
    "G4: grid only tools: confirm, add an honest scope note, or leave out, per tool. The grid inventory above is report only.",
    "G5: contact form mailto target and validation behavior: record as site structure only. The approved contact email wins.",
    "G6: site structure elements (navigation, dock, footer, chat widget shell, hero tagline, portrait, skills band facts, meta descriptions): which deserve answers is undecided.",
    "G7: greetings stay owned by the UI tier, not the library.",
    "G12: demo interiors need a separate crawl per demo deployment.",
    "G13: render verification of the live site is still needed before treating elements as confirmed.",
    "G14: the 17 unanswerable topics stay guarded; ingested text must not leak into answers for them.",
    "G15: education stays library owned; the thin site FAQ answer never overwrites it.",
]


def fetch_github_file(path, token):
    """Fetch one file from the portfolio repo via the GitHub API."""
    url = f"https://api.github.com/repos/{REPO}/contents/{path}?ref=main"
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "portfolio-ingest",
        "Authorization": f"Bearer {token}",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"GitHub API request failed for {path}: {exc}") from exc
    return base64.b64decode(data["content"]).decode("utf-8")

