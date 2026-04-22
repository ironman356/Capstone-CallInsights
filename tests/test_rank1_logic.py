from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = REPO_ROOT / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.services.rank1.pipeline import (  # noqa: E402
    Turn,
    _extract_turns,
    _read_text_lines,
    _score_keywords,
    _score_sentiment,
    _slugify,
    _split_sections,
    classify_issue,
    classify_outcome,
    extract_behaviors,
    score_sentiment,
    segment_call,
    summarize_call,
)


class Rank1LogicTests(unittest.TestCase):
    def test_slugify_normalizes_issue_labels(self) -> None:
        self.assertEqual(_slugify("Hardship / Forbearance"), "hardship-forbearance")

    def test_read_text_lines_removes_blank_lines(self) -> None:
        path = REPO_ROOT / "tests" / "_tmp_read_lines.txt"
        try:
            path.write_text("first\n\n second \n", encoding="utf-8")
            self.assertEqual(_read_text_lines(path), ["first", "second"])
        finally:
            if path.exists():
                path.unlink()

    def test_extract_turns_ignores_invalid_lines(self) -> None:
        text = "\n".join(
            [
                "Narrator: Metadata",
                "Customer: Hello",
                "No separator line",
                "Agent: Hi there",
                "Customer:",
            ]
        )
        turns = _extract_turns(text)
        self.assertEqual([(turn.speaker, turn.text) for turn in turns], [("Customer", "Hello"), ("Agent", "Hi there")])

    def test_score_keywords_counts_multiple_hits(self) -> None:
        scores = _score_keywords(
            "payment still shows pending and payment activity is still pending",
            {"payment confusion": ["pending", "payment activity"]},
        )
        self.assertEqual(scores["payment confusion"], 3)

    def test_classify_issue_picks_expected_issue(self) -> None:
        issue, scores = classify_issue("My escrow analysis caused a shortage in projected disbursements.")
        self.assertIn("escrow", issue)
        self.assertGreater(max(scores.values()), 0)

    def test_classify_issue_returns_other_without_keyword_hits(self) -> None:
        issue, scores = classify_issue("Customer: I just wanted to confirm the office hours.")
        self.assertEqual(issue, "other")
        self.assertTrue(all(score == 0 for score in scores.values()))

    def test_extract_behaviors_merges_base_and_derived_labels(self) -> None:
        text = (
            "Agent: I am sorry. I appreciate your patience. "
            "Next step, I can submit the review. Thank you."
        )
        labels = extract_behaviors(text, "resolved")
        self.assertIn("used empathy", labels)
        self.assertIn("offered next steps", labels)
        self.assertIn("resolved calmly", labels)

    def test_extract_behaviors_adds_failure_signal_for_unresolved_calls(self) -> None:
        text = "Agent: I am sorry. Customer: I am still not happy and still do not know what changed."
        labels = extract_behaviors(text, "unresolved")
        self.assertIn("failed to address concern", labels)

    def test_classify_outcome_detects_all_rank1_outcomes(self) -> None:
        self.assertEqual(classify_outcome("Agent: Your callback number is on file and callback requested."), "callback requested")
        self.assertEqual(classify_outcome("Agent: Please hold while I connect you to a supervisor for escalation."), "escalated")
        self.assertEqual(classify_outcome("Customer: That helps, I finally have a path forward."), "resolved")
        self.assertEqual(classify_outcome("Agent: We will follow-up after the review team responds."), "follow-up needed")
        self.assertEqual(classify_outcome("Customer: I am still confused."), "unresolved")

    def test_split_sections_handles_small_turn_counts(self) -> None:
        turns = [Turn("Customer", "One"), Turn("Agent", "Two")]
        sections = _split_sections(turns)
        self.assertEqual(len(sections["opening"]), 1)
        self.assertEqual(len(sections["mid"]), 1)
        self.assertEqual(len(sections["closing"]), 1)

    def test_score_sentiment_returns_zero_for_no_terms(self) -> None:
        self.assertEqual(_score_sentiment([Turn("Customer", "plain text only")]), 0.0)

    def test_score_sentiment_returns_expected_shape(self) -> None:
        turns = [
            Turn(speaker="Customer", text="Thank you, that helps."),
            Turn(speaker="Customer", text="This is frustrating and confusing."),
            Turn(speaker="Agent", text="I appreciate your patience."),
        ]
        sentiments = score_sentiment(turns)
        self.assertEqual(set(sentiments), {"opening", "mid", "closing", "shift"})
        self.assertAlmostEqual(sentiments["shift"], round(sentiments["closing"] - sentiments["opening"], 3))

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

    def test_segment_call_keeps_single_segment_when_issue_is_other(self) -> None:
        turns = [
            Turn("Customer", "Hello"),
            Turn("Agent", "Hi"),
        ]
        segments = segment_call("CALL-0001", turns, "other")
        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0]["issue"], "other")

    def test_summarize_call_formats_human_readable_summary(self) -> None:
        summary = summarize_call(
            "payment confusion",
            "resolved",
            ["used empathy", "offered next steps"],
            {"opening": 0.0, "mid": 0.0, "closing": 0.5, "shift": 0.5},
        )
        self.assertIn("Payment Confusion call that ended as resolved.", summary)
        self.assertIn("used empathy, offered next steps", summary)
        self.assertIn("+0.500", summary)


if __name__ == "__main__":
    unittest.main()
