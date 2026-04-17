from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = REPO_ROOT / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.services.rank1.pipeline import (  # noqa: E402
    Rank1PipelineService,
    Turn,
    classify_issue,
    classify_outcome,
    extract_behaviors,
    score_sentiment,
    segment_call,
)


class Rank1PipelineTests(unittest.TestCase):
    def test_service_can_run_against_project_dataset(self) -> None:
        bundle = Rank1PipelineService().run()
        self.assertIn("overview", bundle)
        self.assertIn("issues", bundle)
        self.assertIn("calls", bundle)
        self.assertIn("call_details", bundle)
        self.assertGreater(len(bundle["calls"]), 0)

    def test_classify_outcome_detects_escalation(self) -> None:
        text = "Agent: Please hold while I connect you to a supervisor for escalation."
        self.assertEqual(classify_outcome(text), "escalated")

    def test_classify_issue_returns_other_without_keyword_hits(self) -> None:
        issue, scores = classify_issue("Customer: I just wanted to confirm the office hours.")
        self.assertEqual(issue, "other")
        self.assertTrue(all(score == 0 for score in scores.values()))

    def test_extract_behaviors_adds_failure_signal_for_unresolved_calls(self) -> None:
        text = "Agent: I am sorry. Customer: I am still not happy and still do not know what changed."
        labels = extract_behaviors(text, "unresolved")
        self.assertIn("failed to address concern", labels)

    def test_segment_call_splits_on_issue_shift(self) -> None:
        turns = [
            Turn(speaker="Customer", text="My payment still shows pending."),
            Turn(speaker="Agent", text="I understand. Let me explain the processing."),
            Turn(speaker="Customer", text="Also, my escrow analysis increased the monthly payment."),
        ]
        segments = segment_call("CALL-9999", turns, "payment posting")
        self.assertEqual(len(segments), 2)
        self.assertEqual(segments[0]["issue"], "payment posting")
        self.assertIn("escrow", segments[1]["issue"])

    def test_score_sentiment_returns_expected_shape(self) -> None:
        turns = [
            Turn(speaker="Customer", text="Thank you, that helps."),
            Turn(speaker="Customer", text="This is frustrating and confusing."),
        ]
        sentiments = score_sentiment(turns)
        self.assertEqual(set(sentiments), {"opening", "mid", "closing", "shift"})

    def test_project_dataset_pipeline_exposes_top_patterns(self) -> None:
        bundle = Rank1PipelineService().run()
        self.assertIsInstance(bundle["overview"]["top_patterns"], list)
        self.assertGreater(len(bundle["overview"]["top_patterns"]), 0)


if __name__ == "__main__":
    unittest.main()
