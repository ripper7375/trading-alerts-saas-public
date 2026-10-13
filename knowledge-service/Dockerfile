# Knowledge service image (build step 6 part 6; plan decisions D3 (A) and D12).
#
# Built alone on Railway from this folder (Watch Paths: knowledge-service/**). Three things happen at BUILD time, so a
# failure stops the deploy and nothing is downloaded or computed when the container starts:
#
#   1. the embedding model is fetched at the revision pinned in config/index.yaml (D12);
#   2. the index is built from corpus/ and verified, a corpus marked TEST_ONLY is refused, and so is a corpus with an
#      area that Davin has not approved or that changed after he did (--require-approved, ADR-042). ADR-005: "rebuilt on
#      every deploy" means this step; a failed gate is a failed build;
#   3. the index is loaded back once under every pin (txtai 9.5.0, normalised keyword scores, weights 0.7) and checked
#      to have been built with every area APPROVED.
#
# The corpus is written in parts 7 (D1 and D2) and 8 (D3 to D5) and approved one area at a time, so this build fails
# on PENDING areas until the last approval is signed. That is the gate working. For a throwaway image of a draft
# corpus, build it by hand without --require-approved, outside this Dockerfile.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    KNOWLEDGE_MODEL_DIR=/app/models/all-MiniLM-L6-v2 \
    KNOWLEDGE_INDEX_DIR=/app/index

WORKDIR /app
RUN groupadd --system app && useradd --system --gid app --home-dir /app app

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY config ./config
COPY knowledge ./knowledge

# (1) the model, once, at the pinned revision
RUN python -m knowledge.gate fetch-model

# (2) and (3) the index, from the real and approved corpus only
COPY corpus ./corpus
RUN python -m knowledge.gate build --corpus corpus --output index --require-real --require-approved \
 && python -m knowledge.gate check --index index --require-approved

# from here on nothing may be downloaded
ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

RUN chown -R app:app /app
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/healthz' % os.environ.get('PORT', '8000'), timeout=3)"

# one process: the index and the model are loaded once and shared by every request
CMD ["sh", "-c", "exec uvicorn knowledge.api:app --host 0.0.0.0 --port ${PORT:-8000}"]
