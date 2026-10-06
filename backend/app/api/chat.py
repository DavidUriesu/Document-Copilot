"""Authenticated chat thread and streaming API."""

import asyncio
from collections.abc import AsyncIterator
from contextlib import suppress
from datetime import datetime
from time import perf_counter
from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict, Field, field_validator
from supabase import AsyncClient

from app.assistant.outputs import CitationView
from app.auth.dependencies import CurrentUser, get_current_user
from app.chat.messages import ChatStreamRequest, submitted_user_message
from app.chat.orchestrator import ChatTurnError, CompletedTurn, run_chat_turn
from app.chat.streaming import (
    answer_meta_event,
    citation_event,
    error_event,
    finish_events,
    reply_chunks,
    start_events,
    status_event,
    stream_error_event,
    stream_ids,
    text_delta_event,
)
from app.config import settings
from app.database.chats import (
    create_thread,
    get_thread_owner,
    list_messages,
    list_threads,
    update_thread_title,
)
from app.database.supabase import create_service_role_client, create_user_client

router = APIRouter(prefix="/chat", tags=["chat"])
logger = structlog.get_logger()


class ThreadCreate(BaseModel):
    """Fields accepted when creating a chat thread."""

    title: str = Field(min_length=1, max_length=255)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("title must not be blank")
        return title


class ThreadUpdate(ThreadCreate):
    """Fields accepted when updating a chat thread."""


class ThreadResponse(BaseModel):
    """Chat thread metadata returned to the SPA."""

    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    user_id: UUID = Field(alias="userId")
    title: str
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class MessageResponse(BaseModel):
    """Persisted message returned in AI SDK-friendly form."""

    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    thread_id: UUID = Field(alias="threadId")
    role: str
    sequence_number: int = Field(alias="sequenceNumber")
    content: str
    parts: list[dict[str, Any]] | None
    created_at: datetime = Field(alias="createdAt")

    @field_validator("parts")
    @classmethod
    def citation_parts_use_client_field_names(
        cls, parts: list[dict[str, Any]] | None
    ) -> list[dict[str, Any]] | None:
        if parts is None:
            return None

        normalized = []
        for part in parts:
            if part.get("type") != "data-citation":
                normalized.append(part)
                continue
            normalized.append(
                {
                    **part,
                    "data": CitationView.model_validate(part["data"]).model_dump(
                        mode="json", by_alias=True
                    ),
                }
            )
        return normalized


async def _clients(current_user: CurrentUser) -> tuple[AsyncClient, AsyncClient]:
    return (
        await create_user_client(current_user.access_token),
        await create_service_role_client(),
    )


async def _require_owner(
    service_client: AsyncClient, thread_id: UUID, user_id: UUID
) -> None:
    owner_id = await get_thread_owner(service_client, thread_id)
    if owner_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found"
        )
    if owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this thread",
        )


@router.get("/threads", response_model=list[ThreadResponse])
async def read_threads(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[dict[str, Any]]:
    """List chat threads belonging to the authenticated user."""
    user_client = await create_user_client(current_user.access_token)
    return await list_threads(user_client)


@router.post(
    "/threads", response_model=ThreadResponse, status_code=status.HTTP_201_CREATED
)
async def add_thread(
    body: ThreadCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict[str, Any]:
    """Create a chat thread for the authenticated user."""
    user_client = await create_user_client(current_user.access_token)
    return await create_thread(user_client, current_user.id, body.title)


@router.patch("/threads/{thread_id}", response_model=ThreadResponse)
async def update_thread(
    thread_id: UUID,
    body: ThreadUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict[str, Any]:
    """Update an owned chat thread."""
    user_client, service_client = await _clients(current_user)
    await _require_owner(service_client, thread_id, current_user.id)
    return await update_thread_title(user_client, thread_id, body.title)


@router.get("/threads/{thread_id}/messages", response_model=list[MessageResponse])
async def read_messages(
    thread_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[dict[str, Any]]:
    """Load an owned thread's complete message history."""
    user_client, service_client = await _clients(current_user)
    await _require_owner(service_client, thread_id, current_user.id)
    return await list_messages(user_client, thread_id)


@router.post("/stream")
async def stream_chat(
    body: ChatStreamRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> StreamingResponse:
    """Generate, validate, persist, and stream one grounded assistant turn."""
    try:
        thread_id = UUID(body.thread_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="threadId must be a valid UUID",
        ) from exc

    try:
        user_message = submitted_user_message(body.messages)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc

    user_client, service_client = await _clients(current_user)
    await _require_owner(service_client, thread_id, current_user.id)
    message_id, text_id = stream_ids()

    async def events() -> AsyncIterator[str]:
        started_at = perf_counter()
        await logger.ainfo(
            "grounded_chat_turn_started",
            thread_id=str(thread_id),
            user_id=str(current_user.id),
        )
        for event in start_events(message_id, text_id):
            yield event

        queue: asyncio.Queue[str | CompletedTurn | Exception] = asyncio.Queue(8)
        last_stage: str | None = "preparing"
        yield status_event("preparing")

        async def report_progress(stage: str) -> None:
            nonlocal last_stage
            if stage == last_stage:
                return
            last_stage = stage
            await queue.put(stage)

        async def complete_turn() -> None:
            try:
                async with AsyncOpenAI(
                    api_key=settings.openai_api_key,
                    timeout=settings.openai_request_timeout_seconds,
                    max_retries=1,
                ) as openai_client:
                    turn = await run_chat_turn(
                        user_id=current_user.id,
                        thread_id=thread_id,
                        user_message=user_message,
                        user_client=user_client,
                        openai_client=openai_client,
                        assistant_message_id=UUID(message_id),
                        report_progress=report_progress,
                    )
                await queue.put(turn)
            except Exception as exc:  # noqa: BLE001 - handed to stream boundary
                await queue.put(exc)

        task = asyncio.create_task(complete_turn())
        try:
            while True:
                item = await queue.get()
                if isinstance(item, str):
                    yield status_event(item)
                    continue
                if isinstance(item, Exception):
                    raise item
                turn = item
                break

            for chunk in reply_chunks(turn.answer):
                yield text_delta_event(text_id, chunk)
            yield answer_meta_event(turn.answer_status)
            for citation in turn.citations:
                yield citation_event(
                    citation.model_dump(mode="json", by_alias=True)
                )
            for event in finish_events(text_id):
                yield event
            await logger.ainfo(
                "grounded_chat_turn_completed",
                thread_id=str(thread_id),
                user_id=str(current_user.id),
                answer_status=turn.answer_status,
                citation_count=len(turn.citations),
                duration_ms=round((perf_counter() - started_at) * 1000),
            )
        except asyncio.CancelledError:
            task.cancel()
            raise
        except Exception as exc:  # noqa: BLE001 - streaming boundary must emit a safe error
            code = exc.code if isinstance(exc, ChatTurnError) else "unexpected_failed"
            await logger.aexception(
                "grounded_chat_turn_failed",
                thread_id=str(thread_id),
                user_id=str(current_user.id),
                error_code=code,
                duration_ms=round((perf_counter() - started_at) * 1000),
            )
            yield stream_error_event(code)
            yield error_event()
            yield "data: [DONE]\n\n"
        finally:
            if not task.done():
                task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "x-vercel-ai-ui-message-stream": "v1",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
