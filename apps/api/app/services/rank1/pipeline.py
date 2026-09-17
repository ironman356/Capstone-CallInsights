from __future__ import annotations

import json
import os
import re
import textwrap
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from uuid import uuid4

from app.core.config import settings
from app.services.rank1.adaptive import AdaptiveIssueMemory, HuggingFaceAdaptiveEngine


@dataclass(frozen=True)
class IssueDefinition:
    label: str
    customer_patterns: tuple[str, ...]
    agent_patterns: tuple[str, ...]
    description: str


@dataclass(frozen=True)
class BehaviorDefinition:
    label: str
    patterns: tuple[str, ...]
    description: str


@dataclass
class Turn:
    speaker: str
    text: str


@dataclass
class IssueSignal:
    label: str
    score: int
    matched_terms: list[str] = field(default_factory=list)


ISSUE_DEFINITIONS: tuple[IssueDefinition, ...] = (
    IssueDefinition(
        label="payment posting / suspense",
        customer_patterns=(
            "payment still shows pending",
            "payment has not posted",
            "suspense account",
            "where did the payment go",
            "partial payment",
            "payment was drafted",
            "processing to posted",
        ),
        agent_patterns=("payment history", "processing window", "posted overnight", "suspense balance"),
        description="Borrower is confused about payment application, suspense, or posting timelines.",
    ),
    IssueDefinition(
        label="escrow shortage / payment increase",
        customer_patterns=(
            "escrow analysis",
            "payment went up",
            "shortage",
            "taxes increased",
            "insurance premium changed",
            "new monthly payment",
        ),
        agent_patterns=("projected disbursement", "spread the shortage", "escrow review", "county taxes"),
        description="Borrower is challenging a payment change tied to escrow analysis.",
    ),
    IssueDefinition(
        label="late fee / delinquency dispute",
        customer_patterns=(
            "late fee",
            "delinquent",
            "grace period",
            "i paid on time",
            "credit reporting",
            "past due notice",
        ),
        agent_patterns=("assessment date", "grace window", "delinquency status", "waive the late fee"),
        description="Borrower disputes fees, delinquency classification, or payment timing.",
    ),
    IssueDefinition(
        label="autopay / recurring draft",
        customer_patterns=(
            "autopay",
            "automatic payment",
            "never drafted",
            "recurring payment",
            "draft date",
            "bank account on file",
        ),
        agent_patterns=("enrollment cutoff", "next draft cycle", "manual payment", "draft schedule"),
        description="Borrower has questions about auto-debit enrollment, timing, or failed draft behavior.",
    ),
    IssueDefinition(
        label="loss mitigation / hardship",
        customer_patterns=(
            "forbearance",
            "hardship",
            "assistance options",
            "behind on payments",
            "payment assistance",
            "loss mitigation",
            "modification review",
        ),
        agent_patterns=("assistance application", "hardship package", "review queue", "home retention"),
        description="Borrower is seeking hardship relief, repayment options, or loss mitigation support.",
    ),
    IssueDefinition(
        label="payoff / refinance coordination",
        customer_patterns=(
            "payoff quote",
            "good-through date",
            "closing",
            "title company",
            "refinance",
            "wired funds",
            "paid off already",
        ),
        agent_patterns=("payoff statement", "good-through", "closing timeline", "refinance funds"),
        description="Borrower or closing team needs payoff details, refinance confirmation, or timing guidance.",
    ),
    IssueDefinition(
        label="insurance / tax disbursement",
        customer_patterns=(
            "hazard insurance",
            "lender placed insurance",
            "tax bill",
            "taxes were paid",
            "insurance was canceled",
            "county bill",
        ),
        agent_patterns=("insurance carrier", "tax disbursement", "proof of coverage", "escrow disbursement"),
        description="Borrower is calling about property insurance or tax bill handling.",
    ),
    IssueDefinition(
        label="statement / account history confusion",
        customer_patterns=(
            "statement does not make sense",
            "amount due",
            "account history",
            "line item",
            "fees on the statement",
            "billing statement",
        ),
        agent_patterns=("monthly statement", "transaction history", "line by line", "billing cycle"),
        description="Borrower cannot reconcile statement contents or account history entries.",
    ),
)

BEHAVIOR_DEFINITIONS: tuple[BehaviorDefinition, ...] = (
    BehaviorDefinition(
        label="completed verification",
        patterns=("verify", "full name", "property zip", "mailing address", "last four"),
        description="Agent verified the caller before discussing account details.",
    ),
    BehaviorDefinition(
        label="showed empathy",
        patterns=("i understand", "i am sorry", "i can hear the concern", "that sounds stressful", "frustrating"),
        description="Agent acknowledged borrower emotion or inconvenience.",
    ),
    BehaviorDefinition(
        label="explained servicing timeline",
        patterns=("processing window", "within two business days", "next cycle", "good-through date", "takes effect"),
        description="Agent clarified sequencing or operational timing.",
    ),
    BehaviorDefinition(
        label="explained policy clearly",
        patterns=("per the loan terms", "the account reflects", "policy", "grace window", "cutoff", "requires"),
        description="Agent grounded the answer in a servicing rule or policy condition.",
    ),
    BehaviorDefinition(
        label="set explicit next steps",
        patterns=("next step", "i will submit", "i am creating", "case number", "follow-up", "documenting"),
        description="Agent committed to a concrete action or follow-up path.",
    ),
    BehaviorDefinition(
        label="prevented repeat explanation",
        patterns=("adding notes", "document the issue", "not starting from zero", "notes are complete"),
        description="Agent reduced repeat-call friction by preserving context.",
    ),
    BehaviorDefinition(
        label="transferred or escalated",
        patterns=("transfer", "transferred", "supervisor", "specialist", "escalation"),
        description="Agent moved the call to another queue or authority level.",
    ),
)

BEHAVIOR_DESCRIPTION_MAP = {
    definition.label: definition.description for definition in BEHAVIOR_DEFINITIONS
}

POSITIVE_TERMS = frozenset(
    {
        "thank you",
        "that helps",
        "that clears it up",
        "i understand now",
        "appreciate",
        "good plan",
        "that makes sense",
        "path forward",
        "clear answer",
    }
)
NEGATIVE_TERMS = frozenset(
    {
        "frustrating",
        "upset",
        "not clear",
        "not happy",
        "still confused",
        "go in circles",
        "starting from zero",
        "escalate",
        "past due",
        "delinquent",
        "angry",
        "concerned",
    }
)

RESOLVED_TERMS = frozenset(
    {
        "that helps",
        "that clears it up",
        "i understand now",
        "answers my question",
        "that makes sense",
        "glad we could clear that up",
    }
)
FOLLOW_UP_TERMS = frozenset(
    {
        "follow-up",
        "research request",
        "review is completed",
        "review queue",
        "case was created",
        "callback",
        "already in motion",
    }
)
UNRESOLVED_TERMS = frozenset(
    {
        "still confused",
        "still not happy",
        "not clear",
        "does not answer",
        "do not know what changed",
        "nobody seems to know",
    }
)

STOPWORDS = frozenset(
    {
        "a",
        "about",
        "after",
        "all",
        "also",
        "am",
        "an",
        "and",
        "any",
        "are",
        "as",
        "at",
        "be",
        "because",
        "been",
        "before",
        "but",
        "by",
        "can",
        "could",
        "did",
        "do",
        "does",
        "for",
        "from",
        "get",
        "got",
        "had",
        "has",
        "have",
        "help",
        "how",
        "i",
        "if",
        "in",
        "into",
        "is",
        "it",
        "just",
        "know",
        "like",
        "me",
        "my",
        "need",
        "not",
        "now",
        "of",
        "on",
        "or",
        "our",
        "out",
        "please",
        "so",
        "someone",
        "still",
        "that",
        "the",
        "their",
        "them",
        "there",
        "this",
        "to",
        "today",
        "up",
        "want",
        "was",
        "we",
        "what",
        "when",
        "why",
        "with",
        "would",
        "you",
        "your",
    }
)


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
        speaker = speaker.strip().title()
        content = content.strip()
        if speaker not in {"Customer", "Agent"} or not content:
            continue
        turns.append(Turn(speaker=speaker, text=content))
    return turns


def _score_keywords(text: str, keyword_map: dict[str, list[str]]) -> dict[str, int]:
    lowered = text.lower()
    return {
        label: sum(lowered.count(pattern.lower()) for pattern in patterns)
        for label, patterns in keyword_map.items()
    }


def classify_issue(text: str) -> tuple[str, dict[str, int]]:
    phrases = _extract_keyphrases(text)
    if not phrases:
        return "other", {}
    label, score = phrases[0]
    scores = {phrase: phrase_score for phrase, phrase_score in phrases[:8]}
    if score < 3:
        return "other", {phrase: 0 for phrase in scores}
    return label, scores


def _matched_terms(text: str, patterns: Iterable[str]) -> list[str]:
    lowered = text.lower()
    return [pattern for pattern in patterns if pattern.lower() in lowered]


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


def _normalize_phrase(tokens: list[str]) -> str:
    phrase = " ".join(tokens).strip()
    phrase = re.sub(r"\s+", " ", phrase)
    return phrase


def _extract_keyphrases(text: str, *, max_phrases: int = 8) -> list[tuple[str, int]]:
    tokens = _tokenize(text)
    if not tokens:
        return []

    unigram_counts: Counter[str] = Counter()
    phrase_counts: Counter[str] = Counter()
    filtered = [token for token in tokens if len(token) > 2 and token not in STOPWORDS]

    for token in filtered:
        unigram_counts[token] += 1

    for size in (2, 3):
        for index in range(len(tokens) - size + 1):
            chunk = tokens[index : index + size]
            if any(token in STOPWORDS for token in chunk):
                continue
            phrase = _normalize_phrase(chunk)
            if len(phrase) >= 6:
                phrase_counts[phrase] += 1

    ranked = [(phrase, count * len(phrase.split())) for phrase, count in phrase_counts.items()]
    if not ranked:
        ranked = [(token, count) for token, count in unigram_counts.most_common(max_phrases)]
    ranked.sort(key=lambda item: (-item[1], item[0]))
    return ranked[:max_phrases]


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
    return {"opening": opening, "mid": mid, "closing": closing, "shift": round(closing - opening, 3)}


def classify_outcome(text: str) -> str:
    lowered = text.lower()
    if any(term in lowered for term in ("supervisor", "transfer", "specialist", "escalation")):
        return "escalated"
    if any(term in lowered for term in ("callback requested", "callback", "call me back")):
        return "callback requested"
    if any(term in lowered for term in RESOLVED_TERMS):
        return "resolved"
    if any(term in lowered for term in FOLLOW_UP_TERMS):
        return "follow-up needed"
    if any(term in lowered for term in UNRESOLVED_TERMS):
        return "unresolved"
    return "unresolved"


def extract_behaviors(text: str, outcome: str) -> list[str]:
    lowered = text.lower()
    labels = [
        definition.label
        for definition in BEHAVIOR_DEFINITIONS
        if any(pattern in lowered for pattern in definition.patterns)
    ]

    if outcome == "resolved" and "stabilized borrower" not in labels:
        if any(term in lowered for term in RESOLVED_TERMS | {"thank you", "appreciate"}):
            labels.append("stabilized borrower")
            labels.append("resolved calmly")

    if outcome in {"follow-up needed", "unresolved"} and "left issue open" not in labels:
        if any(term in lowered for term in UNRESOLVED_TERMS | FOLLOW_UP_TERMS):
            labels.append("left issue open")
            labels.append("failed to address concern")

    alias_map = {
        "showed empathy": "used empathy",
        "set explicit next steps": "offered next steps",
        "transferred or escalated": "transferred / escalated",
    }
    for label in list(labels):
        alias = alias_map.get(label)
        if alias:
            labels.append(alias)

    return sorted(set(labels))


def segment_call(call_id: str, turns: list[Turn], fallback_issue: str) -> list[dict]:
    if not turns:
        return []

    segments: list[dict] = []
    current_turns: list[Turn] = []
    current_issue = fallback_issue
    segment_index = 1
    customer_buffer: list[str] = []

    for turn in turns:
        current_turns.append(turn)
        if turn.speaker == "Customer":
            customer_buffer.append(turn.text)
            candidate_issue, candidate_scores = classify_issue(" ".join(customer_buffer[-2:]))
            if (
                len(current_turns) > 1
                and candidate_issue != "other"
                and candidate_issue != current_issue
                and candidate_scores.get(candidate_issue, 0) > 0
            ):
                segment_body = current_turns[:-1]
                if segment_body:
                    segment_text = "\n".join(f"{item.speaker}: {item.text}" for item in segment_body)
                    segments.append(
                        {
                            "segment_id": f"{call_id}-SEG-{segment_index:02d}",
                            "call_id": call_id,
                            "order": segment_index,
                            "issue": current_issue,
                            "text": segment_text,
                            "turn_count": len(segment_body),
                        }
                    )
                    segment_index += 1
                current_turns = [turn]
                current_issue = candidate_issue

    if current_turns:
        segment_text = "\n".join(f"{item.speaker}: {item.text}" for item in current_turns)
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
    behavior_text = ", ".join(behaviors[:3]) if behaviors else "limited operational signals"
    return (
        f"{issue.title()} call that ended as {outcome}. "
        f"Observed agent behaviors: {behavior_text}. "
        f"Sentiment shift was {sentiments['shift']:+.3f} from opening to close."
    )


def call_issue_labels(call: dict) -> list[str]:
    labels = [call.get("issue", "")]
    labels.extend(segment.get("issue", "") for segment in call.get("segments", []))
    return list(dict.fromkeys(label for label in labels if label))


def _customer_text(turns: list[Turn]) -> str:
    return " ".join(turn.text for turn in turns if turn.speaker == "Customer")


def _agent_text(turns: list[Turn]) -> str:
    return " ".join(turn.text for turn in turns if turn.speaker == "Agent")


class OptionalHuggingFaceAnalyzer:
    def __init__(self) -> None:
        self.enabled = settings.ENVIRONMENT != "test" and bool(os.getenv("RANK1_ENABLE_HF"))
        self._pipeline = None
        self._sentiment_pipeline = None

    def _load_pipeline(self):
        if not self.enabled or self._pipeline is not None:
            return self._pipeline
        try:
            from transformers import pipeline  # type: ignore

            model_id = os.getenv("RANK1_HF_TEXT2TEXT_MODEL", "google/flan-t5-base")
            self._pipeline = pipeline("text2text-generation", model=model_id)
        except Exception:
            self.enabled = False
            self._pipeline = None
        return self._pipeline

    def _load_sentiment_pipeline(self):
        if not self.enabled or self._sentiment_pipeline is not None:
            return self._sentiment_pipeline
        try:
            from transformers import pipeline  # type: ignore

            model_id = os.getenv(
                "RANK1_HF_SENTIMENT_MODEL",
                "cardiffnlp/twitter-roberta-base-sentiment-latest",
            )
            self._sentiment_pipeline = pipeline("sentiment-analysis", model=model_id)
        except Exception:
            self._sentiment_pipeline = None
        return self._sentiment_pipeline

    def enrich_issue_label(self, transcript_text: str, fallback_label: str) -> str:
        generator = self._load_pipeline()
        if generator is None:
            return fallback_label
        prompt = (
            "Read this customer service call transcript and return a short neutral issue label in 2 to 5 words. "
            "Do not invent details.\n\n"
            f"{transcript_text[:3500]}"
        )
        try:
            result = generator(prompt, max_new_tokens=12, do_sample=False)[0]["generated_text"].strip()
            return _slugify(result).replace("-", " ") or fallback_label
        except Exception:
            return fallback_label

    def summarize(self, transcript_text: str, fallback_summary: str) -> str:
        generator = self._load_pipeline()
        if generator is None:
            return fallback_summary
        prompt = (
            "Summarize this customer service call in one sentence with issue, outcome, and agent behavior. "
            "Ground only in the transcript.\n\n"
            f"{transcript_text[:3500]}"
        )
        try:
            return generator(prompt, max_new_tokens=64, do_sample=False)[0]["generated_text"].strip() or fallback_summary
        except Exception:
            return fallback_summary

    def score_section_sentiment(self, text: str) -> float | None:
        classifier = self._load_sentiment_pipeline()
        if classifier is None or not text.strip():
            return None
        try:
            result = classifier(text[:2000], truncation=True)[0]
        except Exception:
            return None
        label = str(result.get("label", "")).lower()
        score = float(result.get("score", 0.0))
        if "positive" in label:
            return round(score, 3)
        if "negative" in label:
            return round(-score, 3)
        return 0.0


class Rank1PipelineService:
    def __init__(self) -> None:
        self.raw_dir = settings.RAW_TRANSCRIPTS_DIR
        self.processed_dir = settings.PROCESSED_DIR
        self.outputs_dir = settings.OUTPUTS_DIR
        self.hf_engine = HuggingFaceAdaptiveEngine()
        self.issue_memory = AdaptiveIssueMemory(self.outputs_dir / "adaptive_issue_memory.json", self.hf_engine)

    def ensure_output_dirs(self) -> None:
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self.outputs_dir.mkdir(parents=True, exist_ok=True)
        self._sync_issue_memory()

    def _sync_issue_memory(self) -> None:
        if self.issue_memory.store_path.parent != self.outputs_dir:
            self.issue_memory = AdaptiveIssueMemory(self.outputs_dir / "adaptive_issue_memory.json", self.hf_engine)

    @property
    def strategy_store_path(self) -> Path:
        return self.outputs_dir / "strategy_board.json"

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    def _iter_source_files(self) -> list[Path]:
        text_files = sorted(self.raw_dir.glob("*.txt"))
        jsonl_files = sorted(self.raw_dir.glob("*.jsonl"))
        return jsonl_files + text_files

    def _normalize_record(self, record: dict, source_name: str, index: int) -> dict:
        transcript_text = str(record.get("transcript_text") or record.get("transcript") or "").strip()
        turns = record.get("turns")
        if isinstance(turns, list) and turns:
            normalized_turns = [
                {"speaker": str(turn.get("speaker", "")).title(), "text": str(turn.get("text", "")).strip()}
                for turn in turns
                if str(turn.get("speaker", "")).title() in {"Customer", "Agent"} and str(turn.get("text", "")).strip()
            ]
        else:
            normalized_turns = [{"speaker": turn.speaker, "text": turn.text} for turn in _extract_turns(transcript_text)]

        if not transcript_text and normalized_turns:
            transcript_text = "\n".join(f"{turn['speaker']}: {turn['text']}" for turn in normalized_turns)

        call_id = str(record.get("call_id") or f"CALL-{index:04d}")
        return {
            "call_id": call_id,
            "source_file": source_name,
            "timestamp_start": record.get("timestamp_start"),
            "timestamp_end": record.get("timestamp_end"),
            "agent_id": record.get("agent_id"),
            "queue": record.get("queue"),
            "team": record.get("team"),
            "metadata": record.get("metadata", {}),
            "transcript_text": transcript_text,
            "turns": normalized_turns,
            "turn_count": len(normalized_turns),
        }

    def ingest_calls(self) -> list[dict]:
        if not self.raw_dir.exists():
            raise FileNotFoundError(f"Transcript directory not found: {self.raw_dir}")

        calls: list[dict] = []
        for source_path in self._iter_source_files():
            if source_path.suffix == ".jsonl":
                for line_number, line in enumerate(source_path.read_text(encoding="utf-8").splitlines(), start=1):
                    if not line.strip():
                        continue
                    record = json.loads(line)
                    calls.append(self._normalize_record(record, f"{source_path.name}:{line_number}", len(calls) + 1))
            else:
                transcript_text = source_path.read_text(encoding="utf-8").strip()
                calls.append(self._normalize_record({"transcript_text": transcript_text}, source_path.name, len(calls) + 1))
        return calls

    def infer_issue_signal(self, turns: list[Turn]) -> tuple[str, dict[str, int], list[IssueSignal]]:
        customer_turns = [turn.text for turn in turns if turn.speaker == "Customer"]
        opening_customer = " ".join(customer_turns[:1]).strip()
        customer_text = _customer_text(turns)
        agent_text = _agent_text(turns)
        corpus_text = f"{opening_customer} {customer_text} {agent_text}".strip()
        phrases = _extract_keyphrases(opening_customer or customer_text or corpus_text)
        if not phrases:
            return "other", {}, []
        signals = [
            IssueSignal(label=phrase, score=score, matched_terms=[phrase])
            for phrase, score in phrases
        ]
        top = signals[0]
        return top.label, {signal.label: signal.score for signal in signals}, signals

    def detect_customer_actions(self, turns: list[Turn]) -> list[str]:
        transcript = "\n".join(f"{turn.speaker}: {turn.text}" for turn in turns)
        inferred = self.hf_engine.generate_list(
            "Extract concrete actions the customer was asked to take or requested to happen from this call.",
            transcript,
            [],
        )
        if inferred:
            return inferred
        customer_text = _customer_text(turns).lower()
        actions: list[str] = []
        if "make a manual payment" in customer_text or "pay today" in customer_text:
            actions.append("customer expected to make manual payment")
        if "send proof of insurance" in customer_text or "declaration page" in customer_text:
            actions.append("customer expected to provide insurance documents")
        if "call me back" in customer_text or "callback" in customer_text:
            actions.append("customer requested callback")
        if "application" in customer_text or "package" in customer_text:
            actions.append("customer expected to submit hardship package")
        return actions

    def detect_unaddressed_issues(self, turns: list[Turn], outcome: str) -> list[str]:
        transcript = "\n".join(f"{turn.speaker}: {turn.text}" for turn in turns)
        inferred = self.hf_engine.generate_list(
            "List unresolved risks, unanswered questions, or follow-up gaps that remained at the end of this call.",
            transcript,
            [],
        )
        if inferred:
            return inferred
        transcript = " ".join(turn.text.lower() for turn in turns)
        open_items: list[str] = []
        if outcome in {"follow-up needed", "unresolved", "callback requested"}:
            open_items.append("resolution pending after initial servicing contact")
        if "already called once" in transcript or "repeat call" in transcript:
            open_items.append("repeat-call risk remained present")
        if "still confused" in transcript or "not clear" in transcript:
            open_items.append("borrower remained unclear on account explanation")
        return open_items

    def build_call_features(self, call: dict) -> dict:
        self._sync_issue_memory()
        turns = [Turn(**turn) for turn in call["turns"]]
        opening_customer_issue = " ".join(turn.text for turn in turns if turn.speaker == "Customer").split(".")[0].strip()
        seed_issue_label, issue_scores, ranked_signals = self.infer_issue_signal(turns)
        issue_assignment = self.issue_memory.assign(
            call_id=call["call_id"],
            transcript_text=opening_customer_issue or call["transcript_text"],
            fallback_label=seed_issue_label,
        )
        issue_label = issue_assignment.label
        issue_scores[issue_label] = max(issue_scores.get(issue_label, 0), int(round(issue_assignment.similarity * 10)))
        outcome = self.hf_engine.classify_outcome(call["transcript_text"], classify_outcome(call["transcript_text"]))
        agent_text = _agent_text(turns)
        heuristic_behaviors = extract_behaviors(agent_text, outcome)
        hf_behaviors = self.hf_engine.select_labels_by_similarity(
            agent_text,
            BEHAVIOR_DESCRIPTION_MAP,
            threshold=0.24,
            max_labels=5,
        )
        behaviors = sorted(set(heuristic_behaviors + hf_behaviors))
        if self.hf_engine.deep_llm_enabled:
            behaviors = self.hf_engine.generate_list(
                "List the main agent behaviors or strategies used during this call.",
                call["transcript_text"],
                behaviors,
            )
        sentiments = score_sentiment(turns)
        hf_sentiments = self._score_sentiment_with_hf(turns)
        if hf_sentiments is not None:
            sentiments = hf_sentiments
        segments = segment_call(call["call_id"], turns, issue_label)
        customer_actions = self.detect_customer_actions(turns)
        unaddressed = self.detect_unaddressed_issues(turns, outcome)
        summary = summarize_call(issue_label, outcome, behaviors, sentiments)
        summary = self.hf_engine.summarize(call["transcript_text"], summary)

        return {
            "issue": issue_label,
            "issue_cluster_id": issue_assignment.cluster_id,
            "issue_cluster_similarity": issue_assignment.similarity,
            "issue_scores": issue_scores,
            "issue_signals": [
                {"issue": signal.label, "score": signal.score, "matched_terms": signal.matched_terms}
                for signal in ranked_signals
                if signal.score > 0
            ],
            "outcome": outcome,
            "behaviors": behaviors,
            "sentiments": sentiments,
            "segments": segments,
            "customer_actions": customer_actions,
            "unaddressed_issues": unaddressed,
            "summary": summary,
        }

    def _score_sentiment_with_hf(self, turns: list[Turn]) -> dict[str, float] | None:
        sections = _split_sections(turns)
        opening = self.hf_engine.score_section_sentiment(" ".join(turn.text for turn in sections["opening"]))
        mid = self.hf_engine.score_section_sentiment(" ".join(turn.text for turn in sections["mid"]))
        closing = self.hf_engine.score_section_sentiment(" ".join(turn.text for turn in sections["closing"]))
        if opening is None or mid is None or closing is None:
            return None
        return {"opening": opening, "mid": mid, "closing": closing, "shift": round(closing - opening, 3)}

    def enrich_calls(
        self, calls: list[dict]
    ) -> tuple[list[dict], list[dict], list[dict], list[dict], list[dict], list[dict]]:
        segments: list[dict] = []
        issues: list[dict] = []
        behaviors: list[dict] = []
        sentiments: list[dict] = []
        outcomes: list[dict] = []

        for call in calls:
            features = self.build_call_features(call)
            call.update(features)

            segments.extend(call["segments"])
            issues.append(
                {
                    "call_id": call["call_id"],
                    "issue": call["issue"],
                    "scores": call["issue_scores"],
                    "signals": call["issue_signals"],
                }
            )
            behaviors.append({"call_id": call["call_id"], "behaviors": call["behaviors"]})
            sentiments.append({"call_id": call["call_id"], **call["sentiments"]})
            outcomes.append({"call_id": call["call_id"], "outcome": call["outcome"]})

        return calls, segments, issues, behaviors, sentiments, outcomes

    def _build_evidence_pack(self, issue: str, matching_calls: list[dict]) -> dict:
        counts = Counter(call["outcome"] for call in matching_calls)
        avg_shift = round(
            sum(call["sentiments"]["shift"] for call in matching_calls) / max(len(matching_calls), 1),
            3,
        )
        return {
            "issue": issue,
            "time_window": "demo corpus",
            "sample_size": len(matching_calls),
            "outcomes": dict(counts),
            "avg_sentiment_shift": avg_shift,
            "representative_call_ids": [call["call_id"] for call in matching_calls[:5]],
        }

    def build_triple_engine(self, calls: list[dict]) -> dict:
        total_calls = len(calls) or 1
        issue_counts = Counter(call["issue"] for call in calls)
        outcome_counts = Counter(call["outcome"] for call in calls)
        behavior_counts = Counter(behavior for call in calls for behavior in call["behaviors"])

        pattern_rollup: dict[tuple[str, str, str], dict] = {}
        for call in calls:
            for behavior in call["behaviors"] or ["no behavior signal"]:
                key = (call["issue"], behavior, call["outcome"])
                entry = pattern_rollup.setdefault(
                    key,
                    {
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
                    "key": (item["issue"], item["behavior"], item["outcome"]),
                    "issue": item["issue"],
                    "behavior": item["behavior"],
                    "outcome": item["outcome"],
                    "count": item["count"],
                    "lift": lift,
                    "evidence": item["call_ids"][:5],
                    "call_ids": item["call_ids"],
                }
            )
        top_patterns = sorted(patterns, key=lambda item: (-item["count"], -item["lift"], item["issue"]))[:12]

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
            common_outcome = max(outcome_breakdown, key=outcome_breakdown.get) if outcome_breakdown else "unresolved"
            evidence_pack = self._build_evidence_pack(issue, matching_calls)
            issues_ranked.append(
                {
                    "slug": _slugify(issue),
                    "issue": issue,
                    "count": count,
                    "summary": (
                        f"{issue.title()} appeared in {count} calls; the most common outcome was {common_outcome}."
                    ),
                    "top_behaviors": top_behaviors,
                    "outcome_breakdown": outcome_breakdown,
                    "average_shift": evidence_pack["avg_sentiment_shift"],
                    "evidence_pack": evidence_pack,
                    "representative_calls": [
                        {
                            "call_id": call["call_id"],
                            "source_file": call["source_file"],
                            "summary": call["summary"],
                            "sentiments": call["sentiments"],
                            "outcome": call["outcome"],
                        }
                        for call in matching_calls[:5]
                    ],
                }
            )

        average_shift = round(sum(call["sentiments"]["shift"] for call in calls) / max(len(calls), 1), 3)
        repeat_risk = sum(
            1 for call in calls if "repeat-call risk remained present" in call.get("unaddressed_issues", [])
        )
        most_common_issue = issue_counts.most_common(1)[0] if issue_counts else ("other", 0)
        most_common_behavior = behavior_counts.most_common(1)[0][0] if behavior_counts else "no behavior signal"

        overview = {
            "metrics": [
                {"label": "Calls Indexed", "value": len(calls), "tone": "neutral"},
                {"label": "Issue Types", "value": len(issue_counts), "tone": "info"},
                {"label": "Escalations", "value": outcome_counts.get("escalated", 0), "tone": "risk"},
                {"label": "Repeat-Call Risk", "value": repeat_risk, "tone": "warning" if repeat_risk else "stable"},
                {
                    "label": "Avg Sentiment Shift",
                    "value": average_shift,
                    "tone": "stable" if average_shift >= 0 else "warning",
                },
            ],
            "issue_counts": dict(issue_counts),
            "outcome_counts": dict(outcome_counts),
            "sentiment_summary": {
                "opening": round(sum(call["sentiments"]["opening"] for call in calls) / max(len(calls), 1), 3),
                "closing": round(sum(call["sentiments"]["closing"] for call in calls) / max(len(calls), 1), 3),
                "average_shift": average_shift,
            },
            "top_patterns": top_patterns,
            "daily_brief": [
                f"Highest-volume borrower issue: {most_common_issue[0]} ({most_common_issue[1]} calls).",
                f"Escalated calls: {outcome_counts.get('escalated', 0)}; follow-up dependent calls: {outcome_counts.get('follow-up needed', 0)}.",
                f"Most common agent behavior signal: {most_common_behavior}.",
            ],
        }

        call_cards = [
            {
                "call_id": call["call_id"],
                "source_file": call["source_file"],
                "issue": call["issue"],
                "issues": call_issue_labels(call),
                "outcome": call["outcome"],
                "behaviors": call["behaviors"],
                "summary": call["summary"],
                "sentiments": call["sentiments"],
                "timestamp_start": call.get("timestamp_start"),
                "timestamp_end": call.get("timestamp_end"),
            }
            for call in calls
        ]
        return {"overview": overview, "issues": issues_ranked, "calls": call_cards}

    def _build_default_strategies(self, bundle: dict) -> list[dict]:
        created_at = self._now_iso()
        stage_cycle = ["Proposed", "Accepted", "In Progress", "Evaluating", "Closed"]
        owners = ["Servicing Ops", "QA", "Training", "Escrow", "Default"]
        strategies: list[dict] = []
        for index, issue in enumerate(bundle["issues"][:5], start=1):
            top_behavior = issue["top_behaviors"][0]["behavior"] if issue["top_behaviors"] else "standardized servicing guidance"
            strategies.append(
                {
                    "strategy_id": f"STRAT-{index:03d}",
                    "title": f"Standardize response for {issue['issue']}",
                    "issue_slug": issue["slug"],
                    "issue": issue["issue"],
                    "status": stage_cycle[(index - 1) % len(stage_cycle)],
                    "owner": owners[(index - 1) % len(owners)],
                    "hypothesis": (
                        f"Codify {top_behavior} for {issue['issue']} and monitor downstream movement in repeat-call risk, "
                        "escalation rate, and sentiment shift."
                    ),
                    "kpi_focus": ["AHT", "FCR", "Repeat Calls"],
                    "evidence_call_ids": [call["call_id"] for call in issue["representative_calls"][:3]],
                    "notes": issue["summary"],
                    "due_date": None,
                    "created_at": created_at,
                    "updated_at": created_at,
                }
            )
        return strategies

    def load_strategies(self, bundle: dict) -> list[dict]:
        self.ensure_output_dirs()
        path = self.strategy_store_path
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                pass
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
        due_date: str | None,
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
            "due_date": due_date,
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
                if key == "due_date" or value is not None:
                    strategy[key] = value
            strategy["updated_at"] = self._now_iso()
            self.save_strategies(strategies)
            return strategy
        return None

    def delete_strategy(self, bundle: dict, strategy_id: str) -> dict | None:
        strategies = self.load_strategies(bundle)
        for index, strategy in enumerate(strategies):
            if strategy["strategy_id"] != strategy_id:
                continue
            removed = strategies.pop(index)
            self.save_strategies(strategies)
            return removed
        return None

    def build_strategy_board(self, bundle: dict) -> dict:
        stages = ["Proposed", "Accepted", "In Progress", "Evaluating", "Closed"]
        strategies = self.load_strategies(bundle)
        return {
            "stages": [{"name": stage, "count": sum(1 for strategy in strategies if strategy["status"] == stage)} for stage in stages],
            "strategies": strategies,
        }

    def build_pulse_insights(self, bundle: dict) -> list[dict]:
        insights: list[dict] = []
        for index, pattern in enumerate(bundle["overview"]["top_patterns"][:6], start=1):
            trend = "Escalation risk" if pattern["outcome"] == "escalated" else "Operational watch"
            insights.append(
                {
                    "insight_id": f"INS-{index:03d}",
                    "title": f"{pattern['issue'].title()} linked to {pattern['behavior']}",
                    "issue": pattern["issue"],
                    "behavior": pattern["behavior"],
                    "outcome": pattern["outcome"],
                    "trend": trend,
                    "evidence_count": pattern["count"],
                    "summary": (
                        f"{pattern['count']} calls connect {pattern['behavior']} with {pattern['outcome']} "
                        f"inside the {pattern['issue']} issue family."
                    ),
                    "call_ids": pattern["call_ids"],
                    "lift": pattern["lift"],
                }
            )
        return insights

    def build_recalibration_summary(self, bundle: dict) -> dict:
        top_issue = bundle["issues"][0] if bundle["issues"] else None
        low_issue = bundle["issues"][-1] if bundle["issues"] else None
        return {
            "completed_at": self._now_iso(),
            "baseline_window": "Last 30 days",
            "new_clusters_detected": max(len(bundle["overview"]["issue_counts"]) - 5, 0),
            "retired_clusters": 0,
            "top_issue": top_issue["issue"] if top_issue else None,
            "focus_summary": (
                f"{top_issue['issue']} remains the dominant borrower friction point in the current corpus."
                if top_issue
                else "No issue clusters detected."
            ),
            "taxonomy_notes": [
                f"{len(bundle['overview']['issue_counts'])} active issue groupings are currently tracked.",
                (
                    f"Lowest-volume issue cluster is {low_issue['issue']}."
                    if low_issue
                    else "No declining issue cluster available."
                ),
            ],
        }

    def build_ask_ci(self, bundle: dict) -> list[dict]:
        lead_issue = bundle["issues"][0] if bundle["issues"] else None
        escalated = next((item for item in bundle["overview"]["top_patterns"] if item["outcome"] == "escalated"), None)
        stable = next((item for item in bundle["overview"]["top_patterns"] if item["outcome"] == "resolved"), None)
        return [
            {
                "question": "What should leadership review first?",
                "answer": (
                    f"Review {lead_issue['issue']} first because it is the largest recurring issue family."
                    if lead_issue
                    else "The corpus does not yet have a dominant issue family."
                ),
                "evidence_call_ids": [call["call_id"] for call in lead_issue["representative_calls"][:3]] if lead_issue else [],
            },
            {
                "question": "Which behavior is showing escalation risk?",
                "answer": (
                    f"{escalated['behavior']} is the strongest escalated signal within {escalated['issue']}."
                    if escalated
                    else "No escalated pattern is available yet."
                ),
                "evidence_call_ids": escalated["call_ids"][:3] if escalated else [],
            },
            {
                "question": "Where are calls stabilizing?",
                "answer": (
                    f"{stable['behavior']} is the clearest resolved behavior pattern for {stable['issue']}."
                    if stable
                    else "Resolved patterns are still limited in this corpus."
                ),
                "evidence_call_ids": stable["call_ids"][:3] if stable else [],
            },
        ]

    def _build_ask_ci_actions(self, bundle: dict, question: str) -> list[dict]:
        question_lower = question.lower()
        actions: list[dict] = []
        top_issue = bundle["issues"][0] if bundle["issues"] else None
        top_call = bundle["calls"][0] if bundle["calls"] else None

        if any(term in question_lower for term in ("strategy", "strategies", "action plan", "owner", "workflow")):
            actions.append({"type": "page", "label": "Open Action Plans", "target": "strategies"})
        if any(term in question_lower for term in ("issue", "issues", "problem", "evidence", "driver")) and top_issue:
            actions.append({"type": "issue", "label": f"Open {top_issue['issue']}", "target": top_issue["slug"]})
        if any(term in question_lower for term in ("call", "calls", "transcript", "example")) and top_call:
            actions.append({"type": "call", "label": f"Open {top_call['call_id']}", "target": top_call["call_id"]})
        if any(term in question_lower for term in ("governance", "control", "audit", "policy")):
            actions.append({"type": "page", "label": "Open Governance", "target": "governance"})
        if any(term in question_lower for term in ("report", "export", "leadership")):
            actions.append({"type": "page", "label": "Open Reports", "target": "reports"})
        if not actions and top_issue:
            actions.append({"type": "issue", "label": f"Review {top_issue['issue']}", "target": top_issue["slug"]})
        return actions[:3]

    def _build_ask_ci_sources(self, question: str) -> list[str]:
        question_lower = question.lower()
        sources = ["Workspace summary"]
        if any(term in question_lower for term in ("strategy", "strategies", "action plan")):
            sources.append("Strategy board")
        if any(term in question_lower for term in ("issue", "issues", "problem", "driver")):
            sources.append("Issue explorer")
        if any(term in question_lower for term in ("call", "transcript")):
            sources.append("Call review")
        if any(term in question_lower for term in ("governance", "policy", "audit", "control")):
            sources.append("Governance")
        if any(term in question_lower for term in ("report", "leadership", "export")):
            sources.append("Reports")
        if any(term in question_lower for term in ("sentiment", "outcome", "resolved", "escalated")):
            sources.append("Dashboard overview")
        return sources

    def _build_ask_ci_context(self, bundle: dict, question: str, current_page: str | None, history: list[dict] | None) -> str:
        top_issue = bundle["issues"][0] if bundle["issues"] else None
        top_patterns = bundle["overview"]["top_patterns"][:4]
        strategies = self.build_strategy_board(bundle)["strategies"][:6]
        pulse = self.build_pulse_insights(bundle)[:4]
        reports = self.build_report_summary(bundle)
        governance = self.build_governance_summary(bundle)
        history_lines = []
        for item in (history or [])[-6:]:
            role = str(item.get("role", "user")).title()
            content = str(item.get("text") or item.get("content") or "").strip()
            if content:
                history_lines.append(f"{role}: {content[:240]}")

        sections = [
            f"Current page: {current_page or 'overview'}",
            f"Top issue: {top_issue['issue']} ({top_issue['count']} calls)" if top_issue else "Top issue: none",
            "Issues:\n" + "\n".join(
                f"- {issue['issue']}: {issue['count']} calls, summary: {issue['summary']}"
                for issue in bundle["issues"][:5]
            ),
            "Top patterns:\n" + "\n".join(
                f"- {pattern['issue']} | {pattern['behavior']} | {pattern['outcome']} | {pattern['count']} calls | lift {pattern['lift']:.2f}"
                for pattern in top_patterns
            ),
            "Action plans:\n" + (
                "\n".join(
                    f"- {item['title']} | issue: {item['issue']} | status: {item['status']} | owner: {item['owner']} | KPI: {', '.join(item['kpi_focus']) or 'none'}"
                    for item in strategies
                )
                if strategies
                else "- No action plans tracked."
            ),
            "Daily pulse:\n" + "\n".join(f"- {item['title']}: {item['summary']}" for item in pulse),
            "Governance:\n" + "\n".join(f"- {item['label']}: {item['status']}" for item in governance["monitors"]),
            "Reports:\n" + "\n".join(f"- {highlight}" for highlight in reports["highlights"][:4]),
        ]
        if history_lines:
            sections.append("Recent conversation:\n" + "\n".join(history_lines))
        sections.append(f"User question: {question}")
        return "\n\n".join(sections)

    def _fallback_ask_ci_answer(self, bundle: dict, question: str, current_page: str | None) -> str:
        question_lower = question.lower()
        board = self.build_strategy_board(bundle)
        top_issue = bundle["issues"][0] if bundle["issues"] else None
        top_call = bundle["calls"][0] if bundle["calls"] else None
        sentiment = bundle["overview"]["sentiment_summary"]

        if any(term in question_lower for term in ("strategy", "strategies", "action plan", "workflow")):
            open_items = [item for item in board["strategies"] if item["status"] != "Closed"]
            if open_items:
                sample = open_items[0]
                return (
                    f"There are {len(open_items)} active action plans. "
                    f"The first one is {sample['title']} for {sample['issue']}, owned by {sample['owner']}, "
                    f"and currently in {sample['status']}."
                )
            return "There are no active action plans yet. You can create one from the Action Plans page."

        if any(term in question_lower for term in ("issue", "issues", "driver", "problem")) and top_issue:
            return (
                f"The largest current call driver is {top_issue['issue']} with {top_issue['count']} calls. "
                f"Open Issues to review its evidence, top behaviors, and representative calls."
            )

        if any(term in question_lower for term in ("call", "transcript", "example")) and top_call:
            return (
                f"A representative call is {top_call['call_id']}, currently tagged to {top_call['issue']}. "
                f"Open Calls to review the transcript and extracted call detail."
            )

        if any(term in question_lower for term in ("sentiment", "outcome", "resolved", "escalated")):
            return (
                f"Opening sentiment is {sentiment.get('opening', 0.0):.2f}, closing sentiment is {sentiment.get('closing', 0.0):.2f}, "
                f"and average shift is {sentiment.get('average_shift', 0.0):.2f}. Use Overview for the aggregate view."
            )

        if any(term in question_lower for term in ("governance", "control", "audit", "policy")):
            return "Governance shows the system map, evidence rules, and control checks used to keep outputs reviewable and traceable."

        if any(term in question_lower for term in ("report", "export", "leadership")):
            return "Reports packages the management summary, KPI totals, narrative highlights, and issue table for export."

        if any(term in question_lower for term in ("update", "refresh", "new transcript", "learn")):
            return (
                "The system refreshes as new transcripts arrive. Similar calls stay grouped together, new themes can form new issue groups, "
                "and the trend refresh updates the dashboard without relying on a fixed issue list."
            )

        return (
            f"You are currently in {current_page or 'the dashboard'}. "
            "Ask about issues, calls, action plans, governance, reports, or current service trends."
        )

    def _format_ask_ci_answer(self, answer: str) -> str:
        cleaned = re.sub(r"\s+", " ", answer).strip()
        if not cleaned:
            return cleaned

        cleaned = re.sub(r"(?i)\bask ci\b\s*", "", cleaned).strip(" :|-")
        cleaned = cleaned.replace("IM=mproving", "Improving")

        if "|" in cleaned:
            parts = [part.strip(" .") for part in cleaned.split("|") if part.strip(" .")]
            intro_parts: list[str] = []
            detail_groups: list[str] = []
            seen_groups: set[str] = set()
            current_group: dict[str, str] = {}

            def flush_group() -> None:
                if not current_group:
                    return
                detail = []
                issue = current_group.get("issue")
                status = current_group.get("status")
                owner = current_group.get("owner")
                kpi = current_group.get("kpi")
                if issue:
                    detail.append(f"issue: {issue}")
                if status:
                    detail.append(f"status: {status}")
                if owner:
                    detail.append(f"owner: {owner}")
                if kpi:
                    detail.append(f"KPI: {kpi}")
                if detail:
                    line = ", ".join(detail)
                    if line not in seen_groups:
                        seen_groups.add(line)
                        detail_groups.append(line)
                current_group.clear()

            for part in parts:
                if ":" not in part:
                    intro_parts.append(part)
                    continue
                key, value = part.split(":", 1)
                normalized_key = key.strip().lower()
                normalized_value = value.strip()
                if normalized_key in {"summary", "title"}:
                    flush_group()
                    intro_parts.append(normalized_value)
                    continue
                if normalized_key in {"issue", "status", "owner", "kpi"}:
                    if normalized_key == "issue" and current_group:
                        flush_group()
                    current_group[normalized_key] = normalized_value
                    continue
                intro_parts.append(part)
            flush_group()

            sentences: list[str] = []
            if intro_parts:
                sentences.append(". ".join(dict.fromkeys(intro_parts)).strip())
            if detail_groups:
                if len(detail_groups) == 1:
                    sentences.append(f"Related action plan details: {detail_groups[0]}.")
                else:
                    sentences.append("Related action plan details: " + "; ".join(detail_groups) + ".")
            cleaned = " ".join(sentence.rstrip(".") + "." for sentence in sentences if sentence.strip())

        cleaned = re.sub(r"\s*:\s*", ": ", cleaned)
        cleaned = re.sub(r"\s+,", ",", cleaned)
        cleaned = re.sub(r"\.{2,}", ".", cleaned)
        return cleaned.strip()

    def _generate_ask_ci_with_gemini(self, prompt: str) -> str | None:
        if os.getenv("ASK_CI_PROVIDER", "").lower() != "gemini":
            return None

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return None

        model = os.getenv("ASK_CI_GEMINI_MODEL", "gemini-2.0-flash")
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 220,
            },
        }
        request = urllib.request.Request(
            url=f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                body = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError):
            return None

        candidates = body.get("candidates")
        if not isinstance(candidates, list):
            return None

        parts: list[str] = []
        for candidate in candidates:
            content = candidate.get("content", {})
            for part in content.get("parts", []):
                text = part.get("text")
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())
        if not parts:
            return None
        return "\n".join(parts).strip()

    def answer_ask_ci(self, *, question: str, current_page: str | None = None, history: list[dict] | None = None) -> dict:
        bundle = self.load_or_run()
        context = self._build_ask_ci_context(bundle, question, current_page, history)
        prompt = (
            "You are Ask CI, a copilot inside a mortgage servicing analytics dashboard. "
            "Answer the user's question in plain business language for managers. "
            "Use only the provided workspace context. Do not mention model names, implementation details, or anything outside the context. "
            "If the question asks where to go, name the page directly. "
            "Return 1 to 3 short sentences in normal prose. "
            "Do not return labels like 'summary:' or pipe-delimited fields. "
            "Do not repeat the same status, owner, KPI, or issue details multiple times. "
            "Keep the answer concise and useful.\n\n"
            f"{context}"
        )
        generated = self._generate_ask_ci_with_gemini(prompt)
        mode = "gemini" if generated else "fallback"
        if not generated:
            generated = self.hf_engine.generate_text(prompt, max_new_tokens=160)
            if generated:
                mode = "llm"
        answer = generated.strip() if generated else self._fallback_ask_ci_answer(bundle, question, current_page)
        answer = self._format_ask_ci_answer(answer)
        if len(answer.split()) > 110:
            answer = " ".join(answer.split()[:110]).rstrip(" .,") + "."
        return {
            "answer": answer,
            "sources": self._build_ask_ci_sources(question),
            "actions": self._build_ask_ci_actions(bundle, question),
            "generated_at": self._now_iso(),
            "mode": mode if generated else "fallback",
        }

    def build_report_summary(self, bundle: dict) -> dict:
        overview = bundle["overview"]
        return {
            "title": "Call Insights Operational Report",
            "generated_at": self._now_iso(),
            "totals": {
                "calls_indexed": overview["metrics"][0]["value"],
                "issue_types": overview["metrics"][1]["value"],
                "escalations": overview["metrics"][2]["value"],
                "repeat_call_risk": overview["metrics"][3]["value"],
                "avg_sentiment_shift": overview["metrics"][4]["value"],
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
        for line in self._wrap_pdf_lines(
            "Call Insights converts customer service transcripts into issue clusters, behavior signals, "
            "evidence packs, and strategy workflows for operational review."
        ):
            line_specs.append((line, 11))
        line_specs.extend([("", 11), ("KPI Totals", 14)])
        for key, value in report["totals"].items():
            line_specs.append((f"{key.replace('_', ' ').title()}: {value}", 11))
        line_specs.extend([("", 11), ("Highlights", 14)])
        for highlight in report["highlights"]:
            for line in self._wrap_pdf_lines(f"- {highlight}"):
                line_specs.append((line, 11))
        line_specs.extend([("", 11), ("Issue Table", 14)])
        for row in report["issue_table"]:
            for line in self._wrap_pdf_lines(f"{row['issue'].title()} | {row['count']} calls | top outcome: {row['top_outcome']}"):
                line_specs.append((line, 11))

        max_lines_per_page = 42
        pages: list[list[tuple[str, int]]] = [
            line_specs[index : index + max_lines_per_page] for index in range(0, len(line_specs), max_lines_per_page)
        ]
        objects: list[bytes] = [b"<< /Type /Catalog /Pages 2 0 R >>"]
        kids_refs: list[str] = []
        font_object_id = 3 + (len(pages) * 2)
        for page_index, page_lines in enumerate(pages):
            page_object_id = 3 + (page_index * 2)
            content_object_id = page_object_id + 1
            kids_refs.append(f"{page_object_id} 0 R")
            y_position = 790
            commands = []
            for text, size in page_lines:
                commands.append(f"BT /F1 {size} Tf 50 {y_position} Td ({self._pdf_escape(text)}) Tj ET")
                y_position -= 18 if size >= 14 else 15
            content_stream = "\n".join(commands).encode("latin-1", errors="replace")
            objects.append(
                (
                    f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                    f"/Resources << /Font << /F1 {font_object_id} 0 R >> >> /Contents {content_object_id} 0 R >>"
                ).encode("ascii")
            )
            objects.append(
                f"<< /Length {len(content_stream)} >>\nstream\n".encode("ascii") + content_stream + b"\nendstream"
            )

        objects.insert(1, f"<< /Type /Pages /Count {len(pages)} /Kids [{' '.join(kids_refs)}] >>".encode("ascii"))
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
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF".encode("ascii")
        )
        return bytes(pdf)

    def build_governance_summary(self, bundle: dict) -> dict:
        board = self.build_strategy_board(bundle)
        return {
            "generated_at": self._now_iso(),
            "evidence_policy": [
                "Every insight references evidence call IDs before it is displayed.",
                "Strategy records inherit evidence calls when created or accepted.",
                "LLM enrichments are optional and must run only inside approved SPS infrastructure.",
                "Adaptive issue memory updates after every run so new transcript themes can form new clusters.",
            ],
            "audit_summary": {
                "strategies_tracked": len(board["strategies"]),
                "issue_clusters": len(bundle["overview"]["issue_counts"]),
                "evidence_backed_patterns": len(bundle["overview"]["top_patterns"]),
                "adaptive_issue_clusters": len(self.issue_memory.export_clusters()),
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
            "dashboard": {"overview": bundle["overview"], "issues": bundle["issues"], "calls": bundle["calls"]},
            "pulse_insights": self.build_pulse_insights(bundle),
            "recalibration": self.build_recalibration_summary(bundle),
            "strategy_board": self.build_strategy_board(bundle),
            "ask_ci": self.build_ask_ci(bundle),
            "reports": self.build_report_summary(bundle),
            "governance": self.build_governance_summary(bundle),
        }

    def build_llm_batch_tasks(self, calls: list[dict]) -> list[dict]:
        tasks: list[dict] = []
        for call in calls:
            excerpt = call["transcript_text"][:6000]
            tasks.append(
                {
                    "call_id": call["call_id"],
                    "task_type": "rank1_transcript_analysis",
                    "model_hint": {
                        "generation": os.getenv("RANK1_HF_TEXT2TEXT_MODEL", "google/flan-t5-small"),
                        "embeddings": os.getenv("RANK1_HF_EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2"),
                        "sentiment": os.getenv(
                            "RANK1_HF_SENTIMENT_MODEL",
                            "cardiffnlp/twitter-roberta-base-sentiment-latest",
                        ),
                    },
                    "expected_schema": {
                        "issue_label": "string",
                        "issue_rationale": "string",
                        "agent_behaviors": ["string"],
                        "customer_actions": ["string"],
                        "unaddressed_issues": ["string"],
                        "outcome_label": "resolved|follow-up needed|callback requested|escalated|unresolved",
                        "sentiment_opening": "number",
                        "sentiment_mid": "number",
                        "sentiment_closing": "number",
                        "segment_spans": [{"start_turn": "int", "end_turn": "int", "issue_label": "string"}],
                    },
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "Analyze customer service transcripts for issue, behavior, outcome, and sentiment. "
                                "Return only grounded JSON."
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                "Analyze the transcript below. Identify the primary issue, issue segments, agent behaviors, "
                                "customer actions, unresolved gaps, outcome, and sentiment trajectory.\n\n"
                                f"Transcript:\n{excerpt}"
                            ),
                        },
                    ],
                }
            )
        return tasks

    def _write_jsonl(self, path: Path, rows: list[dict]) -> None:
        path.write_text("\n".join(json.dumps(row, ensure_ascii=True) for row in rows) + "\n", encoding="utf-8")

    def _write_bundle_artifacts(
        self,
        *,
        calls: list[dict],
        segments: list[dict],
        issues: list[dict],
        behaviors: list[dict],
        sentiments: list[dict],
        outcomes: list[dict],
        bundle: dict,
    ) -> dict:
        bundle["call_details"] = {call["call_id"]: call for call in calls}
        self._write_jsonl(self.processed_dir / "calls.jsonl", calls)
        self._write_jsonl(self.processed_dir / "segments.jsonl", segments)
        self._write_jsonl(self.processed_dir / "issues.jsonl", issues)
        self._write_jsonl(self.processed_dir / "behaviors.jsonl", behaviors)
        self._write_jsonl(self.processed_dir / "sentiment.jsonl", sentiments)
        self._write_jsonl(self.processed_dir / "outcomes.jsonl", outcomes)
        self._write_jsonl(self.outputs_dir / "llm_batch_tasks.jsonl", self.build_llm_batch_tasks(calls))
        (self.outputs_dir / "adaptive_issue_clusters.json").write_text(
            json.dumps(self.issue_memory.export_clusters(), indent=2) + "\n",
            encoding="utf-8",
        )
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

    def run(self) -> dict:
        self.ensure_output_dirs()
        calls = self.ingest_calls()
        calls, segments, issues, behaviors, sentiments, outcomes = self.enrich_calls(calls)
        self.issue_memory.save()
        bundle = self.build_triple_engine(calls)
        return self._write_bundle_artifacts(
            calls=calls,
            segments=segments,
            issues=issues,
            behaviors=behaviors,
            sentiments=sentiments,
            outcomes=outcomes,
            bundle=bundle,
        )

    def run_incremental(self) -> dict:
        self.ensure_output_dirs()
        existing_bundle = self.load_or_run(force=False)
        existing_calls = list(existing_bundle["call_details"].values())
        existing_ids = {call["call_id"] for call in existing_calls}

        all_calls = self.ingest_calls()
        new_calls = [call for call in all_calls if call["call_id"] not in existing_ids]
        if not new_calls:
            return existing_bundle

        new_calls, new_segments, new_issues, new_behaviors, new_sentiments, new_outcomes = self.enrich_calls(new_calls)
        merged_calls = existing_calls + new_calls
        merged_segments: list[dict] = []
        merged_issues: list[dict] = []
        merged_behaviors: list[dict] = []
        merged_sentiments: list[dict] = []
        merged_outcomes: list[dict] = []

        processed_paths = {
            "segments": self.processed_dir / "segments.jsonl",
            "issues": self.processed_dir / "issues.jsonl",
            "behaviors": self.processed_dir / "behaviors.jsonl",
            "sentiment": self.processed_dir / "sentiment.jsonl",
            "outcomes": self.processed_dir / "outcomes.jsonl",
        }
        loaders = {
            "segments": merged_segments,
            "issues": merged_issues,
            "behaviors": merged_behaviors,
            "sentiment": merged_sentiments,
            "outcomes": merged_outcomes,
        }
        for key, target in loaders.items():
            path = processed_paths[key]
            if path.exists():
                target.extend(json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip())
        merged_segments.extend(new_segments)
        merged_issues.extend(new_issues)
        merged_behaviors.extend(new_behaviors)
        merged_sentiments.extend(new_sentiments)
        merged_outcomes.extend(new_outcomes)

        self.issue_memory.save()
        bundle = self.build_triple_engine(merged_calls)
        return self._write_bundle_artifacts(
            calls=merged_calls,
            segments=merged_segments,
            issues=merged_issues,
            behaviors=merged_behaviors,
            sentiments=merged_sentiments,
            outcomes=merged_outcomes,
            bundle=bundle,
        )

    def load_or_run(self, force: bool = False) -> dict:
        summary_path = self.outputs_dir / "triple_engine_summary.json"
        calls_path = self.processed_dir / "calls.jsonl"
        if force or not summary_path.exists() or not calls_path.exists():
            return self.run()

        calls = [json.loads(line) for line in calls_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        calls_by_id = {call["call_id"]: call for call in calls}
        call_cards = []
        for call_card in summary["calls"]:
            source_call = calls_by_id.get(call_card["call_id"], call_card)
            call_cards.append(
                {
                    **call_card,
                    "issues": call_issue_labels(source_call),
                    "timestamp_start": source_call.get("timestamp_start"),
                    "timestamp_end": source_call.get("timestamp_end"),
                }
            )
        return {
            "overview": summary["overview"],
            "issues": summary["issues"],
            "calls": call_cards,
            "call_details": {call["call_id"]: call for call in calls},
        }
