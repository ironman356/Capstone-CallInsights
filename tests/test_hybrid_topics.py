from __future__ import annotations

import unittest

from evaluation.evaluate_hybrid_results import evaluate
from evaluation.hybrid_topics import HybridTopicModeler, _gemini_schema, segmentation_batch_task, NormalizedEmbeddingRerankStrategy, EmbeddingLLMConsensusStrategy, LLMFirstEmbeddingVerifierStrategy, ExampleRetrievalLLMRerankStrategy, NormalizedLogisticRegressionStrategy, LogisticRegressionLLMRerankStrategy, SVMTopKLLMRerankStrategy, MLEnsembleLLMArbitrationStrategy, EmbeddingSupervisedLLMConsensusStrategy


class QueueLLM:
    def __init__(self, responses: list[dict]) -> None:
        self.responses = list(responses)

    def complete_json(self, **_kwargs) -> dict:
        if not self.responses:
            raise AssertionError("No queued LLM response")
        return self.responses.pop(0)


class HybridTopicTests(unittest.TestCase):
    def setUp(self) -> None:
        self.call = {
            "call_id": "CALL-HYBRID-1",
            "turns": [
                {"speaker": "Agent", "text": "How may I help?"},
                {"speaker": "Customer", "text": "The money left my bank but is not on the mortgage ledger."},
                {"speaker": "Agent", "text": "I will review the receipt and suspense history."},
                {"speaker": "Customer", "text": "Also, the automatic payment did not draft this month."},
                {"speaker": "Agent", "text": "I will check the recurring enrollment separately."},
            ],
        }

    def test_hybrid_model_segments_retrieves_and_reranks(self) -> None:
        llm = QueueLLM(
            [
                {
                    "segments": [
                        {"start_turn": 1, "end_turn": 2, "issue_statement": "Payment left bank but is not posted", "issue_evidence_turns": [1]},
                        {"start_turn": 3, "end_turn": 4, "issue_statement": "Automatic payment did not draft", "issue_evidence_turns": [3]},
                    ]
                },
                {"topic_id": "payment_posting", "confidence": 0.94, "rationale": "Funds were sent but not applied.", "evidence_turns": [1]},
                {"topic_id": "autopay_draft", "confidence": 0.96, "rationale": "A scheduled recurring draft failed.", "evidence_turns": [3]},
            ]
        )
        result = HybridTopicModeler(llm, minimum_similarity=0.0).analyze_call(self.call)
        self.assertEqual([segment["topic_id"] for segment in result["segments"]], ["payment_posting", "autopay_draft"])
        self.assertTrue(all(segment["candidate_topics"] for segment in result["segments"]))

    def test_custom_strategy_is_used_for_classification(self) -> None:
        class StubStrategy:
            strategy_id = "stub_strategy"

            def classify(self, *, segment, turns, retriever, taxonomy) -> dict:
                self.received_segment = segment
                self.received_turns = turns
                return {
                    "topic_id": "payment_posting",
                    "topic_confidence": 0.99,
                    "embedding_top_similarity": 0.99,
                    "topic_rationale": "Stub strategy result.",
                    "topic_evidence_turns": [1],
                    "candidate_topics": [],
                    "abstention_reasons": [],
                }

        strategy = StubStrategy()
        modeler = HybridTopicModeler(QueueLLM([]), strategy=strategy)

        result = modeler.classify_segment(
            {
                "segment_index": 1,
                "start_turn": 1,
                "end_turn": 2,
                "issue_statement": "Payment left bank but is not posted",
                "issue_evidence_turns": [1],
            },
            self.call["turns"],
        )

        self.assertEqual(result["topic_id"], "payment_posting")
        self.assertEqual(result["topic_rationale"], "Stub strategy result.")
        self.assertEqual(strategy.received_segment["segment_index"], 1)

    def test_normalized_embedding_rerank_strategy(self) -> None:
        call = {
            "call_id": "CALL-NORMALIZED-1",
            "turns": self.call["turns"][:3],
        }

        llm = QueueLLM(
            [
                {
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 2,
                            "issue_statement": "My money is gone but it is not visible on the account",
                            "issue_evidence_turns": [1],
                        }
                    ]
                },
                {
                    "canonical_issue": "Payment left bank but is not posted to the mortgage ledger"
                },
                {
                    "topic_id": "payment_posting",
                    "confidence": 0.95,
                    "rationale": "The customer says funds left the bank but were not applied.",
                    "evidence_turns": [1],
                },
            ]
        )

        strategy = NormalizedEmbeddingRerankStrategy(
            llm,
            minimum_similarity=0.0,
        )
        modeler = HybridTopicModeler(llm, strategy=strategy)

        result = modeler.analyze_call(call)

        self.assertEqual(result["modeling_method"], "llm_segmentation_llm_normalization_embedding_retrieval_llm_reranking")
        self.assertEqual(result["segments"][0]["topic_id"], "payment_posting")
        self.assertEqual(
            result["segments"][0]["normalized_issue_statement"],
            "Payment left bank but is not posted to the mortgage ledger",
        )

    def test_embedding_llm_disagreement_forces_unknown_topic(self) -> None:
        call = {
            "call_id": "CALL-CONSENSUS-1",
            "turns": self.call["turns"][:3],
        }

        llm = QueueLLM(
            [
                {
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 2,
                            "issue_statement": "Payment left my bank but was not applied",
                            "issue_evidence_turns": [1],
                        }
                    ]
                },
                {
                    "topic_id": "autopay_draft",
                    "confidence": 0.95,
                    "rationale": "The customer mentions a payment problem.",
                    "evidence_turns": [1],
                },
            ]
        )

        strategy = EmbeddingLLMConsensusStrategy(
            llm,
            candidate_count=6,
            minimum_similarity=0.0,
        )
        modeler = HybridTopicModeler(llm, strategy=strategy)

        result = modeler.analyze_call(call)
        segment = result["segments"][0]

        self.assertEqual(result["modeling_method"], "llm_segmentation_embedding_llm_consensus")
        self.assertEqual(segment["embedding_top_topic_id"], "payment_posting")
        self.assertEqual(segment["topic_id"], "unknown_new_issue")
        self.assertIn("embedding_llm_disagreement", segment["abstention_reasons"])

    def test_llm_first_strategy_rejects_embedding_unsupported_topic(self) -> None:
        call = {
            "call_id": "CALL-LLM-FIRST-1",
            "turns": self.call["turns"][:3],
        }

        llm = QueueLLM(
            [
                {
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 2,
                            "issue_statement": "Payment left my bank but was not applied",
                            "issue_evidence_turns": [1],
                        }
                    ]
                },
                {
                    "topic_id": "payoff_quote",
                    "confidence": 0.95,
                    "rationale": "The customer needs account help.",
                    "evidence_turns": [1],
                },
            ]
        )

        strategy = LLMFirstEmbeddingVerifierStrategy(
            llm,
            candidate_count=1,
            minimum_similarity=0.0,
        )
        modeler = HybridTopicModeler(llm, strategy=strategy)

        result = modeler.analyze_call(call)
        segment = result["segments"][0]

        self.assertEqual(
            result["modeling_method"],
            "llm_segmentation_llm_first_embedding_verification",
        )
        self.assertEqual(segment["topic_id"], "unknown_new_issue")
        self.assertIn(
            "llm_label_not_embedding_supported",
            segment["abstention_reasons"],
        )

    def test_example_retrieval_strategy_uses_labeled_examples(self) -> None:
        call = {
            "call_id": "CALL-EXAMPLE-RETRIEVAL-1",
            "turns": self.call["turns"][:3],
        }

        llm = QueueLLM(
            [
                {
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 2,
                            "issue_statement": "My bank sent the mortgage payment but it is not on my account",
                            "issue_evidence_turns": [1],
                        }
                    ]
                },
                {
                    "topic_id": "payment_posting",
                    "confidence": 0.95,
                    "rationale": "The payment left the customer's bank but was not applied.",
                    "evidence_turns": [1],
                },
            ]
        )

        strategy = ExampleRetrievalLLMRerankStrategy(
            llm,
            example_count=6,
            minimum_similarity=0.0,
        )
        modeler = HybridTopicModeler(llm, strategy=strategy)

        result = modeler.analyze_call(call)
        segment = result["segments"][0]

        self.assertEqual(
            result["modeling_method"],
            "llm_segmentation_embedding_example_retrieval_llm_reranking",
        )
        self.assertEqual(segment["topic_id"], "payment_posting")
        self.assertTrue(segment["retrieved_examples"])
        self.assertTrue(
            any(
                example["topic_id"] == "payment_posting"
                for example in segment["retrieved_examples"]
            )
        )
        self.assertTrue(
            all(
                {"topic_id", "example", "similarity"} <= example.keys()
                for example in segment["retrieved_examples"]
            )
        )

    def test_normalized_logistic_regression_strategy(self) -> None:
        class FakeLogisticRegression:
            classes_ = ["payment_posting", "autopay_draft"]

            def __init__(self) -> None:
                self.seen_texts: list[str] = []

            def predict_proba(self, texts: list[str]) -> list[list[float]]:
                self.seen_texts = texts
                return [[0.93, 0.07]]

        call = {
            "call_id": "CALL-NORMALIZED-LR-1",
            "turns": self.call["turns"][:3],
        }
        classifier = FakeLogisticRegression()
        llm = QueueLLM(
            [
                {
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 2,
                            "issue_statement": "The money left my bank but is not visible on my mortgage account",
                            "issue_evidence_turns": [1],
                        }
                    ]
                },
                {
                    "canonical_issue": "Payment left bank but was not posted to the mortgage ledger"
                },
            ]
        )

        strategy = NormalizedLogisticRegressionStrategy(
            llm,
            classifier,
            candidate_count=2,
            minimum_confidence=0.65,
        )
        modeler = HybridTopicModeler(llm, strategy=strategy)

        result = modeler.analyze_call(call)
        segment = result["segments"][0]

        self.assertEqual(
            result["modeling_method"],
            "llm_segmentation_llm_normalization_logistic_regression",
        )
        self.assertEqual(segment["topic_id"], "payment_posting")
        self.assertEqual(
            segment["normalized_issue_statement"],
            "Payment left bank but was not posted to the mortgage ledger",
        )
        self.assertEqual(
            classifier.seen_texts,
            ["Payment left bank but was not posted to the mortgage ledger"],
        )
        self.assertEqual(
            [candidate["topic_id"] for candidate in segment["candidate_topics"]],
            ["payment_posting", "autopay_draft"],
        )
        self.assertEqual(segment["abstention_reasons"], [])

    def test_logistic_regression_candidates_are_reranked_by_llm(self) -> None:
        class FakeLogisticRegression:
            classes_ = ["payment_posting", "autopay_draft", "payoff_quote"]

            def __init__(self) -> None:
                self.seen_texts: list[str] = []

            def predict_proba(self, texts: list[str]) -> list[list[float]]:
                self.seen_texts = texts
                return [[0.56, 0.40, 0.04]]

        call = {
            "call_id": "CALL-LR-RERANK-1",
            "turns": [
                {"speaker": "Agent", "text": "How may I help?"},
                {
                    "speaker": "Customer",
                    "text": "My automatic mortgage payment did not draft this month.",
                },
                {
                    "speaker": "Agent",
                    "text": "I will review the recurring-payment enrollment.",
                },
            ],
        }

        classifier = FakeLogisticRegression()
        llm = QueueLLM(
            [
                {
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 2,
                            "issue_statement": "Automatic payment did not draft",
                            "issue_evidence_turns": [1],
                        }
                    ]
                },
                {
                    "topic_id": "autopay_draft",
                    "confidence": 0.95,
                    "rationale": "The customer explicitly reports a failed automatic draft.",
                    "evidence_turns": [1],
                },
            ]
        )

        strategy = LogisticRegressionLLMRerankStrategy(
            llm,
            classifier,
            candidate_count=2,
            minimum_probability=0.0,
        )
        modeler = HybridTopicModeler(llm, strategy=strategy)

        result = modeler.analyze_call(call)
        segment = result["segments"][0]

        self.assertEqual(
            result["modeling_method"],
            "llm_segmentation_logistic_regression_top_k_llm_reranking",
        )
        self.assertEqual(segment["topic_id"], "autopay_draft")
        self.assertEqual(
            classifier.seen_texts,
            ["Automatic payment did not draft"],
        )
        self.assertEqual(
            [candidate["topic_id"] for candidate in segment["candidate_topics"]],
            ["payment_posting", "autopay_draft"],
        )
        self.assertEqual(segment["abstention_reasons"], [])

    def test_svm_candidates_are_reranked_by_llm(self) -> None:
        class FakeSVM:
            classes_ = ["payment_posting", "autopay_draft", "payoff_quote"]

            def __init__(self) -> None:
                self.seen_texts: list[str] = []

            def decision_function(self, texts: list[str]) -> list[list[float]]:
                self.seen_texts = texts
                return [[2.1, 1.4, 0.1]]

        call = {
            "call_id": "CALL-SVM-RERANK-1",
            "turns": [
                {"speaker": "Agent", "text": "How may I help?"},
                {
                    "speaker": "Customer",
                    "text": "The automatic mortgage payment was never withdrawn.",
                },
                {
                    "speaker": "Agent",
                    "text": "I will check the recurring-payment enrollment.",
                },
            ],
        }

        classifier = FakeSVM()
        llm = QueueLLM(
            [
                {
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 2,
                            "issue_statement": "Automatic payment was not withdrawn",
                            "issue_evidence_turns": [1],
                        }
                    ]
                },
                {
                    "topic_id": "autopay_draft",
                    "confidence": 0.95,
                    "rationale": "The customer reports a failed recurring payment.",
                    "evidence_turns": [1],
                },
            ]
        )

        strategy = SVMTopKLLMRerankStrategy(
            llm,
            classifier,
            candidate_count=2,
        )
        modeler = HybridTopicModeler(llm, strategy=strategy)

        result = modeler.analyze_call(call)
        segment = result["segments"][0]

        self.assertEqual(
            result["modeling_method"],
            "llm_segmentation_svm_top_k_llm_reranking",
        )
        self.assertEqual(segment["topic_id"], "autopay_draft")
        self.assertEqual(
            classifier.seen_texts,
            ["Automatic payment was not withdrawn"],
        )
        self.assertEqual(
            [candidate["topic_id"] for candidate in segment["candidate_topics"]],
            ["payment_posting", "autopay_draft"],
        )
        self.assertEqual(segment["supervised_top_margin"], 2.1)
        self.assertEqual(segment["abstention_reasons"], [])

    def test_ensemble_votes_are_arbitrated_by_llm(self) -> None:
        class FakeTopicClassifier:
            def __init__(self, topic_id: str) -> None:
                self.topic_id = topic_id

            def predict(self, _texts: list[str]) -> list[str]:
                return [self.topic_id]

        call = {
            "call_id": "CALL-ENSEMBLE-1",
            "turns": [
                {"speaker": "Agent", "text": "How may I help?"},
                {
                    "speaker": "Customer",
                    "text": "My recurring mortgage payment did not come out this month.",
                },
                {
                    "speaker": "Agent",
                    "text": "I will review the automatic-draft enrollment.",
                },
            ],
        }

        llm = QueueLLM(
            [
                {
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 2,
                            "issue_statement": "Automatic payment did not draft",
                            "issue_evidence_turns": [1],
                        }
                    ]
                },
                {
                    "topic_id": "autopay_draft",
                    "confidence": 0.96,
                    "rationale": "The customer specifically describes a failed recurring draft.",
                    "evidence_turns": [1],
                },
            ]
        )

        strategy = MLEnsembleLLMArbitrationStrategy(
            llm,
            {
                "logistic_regression": FakeTopicClassifier("payment_posting"),
                "linear_svm": FakeTopicClassifier("payment_posting"),
                "complement_nb": FakeTopicClassifier("autopay_draft"),
            },
        )
        modeler = HybridTopicModeler(llm, strategy=strategy)

        result = modeler.analyze_call(call)
        segment = result["segments"][0]

        self.assertEqual(
            result["modeling_method"],
            "llm_segmentation_ml_ensemble_vote_llm_arbitration",
        )
        self.assertEqual(segment["topic_id"], "autopay_draft")
        self.assertEqual(
            segment["ensemble_model_votes"],
            {
                "logistic_regression": "payment_posting",
                "linear_svm": "payment_posting",
                "complement_nb": "autopay_draft",
            },
        )
        self.assertEqual(segment["ensemble_top_vote_count"], 2)
        self.assertEqual(
            [candidate["topic_id"] for candidate in segment["candidate_topics"]],
            ["payment_posting", "autopay_draft"],
        )
        self.assertEqual(segment["abstention_reasons"], [])

    def test_embedding_supervised_llm_disagreement_forces_unknown_topic(self) -> None:
        class FakeLogisticRegression:
            classes_ = ["payment_posting", "autopay_draft"]

            def predict_proba(self, _texts: list[str]) -> list[list[float]]:
                return [[0.10, 0.90]]

        call = {
            "call_id": "CALL-THREE-WAY-CONSENSUS-1",
            "turns": self.call["turns"][:3],
        }

        llm = QueueLLM(
            [
                {
                    "segments": [
                        {
                            "start_turn": 1,
                            "end_turn": 2,
                            "issue_statement": "Payment left my bank but was not applied",
                            "issue_evidence_turns": [1],
                        }
                    ]
                },
                {
                    "topic_id": "payment_posting",
                    "confidence": 0.96,
                    "rationale": "The customer says funds left the bank but were not posted.",
                    "evidence_turns": [1],
                },
            ]
        )

        strategy = EmbeddingSupervisedLLMConsensusStrategy(
            llm,
            FakeLogisticRegression(),
            candidate_count=2,
            minimum_similarity=0.0,
            minimum_probability=0.0,
        )
        modeler = HybridTopicModeler(llm, strategy=strategy)

        result = modeler.analyze_call(call)
        segment = result["segments"][0]

        self.assertEqual(
            result["modeling_method"],
            "llm_segmentation_embedding_supervised_ml_llm_consensus",
        )
        self.assertEqual(segment["embedding_top_topic_id"], "payment_posting")
        self.assertEqual(segment["supervised_top_topic_id"], "autopay_draft")
        self.assertEqual(segment["topic_id"], "unknown_new_issue")
        self.assertIn(
            "embedding_logistic_regression_disagreement",
            segment["abstention_reasons"],
        )
        self.assertIn(
            "logistic_regression_llm_disagreement",
            segment["abstention_reasons"],
        )

    def test_invalid_customer_evidence_is_rejected(self) -> None:
        llm = QueueLLM(
            [
                {
                    "segments": [
                        {"start_turn": 1, "end_turn": 2, "issue_statement": "Payment did not post", "issue_evidence_turns": [2]}
                    ]
                }
            ]
        )
        with self.assertRaisesRegex(ValueError, "customer turns"):
            HybridTopicModeler(llm).analyze_call(self.call)

    def test_low_confidence_forces_unknown_topic(self) -> None:
        llm = QueueLLM(
            [
                {"segments": [{"start_turn": 1, "end_turn": 2, "issue_statement": "Payment did not post", "issue_evidence_turns": [1]}]},
                {"topic_id": "payment_posting", "confidence": 0.3, "rationale": "Possible match.", "evidence_turns": [1]},
            ]
        )
        result = HybridTopicModeler(llm, minimum_similarity=0.0).analyze_call(self.call)
        self.assertEqual(result["segments"][0]["topic_id"], "unknown_new_issue")
        self.assertIn("low_llm_confidence", result["segments"][0]["abstention_reasons"])

    def test_batch_task_uses_openai_format_and_json_schema(self) -> None:
        task = segmentation_batch_task(self.call, "local-model")
        self.assertEqual(task["url"], "/v1/chat/completions")
        self.assertEqual(task["body"]["model"], "local-model")
        self.assertEqual(task["body"]["response_format"]["type"], "json_schema")

    def test_gemini_schema_removes_unsupported_constraints(self) -> None:
        cleaned = _gemini_schema({"type": "string", "minLength": 4, "maxLength": 10, "description": "value"})
        self.assertEqual(cleaned, {"type": "string", "description": "value"})

    def test_evaluator_scores_aligned_predictions_and_evidence(self) -> None:
        gold = [
            {
                **self.call,
                "segments": [
                    {"issue_label": "payment_posting"},
                    {"issue_label": "autopay_draft"},
                ],
            }
        ]
        predictions = [
            {
                "call_id": self.call["call_id"],
                "segments": [
                    {"topic_id": "payment_posting", "topic_evidence_turns": [1]},
                    {"topic_id": "autopay_draft", "topic_evidence_turns": [3]},
                ],
            }
        ]
        metrics = evaluate(gold, predictions)
        self.assertEqual(metrics["exact_issue_sequence_accuracy"], 1.0)
        self.assertEqual(metrics["aligned_segment_macro_f1"], 1.0)
        self.assertEqual(metrics["valid_evidence_rate"], 1.0)


if __name__ == "__main__":
    unittest.main()
