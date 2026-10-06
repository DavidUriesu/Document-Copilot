"""Derive minimum filing coverage implied by an analyst question."""

from __future__ import annotations

import re

PILOT_YEAR_FIRST = 2021
PILOT_YEAR_LATEST = 2025
COMPANY_ALIASES = {
    "AAPL": ("apple", "aapl"),
    "AMZN": ("amazon", "amzn"),
    "GOOGL": ("alphabet", "google", "googl"),
    "MSFT": ("microsoft", "msft"),
    "NVDA": ("nvidia", "nvda"),
}
YEAR = re.compile(r"\b20\d{2}\b")


def infer_required_ticker_years(question: str) -> frozenset[tuple[str, int]]:
    """Return the company/year endpoints a grounded answer must cite."""
    normalized = question.casefold()
    tickers = {
        ticker
        for ticker, aliases in COMPANY_ALIASES.items()
        if any(re.search(rf"\b{re.escape(alias)}\b", normalized) for alias in aliases)
    }
    if "five companies" in normalized or "each company" in normalized:
        tickers = set(COMPANY_ALIASES)
    if not tickers:
        return frozenset()

    explicit_years = sorted({int(value) for value in YEAR.findall(normalized)})
    if len(explicit_years) >= 2:
        years = (explicit_years[0], explicit_years[-1])
    elif explicit_years:
        years = (explicit_years[0],)
    elif (
        "over time" in normalized
        or "across the available" in normalized
        or ("available" in normalized and "10-k" in normalized)
    ):
        years = (PILOT_YEAR_FIRST, PILOT_YEAR_LATEST)
    else:
        years = (PILOT_YEAR_LATEST,)

    return frozenset((ticker, year) for ticker in tickers for year in years)
