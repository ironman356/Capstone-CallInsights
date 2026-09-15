from __future__ import annotations

import argparse
import json
import math
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.preprocessing import Normalizer
from sklearn.svm import LinearSVC


REPO_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = REPO_ROOT / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.services.rank1.pipeline import classify_issue as current_classify_issue  # noqa: E402


ISSUE_KEYWORDS = {
    "payment_posting": ("pending", "posted", "applied", "suspense", "ledger", "funds", "transaction history"),
    "autopay_draft": ("automatic", "autopay", "auto pay", "recurring", "draft date", "withdrawal", "pull the payment"),
    "escrow_shortage": ("shortage", "deficit", "cushion", "analysis", "projection", "payment increased", "installment jumped"),
    "insurance_coverage": ("coverage", "policy", "carrier", "declaration", "hazard", "lender-placed", "forced insurance"),
    "late_fee_dispute": ("late fee", "late charge", "penalty", "grace period", "delinquent", "assessment date", "credit reporting"),
    "payoff_quote": ("payoff", "good-through", "good through", "title company", "closing", "settlement", "retire the loan", "per-diem"),
}

APPROACH_KEYWORDS = {
    "ledger_walkthrough": ("ledger", "transaction date", "line by line", "locate the mismatch"),
    "timeline_explanation": ("sequence", "business day", "each step", "status should change"),
    "teach_back": ("own words", "your understanding", "explained it clearly"),
    "case_ownership": ("opening case", "created a tracked", "own the follow-up", "not need to start over"),
    "document_request": ("upload", "supporting record", "secure portal", "declaration page"),
    "policy_citation": ("guideline", "written policy", "requires", "cutoff"),
    "generic_reassurance": ("should be okay", "allow more time", "works itself out"),
    "warm_transfer": ("connect you", "transferring", "specialist", "escalation desk"),
}

OUTCOME_KEYWORDS = {
    "resolved": ("answers this part", "do not need anything else", "that makes sense"),
    "follow_up": ("still open", "wait for the case", "not resolved today"),
    "unresolved": ("still unresolved", "still missing a clear answer", "does not answer"),
    "escalated": ("connect me to", "continue with the escalation", "specialist"),
}


def _segment_text(call: dict, segment: dict, speaker: str | None = None) -> str:
    selected = call["turns"][segment["start_turn"] : segment["end_turn"] + 1]
    if speaker:
        selected = [turn for turn in selected if turn["speaker"] == speaker]
    return " ".join(turn["text"] for turn in selected)


def _load_segments(path: Path) -> tuple[list[dict], list[dict]]:
    calls = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    segments = []
    for call in calls:
        for segment in call["segments"]:
            segments.append(
                {
                    "call_id": call["call_id"],
                    "split": call["split"],
                    "challenge_types": call["challenge_types"],
                    "issue": segment["issue_label"],
                    "confound_group": segment["confound_group"],
                    "approach": segment["agent_approach"],
                    "outcome": segment["outcome"],
                    "customer_text": _segment_text(call, segment, "Customer"),
                    "agent_text": _segment_text(call, segment, "Agent"),
                    "segment_text": _segment_text(call, segment),
                }
            )
    return calls, segments


def _keyword_predict(texts: Iterable[str], catalog: dict[str, tuple[str, ...]]) -> list[str]:
    predictions = []
    for text in texts:
        lowered = text.lower()
        scores = {label: sum(lowered.count(term) for term in terms) for label, terms in catalog.items()}
        predictions.append(max(scores, key=lambda label: (scores[label], label)))
    return predictions


class CurrentPipelineModel:
    name = "current_keyphrase_pipeline"

    def fit(self, _texts: list[str], _labels: list[str]) -> "CurrentPipelineModel":
        return self

    def predict(self, texts: list[str]) -> list[str]:
        return [current_classify_issue(text)[0].replace(" ", "_") for text in texts]


class KeywordModel:
    def __init__(self, name: str, catalog: dict[str, tuple[str, ...]]) -> None:
        self.name = name
        self.catalog = catalog

    def fit(self, _texts: list[str], _labels: list[str]) -> "KeywordModel":
        return self

    def predict(self, texts: list[str]) -> list[str]:
        return _keyword_predict(texts, self.catalog)


class CentroidModel:
    name = "word_tfidf_centroid"

    def __init__(self) -> None:
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True)
        self.labels: list[str] = []
        self.centroids: np.ndarray | None = None

    def fit(self, texts: list[str], labels: list[str]) -> "CentroidModel":
        matrix = self.vectorizer.fit_transform(texts)
        self.labels = sorted(set(labels))
        self.centroids = np.vstack([np.asarray(matrix[np.array(labels) == label].mean(axis=0)).ravel() for label in self.labels])
        norms = np.linalg.norm(self.centroids, axis=1, keepdims=True)
        self.centroids = self.centroids / np.maximum(norms, 1e-12)
        return self

    def predict(self, texts: list[str]) -> list[str]:
        matrix = self.vectorizer.transform(texts)
        scores = matrix @ self.centroids.T
        return [self.labels[index] for index in np.asarray(scores).argmax(axis=1)]


def _char_word_model(name: str) -> Pipeline:
    model = Pipeline(
        [
            (
                "features",
                FeatureUnion(
                    [
                        ("word", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True)),
                        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=2, sublinear_tf=True)),
                    ]
                ),
            ),
            ("classifier", LogisticRegression(max_iter=1500, class_weight="balanced", random_state=4000)),
        ]
    )
    model.name = name  # type: ignore[attr-defined]
    return model


def _linear_svm_model(name: str) -> Pipeline:
    model = Pipeline(
        [
            ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=2, sublinear_tf=True)),
            ("classifier", LinearSVC(class_weight="balanced", random_state=4000)),
        ]
    )
    model.name = name  # type: ignore[attr-defined]
    return model


def _complement_nb_model(name: str) -> Pipeline:
    model = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True)),
            ("classifier", ComplementNB(alpha=0.35)),
        ]
    )
    model.name = name  # type: ignore[attr-defined]
    return model


def _sgd_text_model(name: str) -> Pipeline:
    model = Pipeline(
        [
            ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=2, sublinear_tf=True)),
            ("classifier", SGDClassifier(loss="modified_huber", class_weight="balanced", random_state=4000)),
        ]
    )
    model.name = name  # type: ignore[attr-defined]
    return model


def _lsa_model(name: str, components: int = 48) -> Pipeline:
    model = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True)),
            ("svd", TruncatedSVD(n_components=components, random_state=4000)),
            ("normalize", Normalizer(copy=False)),
            ("classifier", LogisticRegression(max_iter=1500, class_weight="balanced", random_state=4000)),
        ]
    )
    model.name = name  # type: ignore[attr-defined]
    return model


def _classification_metrics(gold: list[str], predicted: list[str]) -> dict:
    known_labels = set(gold)
    normalized = [label if label in known_labels else "__unknown__" for label in predicted]
    return {
        "accuracy": round(float(accuracy_score(gold, normalized)), 4),
        "macro_f1": round(
            float(f1_score(gold, normalized, labels=sorted(known_labels), average="macro", zero_division=0)), 4
        ),
    }


def _pair_metrics(rows: list[dict], predicted: list[str]) -> dict:
    same_total = same_correct = different_total = different_correct = 0
    for left_index, left in enumerate(rows):
        for right_index in range(left_index + 1, len(rows)):
            right = rows[right_index]
            if left["issue"] == right["issue"] and left["customer_text"] != right["customer_text"]:
                same_total += 1
                same_correct += predicted[left_index] == predicted[right_index]
            elif left["confound_group"] == right["confound_group"] and left["issue"] != right["issue"]:
                different_total += 1
                different_correct += predicted[left_index] != predicted[right_index]
    return {
        "paraphrase_same_accuracy": round(same_correct / same_total, 4) if same_total else 0.0,
        "shared_vocabulary_different_accuracy": round(different_correct / different_total, 4) if different_total else 0.0,
        "paraphrase_pairs": same_total,
        "confound_pairs": different_total,
    }


def _call_sequence_metrics(rows: list[dict], predicted: list[str]) -> dict:
    gold_by_call: dict[str, list[str]] = defaultdict(list)
    predicted_by_call: dict[str, list[str]] = defaultdict(list)
    challenge_by_call: dict[str, list[str]] = {}
    for row, label in zip(rows, predicted):
        gold_by_call[row["call_id"]].append(row["issue"])
        predicted_by_call[row["call_id"]].append(label)
        challenge_by_call[row["call_id"]] = row["challenge_types"]
    results = {}
    for challenge in ("single_problem", "one_long_problem", "multiple_problems"):
        relevant = [call_id for call_id, tags in challenge_by_call.items() if challenge in tags]
        results[f"{challenge}_exact_sequence_accuracy"] = round(
            sum(gold_by_call[call_id] == predicted_by_call[call_id] for call_id in relevant) / len(relevant), 4
        ) if relevant else 0.0
    results["all_calls_exact_sequence_accuracy"] = round(
        sum(gold_by_call[call_id] == predicted_by_call[call_id] for call_id in gold_by_call) / len(gold_by_call), 4
    )
    return results


def _predict_outcomes(texts: list[str]) -> list[str]:
    return _keyword_predict(texts, OUTCOME_KEYWORDS)


def _whole_call_outcome_metrics(calls: list[dict], test_rows: list[dict], model: Pipeline) -> dict:
    call_outcomes = {}
    test_calls = [call for call in calls if call["split"] == "test"]
    predicted_calls = model.predict([call["transcript"] for call in test_calls])
    for call, outcome in zip(test_calls, predicted_calls):
        call_outcomes[call["call_id"]] = outcome
    gold = [row["outcome"] for row in test_rows]
    predicted = [call_outcomes[row["call_id"]] for row in test_rows]
    return _classification_metrics(gold, predicted)


def _wilson_interval(successes: int, total: int, z: float = 1.96) -> tuple[float, float]:
    if total == 0:
        return 0.0, 0.0
    rate = successes / total
    denominator = 1 + z * z / total
    center = (rate + z * z / (2 * total)) / denominator
    margin = z * math.sqrt((rate * (1 - rate) + z * z / (4 * total)) / total) / denominator
    return center - margin, center + margin


def _effectiveness(rows: list[dict]) -> list[dict]:
    overall = sum(row["outcome"] == "resolved" for row in rows) / len(rows)
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row["approach"]].append(row)
    results = []
    for approach, items in grouped.items():
        successes = sum(item["outcome"] == "resolved" for item in items)
        lower, upper = _wilson_interval(successes, len(items))
        results.append(
            {
                "approach": approach,
                "sample_size": len(items),
                "resolved": successes,
                "resolution_rate": round(successes / len(items), 4),
                "lift_vs_overall": round((successes / len(items)) - overall, 4),
                "wilson_95_low": round(lower, 4),
                "wilson_95_high": round(upper, 4),
                "representative_calls": [item["call_id"] for item in items if item["outcome"] == "resolved"][:3],
            }
        )
    return sorted(results, key=lambda item: (-item["resolution_rate"], -item["sample_size"], item["approach"]))


def run_benchmark(path: Path) -> dict:
    calls, segments = _load_segments(path)
    train = [row for row in segments if row["split"] == "train"]
    test = [row for row in segments if row["split"] == "test"]
    issue_models = [
        CurrentPipelineModel(),
        KeywordModel("taxonomy_keyword_rules", ISSUE_KEYWORDS),
        CentroidModel(),
        _char_word_model("char_word_tfidf_linear"),
        _lsa_model("lsa_semantic_linear"),
    ]
    approach_models = [
        KeywordModel("taxonomy_keyword_rules", APPROACH_KEYWORDS),
        CentroidModel(),
        _char_word_model("char_word_tfidf_linear"),
        _lsa_model("lsa_semantic_linear", components=32),
    ]
    issue_results = []
    for model in issue_models:
        started = time.perf_counter()
        model.fit([row["customer_text"] for row in train], [row["issue"] for row in train])
        predicted = model.predict([row["customer_text"] for row in test])
        issue_results.append(
            {
                "approach": model.name,
                **_classification_metrics([row["issue"] for row in test], predicted),
                **_pair_metrics(test, predicted),
                **_call_sequence_metrics(test, predicted),
                "runtime_seconds": round(time.perf_counter() - started, 4),
            }
        )
    approach_results = []
    for model in approach_models:
        started = time.perf_counter()
        model.fit([row["agent_text"] for row in train], [row["approach"] for row in train])
        predicted = model.predict([row["agent_text"] for row in test])
        approach_results.append(
            {
                "approach": model.name,
                **_classification_metrics([row["approach"] for row in test], predicted),
                "runtime_seconds": round(time.perf_counter() - started, 4),
            }
        )
    outcome_model = _char_word_model("segment_outcome_linear")
    outcome_model.fit([row["segment_text"] for row in train], [row["outcome"] for row in train])
    segment_outcomes = _classification_metrics(
        [row["outcome"] for row in test], outcome_model.predict([row["segment_text"] for row in test])
    )
    return {
        "corpus": {
            "calls": len(calls),
            "segments": len(segments),
            "train_segments": len(train),
            "test_segments": len(test),
            "test_calls": len({row["call_id"] for row in test}),
            "issue_distribution": dict(sorted(Counter(row["issue"] for row in segments).items())),
            "outcome_distribution": dict(sorted(Counter(row["outcome"] for row in segments).items())),
        },
        "issue_mapping": sorted(issue_results, key=lambda item: -item["macro_f1"]),
        "approach_extraction": sorted(approach_results, key=lambda item: -item["macro_f1"]),
        "resolution_attribution": {
            "segment_evidence_gate": segment_outcomes,
            "whole_call_label_applied_to_segments": _whole_call_outcome_metrics(calls, test, outcome_model),
        },
        "agent_approach_effectiveness": _effectiveness(segments),
    }


def _write_markdown(path: Path, results: dict) -> None:
    corpus = results["corpus"]
    lines = [
        "# Call Insights Benchmark Results",
        "",
        f"Corpus: {corpus['calls']} calls, {corpus['segments']} issue segments, {corpus['test_calls']} held-out test calls.",
        "",
        "## Issue Mapping",
        "",
        "| Method | Macro F1 | Accuracy | Paraphrase same | Shared-vocabulary different | Multi-issue exact | Long single exact | Seconds |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for item in results["issue_mapping"]:
        lines.append(
            f"| {item['approach']} | {item['macro_f1']:.3f} | {item['accuracy']:.3f} | "
            f"{item['paraphrase_same_accuracy']:.3f} | {item['shared_vocabulary_different_accuracy']:.3f} | "
            f"{item['multiple_problems_exact_sequence_accuracy']:.3f} | {item['one_long_problem_exact_sequence_accuracy']:.3f} | {item['runtime_seconds']:.3f} |"
        )
    lines.extend(
        [
            "",
            "## Agent Approach Extraction",
            "",
            "| Method | Macro F1 | Accuracy | Seconds |",
            "|---|---:|---:|---:|",
        ]
    )
    for item in results["approach_extraction"]:
        lines.append(f"| {item['approach']} | {item['macro_f1']:.3f} | {item['accuracy']:.3f} | {item['runtime_seconds']:.3f} |")
    lines.extend(["", "## Resolution Attribution", ""])
    for name, item in results["resolution_attribution"].items():
        lines.append(f"- {name}: macro F1 {item['macro_f1']:.3f}, accuracy {item['accuracy']:.3f}")
    lines.extend(
        [
            "",
            "## Observed Agent-Approach Effectiveness",
            "",
            "Synthetic rates validate the analytics and must not be presented as SPS findings.",
            "",
            "| Agent approach | n | Resolved | Rate | Lift | Wilson 95% CI | Evidence calls |",
            "|---|---:|---:|---:|---:|---:|---|",
        ]
    )
    for item in results["agent_approach_effectiveness"]:
        lines.append(
            f"| {item['approach']} | {item['sample_size']} | {item['resolved']} | {item['resolution_rate']:.3f} | "
            f"{item['lift_vs_overall']:+.3f} | [{item['wilson_95_low']:.3f}, {item['wilson_95_high']:.3f}] | "
            f"{', '.join(item['representative_calls']) or 'none'} |"
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare Call Insights issue and approach mapping methods.")
    parser.add_argument("--input", type=Path, default=Path("data/evaluation/call_insights_benchmark.jsonl"))
    parser.add_argument("--json-output", type=Path, default=Path("data/evaluation/benchmark_results.json"))
    parser.add_argument("--markdown-output", type=Path, default=Path("docs/evaluation-results.md"))
    args = parser.parse_args()
    results = run_benchmark(args.input)
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    _write_markdown(args.markdown_output, results)
    print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
