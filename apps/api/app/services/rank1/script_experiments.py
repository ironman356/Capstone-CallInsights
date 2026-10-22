"""Local prospective script experiment registry. Never fabricates outcomes."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import RLock
from uuid import uuid4
import json
import math
import os
import secrets
import tempfile

LOCK = RLock()
TEACH_BACK = "Before we finish, can you tell me the next step in your own words so I can check that I explained it clearly?"


def now():
    return datetime.now(timezone.utc)


def read_store(path: Path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"experiments": []}


def save_store(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, suffix=".json", delete=False) as handle:
        json.dump(data, handle, indent=2, ensure_ascii=True)
        temp_path = handle.name
    os.replace(temp_path, path)


def summarize(experiment):
    result = dict(experiment)
    observed = [a for a in result["assignments"] if a.get("outcome") is not None]
    counts = {}
    for arm in ("A", "B"):
        arm_rows = [a for a in observed if a["arm"] == arm]
        counts[arm] = {"assigned": sum(a["arm"] == arm for a in result["assignments"]), "observed": len(arm_rows),
                       "success": sum(a["outcome"]["resolved"] and not a["outcome"]["repeat_contact_7d"] for a in arm_rows)}
    result["results"] = counts
    result["difference"] = round(100 * (counts["B"]["success"] / counts["B"]["observed"] - counts["A"]["success"] / counts["A"]["observed"]), 1) if all(counts[a]["observed"] for a in counts) else None
    result["result_status"] = "No observed outcomes yet" if not observed else "Interim descriptive results; incomplete follow-up can bias comparison"
    return result


def list_experiments(path):
    with LOCK:
        return {"experiments": [summarize(e) for e in read_store(path)["experiments"]]}


def create_experiment(path, cluster, baseline):
    guide = cluster["guide"]
    candidates = [t for t in guide["turns"] if t["speaker"].lower() == "agent" and t["eligible"]]
    target = next((t for t in candidates if t["stage"] == "Respond"), candidates[-1] if candidates else None)
    if target is None:
        raise ValueError("No eligible source response is available for this cluster")
    with LOCK:
        store = read_store(path)
        existing = next((e for e in store["experiments"] if e["issue_slug"] == cluster["slug"] and e["variant_b"] == target["text"] + " " + TEACH_BACK), None)
        if existing:
            return summarize(existing)
        p0 = min(.8, max(.1, baseline / 100))
        p1, mean = p0 + .1, p0 + .05
        sample = math.ceil(((1.96 * math.sqrt(2 * mean * (1 - mean)) + .842 * math.sqrt(p0 * (1 - p0) + p1 * (1 - p1))) / .1) ** 2)
        experiment = {"id": "SCRIPT-" + uuid4().hex[:10], "issue_slug": cluster["slug"], "issue": cluster["issue"],
            "created_at": now().isoformat(), "status": "Local pilot setup; not connected to live calls",
            "source_call_id": guide["source_call_id"], "source_turn": target["turn"],
            "variant_a": target["text"], "variant_b": target["text"] + " " + TEACH_BACK,
            "hypothesis": "Adding one teach-back question improves independently verified resolution without repeat contact within 7 days.",
            "primary_outcome": "resolved AND no repeat contact on the same issue within 7 days",
            "randomization": "Independent 50/50 assignment, persisted by pseudonymous customer-issue unit; assign before displaying script.",
            "planning_n_per_arm": sample, "planning_assumptions": f"Illustration: {p0:.0%} baseline, +10 percentage points, two-sided alpha .05, 80% power, independent complete observations. Recalculate for agent clustering and attrition.",
            "required_fields": ["pseudonymous customer-issue unit", "assignment timestamp and arm (automatic)", "script delivery confirmed", "resolved (independent QA/CRM)", "repeat contact within 7 days", "outcome source reference"],
            "assignments": []}
        store["experiments"].append(experiment)
        save_store(path, store)
        return summarize(experiment)


def assign(path, experiment_id, unit_id):
    with LOCK:
        store = read_store(path)
        experiment = next((e for e in store["experiments"] if e["id"] == experiment_id), None)
        if experiment is None:
            raise ValueError("Experiment not found")
        previous = next((a for a in experiment["assignments"] if a["unit_id"] == unit_id), None)
        if previous:
            return previous
        arm = secrets.choice(["A", "B"])
        assignment = {"id": uuid4().hex, "unit_id": unit_id, "arm": arm, "assigned_at": now().isoformat(),
                      "script": experiment["variant_a"] if arm == "A" else experiment["variant_b"], "outcome": None}
        experiment["assignments"].append(assignment)
        save_store(path, store)
        return assignment


def record_outcome(path, experiment_id, assignment_id, payload):
    with LOCK:
        store = read_store(path)
        experiment = next((e for e in store["experiments"] if e["id"] == experiment_id), None)
        assignment = next((a for a in experiment["assignments"] if a["id"] == assignment_id), None) if experiment else None
        if assignment is None:
            raise ValueError("Assignment not found")
        if assignment["outcome"] is not None:
            raise ValueError("Outcome already recorded; append-only registry does not overwrite observations")
        if now() < datetime.fromisoformat(assignment["assigned_at"]) + timedelta(days=7):
            raise ValueError("The 7-day outcome window has not elapsed")
        assignment["outcome"] = {**payload, "recorded_at": now().isoformat()}
        save_store(path, store)
        return summarize(experiment)
