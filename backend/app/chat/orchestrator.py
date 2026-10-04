"""Coordinate one grounded assistant turn from history through persistence."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from openai import AsyncOpenAI
from pydantic_ai import Agent
from pydantic_ai.usage import UsageLimits
from supabase import AsyncClient

from app.assistant.agent import (
    MAX_AGENT_REQUESTS,
    MAX_AGENT_TOOL_CALLS,
    document_agent,
)
from app.assistant.deps import DocumentAgentDeps, ProgressReporter
from app.assistant.outputs import CitationView, GroundedAnswer
from app.assistant.tools import RetrievalError
from app.chat.messages import PersistedMessage, model_history
from app.database.chats import append_grounded_turn, list_messages
from app.grounding.validator import GroundingError, validate_grounded_answer
from app.retrieval.retriever import DocumentRetriever


@dataclass(frozen=True)
class CompletedTurn:
    """Validated and persisted assistant output ready for streaming."""

    message_id: UUID
    answer: str
    parts: list[dict[str, object]]
    citations: list[CitationView]
    answer_status: str


class ChatTurnError(RuntimeError):
    """A chat failure reduced to a safe client-facing category."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


async def run_chat_turn(
    *,
    user_id: UUID,
    thread_id: UUID,
    user_message: PersistedMessage,
    user_client: AsyncClient,
    openai_client: AsyncOpenAI,
    assistant_message_id: UUID,
    report_progress: ProgressReporter | None = None,
    agent: Agent = document_agent,
) -> CompletedTurn:
    """Generate, validate, and atomically persist one complete chat turn."""
    async def ignore_progress(_: str) -> None:
        return None

    progress = report_progress or ignore_progress
    await progress("preparing")
    rows = await list_messages(user_client, thread_id)
    deps = DocumentAgentDeps(
        user_id=user_id,
        thread_id=thread_id,
        retriever=DocumentRetriever(user_client, openai_client),
        report_progress=progress,
    )
    await progress("drafting")
    try:
        result = await agent.run(
            user_message.content,
            deps=deps,
            message_history=model_history(rows),
            usage_limits=UsageLimits(
                request_limit=MAX_AGENT_REQUESTS,
                tool_calls_limit=MAX_AGENT_TOOL_CALLS,
            ),
        )
    except RetrievalError as exc:
        raise ChatTurnError("retrieval_failed") from exc
    except Exception as exc:
        raise ChatTurnError("upstream_failed") from exc
    output: GroundedAnswer = result.output
    await progress("checking")
    try:
        citations = validate_grounded_answer(output, deps.evidence)
    except GroundingError as exc:
        raise ChatTurnError("grounding_failed") from exc
    parts: list[dict[str, object]] = [
        {"type": "text", "text": output.answer},
        {"type": "data-answer-meta", "data": {"status": output.status}},
    ]
    parts.extend(
        {
            "type": "data-citation",
            "data": citation.model_dump(mode="json", by_alias=True),
        }
        for citation in citations
    )
    assistant_message = PersistedMessage(content=output.answer, parts=parts)
    await progress("saving")
    try:
        _, assistant_message_id = await append_grounded_turn(
            user_client,
            thread_id,
            user_message,
            assistant_message,
            citations,
            assistant_message_id=assistant_message_id,
        )
    except Exception as exc:
        raise ChatTurnError("persistence_failed") from exc
    return CompletedTurn(
        message_id=assistant_message_id,
        answer=output.answer,
        parts=parts,
        citations=citations,
        answer_status=output.status,
    )
