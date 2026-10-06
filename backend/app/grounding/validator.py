"""Validate that an answer's citations map to retrieved source text."""

from __future__ import annotations

import re

from app.assistant.outputs import CitationView, GroundedAnswer
from app.retrieval.models import SourcePassage

CITATION_MARKER = re.compile(r"\[(\d+)]")
INSUFFICIENCY_LANGUAGE = (
    "insufficient",
    "not enough",
    "cannot answer",
    "can't answer",
)


class GroundingError(ValueError):
    """Raised when an answer violates the grounding contract."""


def _normalized(text: str) -> str:
    return " ".join(text.split())


def _substantive_blocks(answer: str) -> list[str]:
    blocks = []
    for block in re.split(r"\n\s*\n", answer):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        for line in lines:
            if (
                line.startswith("#")
                or line.endswith(":")
                or re.fullmatch(r"[-|: ]+", line)
            ):
                continue
            blocks.append(line)
    return blocks


def normalize_citation_references(answer: GroundedAnswer) -> GroundedAnswer:
    """Prune unused valid citations and close marker gaps deterministically."""
    markers = [int(value) for value in CITATION_MARKER.findall(answer.answer)]
    if not markers or any(not 1 <= marker <= len(answer.citations) for marker in markers):
        return answer
    used = sorted(set(markers))
    expected = list(range(1, len(answer.citations) + 1))
    if used == expected:
        return answer
    positions = {old: new for new, old in enumerate(used, start=1)}
    answer.answer = CITATION_MARKER.sub(
        lambda match: f"[{positions[int(match.group(1))]}]", answer.answer
    )
    answer.citations = [answer.citations[position - 1] for position in used]
    return answer


def validate_grounded_answer(
    answer: GroundedAnswer,
    evidence: dict[str, SourcePassage],
    required_ticker_years: frozenset[tuple[str, int]] = frozenset(),
) -> list[CitationView]:
    """Return trusted citations or fail closed on any provenance violation."""
    citation_ids = [citation.source_id for citation in answer.citations]
    if len(citation_ids) != len(set(citation_ids)):
        raise GroundingError("Citation source IDs must be unique")
    if answer.status == "grounded" and not answer.citations:
        raise GroundingError("A grounded answer must include citations")

    views = []
    for index, citation in enumerate(answer.citations, start=1):
        passage = evidence.get(citation.source_id)
        if passage is None:
            raise GroundingError("Citation references evidence not retrieved this run")
        views.append(
            CitationView(
                index=index,
                chunk_id=passage.chunk_id,
                excerpt=_normalized(passage.content),
                ticker=passage.ticker,
                company_name=passage.company_name,
                filing_type=passage.filing_type,
                filing_date=passage.filing_date,
                fiscal_year=passage.fiscal_year,
                page_number=passage.page_number,
                section=passage.section,
                source_url=passage.source_url,
            )
        )

    markers = [int(value) for value in CITATION_MARKER.findall(answer.answer)]
    expected = set(range(1, len(answer.citations) + 1))
    if any(marker not in expected for marker in markers):
        raise GroundingError("Answer contains an out-of-range citation marker")
    if set(markers) != expected:
        raise GroundingError(
            "Every citation must be referenced exactly by list position"
        )

    if answer.status == "grounded":
        uncited = [
            block
            for block in _substantive_blocks(answer.answer)
            if not CITATION_MARKER.search(block)
        ]
        if uncited:
            raise GroundingError(
                "Every substantive answer block must contain a citation"
            )
        cited_ticker_years = {
            (citation.ticker, citation.fiscal_year) for citation in views
        }
        missing_coverage = sorted(required_ticker_years - cited_ticker_years)
        if missing_coverage:
            missing = ", ".join(
                f"{ticker} FY{year}" for ticker, year in missing_coverage
            )
            raise GroundingError(
                "Answer is missing required filing coverage: "
                f"{missing}. Search for and cite those periods before answering."
            )
    elif not any(
        phrase in answer.answer.lower() for phrase in INSUFFICIENCY_LANGUAGE
    ):
        raise GroundingError("Insufficient-evidence answers must state the limitation")

    return views
