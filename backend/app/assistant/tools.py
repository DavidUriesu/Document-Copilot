"""Bounded filing-retrieval tools exposed to the document agent."""

import asyncio
from typing import Annotated

from pydantic import Field
from pydantic_ai import RunContext

from app.assistant.deps import DocumentAgentDeps, EvidencePassage
from app.retrieval.models import RetrievalFilters

MAX_SEARCH_RESULTS = 12
MAX_NEIGHBOR_WINDOW = 2
SearchLimit = Annotated[int, Field(ge=1, le=MAX_SEARCH_RESULTS)]
NeighborWindow = Annotated[int, Field(ge=0, le=MAX_NEIGHBOR_WINDOW)]


class RetrievalError(RuntimeError):
    """Raised when a filing lookup cannot be completed."""


async def search_filings(
    ctx: RunContext[DocumentAgentDeps],
    query: str,
    tickers: list[str] | None = None,
    filing_types: list[str] | None = None,
    start_year: int | None = None,
    end_year: int | None = None,
    limit: SearchLimit = 8,
) -> list[EvidencePassage]:
    """Search filings using a concise evidence phrase and explicit scope filters.

    Do not pass the user's complete conversational question. Use a few terms
    likely to occur in one passage and issue separate searches for independent
    topics, companies, or periods.
    """
    if not 1 <= limit <= MAX_SEARCH_RESULTS:
        raise ValueError(f"limit must be between 1 and {MAX_SEARCH_RESULTS}")
    await ctx.deps.report_progress("searching")
    try:
        required_tickers = {
            ticker for ticker, _ in ctx.deps.required_ticker_years
        }
        active_tickers = tuple(
            ticker.upper() for ticker in (tickers or sorted(required_tickers))
        )
        active_filing_types = tuple(filing_types or ())
        required_years = {
            year
            for ticker, year in ctx.deps.required_ticker_years
            if ticker in active_tickers
        }
        effective_start_year = start_year
        effective_end_year = end_year
        if required_years:
            effective_start_year = start_year or min(required_years)
            effective_end_year = end_year or max(required_years)
        passages = await ctx.deps.retriever.search(
            query,
            RetrievalFilters(
                tickers=active_tickers,
                filing_types=active_filing_types,
                fiscal_year_from=effective_start_year,
                fiscal_year_to=effective_end_year,
            ),
            limit=limit,
            neighbor_window=0,
        )
        endpoint_years = {
            year
            for year in (effective_start_year, effective_end_year)
            if year is not None
        }
        present = {(passage.ticker, passage.fiscal_year) for passage in passages}
        missing_endpoints = [
            (ticker.upper(), year)
            for ticker in active_tickers
            for year in sorted(endpoint_years)
            if (ticker.upper(), year) not in present
        ]
        if missing_endpoints:
            supplemental = await asyncio.gather(
                *(
                    ctx.deps.retriever.search(
                        query,
                        RetrievalFilters(
                            tickers=(ticker,),
                            filing_types=active_filing_types,
                            fiscal_year_from=year,
                            fiscal_year_to=year,
                        ),
                        limit=min(limit, 2),
                        neighbor_window=0,
                    )
                    for ticker, year in missing_endpoints
                )
            )
            seen = {passage.chunk_id for passage in passages}
            for results in supplemental:
                for passage in results:
                    if passage.chunk_id in seen:
                        continue
                    passages.append(passage)
                    seen.add(passage.chunk_id)
    except Exception as exc:
        raise RetrievalError("Filing search failed") from exc
    visible = ctx.deps.remember(passages)
    await ctx.deps.report_progress("drafting")
    return visible


async def read_chunk(
    ctx: RunContext[DocumentAgentDeps], source_id: str
) -> EvidencePassage:
    """Read an exact chunk that was already returned by a filing search."""
    passage = ctx.deps.evidence.get(source_id)
    if passage is None:
        raise ValueError("Use a source ID returned by a filing search")
    await ctx.deps.report_progress("reading")
    await ctx.deps.report_progress("drafting")
    return ctx.deps.remember([passage])[0]


async def read_surrounding_chunks(
    ctx: RunContext[DocumentAgentDeps],
    source_id: str,
    window: NeighborWindow = 1,
) -> list[EvidencePassage]:
    """Expand an already-seen chunk with bounded same-filing context."""
    seed = ctx.deps.evidence.get(source_id)
    if seed is None:
        raise ValueError("Use a source ID returned by a filing search")
    if not 0 <= window <= MAX_NEIGHBOR_WINDOW:
        raise ValueError(f"window must be between 0 and {MAX_NEIGHBOR_WINDOW}")
    await ctx.deps.report_progress("reading")
    try:
        passages = await ctx.deps.retriever.read_surrounding_chunks(
            seed.chunk_id, window
        )
    except Exception as exc:
        raise RetrievalError("Filing passage lookup failed") from exc
    visible = ctx.deps.remember(passages)
    await ctx.deps.report_progress("drafting")
    return visible
