from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import sys
API_ROOT = Path(__file__).resolve().parents[1] / "apps" / "api"
sys.path.insert(0, str(API_ROOT))

from app.services.rank1.alerts import dismiss_alert, load_alerts  # noqa: E402


class AlertTests(unittest.TestCase):
    def test_alerts_persist_dismissal_with_evidence(self) -> None:
        bundle = {"overview": {"top_patterns": [{"issue": "escrow", "behavior": "transferred", "outcome": "escalated", "count": 3, "call_ids": ["CALL-1"]}]}}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "alerts.json"
            alert = load_alerts(path, bundle)[0]
            self.assertEqual(alert["evidence_call_ids"], ["CALL-1"])
            self.assertTrue(dismiss_alert(path, alert["alert_id"], bundle)["dismissed"])
