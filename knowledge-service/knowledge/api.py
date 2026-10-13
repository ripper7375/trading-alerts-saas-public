"""The HTTP service: `POST /search` (contract `knowledge-search/1`) and `GET /healthz`.

The monolith's client is `lib/intake/knowledge-client.ts`; its `validateKnowledge` (lib/intake/packet.ts) decides what
an answer may look like, and a 200 body here is exactly that: `{status, index_build_id, chunks, expansions}`.

  * Every call to `/search` must carry `x-knowledge-service-key` equal to `KNOWLEDGE_SERVICE_KEY` (constant-time
    compare). A service started without a key answers 401 to everybody: it fails closed.
  * An index that could not be loaded does not stop the service: `/search` answers 503 with the UNAVAILABLE pack and the
    monolith degrades (architecture 7.6). So does any failure of the search itself. `/healthz` stays up and says no
    build id.
  * The request is strict: an unknown field, a wrong schema or an unknown intent is 422; a routing version this
    service does not hold is 409. Sensor ids and state codes are NOT pattern-checked here: an unregistered one is
    dropped by the retriever, which is where the whitelist lives.
  * Logs name the intent, the counts and the time, never the question.
"""

from __future__ import annotations

import hmac
import logging
import time
from contextlib import asynccontextmanager
from typing import Annotated, Any, Literal, Mapping

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from . import SERVICE_VERSION
from .config import (
    CONFIG_DIR,
    Settings,
    check_templates,
    load_glossary_version,
    load_index_config,
    load_matrix,
)
from .errors import ConfigError, IndexUnavailable, KnowledgeError, RoutingVersionMismatch, UnknownIntent
from .index import LoadedIndex, load_index
from .model import require_model
from .search import Retriever, SearchRequest, unavailable_response
from .tags import load_tags

log = logging.getLogger("knowledge.api")

KEY_HEADER = "x-knowledge-service-key"
SEARCH_SCHEMA = "knowledge-search/1"


class SearchBody(BaseModel):
    """`knowledge-search/1`. Strings are bounded; their content is the retriever's business, not this model's."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)

    schema_: Literal["knowledge-search/1"] = Field(alias="schema")
    intent: str = Field(min_length=1, max_length=40)
    question_en: str = Field(min_length=1, max_length=2000)
    m_star: list[Annotated[str, Field(max_length=64)]] = Field(max_length=16)
    state_codes: list[Annotated[str, Field(max_length=64)]] = Field(max_length=32)
    routing_version: str = Field(min_length=1, max_length=40)


class ChunkOut(BaseModel):
    id: str
    domain: str
    mcd_id: str | None
    state_codes: list[str]
    timeframe: str | None
    version: str
    text: str


class SearchOut(BaseModel):
    status: Literal["OK", "EMPTY", "UNAVAILABLE"]
    index_build_id: str | None
    chunks: list[ChunkOut]
    expansions: list[ChunkOut]


class ServiceState:
    """What the process holds: the retriever when the index loaded, and why not when it did not."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.retriever: Retriever | None = None
        self.load_error: str | None = None
        self.load_seconds: float | None = None

    @property
    def build_id(self) -> str | None:
        return self.retriever.build_id if self.retriever else None

    def load(self) -> None:
        """Load the index. Never raises: a failure is remembered as a short code and `/search` answers 503."""
        started = time.perf_counter()
        try:
            tags = load_tags(CONFIG_DIR / "tags.yaml")
            config = load_index_config(CONFIG_DIR / "index.yaml")
            matrix = load_matrix(tags, self.settings.matrix_path)
            check_templates(config, matrix)
            load_glossary_version()  # the service holds the version the index was built with, or does not start
            require_model(config, self.settings.model_dir)
            loaded: LoadedIndex = load_index(self.settings.index_dir, config, self.settings.model_dir)
            self.retriever = Retriever(loaded, matrix, tags, config)
            self.load_error = None
        except IndexUnavailable as error:
            self.retriever, self.load_error = None, error.code
        except ConfigError as error:
            self.retriever, self.load_error = None, "CONFIG_ERROR"
            log.error("configuration error: %s", error)
        except Exception as error:  # a damaged file must not stop the process: it stays up, UNAVAILABLE
            self.retriever, self.load_error = None, "LOAD_FAILED"
            log.exception("index load failed: %s", type(error).__name__)
        self.load_seconds = time.perf_counter() - started
        if self.retriever is None:
            log.error("knowledge index UNAVAILABLE: %s", self.load_error)
        else:
            log.info("knowledge index %s loaded in %.2fs", self.retriever.build_id, self.load_seconds)


def create_app(settings: Settings | None = None, state: ServiceState | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    state = state or ServiceState(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if state.retriever is None and state.load_error is None:
            state.load()
        if settings.service_key is None:
            log.error("KNOWLEDGE_SERVICE_KEY is not set: every /search call will be refused (401)")
        yield

    app = FastAPI(title="Knowledge service", version=SERVICE_VERSION, lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.knowledge = state

    def require_key(x_knowledge_service_key: Annotated[str | None, Header()] = None) -> None:
        expected = settings.service_key
        if expected is None or x_knowledge_service_key is None:
            raise HTTPException(status_code=401, detail="unauthorized")
        if not hmac.compare_digest(x_knowledge_service_key.encode("utf-8"), expected.encode("utf-8")):
            raise HTTPException(status_code=401, detail="unauthorized")

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_: Request, error: RequestValidationError) -> JSONResponse:
        # which fields, never their values: a question is a trader's text
        fields = sorted({".".join(str(p) for p in e["loc"][1:]) or "body" for e in error.errors()})
        return JSONResponse(status_code=422, content={"detail": "invalid request", "fields": fields})

    @app.get("/healthz")
    def healthz() -> dict[str, Any]:
        return {"status": "ok", "index_build_id": state.build_id}

    @app.post("/search", response_model=SearchOut, dependencies=[Depends(require_key)])
    def search(body: SearchBody) -> Any:
        retriever = state.retriever
        if retriever is None:
            return JSONResponse(status_code=503, content=unavailable_response())
        started = time.perf_counter()
        request = SearchRequest(
            intent=body.intent,
            question_en=body.question_en,
            m_star=tuple(body.m_star),
            state_codes=tuple(body.state_codes),
            routing_version=body.routing_version,
        )
        try:
            result = retriever.search(request)
        except UnknownIntent:
            return JSONResponse(status_code=422, content={"detail": "invalid request", "fields": ["intent"]})
        except RoutingVersionMismatch:
            return JSONResponse(
                status_code=409,
                content={"detail": "routing version not held", "held": retriever.matrix.version},
            )
        except KnowledgeError:
            log.exception("search failed")
            return JSONResponse(status_code=503, content=unavailable_response())
        except Exception as error:  # txtai or sqlite failed mid-request: degrade, never crash
            log.exception("search failed: %s", type(error).__name__)
            return JSONResponse(status_code=503, content=unavailable_response())
        log.info(
            "search intent=%s m_star=%d chunks=%d expansions=%d dropped_ids=%d question_chars=%d ms=%.1f",
            request.intent,
            len(request.m_star),
            len(result.chunks),
            len(result.expansions),
            len(result.plan.dropped_m_star) if result.plan else 0,
            len(request.question_en),
            (time.perf_counter() - started) * 1000,
        )
        return result.to_response()

    return app


def _app_from_env() -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    return create_app()


# `uvicorn knowledge.api:app`
app = _app_from_env()
