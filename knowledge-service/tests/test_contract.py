"""The contract with the monolith, read from the monolith's own files so that neither side can drift alone.

`lib/intake/packet.ts` decides what a knowledge pack may look like (`validateKnowledge`), and
`lib/intake/knowledge-client.ts` decides what the request is. These tests read both and compare the numbers and shapes
this service relies on. They are skipped only when the files are not there (the service checked out alone).
"""

from __future__ import annotations

import json
import re

import pytest

from helpers import PACKET_SCHEMA, PACKET_TS, REPO_ROOT, assert_knowledge_contract
from knowledge.api import KEY_HEADER, SEARCH_SCHEMA, SearchBody
from knowledge.chunker import CHUNK_ID_RE
from knowledge.config import IndexConfig, Matrix
from knowledge.frontmatter import VERSION_RE
from knowledge.tags import STATE_CODE_MAX_CHARS, STATE_CODE_RE, Tags

CLIENT_TS = REPO_ROOT / "lib" / "intake" / "knowledge-client.ts"
INTENTS_TS = REPO_ROOT / "lib" / "intake" / "intents.ts"

pytestmark = pytest.mark.skipif(not PACKET_TS.is_file(), reason="the monolith's lib/intake is not beside the service")


def ts_number(text: str, name: str) -> int:
    match = re.search(rf"export const {name} = ([0-9_]+);", text)
    assert match, f"{name} not found"
    return int(match.group(1).replace("_", ""))


def ts_list(text: str, name: str) -> list[str]:
    match = re.search(rf"export const {name} = \[(.*?)\] as const;", text, re.S)
    assert match, f"{name} not found"
    return re.findall(r"'([^']+)'", match.group(1))


@pytest.fixture(scope="module")
def packet_ts() -> str:
    return PACKET_TS.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def client_ts() -> str:
    return CLIENT_TS.read_text(encoding="utf-8")


class TestWhatTheValidatorHolds:
    def test_the_limits(self, packet_ts: str, index_config: IndexConfig):
        assert ts_number(packet_ts, "KNOWLEDGE_MAX_CHUNKS") == index_config.limit == 4
        assert ts_number(packet_ts, "KNOWLEDGE_MAX_EXPANSIONS") >= index_config.expansions_max
        assert ts_number(packet_ts, "KNOWLEDGE_CHUNK_MAX_CHARS") == index_config.chunker.max_chars == 4000

    def test_the_domains_and_statuses(self, packet_ts: str, tags: Tags):
        assert ts_list(packet_ts, "KNOWLEDGE_DOMAINS") == list(tags.domains)
        assert ts_list(packet_ts, "KNOWLEDGE_STATUSES") == ["OK", "EMPTY", "UNAVAILABLE"]

    def test_the_patterns_a_chunk_id_a_version_and_a_state_code_must_match(self, packet_ts: str):
        ts_id = re.search(r"^const ID = /(.*)/;$", packet_ts, re.M).group(1)
        ts_version = re.search(r"^const VERSION = /(.*)/;$", packet_ts, re.M).group(1)
        ts_state = re.search(r"^export const STATE_CODE = /(.*)/;$", packet_ts, re.M).group(1)
        schema = json.loads(PACKET_SCHEMA.read_text(encoding="utf-8"))["$defs"]
        assert schema["chunk"]["properties"]["id"]["pattern"] == ts_id
        assert schema["version"]["pattern"] == ts_version
        assert schema["stateCode"]["pattern"] == ts_state == STATE_CODE_RE.pattern
        # the service's own, narrower id pattern is a subset of the packet's
        packet_id, packet_version = re.compile(ts_id), re.compile(ts_version)
        for sample in ("a", "a.b-c_d", "z" * 80, "0.x", "t.d2.mcd1.sustained-breach-above-the-upper-band"):
            assert CHUNK_ID_RE.match(sample) and packet_id.match(sample)
        assert not CHUNK_ID_RE.match("_x") and not packet_id.match("_x")
        assert packet_version.match("kb-" + "0" * 32) and packet_version.match("1.0.0") and VERSION_RE.match("1.0.0")
        assert STATE_CODE_MAX_CHARS == 48 and re.search(r"pattern: STATE_CODE,\s*max: 48", packet_ts)

    def test_the_schema_limits_match_the_configuration(self, index_config: IndexConfig):
        defs = json.loads(PACKET_SCHEMA.read_text(encoding="utf-8"))["$defs"]
        assert defs["knowledge"]["properties"]["chunks"]["maxItems"] == index_config.limit
        assert defs["knowledge"]["properties"]["expansions"]["maxItems"] >= index_config.expansions_max
        assert defs["chunk"]["properties"]["text"]["maxLength"] == index_config.chunker.max_chars
        assert defs["chunk"]["properties"]["state_codes"]["maxItems"] == 16

    def test_the_largest_possible_answer_is_inside_what_the_client_reads(self, client_ts: str, index_config: IndexConfig):
        limit = ts_number(client_ts, "KNOWLEDGE_MAX_RESPONSE_CHARS")
        chunk = {
            "id": "i" * 80, "domain": "D2", "mcd_id": "MCD3", "state_codes": ["MCD3_" + "S" * 43] * 16,
            "timeframe": "M15", "version": "99.99.99", "text": "t" * index_config.chunker.max_chars,
        }
        worst = {"status": "OK", "index_build_id": "kb-" + "0" * 32,
                 "chunks": [chunk] * index_config.limit, "expansions": [chunk] * index_config.expansions_max}
        assert len(json.dumps(worst)) < limit


class TestWhatTheClientSends:
    def test_the_header_and_the_schema_name(self, client_ts: str):
        assert re.search(rf"KNOWLEDGE_KEY_HEADER = '{KEY_HEADER}'", client_ts)
        assert re.search(rf"KNOWLEDGE_SEARCH_SCHEMA = '{SEARCH_SCHEMA}'", client_ts)
        assert re.search(r"'/search'|/search`", client_ts)

    def test_the_request_fields_are_the_ones_the_service_accepts(self, client_ts: str):
        block = re.search(r"JSON\.stringify\(\{(.*?)\}\)", client_ts, re.S).group(1)
        sent = set(re.findall(r"^\s*(\w+):", block, re.M))
        accepted = {field.alias or name for name, field in SearchBody.model_fields.items()}
        assert sent == accepted == {"schema", "intent", "question_en", "m_star", "state_codes", "routing_version"}

    def test_the_intents_are_the_matrix_intents(self, matrix: Matrix):
        text = INTENTS_TS.read_text(encoding="utf-8")
        labels = ts_list(text, "UNDERSTAND_INTENTS") + ts_list(text, "INSTANT_INTENTS")
        assert sorted(labels) == sorted(matrix.intents)

    def test_a_503_is_all_the_client_needs_to_degrade(self, client_ts: str):
        # any non-2xx answer becomes an UNAVAILABLE pack without the body being read
        assert "if (!response.ok)" in client_ts and "KNOWLEDGE_HTTP_" in client_ts


class TestAnswersOnTheFixtureIndex:
    def test_each_status_is_accepted_by_the_shared_schema(self, retriever):
        from knowledge.search import SearchRequest, unavailable_response

        ok = retriever.search(SearchRequest("DIRECTION", "breakout above the band", ("MCD1",), (), "routing-v1"))
        empty = retriever.search(SearchRequest("REPORT_2", "x", (), (), "routing-v1"))
        assert_knowledge_contract(ok.to_response(), status="OK")
        assert_knowledge_contract(empty.to_response(), status="EMPTY")
        assert_knowledge_contract(unavailable_response(), status="UNAVAILABLE")

    def test_the_contract_helper_rejects_what_the_packet_would(self):
        good_chunk = {"id": "t.a", "domain": "D1", "mcd_id": None, "state_codes": [], "timeframe": None, "version": "1.0.0", "text": "x"}
        pack = {"status": "OK", "index_build_id": "kb-" + "0" * 32, "chunks": [good_chunk], "expansions": []}
        assert_knowledge_contract(pack)
        broken = [
            {**pack, "extra": 1},
            {**pack, "status": "FINE"},
            {**pack, "index_build_id": None},
            {**pack, "index_build_id": "x" * 41},
            {**pack, "chunks": []},
            {**pack, "chunks": [good_chunk] * 5},
            {**pack, "chunks": [{**good_chunk, "text": "x" * 4001}]},
            {**pack, "chunks": [{**good_chunk, "id": "_bad"}]},
            {**pack, "chunks": [{**good_chunk, "domain": "D6"}]},
            {**pack, "chunks": [{**good_chunk, "timeframe": "H1"}]},
            {**pack, "chunks": [{**good_chunk, "mcd_id": "MCD99"}]},
            {**pack, "chunks": [{**good_chunk, "state_codes": ["bad"]}]},
            {**pack, "chunks": [{k: v for k, v in good_chunk.items() if k != "version"}]},
            {**pack, "chunks": [good_chunk], "expansions": [good_chunk]},
            {**pack, "status": "EMPTY"},
            {**pack, "status": "UNAVAILABLE"},
        ]
        for case in broken:
            with pytest.raises(AssertionError):
                assert_knowledge_contract(case)


# ---------------------------------------------------------------------------
# recorded answers, for the Jest side of the contract
# ---------------------------------------------------------------------------

SAMPLES = REPO_ROOT / "knowledge-service" / "tests" / "fixtures" / "contract" / "search-responses.json"

SAMPLE_REQUESTS = [
    ("ok_direction_with_playbook", ("DIRECTION", "What does a breakout above the upper band mean?", ("MCD1", "MCD3"), ("MCD1_UP_UPPER_BREAKOUT",))),
    ("ok_explain_foundations", ("EXPLAIN", "What is a channel?", (), ())),
    ("ok_instant_with_expansion", ("INSTANT_M5_INSPECT", "Explain the current M5 reading for gold and what it implies for the trader type", ("MCD2", "MCD3"), ())),
    ("empty_report_2", ("REPORT_2", "Make the trade setup", (), ())),
]


class TestRecordedAnswers:
    """`tests/fixtures/contract/search-responses.json` holds real answers of this service on the TEST ONLY corpus. The
    monolith's Jest suite feeds them to `validateKnowledge` and to its own client, so a change on either side that the
    other would refuse fails on both. `WRITE_CONTRACT_FIXTURES=yes pytest tests/test_contract.py` records them again."""

    def test_record_or_check(self, retriever):
        import os

        from knowledge.search import SearchRequest, unavailable_response

        samples = []
        for name, (intent, question, m_star, codes) in SAMPLE_REQUESTS:
            request = SearchRequest(intent, question, m_star, codes, "routing-v1")
            samples.append(
                {
                    "name": name,
                    "request": {
                        "schema": "knowledge-search/1",
                        "intent": intent,
                        "question_en": question,
                        "m_star": list(m_star),
                        "state_codes": list(codes),
                        "routing_version": "routing-v1",
                    },
                    "http_status": 200,
                    "response": retriever.search(request).to_response(),
                }
            )
        samples.append({"name": "unavailable_503", "request": None, "http_status": 503, "response": unavailable_response()})
        document = {"schema": "knowledge-service-samples/1", "corpus_kind": "TEST_ONLY", "samples": samples}
        if os.environ.get("WRITE_CONTRACT_FIXTURES") == "yes":
            SAMPLES.parent.mkdir(parents=True, exist_ok=True)
            SAMPLES.write_bytes((json.dumps(document, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))

        recorded = json.loads(SAMPLES.read_text(encoding="utf-8"))
        assert recorded["schema"] == "knowledge-service-samples/1" and recorded["corpus_kind"] == "TEST_ONLY"
        assert [s["name"] for s in recorded["samples"]] == [s["name"] for s in samples]
        for sample in recorded["samples"]:
            assert_knowledge_contract(sample["response"])
        assert recorded["samples"][2]["response"]["expansions"], "one recorded answer must carry an expansion"
        # what a fresh answer looks like is the same as what was recorded: statuses and the shape of every chunk
        for fresh, old in zip(samples, recorded["samples"]):
            assert fresh["response"]["status"] == old["response"]["status"], fresh["name"]
            assert [sorted(c) for c in fresh["response"]["chunks"]] == [sorted(c) for c in old["response"]["chunks"]]
