from __future__ import annotations

import argparse
import tempfile
import unittest
from pathlib import Path

from evaluation.hybrid_topics import write_jsonl
from evaluation.run_hybrid_topics import (
    _build_strategy,
    _load_supervised_training_rows,
)


class StubLLM:
    def complete_json(self, **_kwargs) -> dict:
        raise AssertionError("Strategy construction must not call the LLM")


class HybridTopicRunnerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        self.training_path = Path(self.tempdir.name) / "training.jsonl"

        write_jsonl(
            self.training_path,
            [
                {
                    "call_id": "TRAIN-1",
                    "split": "train",
                    "turns": [
                        {"speaker": "Agent", "text": "How can I help?"},
                        {"speaker": "Customer", "text": "The funds left my bank but are missing from the ledger."},
                    ],
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 1,
                            "issue_label": "payment_posting",
                        }
                    ],
                },
                {
                    "call_id": "TRAIN-2",
                    "split": "train",
                    "turns": [
                        {"speaker": "Agent", "text": "What happened?"},
                        {"speaker": "Customer", "text": "My payment is still pending and was not applied."},
                    ],
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 1,
                            "issue_label": "payment_posting",
                        }
                    ],
                },
                {
                    "call_id": "TRAIN-3",
                    "split": "train",
                    "turns": [
                        {"speaker": "Agent", "text": "How can I help?"},
                        {"speaker": "Customer", "text": "Autopay skipped the scheduled withdrawal."},
                    ],
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 1,
                            "issue_label": "autopay_draft",
                        }
                    ],
                },
                {
                    "call_id": "TRAIN-4",
                    "split": "train",
                    "turns": [
                        {"speaker": "Agent", "text": "Please explain."},
                        {"speaker": "Customer", "text": "My automatic payment did not draft this month."},
                    ],
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 1,
                            "issue_label": "autopay_draft",
                        }
                    ],
                },
                {
                    "call_id": "TEST-1",
                    "split": "test",
                    "turns": [
                        {"speaker": "Customer", "text": "This row must not be used for training."},
                    ],
                    "segments": [
                        {
                            "start_turn": 0,
                            "end_turn": 0,
                            "issue_label": "payoff_quote",
                        }
                    ],
                },
            ],
        )

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def _args(self, strategy: str, **overrides) -> argparse.Namespace:
        values = {
            "strategy": strategy,
            "candidate_count": 4,
            "example_count": 6,
            "minimum_confidence": 0.65,
            "minimum_similarity": 0.18,
            "minimum_probability": 0.18,
            "supervised_training_input": self.training_path,
            "supervised_training_split": "train",
        }
        values.update(overrides)
        return argparse.Namespace(**values)

    def test_load_supervised_training_rows_uses_only_requested_split(self) -> None:
        texts, labels = _load_supervised_training_rows(
            self.training_path,
            "train",
        )

        self.assertEqual(len(texts), 4)
        self.assertEqual(
            labels,
            [
                "payment_posting",
                "payment_posting",
                "autopay_draft",
                "autopay_draft",
            ],
        )
        self.assertNotIn("This row must not be used for training.", texts)

    def test_baseline_strategy_needs_no_supervised_training_input(self) -> None:
        strategy = _build_strategy(
            self._args(
                "embedding_retrieval_llm_reranking",
                supervised_training_input=None,
            ),
            StubLLM(),
        )

        self.assertEqual(
            strategy.strategy_id,
            "embedding_retrieval_llm_reranking",
        )

    def test_supervised_strategies_are_constructed_from_training_split(self) -> None:
        expected_strategy_ids = {
            "llm_normalization_logistic_regression": (
                "llm_normalization_logistic_regression"
            ),
            "logistic_regression_top_k_llm_reranking": (
                "logistic_regression_top_k_llm_reranking"
            ),
            "svm_top_k_llm_reranking": "svm_top_k_llm_reranking",
            "ml_ensemble_vote_llm_arbitration": (
                "ml_ensemble_vote_llm_arbitration"
            ),
            "embedding_supervised_ml_llm_consensus": (
                "embedding_supervised_ml_llm_consensus"
            ),
        }

        for requested_strategy, expected_strategy_id in expected_strategy_ids.items():
            with self.subTest(strategy=requested_strategy):
                strategy = _build_strategy(
                    self._args(requested_strategy),
                    StubLLM(),
                )
                self.assertEqual(strategy.strategy_id, expected_strategy_id)


if __name__ == "__main__":
    unittest.main()