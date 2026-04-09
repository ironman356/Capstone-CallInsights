from __future__ import annotations

from pydantic import BaseModel


class OverviewMetric(BaseModel):
    label: str
    value: int | float | str
    tone: str


class OverviewResponse(BaseModel):
    metrics: list[OverviewMetric]
    issue_counts: dict[str, int]
    outcome_counts: dict[str, int]
    sentiment_summary: dict[str, float]
    top_patterns: list[dict]
    daily_brief: list[str]


class DashboardResponse(BaseModel):
    overview: OverviewResponse
    issues: list[dict]
    calls: list[dict]


class IssueDetailResponse(BaseModel):
    issue: str
    count: int
    summary: str
    top_behaviors: list[dict]
    outcome_breakdown: dict[str, int]
    evidence_calls: list[dict]


class CallDetailResponse(BaseModel):
    call_id: str
    source_file: str
    issue: str
    outcome: str
    behaviors: list[str]
    sentiments: dict[str, float]
    summary: str
    transcript_text: str
    turns: list[dict]
    segments: list[dict]


class PipelineRunResponse(BaseModel):
    status: str
    call_count: int
    segment_count: int
    output_files: dict[str, str]
