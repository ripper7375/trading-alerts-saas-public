"""Retrieval on the real txtai index (architecture 4.7; 4.11 items 5 and 6).

Item 5: the SQL retrieval runs on a real index with bound, whitelisted ids.
Item 6: the index is built with keyword-score normalisation on and searched with weights=0.7, and a test fails if
either changes.
"""

from __future__ import annotations

import dataclasses
import random
import re
from importlib import metadata as importlib_metadata
from typing import Any

import pytest
import yaml

from helpers import SERVICE_ROOT, assert_knowledge_contract
from knowledge.config import CONFIG_DIR, IndexConfig, Matrix, parse_index_config, parse_matrix
from knowledge.errors import ConfigError, RoutingVersionMismatch, UnknownIntent
from knowledge.index import LoadedIndex, txtai_version
from knowledge.search import (
    Retriever,
    SearchRequest,
    build_query_text,
    build_sql,
    plan_search,
    unavailable_response,
)
from knowledge.tags import Tags
from knowledge.verify import fusion_mismatches, verify_fusion, verify_index

SQL_DIRECTION_BOTH = (
    "SELECT id, text, mcd_id, domain, score FROM txtai WHERE similar(:q, 40) "
    "AND ((domain = :pd AND mcd_id IN (:m0, :m1)) OR domain IN (:d0, :d1)) LIMIT 4"
)


def req(intent="DIRECTION", question="What does a breakout above the upper band mean?", m_star=(), state_codes=(), routing="routing-v1"):
    return SearchRequest(
        intent=intent,
        question_en=question,
        m_star=tuple(m_star),
        state_codes=tuple(state_codes),
        routing_version=routing,
    )


def plan_of(request: SearchRequest, matrix: Matrix, tags: Tags, index_config: IndexConfig):
    return plan_search(request, matrix=matrix, tags=tags, config=index_config)


def in_scope(chunk: dict[str, Any], domains: tuple[str, ...], playbooks: tuple[str, ...]) -> bool:
    return chunk["domain"] in domains or (chunk["domain"] == "D2" and chunk["mcd_id"] in playbooks)


class Spy:
    """Wraps the real embeddings and remembers every search call; everything else passes through."""

    def __init__(self, inner):
        self.inner = inner
        self.calls: list[tuple[tuple, dict]] = []

    def search(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return self.inner.search(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(self.inner, name)


def spied(loaded: LoadedIndex, matrix: Matrix, tags: Tags, config: IndexConfig) -> tuple[Retriever, Spy]:
    spy = Spy(loaded.embeddings)
    return Retriever(LoadedIndex(embeddings=spy, chunks=loaded.chunks, metadata=loaded.metadata), matrix, tags, config), spy


# ===========================================================================
# 4.11 item 5: bound, whitelisted ids
# ===========================================================================


class TestTheSqlIsBuiltAsSection47Says:
    def test_direction_with_a_playbook_scope_and_general_domains(self, matrix, tags, index_config):
        plan = plan_of(req(m_star=["MCD3", "MCD1"]), matrix, tags, index_config)
        assert plan.sql == SQL_DIRECTION_BOTH
        assert dict(plan.parameters) == {
            "q": plan.query_text,
            "pd": "D2",
            "m0": "MCD1",
            "m1": "MCD3",
            "d0": "D3",
            "d1": "D5",
        }

    def test_only_general_domains_when_the_matrix_scopes_no_playbooks(self, matrix, tags, index_config):
        plan = plan_of(req("RISK_SIZING", m_star=["MCD1", "MCD2"]), matrix, tags, index_config)
        assert plan.sql == (
            "SELECT id, text, mcd_id, domain, score FROM txtai WHERE similar(:q, 40) AND domain IN (:d0, :d1) LIMIT 4"
        )
        assert plan.playbook_ids == () and "mcd_id" not in plan.sql.split("WHERE")[1]
        assert set(plan.parameters) == {"q", "d0", "d1"}

    def test_an_empty_m_star_builds_valid_sql_with_no_empty_in_clause(self, matrix, tags, index_config):
        plan = plan_of(req(m_star=[]), matrix, tags, index_config)
        assert plan.sql == (
            "SELECT id, text, mcd_id, domain, score FROM txtai WHERE similar(:q, 40) AND domain IN (:d0, :d1) LIMIT 4"
        )
        assert "IN ()" not in plan.sql and ":pd" not in plan.sql and ":m0" not in plan.sql

    def test_a_playbook_only_scope(self):
        sql, parameters = build_sql((), ("MCD2",), candidates=40, limit=4)
        assert sql == (
            "SELECT id, text, mcd_id, domain, score FROM txtai WHERE similar(:q, 40) "
            "AND (domain = :pd AND mcd_id IN (:m0)) LIMIT 4"
        )
        assert parameters == {"pd": "D2", "m0": "MCD2"}

    def test_nothing_in_scope_builds_no_sql_at_all(self, matrix, tags, index_config):
        assert build_sql((), (), candidates=40, limit=4) == (None, {})
        for intent in ("REPORT_2", "OUT_OF_SCOPE"):
            plan = plan_of(req(intent, m_star=["MCD1"]), matrix, tags, index_config)
            assert plan.sql is None and dict(plan.parameters) == {}

    def test_the_numbers_come_from_the_configuration(self, matrix, tags, index_config):
        config = dataclasses.replace(index_config, candidates=60, limit=3)
        plan = plan_of(req(m_star=["MCD1"]), matrix, tags, config)
        assert "similar(:q, 60)" in plan.sql and plan.sql.endswith("LIMIT 3")

    def test_the_query_is_the_template_the_state_codes_and_the_question(self, matrix, tags, index_config):
        plan = plan_of(
            req("EXPLAIN", "What is LOEDT?", state_codes=["MCD1_UP_IN_CORRIDOR", "MCD3_BULL_VALUE"]),
            matrix,
            tags,
            index_config,
        )
        assert plan.query_text == (
            f"{index_config.intent_templates['EXPLAIN']} | MCD1_UP_IN_CORRIDOR MCD3_BULL_VALUE | What is LOEDT?"
        )
        assert build_query_text("t", ["A", "B"], "q") == "t | A B | q"
        assert build_query_text("t", [], "q") == "t |  | q"

    def test_a_request_with_the_wrong_routing_version_is_refused(self, matrix, tags, index_config):
        with pytest.raises(RoutingVersionMismatch):
            plan_of(req(routing="routing-v2"), matrix, tags, index_config)

    def test_an_intent_the_matrix_does_not_have_is_refused(self, matrix, tags, index_config):
        with pytest.raises(UnknownIntent):
            plan_of(req("BUY_NOW"), matrix, tags, index_config)

    def test_d2_cannot_become_a_general_domain(self, tags):
        raw = {
            "schema": "dispatch-matrix/1",
            "version": "routing-v1",
            "intents": {"X": {"domains": ["D2"], "playbooks": "NONE"}},
        }
        with pytest.raises(ConfigError, match="D2"):
            parse_matrix(raw, tags)


HOSTILE_IDS = [
    "MCD1' OR 1=1 --",
    "MCD1'; DROP TABLE documents; --",
    "MCD1\" OR \"1\"=\"1",
    "MCD1) OR (1=1",
    "MCD1 /* comment */",
    "MCD1\x00",
    ":m0",
    "mcd1",
    "MCD1 ",
    "MCD4",
    "MCD15",
    "MCD99",
    "",
    "D2",
    "%",
]
HOSTILE_QUESTIONS = [
    "x'); DROP TABLE documents; --",
    "' OR 1=1 --",
    "\" OR \"\"=\"",
    "similar(:q, 99999) OR 1=1",
    "; SELECT * FROM txtai",
    "/* */ UNION SELECT id, text, mcd_id, domain, 1 FROM txtai --",
    ":d0 :d1 :m0 :pd",
    "\\' \\\" \\\\",
    "'" * 50,
]
SQL_SHAPE = re.compile(
    r"SELECT id, text, mcd_id, domain, score FROM txtai WHERE similar\(:q, \d+\) AND "
    r"(\(\(domain = :pd AND mcd_id IN \(:m0(, :m\d)*\)\) OR domain IN \(:d0(, :d\d)*\)\)"
    r"|domain IN \(:d0(, :d\d)*\)"
    r"|\(domain = :pd AND mcd_id IN \(:m0(, :m\d)*\)\)) LIMIT \d+"
)


class TestHostileInputIsNeverSql:
    @pytest.mark.parametrize("hostile", HOSTILE_IDS)
    def test_an_id_the_registry_does_not_list_is_dropped_not_bound(self, hostile, matrix, tags, index_config):
        plan = plan_of(req(m_star=[hostile, "MCD2"]), matrix, tags, index_config)
        assert plan.playbook_ids == ("MCD2",)
        assert hostile in plan.dropped_m_star
        assert [v for k, v in plan.parameters.items() if k.startswith("m")] == ["MCD2"]  # only the registered sensor is bound
        assert "'" not in plan.sql and '"' not in plan.sql and ";" not in plan.sql
        assert "--" not in plan.sql and "/*" not in plan.sql and "\x00" not in plan.sql
        assert SQL_SHAPE.fullmatch(plan.sql)

    @pytest.mark.parametrize("question", HOSTILE_QUESTIONS)
    def test_a_hostile_question_is_a_bound_parameter_and_nothing_else(self, question, matrix, tags, index_config):
        plan = plan_of(req(question=question, m_star=["MCD1"]), matrix, tags, index_config)
        assert plan.parameters["q"].endswith(question)
        assert question not in plan.sql
        assert SQL_SHAPE.fullmatch(plan.sql)
        # the only place the text of the question appears is the one bound value
        assert [k for k, v in plan.parameters.items() if question in v] == ["q"]

    def test_a_hostile_state_code_is_dropped_before_it_reaches_the_query_text(self, matrix, tags, index_config):
        plan = plan_of(
            req(state_codes=["MCD1_UP_IN_CORRIDOR", "X' OR 1=1 --", "MCD1_UP_IN_CORRIDOR"]), matrix, tags, index_config
        )
        assert plan.dropped_state_codes == ("X' OR 1=1 --",)
        assert "OR 1=1" not in plan.query_text
        assert plan.query_text.count("MCD1_UP_IN_CORRIDOR") == 1

    def test_unregistered_sensors_are_dropped_even_when_they_look_right(self, matrix, tags, index_config):
        plan = plan_of(req(m_star=["MCD4", "MCD15", "mcd1", "MCD1"]), matrix, tags, index_config)
        assert plan.playbook_ids == ("MCD1",)
        assert set(plan.dropped_m_star) == {"MCD4", "MCD15", "mcd1"}

    def test_every_variable_part_is_a_placeholder_of_the_parameters(self, matrix, tags, index_config):
        rng = random.Random(47)
        alphabet = ["MCD1", "MCD2", "MCD3", "MCD0", "'", '"', ";", "--", " OR 1=1", ":q", "/*", "\\", "%", "\x00", "é", "\U0001f600"]
        for _ in range(300):
            ids = ["".join(rng.choice(alphabet) for _ in range(rng.randint(1, 4))) for _ in range(rng.randint(0, 6))]
            question = "".join(rng.choice(alphabet + [" ", "gold"]) for _ in range(rng.randint(1, 12)))
            intent = rng.choice(list(matrix.intents))
            plan = plan_of(req(intent, question, ids, ["".join(rng.choice(alphabet) for _ in range(3))]), matrix, tags, index_config)
            if plan.sql is None:
                assert not plan.parameters
                continue
            assert SQL_SHAPE.fullmatch(plan.sql), plan.sql
            placeholders = set(re.findall(r":([a-z]+[0-9]*)", plan.sql))
            assert placeholders == set(plan.parameters), (placeholders, plan.parameters)
            # whatever was bound for a sensor is a registered one
            assert all(v in tags.mcd_ids for k, v in plan.parameters.items() if re.fullmatch(r"m[0-9]+", k))


class TestOnTheRealIndex:
    QUESTIONS = [
        "What does a breakout above the upper band mean?",
        "Five minute breakout above the upper band",
        "trend conflict between the two timeframes stand aside",
        "bullish value area combined range",
        "downtrend inside the corridor",
        "half risk sizing and the stop behind structure",
        "news blackout window around a release",
        "what is a channel and the closed bar rule",
        "reference line forty of the invented list",
        "counter-trend rally invalidation",
    ]

    def test_direction_never_returns_a_playbook_outside_m_star(self, retriever: Retriever):
        for question in self.QUESTIONS:
            result = retriever.search(req("DIRECTION", question, m_star=["MCD1"]))
            for chunk in result.chunks + result.expansions:
                assert chunk["domain"] in ("D3", "D5") or (chunk["domain"] == "D2" and chunk["mcd_id"] == "MCD1"), (question, chunk["id"])

    def test_the_filter_is_what_keeps_an_out_of_scope_playbook_out(self, retriever: Retriever, loaded: LoadedIndex):
        question = "Five minute breakout above the upper band"
        unfiltered = loaded.embeddings.search(
            "SELECT id, domain, mcd_id FROM txtai WHERE similar(:q, 15) LIMIT 15", limit=15, weights=0.7, parameters={"q": question}
        )
        assert unfiltered[0]["id"] == "t.d2.mcd2.five-minute-breakout-above-the-upper-band", "the fixture must make the point"
        result = retriever.search(req("DIRECTION", question, m_star=["MCD1"]))
        assert "t.d2.mcd2.five-minute-breakout-above-the-upper-band" not in [c["id"] for c in result.chunks + result.expansions]
        # and when M* does name MCD2, it comes back first among the playbooks
        named = retriever.search(req("DIRECTION", question, m_star=["MCD2"]))
        assert "t.d2.mcd2.five-minute-breakout-above-the-upper-band" in [c["id"] for c in named.chunks]

    def test_with_m_star_empty_no_playbook_at_all_comes_back(self, retriever: Retriever):
        for question in self.QUESTIONS:
            result = retriever.search(req("DIRECTION", question, m_star=[]))
            assert result.chunks, question
            assert all(c["domain"] in ("D3", "D5") for c in result.chunks + result.expansions)

    @pytest.mark.parametrize("hostile", HOSTILE_IDS)
    def test_a_hostile_id_gives_exactly_the_answer_of_an_empty_m_star(self, retriever: Retriever, hostile):
        """If the id were part of the SQL, `OR 1=1` would return every playbook; instead it is gone."""
        question = "What does a breakout above the upper band mean?"
        assert retriever.search(req(m_star=[hostile], question=question)).to_response() == retriever.search(
            req(m_star=[], question=question)
        ).to_response()

    @pytest.mark.parametrize("question", HOSTILE_QUESTIONS)
    def test_a_hostile_question_is_answered_and_harms_nothing(self, retriever: Retriever, question):
        before = retriever.search(req(m_star=["MCD1"])).to_response()
        result = retriever.search(req(question=question, m_star=["MCD1"]))
        assert result.status in ("OK", "EMPTY")
        for chunk in result.chunks + result.expansions:
            assert chunk["domain"] in ("D3", "D5") or (chunk["domain"] == "D2" and chunk["mcd_id"] == "MCD1")
        # the store is intact: the same ordinary question gives the same answer afterwards
        assert retriever.search(req(m_star=["MCD1"])).to_response() == before
        assert retriever.loaded.embeddings.count() == 15

    @pytest.mark.parametrize(
        "intent", ["DIRECTION", "ENTRY_TIMING", "EXIT_TARGETS", "RISK_SIZING", "EXPLAIN", "NEWS", "INSTANT_M5_INSPECT", "INSTANT_M15_INSPECT"]
    )
    def test_every_intent_stays_inside_its_scope(self, retriever: Retriever, matrix: Matrix, intent):
        rule = matrix.intents[intent]
        m_stars = [[], ["MCD1"], ["MCD2", "MCD3"], ["MCD0", "MCD1", "MCD2", "MCD3"], ["MCD1' OR 1=1 --", "MCD2"]]
        seen = 0
        for m_star in m_stars:
            registered = tuple(m for m in m_star if m in ("MCD0", "MCD1", "MCD2", "MCD3")) if rule.playbooks == "M_STAR" else ()
            for question in self.QUESTIONS:
                result = retriever.search(req(intent, question, m_star))
                assert_knowledge_contract(result.to_response())
                for chunk in result.chunks + result.expansions:
                    seen += 1
                    assert in_scope(chunk, rule.domains, registered), (intent, m_star, question, chunk["id"])
        assert seen, "the property must have had something to check"

    def test_explain_looks_in_d1_only_and_news_in_d5_only(self, retriever: Retriever):
        explain = retriever.search(req("EXPLAIN", "What is a channel?", m_star=["MCD1"]))
        assert explain.chunks and all(c["domain"] == "D1" for c in explain.chunks + explain.expansions)
        news = retriever.search(req("NEWS", "Is there a blackout before the release?"))
        assert [c["id"] for c in news.chunks] == ["t.d5.governance.news-blackout-window"]

    def test_the_instant_prompt_searches_d1_d3_and_the_playbooks_of_its_sensors(self, retriever: Retriever):
        result = retriever.search(
            req("INSTANT_M5_INSPECT", "Explain the current M5 reading for gold and what it implies for the trader type", ["MCD2", "MCD3"])
        )
        domains = {c["domain"] for c in result.chunks}
        assert domains <= {"D1", "D2", "D3"}
        assert all(c["mcd_id"] in ("MCD2", "MCD3") for c in result.chunks if c["domain"] == "D2")

    def test_no_scope_means_no_search_and_never_an_unfiltered_one(self, loaded, matrix, tags, index_config):
        retriever, spy = spied(loaded, matrix, tags, index_config)
        for intent in ("REPORT_2", "OUT_OF_SCOPE"):
            result = retriever.search(req(intent, "anything at all", ["MCD1", "MCD2"]))
            assert (result.status, result.chunks, result.expansions) == ("EMPTY", [], [])
            assert result.index_build_id == loaded.build_id
        assert spy.calls == []

    def test_a_scope_with_nothing_in_it_does_not_search_either(self, loaded, tags, index_config):
        raw = {
            "schema": "dispatch-matrix/1",
            "version": "routing-v1",
            "intents": {"DIRECTION": {"domains": [], "playbooks": "M_STAR"}},
        }
        retriever, spy = spied(loaded, parse_matrix(raw, tags), tags, index_config)
        result = retriever.search(req("DIRECTION", "breakout", m_star=["MCD1' OR 1=1 --"]))
        assert result.status == "EMPTY" and spy.calls == []

    def test_the_window_of_candidates_limits_what_the_filter_can_see(self, loaded, matrix, tags, index_config):
        """D11 (c): the filter acts on the first `candidates` hits. With a window of 1 an out-of-scope best hit hides
        everything; the recall test of part 9 decides if 40 is wide enough for the real corpus."""
        narrow = Retriever(loaded, matrix, tags, dataclasses.replace(index_config, candidates=1, limit=1))
        wide = Retriever(loaded, matrix, tags, index_config)
        questions = [
            "counter-trend rally invalidation and stand aside",
            "half risk sizing and the stop behind structure",
            "news blackout window around a release",
        ]
        for question in questions:
            request = req("EXPLAIN", question)  # Explain reads foundations only (D1)
            query = plan_of(request, matrix, tags, index_config).query_text  # the template is part of the query
            best = loaded.embeddings.search(
                "SELECT id, domain, mcd_id FROM txtai WHERE similar(:q, 1) LIMIT 1", limit=1, weights=0.7, parameters={"q": query}
            )[0]
            if best["domain"] != "D1":
                assert narrow.search(request).status == "EMPTY", "the best hit overall is out of scope and hides the rest"
                assert wide.search(request).status == "OK", "a window of 40 reaches the in-scope chunks"
                return
        pytest.fail("the fixture corpus must have a question whose best hit is outside D1")

    def test_the_search_call_carries_the_plan_and_the_pinned_weights(self, loaded, matrix, tags, index_config):
        retriever, spy = spied(loaded, matrix, tags, index_config)
        request = req(m_star=["MCD3", "MCD1"])
        result = retriever.search(request)
        (args, kwargs), = spy.calls
        assert args == (SQL_DIRECTION_BOTH,)
        assert kwargs["weights"] == 0.7
        assert kwargs["limit"] == 4
        assert kwargs["parameters"] == dict(result.plan.parameters)
        assert kwargs["parameters"]["q"] == result.plan.query_text

    def test_a_chunk_is_exactly_the_packets_seven_fields(self, retriever: Retriever, loaded: LoadedIndex):
        result = retriever.search(req(m_star=["MCD1"]))
        assert result.chunks
        for chunk in result.chunks + result.expansions:
            assert set(chunk) == {"id", "domain", "mcd_id", "state_codes", "timeframe", "version", "text"}
            stored = loaded.chunks[chunk["id"]]
            assert chunk["text"] == stored["text"] and chunk["state_codes"] == stored["state_codes"]
            assert len(chunk["text"]) <= 4000

    def test_the_answer_is_the_same_every_time(self, retriever: Retriever):
        first = retriever.search(req(m_star=["MCD1", "MCD3"])).to_response()
        assert all(retriever.search(req(m_star=["MCD3", "MCD1"])).to_response() == first for _ in range(3))

    def test_a_state_code_in_the_query_pulls_its_playbook_up(self, retriever: Retriever):
        plain = retriever.search(req("DIRECTION", "tell me more", m_star=["MCD3"]))
        coded = retriever.search(req("DIRECTION", "tell me more", m_star=["MCD3"], state_codes=["MCD3_NON_CONSOLIDATED_TREND_CONFLICT"]))
        assert_knowledge_contract(coded.to_response())
        ids = [c["id"] for c in coded.chunks]
        assert "t.d2.mcd3.trend-conflict-between-the-two-timeframes" in ids or "t.d3.synthesis.when-the-synthesis-stands-aside" in ids
        assert plain.status == "OK"


# ===========================================================================
# ordering and expansions: the logic, with stored records (the search under it is tested above)
# ===========================================================================


def rec(chunk_id, domain, mcd=None, related=(), tokens=100):
    return {
        "id": chunk_id,
        "domain": domain,
        "mcd_id": mcd,
        "state_codes": [],
        "timeframe": None,
        "version": "1.0.0",
        "text": f"text of {chunk_id}",
        "related": list(related),
        "tokens": tokens,
    }


class FakeEmbeddings:
    def __init__(self, rows):
        self.rows = rows
        self.calls = 0

    def search(self, *args, **kwargs):
        self.calls += 1
        return list(self.rows)


def stub_retriever(records, rows, matrix, tags, config) -> Retriever:
    chunks = {r["id"]: r for r in records}
    loaded = LoadedIndex(embeddings=FakeEmbeddings(rows), chunks=chunks, metadata={"index_build_id": "kb-" + "0" * 32})
    return Retriever(loaded, matrix, tags, config)


def everything_matrix(tags: Tags) -> Matrix:
    raw = {
        "schema": "dispatch-matrix/1",
        "version": "routing-v1",
        "intents": {
            "DIRECTION": {"domains": ["D1", "D3", "D4", "D5"], "playbooks": "M_STAR"},
        },
    }
    return parse_matrix(raw, tags)


class TestTheOrderOfAnAnswer:
    def test_foundations_playbook_synthesis_risk_governance(self, tags, index_config):
        records = [rec("a5", "D5"), rec("a1", "D1"), rec("a3", "D3"), rec("a2", "D2", "MCD1"), rec("a4", "D4")]
        scores = {"a5": 0.9, "a4": 0.7, "a2": 0.6, "a3": 0.5, "a1": 0.1}
        rows = [{"id": i, "score": s} for i, s in scores.items()]
        retriever = stub_retriever(records, rows, everything_matrix(tags), tags, dataclasses.replace(index_config, limit=5))
        result = retriever.search(req("DIRECTION", "q", ["MCD1"]))
        assert [c["id"] for c in result.chunks] == ["a1", "a2", "a3", "a4", "a5"], "by domain, not by score"

    def test_within_a_domain_the_better_score_first_then_the_id(self, tags, index_config):
        records = [rec("d3.b", "D3"), rec("d3.a", "D3"), rec("d3.c", "D3"), rec("d1.x", "D1")]
        rows = [{"id": "d3.b", "score": 0.4}, {"id": "d3.a", "score": 0.4}, {"id": "d3.c", "score": 0.8}, {"id": "d1.x", "score": 0.1}]
        retriever = stub_retriever(records, rows, everything_matrix(tags), tags, index_config)
        assert [c["id"] for c in retriever.search(req("DIRECTION", "q")).chunks] == ["d1.x", "d3.c", "d3.a", "d3.b"]

    def test_only_the_four_best_are_kept_when_more_come_back(self, tags, index_config):
        records = [rec(f"c{i}", "D3") for i in range(6)]
        rows = [{"id": f"c{i}", "score": 0.1 * (i + 1)} for i in range(6)]
        retriever = stub_retriever(records, rows, everything_matrix(tags), tags, index_config)
        assert [c["id"] for c in retriever.search(req("DIRECTION", "q")).chunks] == ["c5", "c4", "c3", "c2"]

    def test_a_row_outside_the_scope_is_dropped_even_if_the_sql_let_it_through(self, tags, index_config, caplog):
        records = [rec("ok", "D3"), rec("leak", "D2", "MCD2"), rec("also", "D4"), rec("ghost", "D3")]
        rows = [{"id": "leak", "score": 0.9}, {"id": "ok", "score": 0.5}, {"id": "also", "score": 0.4}, {"id": "not-in-index", "score": 0.3}]
        raw = {"schema": "dispatch-matrix/1", "version": "routing-v1", "intents": {"DIRECTION": {"domains": ["D3", "D5"], "playbooks": "M_STAR"}}}
        retriever = stub_retriever(records, rows, parse_matrix(raw, tags), tags, index_config)
        result = retriever.search(req("DIRECTION", "q", ["MCD1"]))
        assert [c["id"] for c in result.chunks] == ["ok"]

    def test_zero_rows_is_empty_and_names_the_build(self, tags, index_config):
        retriever = stub_retriever([rec("a", "D3")], [], everything_matrix(tags), tags, index_config)
        result = retriever.search(req("DIRECTION", "q"))
        assert (result.status, result.chunks, result.expansions) == ("EMPTY", [], [])
        assert result.to_response()["index_build_id"] == "kb-" + "0" * 32


class TestExpansions:
    def pack(self, tags, config, records, hit_ids, m_star=("MCD1",)):
        rows = [{"id": i, "score": 1.0 - 0.1 * n} for n, i in enumerate(hit_ids)]
        retriever = stub_retriever(records, rows, everything_matrix(tags), tags, config)
        return retriever.search(req("DIRECTION", "q", m_star))

    def test_the_chunks_named_in_related_follow_the_pack_in_order(self, tags, index_config):
        records = [
            rec("main", "D3", related=["x.one", "x.two"]),
            rec("x.one", "D3"),
            rec("x.two", "D4"),
        ]
        result = self.pack(tags, index_config, records, ["main"])
        assert [c["id"] for c in result.chunks] == ["main"]
        assert [c["id"] for c in result.expansions] == ["x.one", "x.two"]

    def test_the_same_scope_applies_to_them(self, tags, index_config):
        records = [
            rec("main", "D3", related=["in.d3", "pb.mcd1", "pb.mcd2", "found.d1"]),
            rec("in.d3", "D3"),
            rec("pb.mcd1", "D2", "MCD1"),
            rec("pb.mcd2", "D2", "MCD2"),
            rec("found.d1", "D1"),
        ]
        raw = {"schema": "dispatch-matrix/1", "version": "routing-v1", "intents": {"DIRECTION": {"domains": ["D3", "D5"], "playbooks": "M_STAR"}}}
        retriever = stub_retriever(records, [{"id": "main", "score": 1.0}], parse_matrix(raw, tags), tags, index_config)
        result = retriever.search(req("DIRECTION", "q", ["MCD1"]))
        assert [c["id"] for c in result.expansions] == ["in.d3", "pb.mcd1"]

    def test_a_chunk_already_in_the_pack_a_missing_one_and_the_chunk_itself_are_skipped(self, tags, index_config):
        records = [
            rec("a", "D3", related=["b", "gone", "a", "c"]),
            rec("b", "D3", related=["a"]),
            rec("c", "D3"),
        ]
        result = self.pack(tags, index_config, records, ["a", "b"])
        assert [c["id"] for c in result.chunks] == ["a", "b"]
        assert [c["id"] for c in result.expansions] == ["c"]

    def test_the_same_chunk_named_twice_is_added_once(self, tags, index_config):
        records = [rec("a", "D3", related=["x"]), rec("b", "D3", related=["x"]), rec("x", "D4")]
        assert [c["id"] for c in self.pack(tags, index_config, records, ["a", "b"]).expansions] == ["x"]

    def test_at_most_six(self, tags, index_config):
        related = [f"r{i}" for i in range(9)]
        records = [rec("main", "D3", related=related)] + [rec(r, "D4", tokens=10) for r in related]
        result = self.pack(tags, index_config, records, ["main"])
        assert [c["id"] for c in result.expansions] == related[:6]

    def test_only_while_the_knowledge_budget_allows(self, tags, index_config):
        records = [
            rec("main", "D3", related=["big", "small", "fits.later"], tokens=1850),
            rec("big", "D4", tokens=300),
            rec("small", "D4", tokens=100),
            rec("fits.later", "D4", tokens=60),
        ]
        result = self.pack(tags, index_config, records, ["main"])
        # 1850 + 300 is over 2000 and is skipped; 1850 + 100 fits; 1950 + 60 is over
        assert [c["id"] for c in result.expansions] == ["small"]

    def test_a_pack_already_over_the_budget_gets_no_expansion(self, tags, index_config):
        records = [rec("a", "D3", related=["x"], tokens=1200), rec("b", "D3", tokens=1200), rec("x", "D4", tokens=1)]
        assert self.pack(tags, index_config, records, ["a", "b"]).expansions == []

    def test_the_pack_itself_is_never_cut_by_the_budget(self, tags, index_config):
        records = [rec(f"c{i}", "D3", tokens=900) for i in range(4)]
        result = self.pack(tags, index_config, records, [f"c{i}" for i in range(4)])
        assert len(result.chunks) == 4 and result.expansions == []

    def test_the_numbers_come_from_the_configuration(self, tags, index_config):
        config = dataclasses.replace(index_config, expansions_max=1)
        records = [rec("m", "D3", related=["a", "b"]), rec("a", "D4"), rec("b", "D4")]
        assert [c["id"] for c in self.pack(tags, config, records, ["m"]).expansions] == ["a"]

    def test_the_fixture_corpus_expands_across_a_real_search(self, loaded, matrix, tags, index_config):
        # t.d3.synthesis relates to t.d1.channel.what-a-channel-is, which INSTANT_M5_INSPECT may read (D1 and D3)
        retriever = Retriever(loaded, matrix, tags, dataclasses.replace(index_config, limit=1))
        result = retriever.search(req("INSTANT_M5_INSPECT", "counter-trend rally invalidation bias", ["MCD2"]))
        assert [c["id"] for c in result.chunks] == ["t.d3.synthesis.counter-trend-rally"]
        assert "t.d1.channel.what-a-channel-is" in [c["id"] for c in result.expansions]
        assert_knowledge_contract(result.to_response())


def test_the_unavailable_pack_is_what_the_packet_accepts():
    assert unavailable_response() == {"status": "UNAVAILABLE", "index_build_id": None, "chunks": [], "expansions": []}
    assert_knowledge_contract(unavailable_response(), status="UNAVAILABLE")


# ===========================================================================
# 4.11 item 6: normalisation on, weights 0.7, and a test that fails if either changes
# ===========================================================================

QUERY = "broken vehicle repair"
KEYWORD_STUFFED = "repair vehicle broken repair vehicle broken stock keeping unit shelf label barcode"
KEYWORD_LIGHT = "The vehicle was parked outside the harbour office on Tuesday while the staff ate lunch and talked about the weather."
MEANING_ONLY = "A mechanic fixes damaged cars and trucks in the workshop garage."
OTHERS = [
    ("other1", "The committee approved the annual budget for the municipal library."),
    ("other2", "Clouds gather over the mountain range before the evening storm."),
]


def tiny(config: dict[str, Any], keyword_text: str):
    from txtai import Embeddings

    embeddings = Embeddings(config)
    embeddings.index([("keyword", {"text": keyword_text}, None), ("meaning", {"text": MEANING_ONLY}, None), *[(i, {"text": t}, None) for i, t in OTHERS]])
    return embeddings


def ranked(embeddings, weights: float) -> list[tuple[str, float]]:
    rows = embeddings.search(
        "SELECT id, score FROM txtai WHERE similar(:q, 4) LIMIT 4", limit=4, weights=weights, parameters={"q": QUERY}
    )
    return [(r["id"], float(r["score"])) for r in rows]


@pytest.fixture(scope="module")
def tiny_normalized_stuffed(index_config, model_dir):
    return tiny(index_config.embeddings_config(model_dir), KEYWORD_STUFFED)


@pytest.fixture(scope="module")
def tiny_normalized_light(index_config, model_dir):
    return tiny(index_config.embeddings_config(model_dir), KEYWORD_LIGHT)


@pytest.fixture(scope="module")
def tiny_rank_fused_stuffed(index_config, model_dir):
    config = index_config.embeddings_config(model_dir)
    config["scoring"]["normalize"] = False  # what the service forbids: built by hand to show what it would change
    return tiny(config, KEYWORD_STUFFED)


class TestTheHybridSettingsArePinned:
    def test_txtai_is_exactly_9_5_0(self, built):
        assert importlib_metadata.version("txtai") == "9.5.0"
        assert txtai_version() == "9.5.0"
        assert built.metadata["inputs"]["txtai_version"] == "9.5.0"
        assert "txtai==9.5.0" in (SERVICE_ROOT / "requirements.txt").read_text(encoding="utf-8").split()

    def test_the_file_says_normalise_and_0_7(self, index_config):
        raw = yaml.safe_load((CONFIG_DIR / "index.yaml").read_text(encoding="utf-8"))
        assert raw["search"]["weights"] == 0.7
        assert raw["embeddings"]["scoring"] == {"method": "bm25", "terms": True, "normalize": True}
        assert index_config.weights == 0.7

    def test_the_built_index_has_normalised_keyword_scores(self, loaded: LoadedIndex):
        assert loaded.embeddings.scoring.isnormalized() is True
        assert loaded.embeddings.isdense() and loaded.embeddings.issparse()
        assert loaded.embeddings.config["scoring"] == {"method": "bm25", "terms": True, "normalize": True}

    def test_a_configuration_with_normalisation_off_cannot_be_loaded(self):
        raw = yaml.safe_load((CONFIG_DIR / "index.yaml").read_text(encoding="utf-8"))
        raw["embeddings"]["scoring"]["normalize"] = False
        with pytest.raises(ConfigError):
            parse_index_config(raw)

    def test_the_service_searches_with_weights_0_7(self, loaded, matrix, tags, index_config):
        spying, spy = spied(loaded, matrix, tags, index_config)
        spying.search(req(m_star=["MCD1"]))
        assert [kwargs["weights"] for _, kwargs in spy.calls] == [0.7]

    def test_the_fusion_on_the_service_s_own_index_is_the_convex_combination(self, loaded, index_config):
        assert verify_fusion(loaded, index_config) == []
        assert verify_index(loaded, index_config) == []

    @pytest.mark.parametrize("weights", [0.1, 0.3, 0.5, 0.7, 0.9])
    def test_whatever_the_weight_w_means_w_dense_plus_one_minus_w_keyword(self, loaded, weights):
        texts = {chunk_id: record["text"] for chunk_id, record in loaded.chunks.items()}
        for query in ("breakout above the upper band", "half risk sizing", "news blackout release", "stand aside"):
            assert fusion_mismatches(loaded.embeddings, len(loaded.chunks), query, weights, texts) == []


class TestWhatTheWeightsDoToTheOrder:
    """A crafted keyword-only document against a meaning-only one (the model and txtai are real)."""

    def test_the_two_scores_really_differ_between_the_documents(self, tiny_normalized_light):
        dense = dict(ranked(tiny_normalized_light, 1.0))
        keyword = dict(ranked(tiny_normalized_light, 0.0))
        assert dense["meaning"] > dense["keyword"] + 0.2, "the meaning-only document wins on meaning"
        assert "meaning" not in keyword, "and it shares no word with the query, so the keyword index never returns it"
        assert keyword["keyword"] > 0.3

    def test_0_7_and_0_3_order_the_same_two_documents_differently(self, tiny_normalized_light):
        at_07 = ranked(tiny_normalized_light, 0.7)
        at_03 = ranked(tiny_normalized_light, 0.3)
        assert [i for i, _ in at_07][:2] == ["meaning", "keyword"]
        assert [i for i, _ in at_03][:2] == ["keyword", "meaning"]
        # by margins that no rounding could undo
        assert at_07[0][1] - at_07[1][1] > 0.1 and at_03[0][1] - at_03[1][1] > 0.1

    def test_the_scores_are_the_weighted_sum_of_the_two(self, tiny_normalized_light):
        dense, keyword = dict(ranked(tiny_normalized_light, 1.0)), dict(ranked(tiny_normalized_light, 0.0))
        for weights in (0.3, 0.7):
            for doc_id, score in ranked(tiny_normalized_light, weights):
                want = weights * dense.get(doc_id, 0.0) + (1 - weights) * keyword.get(doc_id, 0.0)
                assert score == pytest.approx(want, abs=1e-4)

    def test_normalised_keyword_scores_let_a_strong_keyword_match_win_at_0_7(self, tiny_normalized_stuffed):
        # dense says "meaning" by 0.09; the keyword score (normalised, 0.79) is worth 0.3 * 0.79 and outweighs it
        assert [i for i, _ in ranked(tiny_normalized_stuffed, 1.0)][0] == "meaning"
        assert [i for i, _ in ranked(tiny_normalized_stuffed, 0.7)][0] == "keyword"

    def test_the_same_documents_built_with_normalisation_off_come_out_differently(
        self, tiny_normalized_stuffed, tiny_rank_fused_stuffed
    ):
        assert tiny_normalized_stuffed.scoring.isnormalized() is True
        assert tiny_rank_fused_stuffed.scoring.isnormalized() is False
        # rank fusion at 0.7: the dense winner takes 0.7 and cannot be caught by 0.3 + 0.35
        assert [i for i, _ in ranked(tiny_rank_fused_stuffed, 0.7)][0] == "meaning"
        assert [i for i, _ in ranked(tiny_normalized_stuffed, 0.7)][0] == "keyword"

    def test_the_fusion_check_passes_on_a_normalised_index_and_fails_on_a_rank_fused_one(
        self, tiny_normalized_stuffed, tiny_rank_fused_stuffed
    ):
        texts = {"keyword": KEYWORD_STUFFED, "meaning": MEANING_ONLY, **dict(OTHERS)}
        assert fusion_mismatches(tiny_normalized_stuffed, 4, QUERY, 0.7, texts) == []
        wrong = fusion_mismatches(tiny_rank_fused_stuffed, 4, QUERY, 0.7, texts)
        assert wrong, "an index built with normalize: false must fail the check"
        # under rank fusion the dense-only result is 1, 1/2, 1/3 ..., not the model's cosine similarity
        assert {m.kind for m in wrong} == {"DENSE_NOT_COSINE"}
        assert {m.chunk_id for m in wrong} >= {"meaning", "keyword"}

    def test_the_rank_fused_dense_result_is_a_rank_sequence(self, tiny_rank_fused_stuffed):
        # the evidence behind the line above: rank scores, not similarities
        dense = [score for _, score in ranked(tiny_rank_fused_stuffed, 1.0)]
        assert dense[:2] == pytest.approx([1.0, 0.5])


class TestTheFusionCheckItself:
    """`fusion_mismatches` must not be blind to a wrong mix: shown with an index that answers as scripted."""

    class Scripted:
        def __init__(self, dense, keyword, fused):
            self.by_weights = {1.0: dense, 0.0: keyword, 0.7: fused}

        def search(self, sql, limit=None, weights=None, parameters=None):
            return [{"id": i, "score": s} for i, s in self.by_weights[weights].items()]

    def test_a_consistent_index_has_no_mismatch(self):
        scripted = self.Scripted({"a": 0.6, "b": 0.5}, {"a": 0.8}, {"a": 0.7 * 0.6 + 0.3 * 0.8, "b": 0.7 * 0.5})
        assert fusion_mismatches(scripted, 2, "q", 0.7) == []

    def test_a_mix_that_is_not_the_weighted_sum_is_reported_with_both_figures(self):
        scripted = self.Scripted({"a": 0.6, "b": 0.5}, {"a": 0.8}, {"a": 0.5, "b": 0.7 * 0.5})
        (wrong,) = fusion_mismatches(scripted, 2, "q", 0.7)
        assert (wrong.kind, wrong.chunk_id) == ("FUSED", "a")
        assert wrong.got == pytest.approx(0.5) and wrong.want == pytest.approx(0.7 * 0.6 + 0.3 * 0.8)

    def test_the_tolerance_is_about_a_ten_thousandth(self):
        near = self.Scripted({"a": 0.6}, {"a": 0.8}, {"a": 0.7 * 0.6 + 0.3 * 0.8 + 0.00005})
        far = self.Scripted({"a": 0.6}, {"a": 0.8}, {"a": 0.7 * 0.6 + 0.3 * 0.8 + 0.001})
        assert fusion_mismatches(near, 1, "q", 0.7) == []
        assert [m.chunk_id for m in fusion_mismatches(far, 1, "q", 0.7)] == ["a"]

    def test_the_weight_in_the_formula_is_the_one_that_was_searched(self):
        # these fused scores are the right mix for 0.3, not for 0.7
        scripted = self.Scripted({"a": 0.6}, {"a": 0.8}, {"a": 0.3 * 0.6 + 0.7 * 0.8})
        assert [m.kind for m in fusion_mismatches(scripted, 1, "q", 0.7)] == ["FUSED"]

    def test_an_empty_answer_is_a_mismatch_not_a_pass(self):
        scripted = self.Scripted({"a": 0.6}, {"a": 0.8}, {})
        assert [m.chunk_id for m in fusion_mismatches(scripted, 1, "q", 0.7)] == ["<empty>"]
