"""The HTTP service: `POST /search` (contract knowledge-search/1) and `GET /healthz`."""

from __future__ import annotations

import dataclasses
import json
import shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from helpers import assert_knowledge_contract
from knowledge.api import KEY_HEADER, ServiceState, create_app
from knowledge.build import BuildResult
from knowledge.config import IndexConfig, Matrix, Settings
from knowledge.index import CHUNKS_FILE, LoadedIndex
from knowledge.search import Retriever
from knowledge.tags import Tags

KEY = "test-key-" + "k" * 24
HEADERS = {KEY_HEADER: KEY}
UNAVAILABLE = {"status": "UNAVAILABLE", "index_build_id": None, "chunks": [], "expansions": []}


def body(**changes: Any) -> dict[str, Any]:
    base = {
        "schema": "knowledge-search/1",
        "intent": "DIRECTION",
        "question_en": "What does a breakout above the upper band mean?",
        "m_star": ["MCD1"],
        "state_codes": ["MCD1_UP_UPPER_BREAKOUT"],
        "routing_version": "routing-v1",
    }
    base.update(changes)
    return {k: v for k, v in base.items() if v != "__skip__"}


@pytest.fixture(scope="module")
def settings(built: BuildResult, model_dir: Path) -> Settings:
    return Settings(service_key=KEY, index_dir=built.output_dir, model_dir=model_dir, matrix_path=None)


@pytest.fixture(scope="module")
def client(settings: Settings):
    with TestClient(create_app(settings)) as c:
        yield c


def post(client: TestClient, payload: Any, headers: dict | None = HEADERS):
    return client.post("/search", json=payload, headers=headers or {})


class TestHealth:
    def test_it_names_the_build(self, client: TestClient, built: BuildResult):
        response = client.get("/healthz")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "index_build_id": built.index_build_id}

    def test_it_needs_no_key(self, client: TestClient):
        assert client.get("/healthz", headers={}).status_code == 200

    def test_it_stays_up_without_an_index_and_says_no_build(self, tmp_path: Path, model_dir: Path):
        settings = Settings(service_key=KEY, index_dir=tmp_path / "nothing", model_dir=model_dir, matrix_path=None)
        with TestClient(create_app(settings)) as c:
            assert c.get("/healthz").json() == {"status": "ok", "index_build_id": None}


class TestTheKey:
    def test_no_header_is_401(self, client: TestClient):
        response = post(client, body(), headers=None)
        assert response.status_code == 401
        assert "chunks" not in response.text

    @pytest.mark.parametrize("wrong", ["", "x", KEY[:-1], KEY + "x", KEY.upper(), " " + KEY])
    def test_a_wrong_key_is_401(self, client: TestClient, wrong):
        assert post(client, body(), headers={KEY_HEADER: wrong}).status_code == 401

    def test_the_right_key_is_200(self, client: TestClient):
        assert post(client, body()).status_code == 200

    def test_the_header_name_is_not_case_sensitive(self, client: TestClient):
        assert post(client, body(), headers={"X-Knowledge-Service-Key": KEY}).status_code == 200

    def test_the_key_checks_come_before_the_body_is_judged(self, client: TestClient):
        assert post(client, {"not": "a search"}, headers={KEY_HEADER: "wrong"}).status_code == 401
        assert post(client, {"not": "a search"}, headers=None).status_code == 401
        assert post(client, {"not": "a search"}).status_code == 422

    def test_a_service_started_without_a_key_refuses_everybody(self, built: BuildResult, model_dir: Path):
        settings = Settings(service_key=None, index_dir=built.output_dir, model_dir=model_dir, matrix_path=None)
        with TestClient(create_app(settings)) as c:
            assert post(c, body(), headers={KEY_HEADER: ""}).status_code == 401
            assert post(c, body(), headers={KEY_HEADER: KEY}).status_code == 401
            assert post(c, body(), headers=None).status_code == 401
            assert c.get("/healthz").status_code == 200

    def test_the_key_is_never_in_an_answer(self, client: TestClient):
        for response in (post(client, body()), post(client, body(), headers={KEY_HEADER: "x"}), post(client, {})):
            assert KEY not in response.text


class TestAnAnswer:
    def test_the_body_is_the_knowledge_section_and_nothing_more(self, client: TestClient, built: BuildResult):
        response = post(client, body())
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/json")
        data = response.json()
        assert set(data) == {"status", "index_build_id", "chunks", "expansions"}
        assert data["status"] == "OK" and data["index_build_id"] == built.index_build_id
        assert 1 <= len(data["chunks"]) <= 4
        assert all(set(c) == {"id", "domain", "mcd_id", "state_codes", "timeframe", "version", "text"} for c in data["chunks"])
        assert_knowledge_contract(data, status="OK")

    def test_the_answer_satisfies_the_packet_schema_for_every_intent(self, client: TestClient, matrix: Matrix):
        for intent in matrix.intents:
            for m_star in ([], ["MCD1"], ["MCD2", "MCD3"], ["MCD0", "MCD1", "MCD2", "MCD3"]):
                response = post(client, body(intent=intent, m_star=m_star))
                assert response.status_code == 200, (intent, response.text)
                assert_knowledge_contract(response.json())
                assert len(response.text) < 262_144, "the monolith client refuses a larger answer"

    def test_the_answer_obeys_the_scope_over_http(self, client: TestClient):
        data = post(client, body(intent="DIRECTION", question_en="Five minute breakout above the upper band", m_star=["MCD1"])).json()
        for chunk in data["chunks"] + data["expansions"]:
            assert chunk["domain"] in ("D3", "D5") or (chunk["domain"] == "D2" and chunk["mcd_id"] == "MCD1")

    @pytest.mark.parametrize("intent", ["REPORT_2", "OUT_OF_SCOPE"])
    def test_an_intent_with_no_scope_is_empty_and_names_the_build(self, client: TestClient, built: BuildResult, intent):
        response = post(client, body(intent=intent))
        assert response.status_code == 200
        assert response.json() == {"status": "EMPTY", "index_build_id": built.index_build_id, "chunks": [], "expansions": []}
        assert_knowledge_contract(response.json(), status="EMPTY")

    def test_zero_hits_from_the_search_is_empty_too(self, built: BuildResult, loaded: LoadedIndex, matrix, tags, index_config, settings):
        narrow = dataclasses.replace(index_config, candidates=1, limit=1)
        state = ServiceState(settings)
        state.retriever = Retriever(loaded, matrix, tags, narrow)
        with TestClient(create_app(settings, state)) as c:
            response = post(c, body(intent="EXPLAIN", question_en="half risk sizing and the stop behind structure", m_star=[]))
        assert response.status_code == 200
        assert response.json() == {"status": "EMPTY", "index_build_id": built.index_build_id, "chunks": [], "expansions": []}

    def test_a_question_that_is_not_english_is_still_answered(self, client: TestClient):
        response = post(client, body(question_en="ما هو الاختراق فوق النطاق العلوي؟ 突破 上轨"))
        assert response.status_code == 200
        assert_knowledge_contract(response.json())

    def test_concurrent_requests_all_get_the_same_answer(self, client: TestClient):
        expected = post(client, body()).json()
        with ThreadPoolExecutor(max_workers=8) as pool:
            answers = list(pool.map(lambda _: post(client, body()), range(24)))
        assert all(a.status_code == 200 and a.json() == expected for a in answers)


class TestHostileRequests:
    @pytest.mark.parametrize("hostile", ["MCD1' OR 1=1 --", "MCD1'; DROP TABLE documents; --", "MCD4", ""])
    def test_a_hostile_sensor_id_is_dropped_not_rejected(self, client: TestClient, hostile):
        response = post(client, body(m_star=[hostile]))
        assert response.status_code == 200
        assert response.json() == post(client, body(m_star=[])).json()
        assert all(c["domain"] != "D2" for c in response.json()["chunks"] + response.json()["expansions"])

    def test_a_hostile_question_is_answered(self, client: TestClient):
        response = post(client, body(question_en="x'); DROP TABLE documents; --"))
        assert response.status_code == 200
        assert post(client, body()).status_code == 200  # the store is intact

    def test_a_hostile_state_code_is_dropped(self, client: TestClient):
        assert post(client, body(state_codes=["' OR 1=1 --"])).status_code == 200


class TestARequestThatIsNotTheContract:
    @pytest.mark.parametrize(
        ("changes", "fields"),
        [
            ({"schema": "knowledge-search/2"}, ["schema"]),
            ({"schema": "__skip__"}, ["schema"]),
            ({"intent": "__skip__"}, ["intent"]),
            ({"intent": ""}, ["intent"]),
            ({"intent": "BUY_NOW"}, ["intent"]),
            ({"question_en": ""}, ["question_en"]),
            ({"question_en": "q" * 2001}, ["question_en"]),
            ({"question_en": 5}, ["question_en"]),
            ({"m_star": "MCD1"}, ["m_star"]),
            ({"m_star": ["MCD1"] * 17}, ["m_star"]),
            ({"m_star": [1]}, ["m_star.0"]),
            ({"m_star": ["M" * 65]}, ["m_star.0"]),
            ({"m_star": "__skip__"}, ["m_star"]),
            ({"state_codes": "__skip__"}, ["state_codes"]),
            ({"state_codes": ["S"] * 33}, ["state_codes"]),
            ({"routing_version": "__skip__"}, ["routing_version"]),
            ({"routing_version": ""}, ["routing_version"]),
            ({"extra_field": 1}, ["extra_field"]),
        ],
    )
    def test_it_is_422_and_says_which_field(self, client: TestClient, changes, fields):
        response = post(client, body(**changes))
        assert response.status_code == 422
        assert response.json() == {"detail": "invalid request", "fields": fields}

    def test_an_error_never_echoes_the_question(self, client: TestClient):
        secret = "my-private-question-" + "z" * 30
        response = post(client, body(question_en=secret, intent="BUY_NOW"))
        assert response.status_code == 422 and secret not in response.text

    def test_a_body_that_is_not_json_or_not_an_object(self, client: TestClient):
        assert client.post("/search", content=b"{nope", headers={**HEADERS, "content-type": "application/json"}).status_code == 422
        assert post(client, [1, 2, 3]).status_code == 422
        assert post(client, None).status_code == 422

    def test_a_routing_version_this_service_does_not_hold_is_409(self, client: TestClient):
        response = post(client, body(routing_version="routing-v2"))
        assert response.status_code == 409
        assert response.json() == {"detail": "routing version not held", "held": "routing-v1"}

    def test_get_is_not_allowed(self, client: TestClient):
        assert client.get("/search", headers=HEADERS).status_code == 405

    def test_there_are_no_other_routes(self, client: TestClient):
        for path in ("/docs", "/redoc", "/openapi.json", "/index", "/chunks"):
            assert client.get(path, headers=HEADERS).status_code == 404


class TestWhenTheIndexIsNotThere:
    def unavailable(self, index_dir: Path, model_dir: Path) -> TestClient:
        settings = Settings(service_key=KEY, index_dir=index_dir, model_dir=model_dir, matrix_path=None)
        return TestClient(create_app(settings))

    def test_a_missing_index_is_503_with_the_unavailable_pack(self, tmp_path: Path, model_dir: Path):
        with self.unavailable(tmp_path / "nothing", model_dir) as c:
            response = post(c, body())
        assert response.status_code == 503
        assert response.json() == UNAVAILABLE
        assert_knowledge_contract(response.json(), status="UNAVAILABLE")

    def test_the_key_is_still_checked_first(self, tmp_path: Path, model_dir: Path):
        with self.unavailable(tmp_path / "nothing", model_dir) as c:
            assert post(c, body(), headers=None).status_code == 401

    def test_a_damaged_index_is_503_too_and_the_process_lives(self, built: BuildResult, tmp_path: Path, model_dir: Path):
        damaged = tmp_path / "damaged"
        shutil.copytree(built.output_dir, damaged)
        (damaged / CHUNKS_FILE).write_bytes(b"{}")
        with self.unavailable(damaged, model_dir) as c:
            assert post(c, body()).status_code == 503
            assert c.get("/healthz").json() == {"status": "ok", "index_build_id": None}

    def test_an_index_built_under_other_settings_is_503(self, built: BuildResult, tmp_path: Path, model_dir: Path):
        other = tmp_path / "other"
        shutil.copytree(built.output_dir, other)
        meta_path = other / "build_metadata.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["inputs"]["index_config_sha256"] = "0" * 64
        meta_path.write_text(json.dumps(meta), encoding="utf-8")
        with self.unavailable(other, model_dir) as c:
            assert post(c, body()).status_code == 503

    def test_a_missing_model_is_503_not_a_download(self, built: BuildResult, tmp_path: Path):
        with self.unavailable(built.output_dir, tmp_path / "no-model") as c:
            assert post(c, body()).status_code == 503

    def test_a_search_that_fails_mid_request_is_503_and_the_next_one_works(
        self, loaded: LoadedIndex, matrix: Matrix, tags: Tags, index_config: IndexConfig, settings: Settings
    ):
        class Flaky:
            fail = True

            def __init__(self, inner):
                self.inner = inner

            def search(self, *args, **kwargs):
                if Flaky.fail:
                    raise RuntimeError("database is locked")
                return self.inner.search(*args, **kwargs)

        state = ServiceState(settings)
        state.retriever = Retriever(LoadedIndex(Flaky(loaded.embeddings), loaded.chunks, loaded.metadata), matrix, tags, index_config)
        with TestClient(create_app(settings, state)) as c:
            first = post(c, body())
            Flaky.fail = False
            second = post(c, body())
        assert first.status_code == 503 and first.json() == UNAVAILABLE
        assert second.status_code == 200 and second.json()["status"] == "OK"

    def test_the_log_names_the_intent_and_never_the_question(self, client: TestClient, caplog):
        secret = "a-very-private-question-about-gold"
        with caplog.at_level("INFO", logger="knowledge.api"):
            post(client, body(question_en=secret))
        text = " ".join(r.getMessage() for r in caplog.records)
        assert "intent=DIRECTION" in text and secret not in text and "question_chars=" in text


def test_the_state_remembers_how_long_the_load_took(settings: Settings):
    state = ServiceState(settings)
    state.load()
    assert state.retriever is not None and state.load_error is None
    assert state.load_seconds is not None and state.load_seconds < 30
    state.retriever.loaded.embeddings.close()
