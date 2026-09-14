from __future__ import annotations

import argparse
import json
from pathlib import Path

from sklearn.metrics import accuracy_score, f1_score

from evaluation.hybrid_topics import load_jsonl


def evaluate(gold_calls: list[dict], predicted_calls: list[dict]) -> dict:
    gold_by_id = {str(call["call_id"]): call for call in gold_calls}
    predicted_by_id = {str(call.get("call_id")): call for call in predicted_calls}
    evaluated_calls = 0
    failed_calls = 0
    count_correct = 0
    exact_sequences = 0
    gold_labels: list[str] = []
    predicted_labels: list[str] = []
    unknown = 0
    evidence_valid = 0
    evidence_total = 0

    for call_id, gold_call in gold_by_id.items():
        prediction = predicted_by_id.get(call_id)
        if not prediction or prediction.get("error"):
            failed_calls += 1
            continue
        predicted_segments = prediction.get("segments")
        if not isinstance(predicted_segments, list):
            failed_calls += 1
            continue
        evaluated_calls += 1
        gold_segments = gold_call["segments"]
        gold_sequence = [segment["issue_label"] for segment in gold_segments]
        predicted_sequence = [str(segment.get("topic_id", "unknown_new_issue")) for segment in predicted_segments]
        if len(gold_segments) == len(predicted_segments):
            count_correct += 1
            exact_sequences += gold_sequence == predicted_sequence
            gold_labels.extend(gold_sequence)
            predicted_labels.extend(predicted_sequence)
        for segment in predicted_segments:
            unknown += segment.get("topic_id") == "unknown_new_issue"
            evidence = segment.get("topic_evidence_turns")
            evidence_total += 1
            if isinstance(evidence, list) and evidence and all(
                isinstance(turn_id, int)
                and 0 <= turn_id < len(gold_call["turns"])
                and gold_call["turns"][turn_id]["speaker"].lower() == "customer"
                for turn_id in evidence
            ):
                evidence_valid += 1

    labels = sorted({segment["issue_label"] for call in gold_calls for segment in call["segments"]})
    normalized_predictions = [label if label in labels else "unknown_new_issue" for label in predicted_labels]
    return {
        "gold_calls": len(gold_calls),
        "evaluated_calls": evaluated_calls,
        "failed_or_missing_calls": failed_calls,
        "call_coverage": round(evaluated_calls / len(gold_calls), 4) if gold_calls else 0.0,
        "issue_count_accuracy": round(count_correct / evaluated_calls, 4) if evaluated_calls else 0.0,
        "exact_issue_sequence_accuracy": round(exact_sequences / evaluated_calls, 4) if evaluated_calls else 0.0,
        "aligned_segment_accuracy": round(float(accuracy_score(gold_labels, normalized_predictions)), 4) if gold_labels else 0.0,
        "aligned_segment_macro_f1": round(
            float(f1_score(gold_labels, normalized_predictions, labels=labels, average="macro", zero_division=0)), 4
        ) if gold_labels else 0.0,
        "unknown_rate": round(unknown / evidence_total, 4) if evidence_total else 0.0,
        "valid_evidence_rate": round(evidence_valid / evidence_total, 4) if evidence_total else 0.0,
        "aligned_segments": len(gold_labels),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate hybrid topic-modeling outputs against a labeled corpus.")
    parser.add_argument("--gold", type=Path, required=True)
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--split", choices=("train", "test"))
    args = parser.parse_args()
    gold = load_jsonl(args.gold)
    if args.split:
        gold = [call for call in gold if call.get("split") == args.split]
    results = evaluate(gold, load_jsonl(args.predictions))
    rendered = json.dumps(results, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
