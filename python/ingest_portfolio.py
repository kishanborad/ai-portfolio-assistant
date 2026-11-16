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


class TSParser:
    """Minimal parser for TypeScript object literal arrays.

    Handles objects, arrays, single and double quoted strings with
    escapes, bare identifiers, numbers, booleans, null, trailing
    commas, and line and block comments. Never evaluates code.
    """

    def __init__(self, text):
        self.text = text
        self.pos = 0
        self.end = len(text)

    def parse_array(self):
        self._skip()
        if self._peek() != "[":
            raise ValueError(f"expected '[' at offset {self.pos}")
        return self._value()

    def _peek(self):
        return self.text[self.pos] if self.pos < self.end else ""

    def _skip(self):
        while self.pos < self.end:
            ch = self.text[self.pos]
            if ch in " \t\r\n":
                self.pos += 1
            elif self.text.startswith("//", self.pos):
                while self.pos < self.end and self.text[self.pos] != "\n":
                    self.pos += 1
            elif self.text.startswith("/*", self.pos):
                close = self.text.find("*/", self.pos + 2)
                if close < 0:
                    raise ValueError("unterminated block comment")
                self.pos = close + 2
            else:
                return

    def _value(self):
        self._skip()
        ch = self._peek()
        if ch == "{":
            return self._object()
        if ch == "[":
            return self._array()
        if ch in "'\"":
            return self._string()
        return self._bare()

    def _object(self):
        self.pos += 1
        obj = {}
        while True:
            self._skip()
            if self._peek() == "}":
                self.pos += 1
                return obj
            key = self._string() if self._peek() in "'\"" else self._bare()
            self._skip()
            if self._peek() != ":":
                raise ValueError(f"expected ':' after key {key!r}")
            self.pos += 1
            obj[key] = self._value()
            self._skip()
            if self._peek() == ",":
                self.pos += 1
            elif self._peek() != "}":
                raise ValueError("expected ',' or '}' in object")

    def _array(self):
        self.pos += 1
        items = []
        while True:
            self._skip()
            if self._peek() == "]":
                self.pos += 1
                return items
            items.append(self._value())
            self._skip()
            if self._peek() == ",":
                self.pos += 1
            elif self._peek() != "]":
                raise ValueError("expected ',' or ']' in array")

    def _string(self):
        quote = self.text[self.pos]
        self.pos += 1
        out = []
        while self.pos < self.end:
            ch = self.text[self.pos]
            self.pos += 1
            if ch == quote:
                return "".join(out)
            if ch == "\\" and self.pos < self.end:
                esc = self.text[self.pos]
                self.pos += 1
                out.append({"n": "\n", "t": "\t", "r": "\r"}.get(esc, esc))
            else:
                out.append(ch)
        raise ValueError("unterminated string")

    def _bare(self):
        start = self.pos
        while self.pos < self.end and self.text[self.pos] not in " \t\r\n,]}:":
            self.pos += 1
        word = self.text[start:self.pos]
        if word == "true":
            return True
        if word == "false":
            return False
        if word == "null":
            return None
        try:
            return int(word)
        except ValueError:
            pass
        try:
            return float(word)
        except ValueError:
            pass
        return word


def parse_ts_array(text):
    """Parse the first array literal assigned in a TS source file."""
    assign = text.find("=")
    start = text.find("[", assign)
    if start < 0:
        raise ValueError("no array literal found")
    result = TSParser(text[start:]).parse_array()
    if not isinstance(result, list):
        raise TypeError("top level value is not an array")
    return result

