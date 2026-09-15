from __future__ import annotations

import unittest

from evaluation.evaluate_hybrid_results import evaluate
from evaluation.hybrid_topics import HybridTopicModeler, _gemini_schema, segmentation_batch_task


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
