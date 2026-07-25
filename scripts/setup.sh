#!/usr/bin/env bash
# ── setup.sh ────────────────────────────────────────────────────────────────
# Install all dependencies for the AI Portfolio Assistant.
# Handles Node.js packages and Python virtual environment setup.
#
# Usage:
#   bash scripts/setup.sh
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== AI Portfolio Assistant Setup ==="
echo ""

# ── Node.js dependencies ────────────────────────────────────────────────────
echo "[1/3] Installing Node.js dependencies..."
cd "${PROJECT_ROOT}"
if command -v npm &>/dev/null; then
    npm install
    echo "  Node.js dependencies installed."
else
    echo "  WARNING: npm not found. Skipping Node.js setup."
    echo "  Install Node.js 20+ to run the frontend."
fi

# ── Python virtual environment ──────────────────────────────────────────────
echo ""
echo "[2/3] Setting up Python virtual environment..."
cd "${PROJECT_ROOT}/python"

if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo "  WARNING: Python not found. Skipping Python setup."
    echo "  Install Python 3.10+ to build knowledge embeddings."
    exit 0
fi

PYTHON_VERSION=$("${PYTHON_CMD}" --version 2>&1 | awk '{print $2}')
echo "  Using ${PYTHON_CMD} (${PYTHON_VERSION})"

if [ ! -d ".venv" ]; then
    "${PYTHON_CMD}" -m venv .venv
    echo "  Created virtual environment at python/.venv"
fi

source .venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo "  Python dependencies installed."

# ── Build knowledge base ────────────────────────────────────────────────────
echo ""
echo "[3/3] Building knowledge base..."
cd "${PROJECT_ROOT}"
bash scripts/build-knowledge.sh

echo ""
echo "=== Setup complete ==="
echo "Run 'npm run dev' to start the development server."
