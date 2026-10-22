from __future__ import annotations
import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))
from app.services.rank1.rank3 import predict_risk, simulate_call, transparency_report  # noqa:E402
class Rank3ServiceTests(unittest.TestCase):
 def test_risk_simulation_and_transparency(self):
  self.assertGreater(predict_risk("I already called and need a supervisor")['escalation_risk'],.5)
  self.assertIn('simulated_outcome',simulate_call('I am frustrated','I will explain the next steps'))
  self.assertTrue(transparency_report({'call_id':'C','redaction_applied':True})['redaction_applied'])
