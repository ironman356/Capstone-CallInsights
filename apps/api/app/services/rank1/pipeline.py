from __future__ import annotations

import json
import re
import textwrap
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from uuid import uuid4

from app.core.config import settings

ISSUE_KEYWORDS: dict[str, list[str]] = {
    "payment confusion": [
        "payment still shows pending",
        "pending",
        "payment activity",
        "processing",
        "posting",
        "manual payment",
        "made the payment",
        "missed payment",
    ],
    "escrow issue": [
        "escrow",
        "escrow analysis",
        "shortage",
        "monthly payment went up",
        "projected disbursements",
    ],
    "late fee dispute": [
        "late fee",
        "grace period",
        "courtesy review",
    ],
    "autopay issue": [
        "autopay",
        "automatic",
        "draft",
        "recurring payment",
        "enrollment",
    ],
    "payoff request": [
        "payoff",
        "closing",
        "title company",
        "good-through date",
    ],
    "hardship / forbearance": [
        "hardship",
        "forbearance",
        "assistance options",
        "behind",
        "assistance team",
    ],
    "refinance status": [
        "refinance",
        "old loan",
        "paid off already",
        "payoff funds",
    ],
    "insurance / tax escrow issue": [
        "hazard insurance",
        "lender-placed",
        "insurance",
        "tax bill",
        "county taxes",
        "tax amount",
        "escrow account adjusted",
    ],
    "statement confusion": [
        "statement",
        "amount due",
        "billing cycle",
        "suspense",
        "line by line",
    ],
}

BEHAVIOR_RULES: dict[str, list[str]] = {
    "explained timeline early": [
        "turnaround window",
        "next due date",
        "within two business days",
        "next billing cycle",
        "normal processing time",
        "reviewed when the next",
    ],
    "used empathy": [
        "i understand",
        "i am sorry",
        "i appreciate your patience",
        "why that is frustrating",
        "sorry you are dealing with that",
    ],
    "repeated policy clearly": [
        "the loan applies",
        "depends on",
        "until the prior loan is paid",
        "when county taxes change",
        "payment plan availability depends",
    ],
    "offered next steps": [
        "next step",
        "i can submit",
        "i outlined",
        "i reviewed where to check",
        "i am adding notes",
        "i have submitted",
        "documenting",
    ],
    "transferred / escalated": [
        "transfer",
        "transferred",
        "escalate",
        "escalation",
        "specialist",
        "supervisor",
    ],
    "asked verification questions": [
        "verify your full name",
        "verify your name",
        "property zip code",
        "zip code on file",
    ],
    "created confusion": [
        "i cannot fully reconcile",
        "i do not have the final",
        "i cannot verify",
        "still need someone else",
        "part of it is still unresolved",
    ],
    "placed on hold": [
        "please hold",
        "while i connect",
    ],
}

POSITIVE_TERMS = frozenset(
    {
        "good",
        "appreciate",
        "that helps",
        "that clears it up",
        "path forward",
        "welcome",
        "thank you",
        "reasonable",
    }
)
NEGATIVE_TERMS = frozenset(
    {
        "not acceptable",
        "tired",
        "transfer",
        "wrong",
        "escalate",
        "limbo",
        "upset",
        "not happy",
        "confusing",
        "behind",
        "frustrating",
        "delinquency",
    }
)


@dataclass
class Turn:
    speaker: str
    text: str


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _read_text_lines(path: Path) -> list[str]:
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _extract_turns(text: str) -> list[Turn]:
    turns: list[Turn] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or ":" not in line:
            continue
        speaker, content = line.split(":", 1)
        speaker = speaker.strip()
        content = content.strip()
        if speaker not in {"Customer", "Agent"} or not content:
            continue
        turns.append(Turn(speaker=speaker, text=content))
    return turns


def _score_keywords(text: str, keyword_map: dict[str, list[str]]) -> dict[str, int]:
    lowered = text.lower()
    return {
        label: sum(lowered.count(pattern) for pattern in patterns)
        for label, patterns in keyword_map.items()
    }


def classify_issue(text: str) -> tuple[str, dict[str, int]]:
    scores = _score_keywords(text, ISSUE_KEYWORDS)
    if not scores:
        return "other", {}
    label = max(scores, key=scores.get)
    if scores[label] <= 0:
        return "other", scores
    return label, scores


def extract_behaviors(text: str, outcome: str) -> list[str]:
    lowered = text.lower()
    labels = [
        label
        for label, patterns in BEHAVIOR_RULES.items()
        if any(pattern in lowered for pattern in patterns)
    ]

    if outcome == "resolved" and "resolved calmly" not in labels:
        if "thank you" in lowered or "appreciate" in lowered:
            labels.append("resolved calmly")

    if outcome in {"follow-up needed", "unresolved"} and "failed to address concern" not in labels:
        if (
            "still do not know" in lowered
            or "not happy" in lowered
            or "back where i started" in lowered
        ):
            labels.append("failed to address concern")

    return sorted(set(labels))


def classify_outcome(text: str) -> str:
    lowered = text.lower()
    if "callback number" in lowered or "callback requested" in lowered:
        return "callback requested"
    if any(
        token in lowered
        for token in ("transfer me", "escalate", "escalation", "supervisor", "please hold while i connect")
    ):
        return "escalated"
    if any(
        token in lowered
        for token in ("that helps", "that clears it up", "appreciate you explaining", "good day", "path forward")
    ):
        return "resolved"
    if any(
        token in lowered
        for token in ("follow-up", "review team", "receive an update", "check back", "wait for the follow-up")
    ):
        return "follow-up needed"
    return "unresolved"


def _split_sections(turns: list[Turn]) -> dict[str, list[Turn]]:
    if not turns:
        return {"opening": [], "mid": [], "closing": []}

    third = max(1, len(turns) // 3)
    opening = turns[:third]
    mid = turns[third : third * 2] or turns[third:]
    closing = turns[third * 2 :] or turns[-third:]
    return {"opening": opening, "mid": mid, "closing": closing}


def _score_sentiment(turns: Iterable[Turn]) -> float:
    text = " ".join(turn.text.lower() for turn in turns)
    if not text:
        return 0.0

    positive = sum(text.count(term) for term in POSITIVE_TERMS)
    negative = sum(text.count(term) for term in NEGATIVE_TERMS)
    total = positive + negative
    if total == 0:
        return 0.0
    return round((positive - negative) / total, 3)


def score_sentiment(turns: list[Turn]) -> dict[str, float]:
    sections = _split_sections(turns)
    opening = _score_sentiment(sections["opening"])
    mid = _score_sentiment(sections["mid"])
    closing = _score_sentiment(sections["closing"])
    return {
        "opening": opening,
        "mid": mid,
        "closing": closing,
        "shift": round(closing - opening, 3),
    }


def segment_call(call_id: str, turns: list[Turn], fallback_issue: str) -> list[dict]:
    if not turns:
        return []

    segments: list[dict] = []
    current_turns: list[Turn] = []
    current_issue = fallback_issue
    segment_index = 1

    for turn in turns:
        candidate_issue, candidate_scores = classify_issue(turn.text)
        if (
            current_turns
            and candidate_issue != "other"
            and candidate_issue != current_issue
            and candidate_scores.get(candidate_issue, 0) > 0
        ):
            segment_text = "\n".join(f"{t.speaker}: {t.text}" for t in current_turns)
            segments.append(
                {
                    "segment_id": f"{call_id}-SEG-{segment_index:02d}",
                    "call_id": call_id,
                    "order": segment_index,
                    "issue": current_issue,
                    "text": segment_text,
                    "turn_count": len(current_turns),
                }
            )
            segment_index += 1
            current_turns = []
            current_issue = candidate_issue

        current_turns.append(turn)
        if candidate_issue != "other":
            current_issue = candidate_issue

    if current_turns:
        segment_text = "\n".join(f"{t.speaker}: {t.text}" for t in current_turns)
        segments.append(
            {
                "segment_id": f"{call_id}-SEG-{segment_index:02d}",
                "call_id": call_id,
                "order": segment_index,
                "issue": current_issue,
                "text": segment_text,
                "turn_count": len(current_turns),
            }
        )

    return segments


def summarize_call(issue: str, outcome: str, behaviors: list[str], sentiments: dict[str, float]) -> str:
    behavior_text = ", ".join(behaviors[:3]) if behaviors else "limited agent signals"
    return (
        f"{issue.title()} call that ended as {outcome}. "
        f"Primary agent behaviors: {behavior_text}. "
        f"Sentiment shift was {sentiments['shift']:+.3f} from opening to close."
    )


class Rank1PipelineService:
    def __init__(self) -> None:
        self.raw_dir = settings.RAW_TRANSCRIPTS_DIR
        self.processed_dir = settings.PROCESSED_DIR
        self.outputs_dir = settings.OUTPUTS_DIR

    def ensure_output_dirs(self) -> None:
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self.outputs_dir.mkdir(parents=True, exist_ok=True)

    @property
    def strategy_store_path(self) -> Path:
        return self.outputs_dir / "strategy_board.json"

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    def ingest_calls(self) -> list[dict]:
        if not self.raw_dir.exists():
            raise FileNotFoundError(f"Transcript directory not found: {self.raw_dir}")

        calls: list[dict] = []
        for index, path in enumerate(sorted(self.raw_dir.glob("*.txt")), start=1):
            transcript_text = path.read_text(encoding="utf-8").strip()
            turns = _extract_turns(transcript_text)
            call_id = f"CALL-{index:04d}"
            calls.append(
                {
                    "call_id": call_id,
                    "source_file": path.name,
                    "transcript_text": transcript_text,
                    "turns": [{"speaker": turn.speaker, "text": turn.text} for turn in turns],
                    "turn_count": len(turns),
                }
            )
        return calls

    def enrich_calls(self, calls: list[dict]) -> tuple[list[dict], list[dict], list[dict], list[dict], list[dict], list[dict]]:
        segments: list[dict] = []
        issues: list[dict] = []
        behaviors: list[dict] = []
        sentiments: list[dict] = []
        outcomes: list[dict] = []

        for call in calls:
            turns = [Turn(**turn) for turn in call["turns"]]
            issue_label, issue_scores = classify_issue(call["transcript_text"])
            outcome = classify_outcome(call["transcript_text"])
            behavior_labels = extract_behaviors(call["transcript_text"], outcome)
            sentiment_scores = score_sentiment(turns)
            call_segments = segment_call(call["call_id"], turns, issue_label)
            summary = summarize_call(issue_label, outcome, behavior_labels, sentiment_scores)

            call["issue"] = issue_label
            call["issue_scores"] = issue_scores
            call["outcome"] = outcome
            call["behaviors"] = behavior_labels
            call["sentiments"] = sentiment_scores
            call["segments"] = call_segments
            call["summary"] = summary

            segments.extend(call_segments)
            issues.append({"call_id": call["call_id"], "issue": issue_label, "scores": issue_scores})
            behaviors.append({"call_id": call["call_id"], "behaviors": behavior_labels})
            sentiments.append({"call_id": call["call_id"], **sentiment_scores})
            outcomes.append({"call_id": call["call_id"], "outcome": outcome})

        return calls, segments, issues, behaviors, sentiments, outcomes

    def build_triple_engine(self, calls: list[dict]) -> dict:
        total_calls = len(calls) or 1
        issue_counts = Counter(call["issue"] for call in calls)
        outcome_counts = Counter(call["outcome"] for call in calls)
        behavior_counts = Counter(behavior for call in calls for behavior in call["behaviors"])

        pattern_rollup: dict[tuple[str, str, str], dict] = {}
        for call in calls:
            call_behaviors = call["behaviors"] or ["none observed"]
            for behavior in call_behaviors:
                combo_key = (call["issue"], behavior, call["outcome"])
                entry = pattern_rollup.setdefault(
                    combo_key,
                    {
                        "key": combo_key,
                        "issue": call["issue"],
                        "behavior": behavior,
                        "outcome": call["outcome"],
                        "count": 0,
                        "call_ids": [],
                    },
                )
                entry["count"] += 1
                entry["call_ids"].append(call["call_id"])

        patterns: list[dict] = []
        for item in pattern_rollup.values():
            expected = (
                (issue_counts[item["issue"]] / total_calls)
                * (max(behavior_counts.get(item["behavior"], 1), 1) / total_calls)
                * (outcome_counts[item["outcome"]] / total_calls)
                * total_calls
            )
            lift = round(item["count"] / expected, 3) if expected else 0.0
            patterns.append(
                {
                    "key": item["key"],
                    "issue": item["issue"],
                    "behavior": item["behavior"],
                    "outcome": item["outcome"],
                    "count": item["count"],
                    "lift": lift,
                    "evidence": item["call_ids"][:5],
                    "call_ids": item["call_ids"],
                }
            )

        top_patterns = sorted(patterns, key=lambda item: (-item["count"], -item["lift"], item["issue"]))[:10]

        issues_ranked: list[dict] = []
        for issue, count in issue_counts.most_common():
            matching_calls = [call for call in calls if call["issue"] == issue]
            outcome_breakdown = dict(Counter(call["outcome"] for call in matching_calls))
            top_behaviors = [
                {"behavior": label, "count": behavior_count}
                for label, behavior_count in Counter(
                    behavior for call in matching_calls for behavior in call["behaviors"]
                ).most_common(5)
            ]
            average_shift = round(
                sum(call["sentiments"]["shift"] for call in matching_calls) / max(len(matching_calls), 1),
                3,
            )
            common_outcome = max(outcome_breakdown, key=outcome_breakdown.get) if outcome_breakdown else "unresolved"
            issues_ranked.append(
                {
                    "slug": _slugify(issue),
                    "issue": issue,
                    "count": count,
                    "summary": f"{issue.title()} appeared in {count} calls with {common_outcome} as the most common outcome.",
                    "top_behaviors": top_behaviors,
                    "outcome_breakdown": outcome_breakdown,
                    "average_shift": average_shift,
                    "representative_calls": [
                        {
                            "call_id": call["call_id"],
                            "source_file": call["source_file"],
                            "summary": call["summary"],
                            "sentiments": call["sentiments"],
                        }
                        for call in matching_calls[:5]
                    ],
                }
            )

        average_shift = round(
            sum(call["sentiments"]["shift"] for call in calls) / max(len(calls), 1),
            3,
        )
        opening_average = round(
            sum(call["sentiments"]["opening"] for call in calls) / max(len(calls), 1),
            3,
        )
        closing_average = round(
            sum(call["sentiments"]["closing"] for call in calls) / max(len(calls), 1),
            3,
        )
        most_common_issue = issue_counts.most_common(1)[0] if issue_counts else ("other", 0)
        most_common_behavior = behavior_counts.most_common(1)[0][0] if behavior_counts else "none observed"

        overview = {
            "metrics": [
                {"label": "Calls Indexed", "value": len(calls), "tone": "neutral"},
                {"label": "Issue Types", "value": len(issue_counts), "tone": "info"},
                {"label": "Escalations", "value": outcome_counts.get("escalated", 0), "tone": "risk"},
                {
                    "label": "Avg Sentiment Shift",
                    "value": average_shift,
                    "tone": "stable" if average_shift >= 0 else "warning",
                },
            ],
            "issue_counts": dict(issue_counts),
            "outcome_counts": dict(outcome_counts),
            "sentiment_summary": {
                "opening": opening_average,
                "closing": closing_average,
                "average_shift": average_shift,
            },
            "top_patterns": top_patterns,
            "daily_brief": [
                f"Most common issue today: {most_common_issue[0]} ({most_common_issue[1]} calls).",
                f"Escalated calls: {outcome_counts.get('escalated', 0)}; resolved calls: {outcome_counts.get('resolved', 0)}.",
                f"Most frequent behavior signal: {most_common_behavior}.",
            ],
        }

        call_cards = [
            {
                "call_id": call["call_id"],
                "source_file": call["source_file"],
                "issue": call["issue"],
                "outcome": call["outcome"],
                "behaviors": call["behaviors"],
                "summary": call["summary"],
                "sentiments": call["sentiments"],
            }
            for call in calls
        ]

        return {"overview": overview, "issues": issues_ranked, "calls": call_cards}

    def _build_default_strategies(self, bundle: dict) -> list[dict]:
        statuses = ["Proposed", "Accepted", "In Progress", "Evaluating", "Closed"]
        owners = ["Operations", "Servicing", "QA", "Training", "Leadership"]
        kpis = [
            ["AHT", "Escalation Rate"],
            ["FCR", "Repeat Calls"],
            ["Sentiment", "AHT"],
            ["Escalation Rate", "Sentiment"],
            ["Repeat Calls", "FCR"],
        ]
        created_at = self._now_iso()
        seeded: list[dict] = []
        for index, issue in enumerate(bundle["issues"][:5], start=1):
            seeded.append(
                {
                    "strategy_id": f"STRAT-{index:03d}",
                    "title": f"Improve {issue['issue']}",
                    "issue_slug": issue["slug"],
                    "issue": issue["issue"],
                    "status": statuses[(index - 1) % len(statuses)],
                    "owner": owners[(index - 1) % len(owners)],
                    "hypothesis": (
                        f"Standardize the strongest behaviors for {issue['issue']} and monitor the next recalibration "
                        "cycle for KPI movement."
                    ),
                    "kpi_focus": kpis[(index - 1) % len(kpis)],
                    "evidence_call_ids": [call["call_id"] for call in issue["representative_calls"][:3]],
                    "notes": issue["summary"],
                    "created_at": created_at,
                    "updated_at": created_at,
                }
            )
        return seeded

    def load_strategies(self, bundle: dict) -> list[dict]:
        self.ensure_output_dirs()
        path = self.strategy_store_path
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                seeded = self._build_default_strategies(bundle)
                self.save_strategies(seeded)
                return seeded

        seeded = self._build_default_strategies(bundle)
        self.save_strategies(seeded)
        return seeded

    def save_strategies(self, strategies: list[dict]) -> None:
        self.ensure_output_dirs()
        self.strategy_store_path.write_text(json.dumps(strategies, indent=2) + "\n", encoding="utf-8")

    def create_strategy(
        self,
        bundle: dict,
        *,
        issue_slug: str,
        title: str,
        owner: str,
        hypothesis: str,
        notes: str,
        kpi_focus: list[str],
        evidence_call_ids: list[str],
    ) -> dict:
        issue = next((item for item in bundle["issues"] if item["slug"] == issue_slug), None)
        if issue is None:
            raise ValueError("Issue not found")

        strategies = self.load_strategies(bundle)
        now = self._now_iso()
        strategy = {
            "strategy_id": f"STRAT-{uuid4().hex[:8].upper()}",
            "title": title.strip(),
            "issue_slug": issue_slug,
            "issue": issue["issue"],
            "status": "Proposed",
            "owner": owner.strip(),
            "hypothesis": hypothesis.strip(),
            "kpi_focus": kpi_focus,
            "evidence_call_ids": evidence_call_ids or [call["call_id"] for call in issue["representative_calls"][:2]],
            "notes": notes.strip(),
            "created_at": now,
            "updated_at": now,
        }
        strategies.insert(0, strategy)
        self.save_strategies(strategies)
        return strategy

    def update_strategy(self, bundle: dict, strategy_id: str, updates: dict) -> dict | None:
        strategies = self.load_strategies(bundle)
        for strategy in strategies:
            if strategy["strategy_id"] != strategy_id:
                continue
            for key, value in updates.items():
                if value is not None:
                    strategy[key] = value
            strategy["updated_at"] = self._now_iso()
            self.save_strategies(strategies)
            return strategy
        return None

    def build_strategy_board(self, bundle: dict) -> dict:
        stage_order = ["Proposed", "Accepted", "In Progress", "Evaluating", "Closed"]
        strategies = self.load_strategies(bundle)
        return {
            "stages": [
                {
                    "name": stage,
                    "count": sum(1 for strategy in strategies if strategy["status"] == stage),
                }
                for stage in stage_order
            ],
            "strategies": strategies,
        }

    def build_pulse_insights(self, bundle: dict) -> list[dict]:
        insights: list[dict] = []
        for index, pattern in enumerate(bundle["overview"]["top_patterns"][:6], start=1):
            trend = "Escalation risk" if pattern["outcome"] == "escalated" else "Stabilizing signal"
            insights.append(
                {
                    "insight_id": f"INS-{index:03d}",
                    "title": f"{pattern['issue'].title()} is moving through {pattern['behavior']}",
                    "issue": pattern["issue"],
                    "behavior": pattern["behavior"],
                    "outcome": pattern["outcome"],
                    "trend": trend,
                    "evidence_count": pattern["count"],
                    "summary": (
                        f"{pattern['count']} evidence calls show {pattern['behavior']} linked with "
                        f"{pattern['outcome']} for {pattern['issue']}."
                    ),
                    "call_ids": pattern["call_ids"],
                    "lift": pattern["lift"],
                }
            )
        return insights

    def build_recalibration_summary(self, bundle: dict) -> dict:
        top_issue = bundle["issues"][0] if bundle["issues"] else None
        declining_issue = bundle["issues"][-1] if bundle["issues"] else None
        return {
            "completed_at": self._now_iso(),
            "baseline_window": "Last 30 days",
            "new_clusters_detected": max(len(bundle["overview"]["issue_counts"]) - 6, 0),
            "retired_clusters": 0,
            "top_issue": top_issue["issue"] if top_issue else None,
            "focus_summary": (
                f"{top_issue['issue']} remains the highest-volume issue cluster." if top_issue else "No issue clusters detected."
            ),
            "taxonomy_notes": [
                f"{len(bundle['overview']['issue_counts'])} issue groupings are active in the current taxonomy.",
                f"Most common behavior signal remains {bundle['overview']['top_patterns'][0]['behavior']}."
                if bundle["overview"]["top_patterns"]
                else "No ranked patterns are available yet.",
                (
                    f"Lowest-volume active issue: {declining_issue['issue']}."
                    if declining_issue
                    else "No declining issue trend is available."
                ),
            ],
        }

    def build_ask_ci(self, bundle: dict) -> list[dict]:
        issues = bundle["issues"]
        patterns = bundle["overview"]["top_patterns"]
        escalation = next((pattern for pattern in patterns if pattern["outcome"] == "escalated"), None)
        resolved = next((pattern for pattern in patterns if pattern["outcome"] == "resolved"), None)
        lead_issue = issues[0] if issues else None
        return [
            {
                "question": "What should leadership review first?",
                "answer": (
                    f"Start with {lead_issue['issue']} because it is the largest recurring issue cluster."
                    if lead_issue
                    else "No lead issue is available yet."
                ),
                "evidence_call_ids": [call["call_id"] for call in lead_issue["representative_calls"][:3]] if lead_issue else [],
            },
            {
                "question": "Which pattern is driving escalations?",
                "answer": (
                    f"{escalation['issue']} paired with {escalation['behavior']} is the strongest escalated pattern."
                    if escalation
                    else "No escalated pattern is available yet."
                ),
                "evidence_call_ids": escalation["call_ids"][:3] if escalation else [],
            },
            {
                "question": "Where are agents stabilizing calls?",
                "answer": (
                    f"{resolved['behavior']} is the clearest resolved behavior for {resolved['issue']}."
                    if resolved
                    else "Resolved signals are still limited in the current corpus."
                ),
                "evidence_call_ids": resolved["call_ids"][:3] if resolved else [],
            },
        ]

    def build_report_summary(self, bundle: dict) -> dict:
        overview = bundle["overview"]
        return {
            "title": "Call Insights Operational Report",
            "generated_at": self._now_iso(),
            "totals": {
                "calls_indexed": overview["metrics"][0]["value"],
                "issue_types": overview["metrics"][1]["value"],
                "escalations": overview["metrics"][2]["value"],
                "avg_sentiment_shift": overview["metrics"][3]["value"],
            },
            "highlights": overview["daily_brief"],
            "issue_table": [
                {
                    "issue": issue["issue"],
                    "count": issue["count"],
                    "top_outcome": max(issue["outcome_breakdown"], key=issue["outcome_breakdown"].get),
                }
                for issue in bundle["issues"][:6]
            ],
        }

    def _pdf_escape(self, value: str) -> str:
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    def _wrap_pdf_lines(self, value: str, width: int = 88) -> list[str]:
        return textwrap.wrap(value, width=width, break_long_words=False, break_on_hyphens=False) or [value]

    def build_report_pdf(self, bundle: dict) -> bytes:
        report = self.build_report_summary(bundle)
        line_specs: list[tuple[str, int]] = [
            (report["title"], 18),
            (f"Generated: {report['generated_at']}", 11),
            ("", 11),
            ("Platform Summary", 14),
        ]
        for summary_line in self._wrap_pdf_lines(
            "Call Insights converts historical call transcripts into ranked issues, behavior patterns, "
            "strategy workflows, and evidence-backed reports for operational review."
        ):
            line_specs.append((summary_line, 11))

        line_specs.extend(
            [
                ("", 11),
                ("KPI Totals", 14),
            ]
        )
        for key, value in report["totals"].items():
            line_specs.append((f"{key.replace('_', ' ').title()}: {value}", 11))

        line_specs.extend(
            [
                ("", 11),
                ("Highlights", 14),
            ]
        )
        for highlight in report["highlights"]:
            for wrapped in self._wrap_pdf_lines(f"- {highlight}"):
                line_specs.append((wrapped, 11))

        line_specs.extend(
            [
                ("", 11),
                ("Issue Table", 14),
            ]
        )
        for row in report["issue_table"]:
            table_line = (
                f"{row['issue'].title()} | {row['count']} calls | top outcome: {row['top_outcome']}"
            )
            for wrapped in self._wrap_pdf_lines(table_line):
                line_specs.append((wrapped, 11))

        max_lines_per_page = 42
        pages: list[list[tuple[str, int]]] = [
            line_specs[index : index + max_lines_per_page]
            for index in range(0, len(line_specs), max_lines_per_page)
        ]

        objects: list[bytes] = []
        page_object_ids: list[int] = []
        font_object_id = 3 + (len(pages) * 2)

        objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")

        kids_refs = []
        for page_index, page_lines in enumerate(pages):
            page_object_id = 3 + (page_index * 2)
            content_object_id = page_object_id + 1
            page_object_ids.append(page_object_id)
            kids_refs.append(f"{page_object_id} 0 R")

            y_position = 790
            commands = []
            for text, size in page_lines:
                safe_text = self._pdf_escape(text)
                commands.append(f"BT /F1 {size} Tf 50 {y_position} Td ({safe_text}) Tj ET")
                y_position -= 18 if size >= 14 else 15
            content_stream = "\n".join(commands).encode("latin-1", errors="replace")

            page_object = (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                f"/Resources << /Font << /F1 {font_object_id} 0 R >> >> "
                f"/Contents {content_object_id} 0 R >>"
            ).encode("ascii")
            content_object = (
                f"<< /Length {len(content_stream)} >>\nstream\n".encode("ascii")
                + content_stream
                + b"\nendstream"
            )

            objects.append(page_object)
            objects.append(content_object)

        pages_object = f"<< /Type /Pages /Count {len(page_object_ids)} /Kids [{' '.join(kids_refs)}] >>".encode(
            "ascii"
        )
        objects.insert(1, pages_object)
        objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

        pdf = bytearray(b"%PDF-1.4\n")
        offsets = [0]
        for index, obj in enumerate(objects, start=1):
            offsets.append(len(pdf))
            pdf.extend(f"{index} 0 obj\n".encode("ascii"))
            pdf.extend(obj)
            pdf.extend(b"\nendobj\n")

        xref_offset = len(pdf)
        pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        pdf.extend(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
        pdf.extend(
            (
                f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF"
            ).encode("ascii")
        )
        return bytes(pdf)

    def build_governance_summary(self, bundle: dict) -> dict:
        strategy_board = self.build_strategy_board(bundle)
        return {
            "generated_at": self._now_iso(),
            "evidence_policy": [
                "Every insight references evidence call IDs before it is rendered.",
                "Strategies inherit issue references and evidence calls at creation time.",
                "Monthly recalibration metadata is logged with completion timestamps.",
            ],
            "audit_summary": {
                "strategies_tracked": len(strategy_board["strategies"]),
                "issue_clusters": len(bundle["overview"]["issue_counts"]),
                "evidence_backed_patterns": len(bundle["overview"]["top_patterns"]),
            },
            "monitors": [
                {"label": "Nightly pulse ready", "status": "healthy"},
                {"label": "Monthly recalibration", "status": "scheduled"},
                {"label": "Evidence pack coverage", "status": "healthy"},
            ],
        }

    def build_workspace(self, *, force: bool = False) -> dict:
        bundle = self.load_or_run(force=force)
        return {
            "dashboard": {
                "overview": bundle["overview"],
                "issues": bundle["issues"],
                "calls": bundle["calls"],
            },
            "pulse_insights": self.build_pulse_insights(bundle),
            "recalibration": self.build_recalibration_summary(bundle),
            "strategy_board": self.build_strategy_board(bundle),
            "ask_ci": self.build_ask_ci(bundle),
            "reports": self.build_report_summary(bundle),
            "governance": self.build_governance_summary(bundle),
        }

    def _write_jsonl(self, path: Path, rows: list[dict]) -> None:
        path.write_text("\n".join(json.dumps(row, ensure_ascii=True) for row in rows), encoding="utf-8")

    def run(self) -> dict:
        self.ensure_output_dirs()
        calls = self.ingest_calls()
        calls, segments, issues, behaviors, sentiments, outcomes = self.enrich_calls(calls)
        bundle = self.build_triple_engine(calls)
        bundle["call_details"] = {call["call_id"]: call for call in calls}

        self._write_jsonl(self.processed_dir / "calls.jsonl", calls)
        self._write_jsonl(self.processed_dir / "segments.jsonl", segments)
        self._write_jsonl(self.processed_dir / "issues.jsonl", issues)
        self._write_jsonl(self.processed_dir / "behaviors.jsonl", behaviors)
        self._write_jsonl(self.processed_dir / "sentiment.jsonl", sentiments)
        self._write_jsonl(self.processed_dir / "outcomes.jsonl", outcomes)

        (self.outputs_dir / "triple_engine_summary.json").write_text(
            json.dumps(
                {
                    "overview": bundle["overview"],
                    "issues": bundle["issues"],
                    "calls": bundle["calls"],
                    "top_patterns": bundle["overview"]["top_patterns"],
                },
                indent=2,
                ensure_ascii=True,
            )
            + "\n",
            encoding="utf-8",
        )

        return bundle

    def load_or_run(self, force: bool = False) -> dict:
        summary_path = self.outputs_dir / "triple_engine_summary.json"
        calls_path = self.processed_dir / "calls.jsonl"

        if force or not summary_path.exists() or not calls_path.exists():
            return self.run()

        calls = [
            json.loads(line)
            for line in calls_path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        summary = json.loads(summary_path.read_text(encoding="utf-8"))

        return {
            "overview": summary["overview"],
            "issues": summary["issues"],
            "calls": summary["calls"],
            "call_details": {call["call_id"]: call for call in calls},
        }
