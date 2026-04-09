from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

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
