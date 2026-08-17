"""Sync knowledge base with portfolio project data.

Fetches the latest playground data from the portfolio GitHub repo and
creates knowledge markdown files for any new projects not yet covered.
Existing files are never overwritten — only missing ones get created.

Usage:
    python sync_portfolio.py --knowledge-dir ../knowledge
"""

import argparse
import base64
import json
import os
import re
import subprocess
import urllib.request

REPO = "kishanborad/kishanborad-portfolio"
PLAYGROUNDS_PATH = "frontend/src/constants/playgrounds.ts"
FAQ_PATH = "frontend/src/data/faq.json"

# Known mappings from playground id to knowledge filename.
# New projects not listed here get a filename derived from their id.
ID_TO_FILENAME: dict[str, str] = {
    "ai-assistant": "ai-assistant.md",
    "sql-workbench": "sql-workbench.md",
    "event-stream": "event-stream.md",
    "test-runner": "test-runner.md",
    "visual-diff": "visual-regression.md",
    "ai-test-generator": "ai-test-generator.md",
}


def _gh_token() -> str | None:
    """Get GitHub token from env or gh CLI."""
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        return token
    try:
        result = subprocess.run(
            ["gh", "auth", "token"],
            capture_output=True, text=True, timeout=10, check=False,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except FileNotFoundError:
        pass
    return None


def fetch_github_file(path: str) -> str:
    """Fetch a file from the portfolio repo via GitHub API."""
    token = _gh_token()
    url = f"https://api.github.com/repos/{REPO}/contents/{path}?ref=main"
    headers: dict[str, str] = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "portfolio-sync",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            auth_hint = "with token" if token else "WITHOUT token (repo may be private)"
            raise RuntimeError(
                f"404 fetching {path} from {REPO} ({auth_hint}). "
                f"Check PORTFOLIO_PAT secret is set and has repo scope."
            ) from e
        raise

    content_b64 = data.get("content", "")
    return base64.b64decode(content_b64).decode("utf-8")


def parse_playgrounds(ts_content: str) -> list[dict]:
    """Parse playground objects from the TypeScript array literal."""
    projects: list[dict] = []
    blocks = re.findall(r"\{([^}]+)\}", ts_content, re.DOTALL)
    for block in blocks:
        project: dict[str, object] = {}
        for key in ("id", "title", "track", "blurb", "status", "github", "demoUrl"):
            match = re.search(rf"{key}:\s*'([^']*)'", block)
            if not match:
                match = re.search(rf'{key}:\s*"([^"]*)"', block)
            if match:
                project[key] = match.group(1)
        tech_match = re.search(r"tech:\s*\[([^\]]*)\]", block)
        if tech_match:
            techs = re.findall(r"'([^']*)'", tech_match.group(1))
            if not techs:
                techs = re.findall(r'"([^"]*)"', tech_match.group(1))
            project["tech"] = techs
        if project.get("id"):
            projects.append(project)
    return projects


def find_faq_answer(faq_data: list[dict], title: str) -> str | None:
    """Find the best FAQ answer for a project by title match."""
    for entry in faq_data:
        if entry.get("category") == "projects" and title in entry.get("question", ""):
            return entry.get("answer")
    return None


def generate_knowledge_md(project: dict, faq_answer: str | None) -> str:
    """Generate a knowledge markdown file from project metadata."""
    title = project.get("title", "")
    track = project.get("track", "dev")
    blurb = project.get("blurb", "")
    tech = project.get("tech", [])

    # Build tags
    tags: list[str] = []
    pid = str(project.get("id", ""))
    if pid:
        tags.append(pid)
        if "-" in pid:
            tags.extend(pid.split("-"))
    for t in tech:
        tag = t.lower().replace(" ", "-")
        if tag not in tags:
            tags.append(tag)

    track_label = "development" if track == "dev" else "QA"
    description = faq_answer or blurb
    tech_str = ", ".join(str(t) for t in tech)

    return (
        f"---\n"
        f"title: {title}\n"
        f"category: projects\n"
        f"tags: [{', '.join(tags)}]\n"
        f"---\n"
        f"\n"
        f"{description}\n"
        f"\n"
        f"This is a {track_label} track project. "
        f"It runs entirely in the browser with no server or backend required.\n"
        f"\n"
        f"Tech stack: {tech_str}.\n"
    )


def sync(knowledge_dir: str) -> list[str]:
    """Sync knowledge files with portfolio. Returns list of created filenames."""
    projects_dir = os.path.join(knowledge_dir, "projects")
    os.makedirs(projects_dir, exist_ok=True)

    print("Fetching portfolio playground data...")
    ts_content = fetch_github_file(PLAYGROUNDS_PATH)
    playgrounds = parse_playgrounds(ts_content)

    print("Fetching portfolio FAQ data...")
    faq_content = fetch_github_file(FAQ_PATH)
    faq_data = json.loads(faq_content)

    print(f"Found {len(playgrounds)} playgrounds in portfolio")

    existing = set(os.listdir(projects_dir))
    created: list[str] = []

    for project in playgrounds:
        if project.get("status") != "live":
            continue

        pid = str(project.get("id", ""))
        filename = ID_TO_FILENAME.get(pid, f"{pid}.md")

        if filename in existing:
            print(f"  [skip] {filename}")
            continue

        title = str(project.get("title", ""))
        faq_answer = find_faq_answer(faq_data, title)
        content = generate_knowledge_md(project, faq_answer)

        filepath = os.path.join(projects_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

        print(f"  [new]  {filename}")
        created.append(filename)

    return created


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync knowledge with portfolio")
    parser.add_argument("--knowledge-dir", default="../knowledge")
    args = parser.parse_args()

    created = sync(args.knowledge_dir)
    if created:
        print(f"\nCreated {len(created)} new knowledge file(s). "
              "Run build-knowledge.sh to rebuild.")
    else:
        print("\nKnowledge base is up to date.")


if __name__ == "__main__":
    main()
