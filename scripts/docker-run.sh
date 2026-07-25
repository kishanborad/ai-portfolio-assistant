#!/usr/bin/env bash
# ── docker-run.sh ───────────────────────────────────────────────────────────
# Build and run the AI Portfolio Assistant in a Docker container.
# The container builds the knowledge base and serves the app.
#
# Usage:
#   bash scripts/docker-run.sh              # Build and run
#   bash scripts/docker-run.sh --build-only # Build image only
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
IMAGE_NAME="ai-portfolio-assistant"
MODE="${1:-run}"

cd "${PROJECT_ROOT}"

echo "=== Building Docker image ==="
docker build -t "${IMAGE_NAME}" .

if [ "${MODE}" = "--build-only" ]; then
    echo "Image built successfully: ${IMAGE_NAME}"
    exit 0
fi

echo ""
echo "=== Running container ==="
echo "  http://localhost:8080"
docker run --rm -p 8080:80 "${IMAGE_NAME}"
