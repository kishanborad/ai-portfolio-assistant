"""Package setup for ai-portfolio-assistant Python tools."""

from setuptools import setup, find_packages

setup(
    name="ai-portfolio-assistant-tools",
    version="1.0.0",
    description="Knowledge embedding pipeline and analysis tools",
    author="Kishan Borad",
    python_requires=">=3.10",
    packages=find_packages(),
    install_requires=[
        "sentence-transformers>=2.7.0",
        "tiktoken>=0.7.0",
        "pyyaml>=6.0.1",
        "numpy>=1.26.0",
    ],
    extras_require={
        "dev": [
            "pytest>=8.3.0",
            "pytest-cov>=5.0.0",
            "ruff>=0.6.0",
        ],
    },
)
