"""Structured agent output and trusted citation presentation models."""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CitationRef(BaseModel):
    """Model-provided reference to evidence seen during this run."""

    source_id: str = Field(pattern=r"^S[1-9]\d*$")


class GroundedAnswer(BaseModel):
    """Schema-constrained final answer from the document agent."""

    status: Literal["grounded", "insufficient_evidence"]
    answer: str = Field(min_length=1)
    citations: list[CitationRef]


class CitationView(BaseModel):
    """Validated citation metadata derived from stored corpus records."""

    model_config = ConfigDict(populate_by_name=True)

    index: int
    chunk_id: UUID = Field(alias="chunkId")
    excerpt: str
    ticker: str
    company_name: str = Field(alias="companyName")
    filing_type: str = Field(alias="filingType")
    filing_date: date = Field(alias="filingDate")
    fiscal_year: int = Field(alias="fiscalYear")
    page_number: int | None = Field(alias="pageNumber")
    section: str | None
    source_url: str = Field(alias="sourceUrl")
