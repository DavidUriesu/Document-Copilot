"""Tests for grounded chat-turn orchestration."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID

from app.assistant.agent import MAX_AGENT_REQUESTS, MAX_AGENT_TOOL_CALLS
from app.assistant.outputs import CitationRef, GroundedAnswer
from app.chat.messages import PersistedMessage
from app.chat.orchestrator import run_chat_turn
from tests.grounding.test_validator import CHUNK, passage

USER = UUID("10000000-0000-0000-0000-000000000009")
THREAD = UUID("20000000-0000-0000-0000-000000000009")
ASSISTANT = UUID("40000000-0000-0000-0000-000000000009")


def test_turn_validates_and_persists_before_returning() -> None:
    output = GroundedAnswer(
        status="grounded",
        answer="Services net sales increased. [1]",
        citations=[
            CitationRef(
                chunk_id=CHUNK,
                excerpt="Services net sales increased during 2025",
            )
        ],
    )

    async def run_agent(*args, **kwargs):
        kwargs["deps"].evidence[CHUNK] = passage()
        return SimpleNamespace(output=output)

    agent = SimpleNamespace(run=AsyncMock(side_effect=run_agent))
    persist = AsyncMock(return_value=(UUID(int=8), ASSISTANT))
    user_message = PersistedMessage(
        "How did Services change?",
        [{"type": "text", "text": "How did Services change?"}],
    )
    progress = AsyncMock()

    with (
        patch("app.chat.orchestrator.list_messages", AsyncMock(return_value=[])),
        patch("app.chat.orchestrator.append_grounded_turn", persist),
    ):
        result = asyncio.run(
            run_chat_turn(
                user_id=USER,
                thread_id=THREAD,
                user_message=user_message,
                user_client=object(),
                openai_client=object(),
                assistant_message_id=ASSISTANT,
                report_progress=progress,
                agent=agent,
            )
        )

    assert result.message_id == ASSISTANT
    assert result.citations[0].ticker == "AAPL"
    assert result.parts[1] == {
        "type": "data-answer-meta",
        "data": {"status": "grounded"},
    }
    assert result.parts[2]["type"] == "data-citation"
    assert result.parts[2]["data"]["companyName"] == "Apple Inc."
    assert result.parts[2]["data"]["filingDate"] == "2025-10-31"
    assert "company_name" not in result.parts[2]["data"]
    assert result.answer_status == "grounded"
    limits = agent.run.await_args.kwargs["usage_limits"]
    assert limits.request_limit == MAX_AGENT_REQUESTS
    assert limits.tool_calls_limit == MAX_AGENT_TOOL_CALLS
    persist.assert_awaited_once()
    assert persist.await_args.kwargs["assistant_message_id"] == ASSISTANT
    assert [call.args[0] for call in progress.await_args_list] == [
        "preparing",
        "drafting",
        "checking",
        "saving",
    ]
