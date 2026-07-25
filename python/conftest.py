"""Pytest configuration — add the python/ directory to sys.path.

This allows tests in python/tests/ to import build_embeddings and
knowledge_validator without an installed package.
"""

import sys
import os

# Make the python/ directory importable from tests/
sys.path.insert(0, os.path.dirname(__file__))
