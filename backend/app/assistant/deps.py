"""Request-scoped dependencies for the document agent."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import date
from uuid import UUID

from app.retrieval.models import SourcePassage
from app.retrieval.retriever import DocumentRetriever

ProgressReporter = Callable[[str], Awaitable[None]]


async def _ignore_progress(_: str) -> None:
    """Provide a no-op reporter for tests and non-streaming callers."""


@dataclass(frozen=True)
class EvidencePassage:
    """Compact model-facing evidence with a run-local citation handle."""

    source_id: str
    content: str
    page_number: int | None
    section: str | None
    ticker: str
    company_name: str
    filing_type: str
    filing_date: date
    fiscal_year: int
    source_url: str


@dataclass
class DocumentAgentDeps:
    """Services and retrieved evidence available during one agent run."""

    user_id: UUID
    thread_id: UUID
    retriever: DocumentRetriever
    required_ticker_years: frozenset[tuple[str, int]] = frozenset()
    evidence: dict[str, SourcePassage] = field(default_factory=dict)
    source_ids_by_chunk: dict[UUID, str] = field(default_factory=dict)
    report_progress: ProgressReporter = _ignore_progress

    def remember(self, passages: list[SourcePassage]) -> list[EvidencePassage]:
        """Store passages and expose stable short handles for this run."""
        visible = []
        for passage in passages:
            source_id = self.source_ids_by_chunk.get(passage.chunk_id)
            if source_id is None:
                source_id = f"S{len(self.source_ids_by_chunk) + 1}"
                self.source_ids_by_chunk[passage.chunk_id] = source_id
                self.evidence[source_id] = passage
            visible.append(
                EvidencePassage(
                    source_id=source_id,
                    content=passage.content,
                    page_number=passage.page_number,
                    section=passage.section,
                    ticker=passage.ticker,
                    company_name=passage.company_name,
                    filing_type=passage.filing_type,
                    filing_date=passage.filing_date,
                    fiscal_year=passage.fiscal_year,
                    source_url=passage.source_url,
                )
            )
        return visible
