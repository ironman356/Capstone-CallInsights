from __future__ import annotations

import sys
import unittest
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1] / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.services.rank1.redaction import redact_transcript_text  # noqa: E402


class TranscriptRedactionTests(unittest.TestCase):
    def test_redacts_direct_identifiers_without_removing_call_context(self) -> None:
        text = "Customer: Call 801-555-0199 or jane@example.com. SSN 123-45-6789 and card 4111 1111 1111 1111."
        result = redact_transcript_text(text)
        self.assertNotIn("801-555-0199", result)
        self.assertNotIn("jane@example.com", result)
        self.assertNotIn("123-45-6789", result)
        self.assertNotIn("4111 1111 1111 1111", result)
        self.assertIn("Customer:", result)
        self.assertIn("[REDACTED_PHONE]", result)
        self.assertIn("[REDACTED_EMAIL]", result)
        self.assertIn("[REDACTED_SSN]", result)
        self.assertIn("[REDACTED_CARD]", result)
