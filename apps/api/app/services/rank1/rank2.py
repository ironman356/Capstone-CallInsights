"""Rank 2 operational workflows: voice intake, evidence packs, and measurements."""
from __future__ import annotations

from collections import Counter
from pathlib import Path
import json

from app.services.rank1.redaction import redact_transcript_text


def intake_voice_transcript(transcript_text: str, source_reference: str) -> dict:
    text = redact_transcript_text(transcript_text.strip())
    if not text:
        raise ValueError("Transcript text is required")
    return {"source_type": "voice_transcript", "source_reference": source_reference.strip(), "transcript_text": text,
            "redaction_applied": True}


def build_evidence_pack(bundle: dict, issue_slug: str | None = None, outcome: str | None = None) -> dict:
    calls = list(bundle["call_details"].values())
    if issue_slug:
        calls = [call for call in calls if call.get("issue", "").lower().replace(" / ", "-").replace(" ", "-") == issue_slug]
    if outcome:
        calls = [call for call in calls if call.get("outcome") == outcome]
    return {"filters": {"issue_slug": issue_slug, "outcome": outcome}, "sample_size": len(calls),
            "outcomes": dict(Counter(call["outcome"] for call in calls)),
            "evidence": [{"call_id": call["call_id"], "issue": call["issue"], "outcome": call["outcome"], "summary": call["summary"]} for call in calls[:25]]}


def record_strategy_measurement(path: Path, strategy_id: str, baseline: dict, observed: dict) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    records = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    result = {"strategy_id": strategy_id, "baseline": baseline, "observed": observed,
              "resolution_delta": round(float(observed["resolution_rate"]) - float(baseline["resolution_rate"]), 4),
              "repeat_contact_delta": round(float(observed["repeat_contact_rate"]) - float(baseline["repeat_contact_rate"]), 4)}
    records = [item for item in records if item["strategy_id"] != strategy_id] + [result]
    path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    return result
