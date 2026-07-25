#!/usr/bin/env bash
# ── deploy.sh ───────────────────────────────────────────────────────────────
# Build and deploy the AI Portfolio Assistant to GitHub Pages.
# Runs the knowledge build pipeline first, then vite build, then gh-pages.
#
# Usage:
#   bash scripts/deploy.sh
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== Deploying AI Portfolio Assistant ==="

# ── build knowledge base ────────────────────────────────────────────────────
echo "[1/3] Building knowledge base..."
bash "${SCRIPT_DIR}/build-knowledge.sh"

# ── build frontend ──────────────────────────────────────────────────────────
echo ""
echo "[2/3] Building frontend..."
cd "${PROJECT_ROOT}"
npx tsc -b
npx vite build

# ── deploy to GitHub Pages ──────────────────────────────────────────────────
echo ""
echo "[3/3] Deploying to GitHub Pages..."
npx gh-pages -d dist

echo ""
echo "=== Deployed ==="
echo "  https://kishanborad.github.io/ai-portfolio-assistant/"
