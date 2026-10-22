"""Local Rank 3 decision-support services with inspectable deterministic logic."""
from __future__ import annotations

from app.services.rank1.pipeline import classify_outcome, extract_behaviors, score_sentiment, Turn


def predict_risk(transcript_text: str) -> dict:
    outcome = classify_outcome(transcript_text)
    lower = transcript_text.lower()
    escalation = min(0.95, 0.15 + 0.45 * ("supervisor" in lower or "escalat" in lower) + 0.25 * ("frustrat" in lower))
    repeat = min(0.95, 0.2 + 0.35 * (outcome in {"unresolved", "follow-up needed"}) + 0.2 * ("already called" in lower))
    return {"escalation_risk": round(escalation, 2), "repeat_contact_risk": round(repeat, 2), "rules": ["escalation language", "outcome state", "repeat-contact language"]}


def recommend_strategy(call: dict) -> dict:
    risk = predict_risk(call["transcript_text"])
    behavior = call.get("behaviors", ["offered next steps"])[0]
    return {"issue": call.get("issue"), "recommendation": f"Coach agents to reinforce {behavior} and provide a clear next step.", "risk": risk, "evidence_call_ids": [call["call_id"]]}


def simulate_call(transcript_text: str, agent_response: str) -> dict:
    turns = [Turn(speaker="Customer", text=transcript_text), Turn(speaker="Agent", text=agent_response)]
    outcome = classify_outcome("\n".join(f"{turn.speaker}: {turn.text}" for turn in turns))
    return {"simulated_outcome": outcome, "behaviors": extract_behaviors(agent_response, outcome), "sentiment": score_sentiment(turns), "risk": predict_risk(transcript_text + " " + agent_response)}


def transparency_report(call: dict) -> dict:
    return {"call_id": call["call_id"], "issue": call.get("issue"), "outcome": call.get("outcome"), "behaviors": call.get("behaviors", []), "sentiment": call.get("sentiments", {}), "source_file": call.get("source_file"), "redaction_applied": call.get("redaction_applied", False), "limitations": ["Rule-based risk scores are decision support, not causal findings.", "Human review is required before operational action."]}
