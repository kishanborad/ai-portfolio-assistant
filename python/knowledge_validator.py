"""Validate knowledge base markdown files for required frontmatter fields.

Checks that every .md file in the knowledge directory has YAML frontmatter
with title, category, and tags. Reports coverage by category.

Usage:
    python knowledge_validator.py --knowledge-dir ../knowledge
"""

import argparse
import os
import re
import sys

import yaml

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
REQUIRED_FIELDS = ["title", "category", "tags"]


def validate_frontmatter(filepath: str) -> dict:
    """Validate a single markdown file's frontmatter.

    Returns {"valid": bool, "errors": list[str], "metadata": dict}.
    """
    with open(filepath, encoding="utf-8") as f:
        text = f.read()

    match = FRONTMATTER_RE.match(text)
    if not match:
        return {
            "valid": False,
            "errors": ["No YAML frontmatter found"],
            "metadata": {},
        }

    try:
        metadata = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError as exc:
        return {
            "valid": False,
            "errors": [f"Invalid YAML: {exc}"],
            "metadata": {},
        }

    errors = []
    for field in REQUIRED_FIELDS:
        if field not in metadata:
            errors.append(f"Missing required field: {field}")

    if "tags" in metadata and not isinstance(metadata["tags"], list):
        errors.append("Field 'tags' must be a list")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "metadata": metadata,
    }


def validate_knowledge_dir(knowledge_dir: str) -> dict:
    """Validate all markdown files in a knowledge directory.

    Returns {
        "files": [{"path": str, "valid": bool, "errors": list}],
        "coverage": {category: count},
        "total": int,
        "valid": int,
    }
    """
    files = []
    coverage: dict[str, int] = {}

    for root, _dirs, filenames in os.walk(knowledge_dir):
        for fname in sorted(filenames):
            if not fname.endswith(".md"):
                continue

            filepath = os.path.join(root, fname)
            result = validate_frontmatter(filepath)
            files.append({
                "path": filepath,
                "valid": result["valid"],
                "errors": result["errors"],
            })

            if result["valid"]:
                cat = result["metadata"].get("category", "unknown")
                coverage[cat] = coverage.get(cat, 0) + 1

    return {
        "files": files,
        "coverage": coverage,
        "total": len(files),
        "valid": sum(1 for f in files if f["valid"]),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Validate knowledge base frontmatter"
    )
    parser.add_argument(
        "--knowledge-dir",
        default="../knowledge",
        help="Path to the knowledge/ directory",
    )
    args = parser.parse_args()

    result = validate_knowledge_dir(args.knowledge_dir)

    for file_info in result["files"]:
        status = "OK" if file_info["valid"] else "FAIL"
        path = os.path.relpath(file_info["path"], args.knowledge_dir)
        print(f"  [{status}] {path}")
        for err in file_info["errors"]:
            print(f"         {err}")

    print(f"\n{result['valid']}/{result['total']} files valid")
    print(f"Coverage: {result['coverage']}")

    if result["valid"] < result["total"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
