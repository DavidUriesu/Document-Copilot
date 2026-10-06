"""Tests for bounded document-agent tools."""

import asyncio
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from app.assistant.deps import DocumentAgentDeps
from app.assistant.tools import read_chunk, read_surrounding_chunks, search_filings
from tests.grounding.test_validator import CHUNK, passage


def context(retriever) -> SimpleNamespace:
    return SimpleNamespace(
        deps=DocumentAgentDeps(
            user_id=UUID(int=0),
            thread_id=UUID(int=0),
            retriever=retriever,
            report_progress=AsyncMock(),
        )
    )


def test_search_records_every_returned_passage() -> None:
    source = passage()
    retriever = SimpleNamespace(search=AsyncMock(return_value=[source]))
    ctx = context(retriever)
    result = asyncio.run(search_filings(ctx, "services", tickers=["AAPL"]))
    assert result[0].source_id == "S1"
    assert result[0].content == source.content
    assert ctx.deps.evidence == {"S1": source}
    assert retriever.search.await_args.kwargs["neighbor_window"] == 0
    assert [call.args[0] for call in ctx.deps.report_progress.await_args_list] == [
        "searching",
        "drafting",
    ]


def test_read_chunk_requires_search_first() -> None:
    ctx = context(SimpleNamespace())
    with pytest.raises(ValueError, match="source ID"):
        asyncio.run(read_chunk(ctx, "S1"))


def test_search_supplements_missing_endpoint_years() -> None:
    older = replace(passage(), fiscal_year=2021)
    latest = replace(
        passage(),
        chunk_id=UUID("00000000-0000-0000-0000-000000000002"),
        fiscal_year=2025,
    )
    retriever = SimpleNamespace(
        search=AsyncMock(side_effect=[[older], [latest]])
    )
    ctx = context(retriever)

    result = asyncio.run(
        search_filings(
            ctx,
            "services net sales",
            tickers=["AAPL"],
            start_year=2021,
            end_year=2025,
        )
    )

    assert [item.source_id for item in result] == ["S1", "S2"]
    assert retriever.search.await_count == 2
    supplemental_filters = retriever.search.await_args_list[1].args[1]
    assert supplemental_filters.tickers == ("AAPL",)
    assert supplemental_filters.fiscal_year_from == 2025
    assert supplemental_filters.fiscal_year_to == 2025


def test_search_applies_question_coverage_when_model_omits_filters() -> None:
    older = replace(passage(), fiscal_year=2021)
    latest = replace(
        passage(),
        chunk_id=UUID("00000000-0000-0000-0000-000000000002"),
        fiscal_year=2025,
    )
    retriever = SimpleNamespace(search=AsyncMock(side_effect=[[latest], [older]]))
    ctx = context(retriever)
    ctx.deps.required_ticker_years = frozenset(
        {("AAPL", 2021), ("AAPL", 2025)}
    )

    result = asyncio.run(search_filings(ctx, "services net sales"))

    assert {item.fiscal_year for item in result} == {2021, 2025}
    initial_filters = retriever.search.await_args_list[0].args[1]
    assert initial_filters.tickers == ("AAPL",)
    assert initial_filters.fiscal_year_from == 2021
    assert initial_filters.fiscal_year_to == 2025


def test_surrounding_read_records_new_evidence() -> None:
    source = passage()
    retriever = SimpleNamespace(
        read_surrounding_chunks=AsyncMock(return_value=[source])
    )
    ctx = context(retriever)
    ctx.deps.remember([source])
    result = asyncio.run(read_surrounding_chunks(ctx, "S1", 2))
    assert result[0].source_id == "S1"
    retriever.read_surrounding_chunks.assert_awaited_once_with(CHUNK, 2)
    assert [call.args[0] for call in ctx.deps.report_progress.await_args_list] == [
        "reading",
        "drafting",
    ]
