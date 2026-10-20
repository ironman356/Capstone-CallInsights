import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from app.services.rank1.phrases import common_phrases


def call(call_id, text, speaker="Agent", issue="escrow", behaviors=None):
    return {"call_id": call_id, "issue": issue, "behaviors": behaviors or ["used empathy"],
            "turns": [{"speaker": speaker, "text": text}]}


class CommonPhrasesTests(unittest.TestCase):
    def test_counts_distinct_calls_preserves_quotes_and_removes_nested_duplicates(self):
        phrases = common_phrases([
            call("a", "Review your escrow shortage. Review your escrow shortage."),
            call("b", "REVIEW YOUR ESCROW SHORTAGE."),
            call("c", "A unique payment question."),
        ])
        self.assertEqual(phrases, [{"text": "Review your escrow shortage", "speaker": "Agent", "call_ids": ["a", "b"]}])

    def test_does_not_cross_sentences_speakers_or_count_one_call_twice(self):
        self.assertEqual(common_phrases([
            call("a", "Payment pending. Escrow shortage."),
            call("b", "Payment pending. Escrow shortage."),
        ]), [])
        self.assertEqual(common_phrases([
            call("a", "Review your escrow shortage."),
            call("b", "Review your escrow shortage.", speaker="Customer"),
        ]), [])
        self.assertEqual(common_phrases([call("a", "Review your escrow shortage. " * 3)]), [])
        self.assertEqual(common_phrases([call("a", "Thank you for your help."), call("b", "Thank you for your help.")]), [])

    def test_endpoint_filters_issue_and_approach(self):
        from app.api import rank1
        from app.main import app
        from fastapi.testclient import TestClient

        calls = [call("a", "Review your escrow shortage."), call("b", "Review your escrow shortage."),
                 call("c", "Review your escrow shortage.", issue="payment"),
                 call("d", "Review your escrow shortage.", behaviors=["offered next steps"])]
        with patch.object(rank1.service, "load_or_run", return_value={"call_details": {item["call_id"]: item for item in calls}}):
            client = TestClient(app)
            response = client.get("/api/rank1/common-phrases", params={"issue": "escrow", "approach": "used empathy"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["call_count"], 2)
            self.assertEqual(response.json()["phrases"][0]["call_ids"], ["a", "b"])
            self.assertEqual(client.get("/api/rank1/common-phrases").status_code, 422)


if __name__ == "__main__":
    unittest.main()
