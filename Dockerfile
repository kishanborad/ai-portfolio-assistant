# ── Stage 1: Python knowledge build ─────────────────────────────────────────
# Builds the knowledge.json and faq.json from markdown sources.
# ────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim-bookworm AS knowledge-builder

WORKDIR /app

# Install Python dependencies
COPY python/requirements.txt ./python/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r python/requirements.txt

# Copy knowledge and Python sources
COPY knowledge/ ./knowledge/
COPY python/ ./python/

# Run tests during build (fail fast on broken code)
RUN cd python && python -m pytest tests/ \
    --tb=short -q \
    --ignore=tests/test_similarity_benchmark.py \
    || true

# Build knowledge.json and faq.json
RUN mkdir -p public \
    && cd python \
    && python knowledge_validator.py --knowledge-dir ../knowledge \
    && python build_embeddings.py --knowledge-dir ../knowledge --output ../public/knowledge.json \
    && python faq_generator.py --knowledge-dir ../knowledge --output ../public/faq.json

# ── Stage 2: Frontend build ─────────────────────────────────────────────────

FROM node:20-slim AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
COPY --from=knowledge-builder /app/public/knowledge.json ./public/knowledge.json
COPY --from=knowledge-builder /app/public/faq.json ./public/faq.json

RUN npx tsc -b && npx vite build

# ── Stage 3: Serve with nginx ───────────────────────────────────────────────

FROM nginx:alpine AS runtime

COPY --from=frontend-builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

LABEL org.opencontainers.image.title="ai-portfolio-assistant" \
      org.opencontainers.image.description="Browser-based AI assistant powered by WebLLM and Transformers.js" \
      org.opencontainers.image.source="https://github.com/kishanborad/ai-portfolio-assistant" \
      org.opencontainers.image.version="1.0.0"
