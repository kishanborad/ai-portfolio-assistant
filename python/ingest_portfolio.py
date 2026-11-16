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

import argparse
import base64
import json
import os
import re
import sys
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


def sanitize(text):
    """Remove characters banned from generated content."""
    text = text.replace(" \u2014 ", ", ").replace("\u2014", ",")
    text = text.replace("\u2013", "-")
    text = re.sub("\u007e(\\d)", r"about \1", text)
    return text.replace("\u007e", "")


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def frontmatter(title, category, tags):
    lines = ["---", "title: " + json.dumps(title), "category: " + category,
             "tags: [" + ", ".join(tags) + "]", GENERATED_LINE, "---", ""]
    return "\n".join(lines)


def role_markdown(role, date):
    company = role["company_name"]
    points = [sanitize(point["text"]) for point in role["points"]]
    opening = "From {} I was a {} at {}.".format(date, role["title"], company)
    if points:
        opening += " " + points[0]
    body = "\n\n".join([opening] + points[1:])
    tags = [slugify(company), slugify(role["title"])]
    return frontmatter(company, "resume", tags) + "\n" + body + "\n"


def project_markdown(project, blurb):
    tech = ", ".join(project["tech"])
    track = "development" if project.get("track") == "dev" else "QA"
    body = (sanitize(blurb)
            + f"\n\nThis is a {track} track project. A live demo and the source repo "
            f"are linked from the portfolio.\n\nTech stack: {tech}.")
    tags = [project["id"]] + project["id"].split("-")
    for item in project["tech"]:
        tag = slugify(item)
        if tag not in tags:
            tags.append(tag)
    return frontmatter(project["title"], "projects", tags) + "\n" + body + "\n"


def publication_markdown(pub, verified):
    name = pub["name"]
    kind = pub["category"].lower()
    if verified:
        authors = verified["authors"]
        if len(authors) > 2:
            byline = ", ".join(authors[:-1]) + ", and " + authors[-1]
        else:
            byline = " and ".join(authors)
        body = ('A {} titled "{}" by {}, published in {}, {} (DOI {}). '
                "Read it at: {}.".format(kind, name, byline, verified["venue"], verified["date"],
                   verified["doi"], pub["demo"]))
    else:
        body = ('A {} titled "{}". Read it at: {}. '
                "The site card shows no authors or date.".format(kind, name, pub["demo"]))
    tags = ["publication", slugify(pub["category"])]
    return frontmatter(name, "resume", tags) + "\n" + body + "\n"


def faq_target(category, title):
    template = FAQ_QUESTION.get(category, "Tell me about {title}")
    return template.format(title=title)


def phrase_of(title):
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def merge_keyword_map(path, additions):
    """Append new mappings, preserving every existing entry."""
    with open(path, encoding="utf-8") as handle:
        entries = json.load(handle)

    def key(entry):
        return (entry.get("target"), tuple(sorted(entry.get("tokens", []))),
                entry.get("phrase"))

    seen = {key(entry) for entry in entries}
    added = []
    for entry in additions:
        if key(entry) not in seen:
            entries.append(entry)
            seen.add(key(entry))
            added.append(entry)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(entries, handle, indent=2)
        handle.write("\n")
    return added


def read_frontmatter(path):
    """Read title and category from a knowledge file, without YAML."""
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    meta = {}
    if match:
        for line in match.group(1).split("\n"):
            field, sep, value = line.partition(":")
            if sep:
                meta[field.strip()] = value.strip().strip('"')
    return meta


def write_or_skip(path, content, report, key):
    """Write a generated file, or record why it was left alone."""
    if os.path.exists(path):
        with open(path, encoding="utf-8") as handle:
            existing = handle.read()
        if GENERATED_LINE not in existing:
            report["skipped"].append(key)
            return
        if existing == content:
            report["unchanged"].append(key)
            return
        action = "changed"
    else:
        action = "added"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(content)
    report[action].append(key)


def remove_stale_generated(knowledge_dir, owned, report):
    """Delete generated files whose element left the portfolio."""
    for subdir in ("resume", "projects"):
        folder = os.path.join(knowledge_dir, subdir)
        if not os.path.isdir(folder):
            continue
        for fname in sorted(os.listdir(folder)):
            if not fname.endswith(".md"):
                continue
            path = os.path.join(folder, fname)
            if path in owned:
                continue
            with open(path, encoding="utf-8") as handle:
                if GENERATED_LINE in handle.read():
                    os.remove(path)
                    report["removed"].append(os.path.join(subdir, fname))


def file_meta(knowledge_dir, subdir, fname):
    """Read title and category from a knowledge file, or None."""
    path = os.path.join(knowledge_dir, subdir, fname)
    if not os.path.exists(path):
        return None
    meta = read_frontmatter(path)
    if "title" not in meta or "category" not in meta:
        return None
    return meta


def file_target(knowledge_dir, subdir, fname):
    """Build the FAQ question for a knowledge file, or None."""
    meta = file_meta(knowledge_dir, subdir, fname)
    if not meta:
        return None
    return faq_target(meta["category"], meta["title"])


def build_keyword_additions(knowledge_dir, experiences, playgrounds,
                            publications, covered, report):
    """Build keyword map additions with file-derived targets.

    FAQ questions are generated from knowledge file frontmatter, so
    every target is derived from the file, never from site strings:
    site names differ (UL Solutions Inc vs UL Solutions, Local AI
    Portfolio Assistant vs AI Portfolio Assistant) and a target
    built from a site string would never fire.
    """
    additions = []
    for role in experiences:
        company = role["company_name"]
        filename = ROLE_FILES.get(company, slugify(company) + ".md")
        target = file_target(knowledge_dir, "resume", filename)
        if not target:
            report["notes"].append(
                f"No keyword mapping for role {company}: {filename} not found.")
            continue
        tokens = ROLE_TOKENS.get(company, [slugify(company).split("-")[0]])
        additions.append({"target": target, "tokens": tokens})
    for project in playgrounds:
        if project.get("status") != "live":
            continue
        pid = project["id"]
        filename = PROJECT_FILES.get(pid, slugify(pid) + ".md")
        meta = file_meta(knowledge_dir, "projects", filename)
        if not meta:
            report["notes"].append(
                f"No keyword mapping for project {pid}: {filename} not found.")
            continue
        target = faq_target(meta["category"], meta["title"])
        phrases = {phrase_of(project["title"]), phrase_of(meta["title"])}
        for phrase in sorted(phrases):
            additions.append({"target": target, "phrase": phrase})
    for pub in publications:
        pid = pub["id"]
        if pid in covered:
            filename = covered[pid]
        else:
            filename = PUBLICATION_FILES.get(pid, slugify(pub["name"]) + ".md")
        target = file_target(knowledge_dir, "resume", filename)
        if not target:
            report["notes"].append(
                f"No keyword mapping for publication {pub['name']}: file not found.")
            continue
        phrase = PUBLICATION_PHRASES.get(pid, phrase_of(pub["name"]))
        additions.append({"target": target, "phrase": phrase})

    target = file_target(knowledge_dir, "personality", "location.md")
    if target:
        additions.append({"target": target,
                          "tokens": ["based", "location", "located", "jersey"]})
        additions.append({"target": target, "phrase": "jersey city"})
    target = file_target(knowledge_dir, "personality", "contact.md")
    if target:
        additions.append({"target": target,
                          "tokens": ["contact", "reach", "touch", "email"]})
        additions.append({"target": target, "phrase": "get in touch"})
    target = file_target(knowledge_dir, "resume", "publications.md")
    if target:
        additions.append({"target": target, "tokens": ["paper", "papers",
                                                       "publication",
                                                       "publications",
                                                       "research"]})
    return additions


def sync(knowledge_dir, public_dir, overrides, token):
    """Run one full ingestion pass. Returns the drift report data."""
    sources = {name: fetch_github_file(path, token)
               for name, path in SOURCE_FILES.items()}
    experiences = parse_ts_array(sources["experiences"])
    playgrounds = parse_ts_array(sources["playgrounds"])
    publications = parse_ts_array(sources["publications"])
    technologies = parse_ts_array(sources["technologies"])
    for label, items in (("experiences", experiences),
                         ("playgrounds", playgrounds),
                         ("publications", publications),
                         ("technologies", technologies)):
        if not items:
            raise RuntimeError(f"parsed zero {label}; refusing to sync")
    report = {"added": [], "changed": [], "unchanged": [], "removed": [],
              "skipped": [], "conflicts": [], "notes": [],
              "keyword_added": [],
              "grid": [(item["name"], item["group"]) for item in technologies]}
    owned = set()

    role_overrides = overrides.get("roles", {})
    for role in experiences:
        company = role["company_name"]
        filename = ROLE_FILES.get(company, slugify(company) + ".md")
        path = os.path.join(knowledge_dir, "resume", filename)
        owned.add(path)
        date = role["date"]
        override = role_overrides.get(company, {}).get("date")
        if override and override != date:
            report["conflicts"].append(
                f"Role {company}: site date {date} replaced with confirmed date {override}.")
            date = override
        write_or_skip(path, role_markdown(role, date), report, "role " + company)

    blurb_overrides = overrides.get("project_blurbs", {})
    for project in playgrounds:
        if project.get("status") != "live":
            continue
        pid = project["id"]
        filename = PROJECT_FILES.get(pid, slugify(pid) + ".md")
        path = os.path.join(knowledge_dir, "projects", filename)
        owned.add(path)
        blurb = project.get("blurb", "")
        override = blurb_overrides.get(pid)
        if override and sanitize(override) != sanitize(blurb):
            report["conflicts"].append(
                f"Project {pid}: site blurb replaced by the override in "
                "ingest_overrides.json; the site text is stale.")
            blurb = override
        write_or_skip(path, project_markdown(project, blurb),
                      report, "project " + pid)

    pub_overrides = overrides.get("publications", {})
    covered = overrides.get("covered_publications", {})
    for pub in publications:
        pid = pub["id"]
        if pid in covered:
            report["notes"].append(
                f"Publication {pub['name']} is covered by hand-maintained "
                f"{covered[pid]}; no file generated.")
            continue
        filename = PUBLICATION_FILES.get(pid, slugify(pub["name"]) + ".md")
        path = os.path.join(knowledge_dir, "resume", filename)
        owned.add(path)
        write_or_skip(path, publication_markdown(pub, pub_overrides.get(pid)),
                      report, "publication " + pub["name"])

    remove_stale_generated(knowledge_dir, owned, report)

    additions = build_keyword_additions(
        knowledge_dir, experiences, playgrounds,
        publications, covered, report)

    keyword_path = os.path.join(public_dir, "keyword-map.json")
    if os.path.exists(keyword_path):
        report["keyword_added"] = merge_keyword_map(keyword_path, additions)
    else:
        report["notes"].append("keyword-map.json not found; no mappings added.")
    return report

def write_drift_report(path, report):
    """Write the markdown drift report for the sync PR body."""
    lines = ["# Portfolio ingestion drift report", "",
             ("Generated by ingest_portfolio.py. Confirmed facts from "
             "ingest_overrides.json win over site text."), ""]

    def section(title, items, empty):
        lines.append("## " + title)
        lines.append("")
        if items:
            lines.extend("- " + item for item in items)
        else:
            lines.append(empty)
        lines.append("")

    section("Conflicts: override applied", report["conflicts"], "None.")
    section("Added", report["added"], "No files added.")
    section("Changed", report["changed"], "No files changed.")
    section("Removed", report["removed"], "No files removed.")
    section("Skipped: hand maintained, not compared", report["skipped"],
            "No files skipped.")
    section("Keyword map additions",
            [json.dumps(entry) for entry in report["keyword_added"]],
            "No mappings added.")
    section("Notes", report["notes"], "None.")
    lines.append("## Technology grid inventory (report only, never skill claims)")
    lines.append("")
    lines.extend(f"- {name} ({group})" for name, group in report["grid"])
    lines.append("")
    lines.append("## Awaiting decision")
    lines.append("")
    lines.extend("- " + item for item in UNDECIDED)
    lines.append("")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Ingest portfolio content into the knowledge base.")
    parser.add_argument("--knowledge-dir", default="../knowledge")
    parser.add_argument("--public-dir", default="../public")
    parser.add_argument("--overrides", default=None,
                        help="defaults to ingest_overrides.json beside this script")
    parser.add_argument("--drift-report", default="drift-report.md")
    args = parser.parse_args(argv)
    token = os.environ.get("PORTFOLIO_PAT", "").strip()
    if not token:
        print("PORTFOLIO_PAT is not set. Refusing to run without a token.",
              file=sys.stderr)
        return 2
    if args.overrides:
        overrides_path = args.overrides
    else:
        here = os.path.dirname(os.path.abspath(__file__))
        overrides_path = os.path.join(here, "ingest_overrides.json")
    try:
        with open(overrides_path, encoding="utf-8") as handle:
            overrides = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Cannot load overrides file {overrides_path}: {exc}",
              file=sys.stderr)
        return 2
    report = sync(args.knowledge_dir, args.public_dir, overrides, token)
    write_drift_report(args.drift_report, report)
    print(f"added {len(report['added'])}, changed {len(report['changed'])}, "
          f"unchanged {len(report['unchanged'])}, removed {len(report['removed'])}, "
          f"skipped {len(report['skipped'])}, conflicts {len(report['conflicts'])}, "
          f"keyword mappings added {len(report['keyword_added'])}")
    print(f"drift report: {args.drift_report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

