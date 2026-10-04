"""Tests for bounded document-agent tools."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.assistant.tools import read_chunk, read_surrounding_chunks, search_filings
from tests.grounding.test_validator import CHUNK, passage


def context(retriever) -> SimpleNamespace:
    return SimpleNamespace(
        deps=SimpleNamespace(
            retriever=retriever,
            evidence={},
            report_progress=AsyncMock(),
        )
    )


def test_search_records_every_returned_passage() -> None:
    source = passage()
    retriever = SimpleNamespace(search=AsyncMock(return_value=[source]))
    ctx = context(retriever)
    result = asyncio.run(search_filings(ctx, "services", tickers=["AAPL"]))
    assert result == [source]
    assert ctx.deps.evidence == {CHUNK: source}
    assert [call.args[0] for call in ctx.deps.report_progress.await_args_list] == [
        "searching",
        "drafting",
    ]


def test_read_chunk_requires_search_first() -> None:
    ctx = context(SimpleNamespace())
    with pytest.raises(ValueError, match="Search"):
        asyncio.run(read_chunk(ctx, CHUNK))


def test_surrounding_read_records_new_evidence() -> None:
    source = passage()
    retriever = SimpleNamespace(
        read_surrounding_chunks=AsyncMock(return_value=[source])
    )
    ctx = context(retriever)
    ctx.deps.evidence[CHUNK] = source
    result = asyncio.run(read_surrounding_chunks(ctx, CHUNK, 2))
    assert result == [source]
    retriever.read_surrounding_chunks.assert_awaited_once_with(CHUNK, 2)
    assert [call.args[0] for call in ctx.deps.report_progress.await_args_list] == [
        "reading",
        "drafting",
    ]
