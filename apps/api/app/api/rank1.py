from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.schemas.rank1 import (
    AskCiChatRequest,
    AskCiChatResponse,
    CallDetailResponse,
    DashboardResponse,
    ExportReportResponse,
    GovernanceResponse,
    IssueDetailResponse,
    PipelineRunResponse,
    StrategyBoardResponse,
    StrategyCreateRequest,
    StrategyRecord,
    StrategyUpdateRequest,
    WorkspaceResponse,
)
from app.services.rank1.pipeline import Rank1PipelineService

router = APIRouter(prefix="/rank1", tags=["rank1"])
service = Rank1PipelineService()


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard() -> DashboardResponse:
    bundle = service.load_or_run()
    return DashboardResponse(
        overview=bundle["overview"],
        issues=bundle["issues"],
        calls=bundle["calls"],
    )


@router.get("/issues/{issue_slug}", response_model=IssueDetailResponse)
def get_issue_detail(issue_slug: str) -> IssueDetailResponse:
    bundle = service.load_or_run()
    issue = next((item for item in bundle["issues"] if item["slug"] == issue_slug), None)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return IssueDetailResponse(
        issue=issue["issue"],
        count=issue["count"],
        summary=issue["summary"],
        top_behaviors=issue["top_behaviors"],
        outcome_breakdown=issue["outcome_breakdown"],
        evidence_calls=issue["representative_calls"],
    )


@router.get("/calls/{call_id}", response_model=CallDetailResponse)
def get_call_detail(call_id: str) -> CallDetailResponse:
    bundle = service.load_or_run()
    call = bundle["call_details"].get(call_id)
    if call is None:
        raise HTTPException(status_code=404, detail="Call not found")
    return CallDetailResponse(
        call_id=call["call_id"],
        source_file=call["source_file"],
        issue=call["issue"],
        outcome=call["outcome"],
        behaviors=call["behaviors"],
        sentiments=call["sentiments"],
        summary=call["summary"],
        transcript_text=call["transcript_text"],
        turns=call["turns"],
        segments=call["segments"],
    )


@router.post("/run", response_model=PipelineRunResponse)
def run_pipeline() -> PipelineRunResponse:
    bundle = service.load_or_run(force=True)
    return PipelineRunResponse(
        status="ok",
        call_count=len(bundle["calls"]),
        segment_count=sum(len(call["segments"]) for call in bundle["call_details"].values()),
        output_files={
            "calls": "data/processed/calls.jsonl",
            "segments": "data/processed/segments.jsonl",
            "issues": "data/processed/issues.jsonl",
            "behaviors": "data/processed/behaviors.jsonl",
            "sentiment": "data/processed/sentiment.jsonl",
            "outcomes": "data/processed/outcomes.jsonl",
            "triple_engine": "data/outputs/triple_engine_summary.json",
        },
    )


@router.get("/workspace", response_model=WorkspaceResponse)
def get_workspace() -> WorkspaceResponse:
    workspace = service.build_workspace()
    return WorkspaceResponse(**workspace)


@router.post("/ask-ci/chat", response_model=AskCiChatResponse)
def ask_ci_chat(payload: AskCiChatRequest) -> AskCiChatResponse:
    response = service.answer_ask_ci(
        question=payload.question,
        current_page=payload.current_page,
        history=payload.history,
    )
    return AskCiChatResponse(**response)


@router.get("/strategies", response_model=StrategyBoardResponse)
def get_strategies() -> StrategyBoardResponse:
    board = service.build_strategy_board(service.load_or_run())
    return StrategyBoardResponse(**board)


@router.post("/strategies", response_model=StrategyRecord)
def create_strategy(payload: StrategyCreateRequest) -> StrategyRecord:
    bundle = service.load_or_run()
    try:
        strategy = service.create_strategy(
            bundle,
            issue_slug=payload.issue_slug,
            title=payload.title,
            owner=payload.owner,
            hypothesis=payload.hypothesis,
            notes=payload.notes,
            kpi_focus=payload.kpi_focus,
            evidence_call_ids=payload.evidence_call_ids,
            due_date=payload.due_date.isoformat() if payload.due_date else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StrategyRecord(**strategy)


@router.patch("/strategies/{strategy_id}", response_model=StrategyRecord)
def update_strategy(strategy_id: str, payload: StrategyUpdateRequest) -> StrategyRecord:
    strategy = service.update_strategy(service.load_or_run(), strategy_id, payload.model_dump(mode="json", exclude_unset=True))
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return StrategyRecord(**strategy)


@router.delete("/strategies/{strategy_id}", response_model=StrategyRecord)
def delete_strategy(strategy_id: str) -> StrategyRecord:
    strategy = service.delete_strategy(service.load_or_run(), strategy_id)
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return StrategyRecord(**strategy)


@router.post("/recalibrate", response_model=WorkspaceResponse)
def recalibrate_workspace() -> WorkspaceResponse:
    workspace = service.build_workspace(force=True)
    return WorkspaceResponse(**workspace)


@router.post("/reports/export", response_model=ExportReportResponse)
def export_report() -> ExportReportResponse:
    report = service.build_report_summary(service.load_or_run())
    return ExportReportResponse(status="ok", generated_at=report["generated_at"], report=report)


@router.get("/reports/export.pdf")
def download_report_pdf() -> Response:
    bundle = service.load_or_run()
    report = service.build_report_summary(bundle)
    pdf_bytes = service.build_report_pdf(bundle)
    generated_at = report["generated_at"].replace(":", "-")
    filename = f"call-insights-report-{generated_at}.pdf"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.get("/governance", response_model=GovernanceResponse)
def get_governance() -> GovernanceResponse:
    return GovernanceResponse(**service.build_governance_summary(service.load_or_run()))
