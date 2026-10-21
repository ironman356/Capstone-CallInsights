from __future__ import annotations
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))
from app.services.rank1.rank2 import intake_voice_transcript, record_strategy_measurement  # noqa: E402

class Rank2WorkflowTests(unittest.TestCase):
    def test_voice_intake_redacts_and_measurements_persist(self) -> None:
        intake = intake_voice_transcript("Customer: My phone is 801-555-0199.", "recording-1")
        self.assertIn("[REDACTED_PHONE]", intake["transcript_text"])
        with tempfile.TemporaryDirectory() as directory:
            result = record_strategy_measurement(Path(directory) / "measurements.json", "STRAT-1", {"resolution_rate": .5, "repeat_contact_rate": .4}, {"resolution_rate": .7, "repeat_contact_rate": .2})
        self.assertEqual(result["resolution_delta"], .2)
        self.assertEqual(result["repeat_contact_delta"], -.2)
