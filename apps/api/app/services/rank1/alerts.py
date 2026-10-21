"""Persisted, evidence-linked operational alerts for Rank 2 monitoring."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


def build_alerts(bundle: dict) -> list[dict]:
    alerts: list[dict] = []
    for pattern in bundle.get("overview", {}).get("top_patterns", []):
        if pattern.get("outcome") != "escalated":
            continue
        alerts.append({
            "alert_id": f"escalation-{pattern['issue']}-{pattern['behavior']}".lower().replace(" ", "-"),
            "severity": "high",
            "title": f"Escalation risk: {pattern['issue']}",
            "summary": f"{pattern['count']} calls pair {pattern['behavior']} with escalation.",
            "evidence_call_ids": pattern.get("call_ids", [])[:5],
            "dismissed": False,
        })
    return alerts


def load_alerts(path: Path, bundle: dict) -> list[dict]:
    current = {item["alert_id"]: item for item in build_alerts(bundle)}
    if path.exists():
        for saved in json.loads(path.read_text(encoding="utf-8")):
            if saved.get("alert_id") in current:
                current[saved["alert_id"]]["dismissed"] = bool(saved.get("dismissed"))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(list(current.values()), indent=2), encoding="utf-8")
    return list(current.values())


def dismiss_alert(path: Path, alert_id: str, bundle: dict) -> dict:
    alerts = load_alerts(path, bundle)
    alert = next((item for item in alerts if item["alert_id"] == alert_id), None)
    if alert is None:
        raise ValueError("Alert not found")
    alert["dismissed"] = True
    alert["dismissed_at"] = datetime.now(timezone.utc).isoformat()
    path.write_text(json.dumps(alerts, indent=2), encoding="utf-8")
    return alert
