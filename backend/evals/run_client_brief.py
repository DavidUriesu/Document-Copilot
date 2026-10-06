"""Run and record the ten client-brief questions against live services."""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from time import perf_counter
from typing import Any
from uuid import UUID

from openai import AsyncOpenAI
from pydantic_ai.usage import UsageLimits

from app.assistant.agent import (
    MAX_AGENT_REQUESTS,
    MAX_AGENT_TOOL_CALLS,
    document_agent,
)
from app.assistant.coverage import infer_required_ticker_years
from app.assistant.deps import DocumentAgentDeps
from app.config import settings
from app.database.supabase import create_service_role_client
from app.grounding.validator import validate_grounded_answer
from app.logging import configure_logging
from app.retrieval.retriever import DocumentRetriever

EVALS_DIR = Path(__file__).resolve().parent
QUESTION_PATH = EVALS_DIR / "questions.json"
DEFAULT_OUTPUT_PATH = EVALS_DIR / "client_brief_results.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--question",
        action="append",
        type=int,
        dest="question_ids",
        help="Run one question number; repeat to select several",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    return parser.parse_args()


def load_questions(selected_ids: list[int] | None) -> list[dict[str, Any]]:
    questions = json.loads(QUESTION_PATH.read_text(encoding="utf-8"))
    if not selected_ids:
        return questions
    selected = set(selected_ids)
    matches = [question for question in questions if question["id"] in selected]
    missing = selected.difference(question["id"] for question in matches)
    if missing:
        raise ValueError(f"Unknown question numbers: {sorted(missing)}")
    return matches


async def evaluate_question(
    specification: dict[str, Any], database: Any, openai: AsyncOpenAI
) -> dict[str, Any]:
    started_at = perf_counter()
    stages: list[dict[str, Any]] = []

    async def report_progress(stage: str) -> None:
        stages.append(
            {"stage": stage, "elapsed_seconds": round(perf_counter() - started_at, 3)}
        )

    deps = DocumentAgentDeps(
        user_id=UUID(int=0),
        thread_id=UUID(int=0),
        retriever=DocumentRetriever(database, openai),
        required_ticker_years=infer_required_ticker_years(specification["question"]),
        report_progress=report_progress,
    )
    result = await document_agent.run(
        specification["question"],
        deps=deps,
        usage_limits=UsageLimits(
            request_limit=MAX_AGENT_REQUESTS,
            tool_calls_limit=MAX_AGENT_TOOL_CALLS,
        ),
    )
    citations = validate_grounded_answer(
        result.output,
        deps.evidence,
        deps.required_ticker_years,
    )
    citation_tickers = sorted({citation.ticker for citation in citations})
    missing_tickers = sorted(
        set(specification["required_tickers"]).difference(citation_tickers)
    )
    cited_ticker_years = {
        (citation.ticker, citation.fiscal_year) for citation in citations
    }
    required_ticker_years = {
        (ticker, year)
        for ticker, years in specification.get("required_years_by_ticker", {}).items()
        for year in years
    }
    missing_ticker_years = sorted(required_ticker_years - cited_ticker_years)
    allowed_statuses = specification.get("allowed_statuses", ["grounded"])
    usage = result.usage
    return {
        **specification,
        "automatic_pass": (
            bool(citations)
            and result.output.status in allowed_statuses
            and not missing_tickers
            and not missing_ticker_years
        ),
        "answer_status": result.output.status,
        "answer": result.output.answer,
        "citation_tickers": citation_tickers,
        "missing_required_tickers": missing_tickers,
        "missing_required_ticker_years": [
            {"ticker": ticker, "fiscal_year": year}
            for ticker, year in missing_ticker_years
        ],
        "citations": [
            citation.model_dump(mode="json", by_alias=True) for citation in citations
        ],
        "evidence_count": len(deps.evidence),
        "model_requests": usage.requests,
        "tool_calls": usage.tool_calls,
        "elapsed_seconds": round(perf_counter() - started_at, 3),
        "progress": stages,
        "human_review": None,
    }


async def run(args: argparse.Namespace) -> int:
    questions = load_questions(args.question_ids)
    database = await create_service_role_client()
    openai = AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=settings.openai_request_timeout_seconds,
        max_retries=1,
    )
    results = []
    for specification in questions:
        question_id = specification["id"]
        print(f"Q{question_id}: running", flush=True)
        started_at = perf_counter()
        try:
            async with asyncio.timeout(settings.chat_turn_timeout_seconds):
                evaluation = await evaluate_question(specification, database, openai)
        except Exception as exc:  # noqa: BLE001 - evaluation records external failures
            evaluation = {
                **specification,
                "automatic_pass": False,
                "error_type": type(exc).__name__,
                "error": str(exc),
                "elapsed_seconds": round(perf_counter() - started_at, 3),
                "human_review": None,
            }
        results.append(evaluation)
        status = "PASS" if evaluation["automatic_pass"] else "FAIL"
        elapsed = evaluation.get("elapsed_seconds", "-")
        print(f"Q{question_id}: {status} ({elapsed}s)", flush=True)

    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "chat_model": settings.openai_chat_model,
        "embedding_model": settings.openai_embedding_model,
        "turn_timeout_seconds": settings.chat_turn_timeout_seconds,
        "automatic_pass_count": sum(result["automatic_pass"] for result in results),
        "question_count": len(results),
        "results": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Report: {args.output}")
    return 0 if report["automatic_pass_count"] == len(results) else 1


def main() -> None:
    configure_logging()
    raise SystemExit(asyncio.run(run(parse_args())))


if __name__ == "__main__":
    main()
