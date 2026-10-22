import sys
import unittest
import tempfile
from datetime import timedelta
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))
from app.services.rank1.solutions import extract, cluster_report, build_solution_report
from app.services.rank1 import script_experiments as trials
from app.services.rank1.conversation_paths import stages, doubly_robust


class SolutionDiscoveryTests(unittest.TestCase):
    def test_customer_language_and_post_outcome_actions_are_excluded(self):
        call = {"call_id": "a", "behaviors": ["resolved calmly"], "turns": [
            {"speaker": "Customer", "text": "Please transfer me"},
            {"speaker": "Agent", "text": "I can review the account."},
            {"speaker": "Customer", "text": "That helps, now I understand."},
            {"speaker": "Agent", "text": "I will document this and transfer you."},
            {"speaker": "Agent", "text": "Thanks."},
            {"speaker": "Customer", "text": "Goodbye."},
        ]}
        row = extract(call)
        self.assertIn("behavior: review account", row["features"])
        self.assertNotIn("behavior: transfer", row["features"])
        self.assertNotIn("behavior: document next steps", row["features"])
        self.assertFalse(any("resolved" in key for key in row["features"]))

    def test_order_requires_distinct_turns(self):
        row = extract({"turns": [
            {"speaker": "Agent", "text": "I will explain and review."},
            {"speaker": "Agent", "text": "I understand your frustration."},
            {"speaker": "Customer", "text": "Okay"},
            {"speaker": "Customer", "text": "Thanks"},
        ]})
        self.assertNotIn("sequence: explain process → review account", row["features"])
        self.assertIn("sequence: review account → acknowledge frustration", row["features"])

    def test_no_comparator_is_not_reported_as_effect(self):
        rows = [{"call": {"call_id": str(i), "issue": "escrow", "outcome": "resolved"},
                 "features": {"verb: explain": 1}, "quotes": {}} for i in range(5)]
        signal = cluster_report(rows, {"issue": "escrow", "slug": "escrow"})["signals"][0]
        self.assertIsNone(signal["delta"])
        self.assertIsNone(signal["interval"])
        self.assertEqual(signal["status"], "insufficient comparison")

    def test_denominators_and_counterexamples(self):
        rows = [{"call": {"call_id": str(i), "issue": "escrow", "outcome": "resolved" if i in (0, 1, 4) else "unresolved"},
                 "features": {"verb: explain": 1} if i < 4 else {}, "quotes": {}} for i in range(8)]
        signal = cluster_report(rows, {"issue": "escrow", "slug": "escrow"})["signals"][0]
        self.assertEqual((signal["support"], signal["comparison_count"]), (4, 4))
        self.assertEqual((signal["rate"], signal["without_rate"], signal["delta"]), (50, 25, 25))
        self.assertEqual(len(signal["counterexamples"]), 2)
        self.assertEqual(signal["status"], "uncertain")

    def test_empty_corpus(self):
        report = build_solution_report({"call_details": {}, "issues": []})
        self.assertEqual(report["clusters"], [])
        self.assertEqual(report["benchmark"]["status"], "insufficient data")

    def test_stages_preserve_exact_source_turns(self):
        turns = [{"speaker": "Agent", "text": f"Exact line {i}."} for i in range(8)]
        actual = stages({"turns": turns})
        self.assertEqual([t["text"] for t in actual], [t["text"] for t in turns])
        self.assertEqual([t["stage"] for t in actual], ["Welcome", "Verify", "Verify", "Understand", "Acknowledge", "Respond", "Close", "Close"])

    def test_adjustment_does_not_reinclude_excluded_repeated_text(self):
        rows = [{"call": {"turns": [{"speaker": "Agent", "text": "Repeated line"}] * 6},
                 "turns": [{"turn": 1, "text": "Repeated line"}], "group": "opening"}]
        self.assertEqual(doubly_robust(rows, {})[0]["n"], 0)

    def test_report_deterministic_and_json_serializable(self):
        import json
        bundle = {"call_details": {str(i): {"call_id": str(i), "issue": "escrow", "outcome": "resolved" if i % 2 else "unresolved",
                   "turns": [{"speaker": "Agent", "text": "I will review your account."}, {"speaker": "Customer", "text": "Thanks."}]}
                  for i in range(4)}, "issues": [{"issue": "escrow", "slug": "escrow"}]}
        self.assertEqual(json.dumps(build_solution_report(bundle), allow_nan=False), json.dumps(build_solution_report(bundle), allow_nan=False))
        report = build_solution_report(bundle)
        for conversation in report["conversations"]["clusters"]:
            for call in conversation["calls"]:
                source = bundle["call_details"][call["call_id"]]["turns"]
                self.assertEqual([t["text"] for t in call["turns"]], [t["text"] for t in source])


class ScriptExperimentTests(unittest.TestCase):
    def test_persisted_assignment_followup_and_no_fabricated_results(self):
        cluster = {"slug": "test", "issue": "Test issue", "guide": {"source_call_id": "CALL-1", "turns": [
            {"speaker": "Agent", "text": "Here is the next step.", "eligible": True, "stage": "Respond", "turn": 6}]}}
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "experiments.json"
            experiment = trials.create_experiment(path, cluster, 25)
            self.assertIsNone(experiment["difference"])
            self.assertEqual(experiment["assignments"], [])
            self.assertEqual(trials.create_experiment(path, cluster, 25)["id"], experiment["id"])
            with patch.object(trials.secrets, "choice", return_value="A"):
                first = trials.assign(path, experiment["id"], "unit-one")
            self.assertEqual(trials.assign(path, experiment["id"], "unit-one"), first)
            payload = {"resolved": True, "repeat_contact_7d": False, "delivered": False, "source_reference": "qa-test"}
            with self.assertRaisesRegex(ValueError, "7-day"):
                trials.record_outcome(path, experiment["id"], first["id"], payload)
            future = trials.now() + timedelta(days=8)
            with patch.object(trials, "now", return_value=future):
                recorded = trials.record_outcome(path, experiment["id"], first["id"], payload)
                self.assertEqual(recorded["results"]["A"]["success"], 1)
                self.assertIsNone(recorded["difference"])
                with self.assertRaisesRegex(ValueError, "already recorded"):
                    trials.record_outcome(path, experiment["id"], first["id"], payload)


if __name__ == "__main__":
    unittest.main()
