"""Shared fixtures. Tests run on the real txtai and the real model; nothing here is a mock.

The model (about 90 MB) is fetched once at the pinned revision into `knowledge-service/models/` (or
`KNOWLEDGE_MODEL_DIR`). With `KNOWLEDGE_TEST_NO_DOWNLOAD=1` a missing model is an error instead of a download, which is
what a locked-down CI step wants. The index of the TEST ONLY corpus is built once per session.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from knowledge.build import BuildResult, build_index
from knowledge.config import (
    CONFIG_DIR,
    IndexConfig,
    Matrix,
    Settings,
    load_glossary_version,
    load_index_config,
    load_matrix,
)
from knowledge.index import LoadedIndex, load_index
from knowledge.model import TokenCounter, fetch_model, model_ready
from knowledge.search import Retriever
from knowledge.tags import Tags, load_tags

TESTS = Path(__file__).resolve().parent
FIXTURE_CORPUS = TESTS / "fixtures" / "corpus"
REAL_CORPUS = TESTS.parent / "corpus"


@pytest.fixture(scope="session")
def tags() -> Tags:
    return load_tags(CONFIG_DIR / "tags.yaml")


@pytest.fixture(scope="session")
def index_config() -> IndexConfig:
    return load_index_config(CONFIG_DIR / "index.yaml")


@pytest.fixture(scope="session")
def matrix(tags: Tags) -> Matrix:
    return load_matrix(tags)


@pytest.fixture(scope="session")
def glossary_version() -> str:
    return load_glossary_version()


@pytest.fixture(scope="session")
def model_dir(index_config: IndexConfig) -> Path:
    path = Settings.from_env().model_dir
    if not model_ready(path, index_config.model_revision):
        if os.environ.get("KNOWLEDGE_TEST_NO_DOWNLOAD"):
            pytest.fail(f"the model {index_config.model_revision} is not in {path} and downloads are off", pytrace=False)
        fetch_model(index_config, path)
    return path


@pytest.fixture(scope="session")
def counter(model_dir: Path) -> TokenCounter:
    return TokenCounter(model_dir)


@pytest.fixture(scope="session")
def fixture_corpus() -> Path:
    return FIXTURE_CORPUS


@pytest.fixture(scope="session")
def built(
    tmp_path_factory: pytest.TempPathFactory,
    tags: Tags,
    index_config: IndexConfig,
    glossary_version: str,
    model_dir: Path,
    counter: TokenCounter,
) -> BuildResult:
    output = tmp_path_factory.mktemp("index") / "fixture-index"
    return build_index(
        FIXTURE_CORPUS,
        output,
        tags=tags,
        config=index_config,
        glossary_version=glossary_version,
        model_dir=model_dir,
        counter=counter,
    )


@pytest.fixture(scope="session")
def loaded(built: BuildResult, index_config: IndexConfig, model_dir: Path) -> LoadedIndex:
    assert built.output_dir is not None
    return load_index(built.output_dir, index_config, model_dir)


@pytest.fixture(scope="session")
def retriever(loaded: LoadedIndex, matrix: Matrix, tags: Tags, index_config: IndexConfig) -> Retriever:
    return Retriever(loaded, matrix, tags, index_config)


@pytest.fixture(scope="session")
def real_corpus_build(
    tmp_path_factory: pytest.TempPathFactory,
    tags: Tags,
    index_config: IndexConfig,
    glossary_version: str,
    model_dir: Path,
    counter: TokenCounter,
) -> BuildResult:
    """The real corpus (`corpus/`, D1 to D5) built once per session, the way the image builds it minus the approval gate."""
    output = tmp_path_factory.mktemp("real-index") / "index"
    return build_index(
        REAL_CORPUS,
        output,
        tags=tags,
        config=index_config,
        glossary_version=glossary_version,
        model_dir=model_dir,
        counter=counter,
        require_real=True,
    )


@pytest.fixture(scope="session")
def real_corpus_retriever(
    real_corpus_build: BuildResult, index_config: IndexConfig, model_dir: Path, matrix: Matrix, tags: Tags
) -> Retriever:
    assert real_corpus_build.output_dir is not None
    return Retriever(load_index(real_corpus_build.output_dir, index_config, model_dir), matrix, tags, index_config)
