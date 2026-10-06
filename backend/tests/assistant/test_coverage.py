"""Tests for deterministic company and period coverage inference."""

import json
from pathlib import Path

import pytest

from app.assistant.coverage import infer_required_ticker_years


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        (
            "Compare Apple's filings from 2021 through 2025.",
            {("AAPL", 2021), ("AAPL", 2025)},
        ),
        (
            "For Alphabet, compare revenue across the available 10-Ks.",
            {("GOOGL", 2021), ("GOOGL", 2025)},
        ),
        (
            "Compare Apple and NVIDIA supplier language over time.",
            {
                ("AAPL", 2021),
                ("AAPL", 2025),
                ("NVDA", 2021),
                ("NVDA", 2025),
            },
        ),
        (
            "Compare Microsoft, Alphabet, Amazon, and NVIDIA commitments.",
            {
                ("AMZN", 2025),
                ("GOOGL", 2025),
                ("MSFT", 2025),
                ("NVDA", 2025),
            },
        ),
        (
            "Summarize the latest geographic exposure for each company.",
            {
                ("AAPL", 2025),
                ("AMZN", 2025),
                ("GOOGL", 2025),
                ("MSFT", 2025),
                ("NVDA", 2025),
            },
        ),
        ("Did generative AI improve margins for these companies?", set()),
    ],
)
def test_infer_required_ticker_years(
    question: str, expected: set[tuple[str, int]]
) -> None:
    assert infer_required_ticker_years(question) == frozenset(expected)


def test_client_brief_coverage_matches_evaluation_contract() -> None:
    questions_path = Path(__file__).parents[2] / "evals" / "questions.json"
    questions = json.loads(questions_path.read_text(encoding="utf-8"))

    for specification in questions:
        expected = {
            (ticker, year)
            for ticker, years in specification.get(
                "required_years_by_ticker", {}
            ).items()
            for year in years
        }
        assert infer_required_ticker_years(specification["question"]) == expected
