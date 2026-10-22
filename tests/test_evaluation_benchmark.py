from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from evaluation.benchmark import  fit_hybrid_topic_classifiers, run_benchmark, _write_markdown
from evaluation.corpus import build_corpus, write_jsonl


class EvaluationBenchmarkTests(unittest.TestCase):
    def test_corpus_contains_required_challenges_and_segment_evidence(self) -> None:
        rows = build_corpus(count=60, seed=4000)
        challenges = {challenge for row in rows for challenge in row["challenge_types"]}
        self.assertTrue({"held_out_paraphrase", "multiple_problems", "one_long_problem"} <= challenges)
        self.assertTrue(any(len(row["segments"]) == 3 for row in rows))
        for row in rows:
            for segment in row["segments"]:
                self.assertTrue(segment["approach_evidence_turns"])
                self.assertTrue(segment["resolution_evidence_turns"])

    def test_benchmark_runs_all_issue_methods(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            corpus_path = Path(directory) / "benchmark.jsonl"
            write_jsonl(corpus_path, build_corpus(count=60, seed=4000))
            results = run_benchmark(corpus_path)
        method_names = {item["approach"] for item in results["issue_mapping"]}
        self.assertGreaterEqual(len(method_names), 9)
        self.assertIn("char_tfidf_linear_svm", method_names)
        self.assertIn("word_tfidf_complement_nb", method_names)
        self.assertIn("segment_evidence_gate", results["resolution_attribution"])
        self.assertTrue(results["agent_approach_effectiveness"])

    def test_hybrid_topic_classifiers_are_fitted_and_usable(self) -> None:
        texts = [
            "My payment is missing from the loan ledger.",
            "The funds left my bank but were not applied.",
            "Autopay skipped the scheduled draft.",
            "My automatic payment did not withdraw.",
        ]
        labels = [
            "payment_posting",
            "payment_posting",
            "autopay_draft",
            "autopay_draft",
        ]

        classifiers = fit_hybrid_topic_classifiers(texts, labels)

        self.assertEqual(
            set(classifiers),
            {"logistic_regression", "linear_svm"},
        )
        self.assertEqual(
            set(classifiers["logistic_regression"].classes_),
            set(labels),
        )
        self.assertEqual(
            set(classifiers["linear_svm"].classes_),
            set(labels),
        )
        self.assertEqual(
            len(
                classifiers["logistic_regression"].predict(
                    ["The scheduled automatic draft was skipped."]
                )
            ),
            1,
        )
        self.assertEqual(
            len(
                classifiers["linear_svm"].predict(
                    ["The scheduled automatic draft was skipped."]
                )
            ),
            1,
        )

    def test_benchmark_scores_cached_hybrid_predictions(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            directory_path = Path(directory)
            corpus_path = directory_path / "benchmark.jsonl"
            prediction_path = directory_path / "hybrid_predictions.jsonl"

            corpus = build_corpus(count=60, seed=4000)
            write_jsonl(corpus_path, corpus)

            predictions = []
            for call in corpus:
                if call["split"] != "test":
                    continue

                predicted_segments = []
                for segment in call["segments"]:
                    evidence_turn = next(
                        turn_index
                        for turn_index in range(
                            segment["start_turn"],
                            segment["end_turn"] + 1,
                        )
                        if call["turns"][turn_index]["speaker"] == "Customer"
                    )
                    predicted_segments.append(
                        {
                            "topic_id": segment["issue_label"],
                            "topic_evidence_turns": [evidence_turn],
                        }
                    )

                predictions.append(
                    {
                        "call_id": call["call_id"],
                        "modeling_method": (
                            "llm_segmentation_"
                            "logistic_regression_top_k_llm_reranking"
                        ),
                        "segments": predicted_segments,
                    }
                )

            write_jsonl(prediction_path, predictions)

            results = run_benchmark(
                corpus_path,
                hybrid_prediction_paths={
                    "logistic_regression_top_k_llm_reranking": prediction_path,
                },
            )

        hybrid_results = results["hybrid_issue_mapping"]

        self.assertEqual(len(hybrid_results), 1)
        self.assertEqual(
            hybrid_results[0]["approach"],
            "logistic_regression_top_k_llm_reranking",
        )
        self.assertEqual(hybrid_results[0]["macro_f1"], 1.0)
        self.assertEqual(hybrid_results[0]["accuracy"], 1.0)
        self.assertEqual(hybrid_results[0]["call_coverage"], 1.0)
        self.assertEqual(hybrid_results[0]["valid_evidence_rate"], 1.0)

    def test_markdown_includes_hybrid_results_section(self) -> None:
        results = {
            "corpus": {
                "calls": 1,
                "segments": 1,
                "train_segments": 0,
                "test_segments": 1,
                "test_calls": 1,
                "issue_distribution": {},
                "outcome_distribution": {},
            },
            "issue_mapping": [],
            "hybrid_issue_mapping": [
                {
                    "approach": "svm_top_k_llm_reranking",
                    "macro_f1": 0.8,
                    "accuracy": 0.75,
                    "call_coverage": 1.0,
                    "issue_count_accuracy": 0.9,
                    "exact_issue_sequence_accuracy": 0.85,
                    "unknown_rate": 0.1,
                    "valid_evidence_rate": 1.0,
                }
            ],
            "approach_extraction": [],
            "resolution_attribution": {},
            "agent_approach_effectiveness": [],
        }

        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            markdown_path = Path(directory) / "results.md"
            _write_markdown(markdown_path, results)
            markdown = markdown_path.read_text(encoding="utf-8")

        self.assertIn("## Hybrid Issue Mapping (End-to-End)", markdown)
        self.assertIn("svm_top_k_llm_reranking", markdown)
        self.assertIn("| Method | Macro F1 | Accuracy | Call coverage |", markdown)


if __name__ == "__main__":
    unittest.main()
