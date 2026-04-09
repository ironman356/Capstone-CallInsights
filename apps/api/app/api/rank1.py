from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.rank1 import (
    CallDetailResponse,
    DashboardResponse,
    IssueDetailResponse,
    PipelineRunResponse,
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
