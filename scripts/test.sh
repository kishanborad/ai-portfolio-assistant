#!/usr/bin/env bash
# ── test.sh ─────────────────────────────────────────────────────────────────
# Run all tests: Python (pytest) and Frontend (vitest).
#
# Usage:
#   bash scripts/test.sh           # Run all tests
#   bash scripts/test.sh python    # Python tests only
#   bash scripts/test.sh frontend  # Frontend tests only
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET="${1:-all}"

run_python_tests() {
    echo "=== Python Tests ==="
    cd "${PROJECT_ROOT}/python"

    if [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate
    fi

    python -m pytest tests/ \
        --tb=short \
        -v \
        --cov=. \
        --cov-report=term-missing \
        --cov-exclude-lines="if __name__" \
        --ignore=tests/test_similarity_benchmark.py

    echo ""
}

run_frontend_tests() {
    echo "=== Frontend Tests ==="
    cd "${PROJECT_ROOT}"
    npx vitest run --reporter=verbose
    echo ""
}

case "${TARGET}" in
    python)
        run_python_tests
        ;;
    frontend)
        run_frontend_tests
        ;;
    all)
        run_python_tests
        run_frontend_tests
        ;;
    *)
        echo "Usage: bash scripts/test.sh [python|frontend|all]"
        exit 1
        ;;
esac

echo "=== All tests passed ==="
