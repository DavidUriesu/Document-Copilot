"""Request-scoped dependencies for the document agent."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from uuid import UUID

from app.retrieval.models import SourcePassage
from app.retrieval.retriever import DocumentRetriever

ProgressReporter = Callable[[str], Awaitable[None]]


async def _ignore_progress(_: str) -> None:
    """Provide a no-op reporter for tests and non-streaming callers."""


@dataclass
class DocumentAgentDeps:
    """Services and retrieved evidence available during one agent run."""

    user_id: UUID
    thread_id: UUID
    retriever: DocumentRetriever
    evidence: dict[UUID, SourcePassage] = field(default_factory=dict)
    report_progress: ProgressReporter = _ignore_progress
