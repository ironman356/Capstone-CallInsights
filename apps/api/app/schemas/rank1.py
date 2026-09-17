from __future__ import annotations

from datetime import date

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


class StrategyRecord(BaseModel):
    strategy_id: str
    title: str
    issue_slug: str
    issue: str
    status: str
    owner: str
    hypothesis: str
    kpi_focus: list[str]
    evidence_call_ids: list[str]
    notes: str
    due_date: date | None = None
    created_at: str
    updated_at: str


class StrategyBoardResponse(BaseModel):
    stages: list[dict]
    strategies: list[StrategyRecord]


class StrategyCreateRequest(BaseModel):
    issue_slug: str
    title: str
    owner: str
    hypothesis: str
    notes: str = ""
    kpi_focus: list[str] = []
    evidence_call_ids: list[str] = []
    due_date: date | None = None


class StrategyUpdateRequest(BaseModel):
    status: str | None = None
    owner: str | None = None
    hypothesis: str | None = None
    notes: str | None = None
    kpi_focus: list[str] | None = None
    evidence_call_ids: list[str] | None = None
    due_date: date | None = None


class ExportReportResponse(BaseModel):
    status: str
    generated_at: str
    report: dict


class GovernanceResponse(BaseModel):
    generated_at: str
    evidence_policy: list[str]
    audit_summary: dict
    monitors: list[dict]


class AskCiChatRequest(BaseModel):
    question: str
    current_page: str | None = None
    history: list[dict] = []


class AskCiChatAction(BaseModel):
    type: str
    label: str
    target: str


class AskCiChatResponse(BaseModel):
    answer: str
    sources: list[str]
    actions: list[AskCiChatAction]
    generated_at: str
    mode: str


class WorkspaceResponse(BaseModel):
    dashboard: DashboardResponse
    pulse_insights: list[dict]
    recalibration: dict
    strategy_board: StrategyBoardResponse
    ask_ci: list[dict]
    reports: dict
    governance: GovernanceResponse
