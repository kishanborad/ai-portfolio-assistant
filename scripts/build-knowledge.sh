#!/usr/bin/env bash
# ── build-knowledge.sh ──────────────────────────────────────────────────────
# Build knowledge.json and faq.json from the markdown knowledge base.
# Validates frontmatter, generates embeddings, produces FAQ entries.
#
# Usage:
#   bash scripts/build-knowledge.sh
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KNOWLEDGE_DIR="${PROJECT_ROOT}/knowledge"
OUTPUT_DIR="${PROJECT_ROOT}/public"
PYTHON_DIR="${PROJECT_ROOT}/python"

echo "=== Building Knowledge Base ==="

# ── activate venv if available ──────────────────────────────────────────────
if [ -f "${PYTHON_DIR}/.venv/bin/activate" ]; then
    source "${PYTHON_DIR}/.venv/bin/activate"
fi

# ── validate knowledge files ────────────────────────────────────────────────
echo "[1/3] Validating knowledge files..."
cd "${PYTHON_DIR}"
python knowledge_validator.py --knowledge-dir "${KNOWLEDGE_DIR}"

# ── build embeddings ────────────────────────────────────────────────────────
echo ""
echo "[2/3] Building embeddings..."
python build_embeddings.py \
    --knowledge-dir "${KNOWLEDGE_DIR}" \
    --output "${OUTPUT_DIR}/knowledge.json"

# ── generate FAQ ────────────────────────────────────────────────────────────
echo ""
echo "[3/3] Generating FAQ entries..."
python faq_generator.py \
    --knowledge-dir "${KNOWLEDGE_DIR}" \
    --output "${OUTPUT_DIR}/faq.json"

echo ""
echo "=== Knowledge base built ==="
echo "  ${OUTPUT_DIR}/knowledge.json"
echo "  ${OUTPUT_DIR}/faq.json"
