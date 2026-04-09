from __future__ import annotations

import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = REPO_ROOT / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.api import rank1 as rank1_api  # noqa: E402
from app.main import app  # noqa: E402

from tests._rank1_test_utils import (  # noqa: E402
    make_workspace_temp_dir,
    remove_workspace_temp_dir,
    write_sample_transcripts,
)


class Rank1ApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_base = make_workspace_temp_dir(REPO_ROOT / "tests", "tmp_api")
        base = self.temp_base
        raw_dir = base / "raw" / "transcripts"
        write_sample_transcripts(raw_dir)

        self.original_dirs = (
            rank1_api.service.raw_dir,
            rank1_api.service.processed_dir,
            rank1_api.service.outputs_dir,
        )
        rank1_api.service.raw_dir = raw_dir
        rank1_api.service.processed_dir = base / "processed"
        rank1_api.service.outputs_dir = base / "outputs"

        self.client = TestClient(app)

    def tearDown(self) -> None:
        rank1_api.service.raw_dir, rank1_api.service.processed_dir, rank1_api.service.outputs_dir = self.original_dirs
        remove_workspace_temp_dir(self.temp_base)

    def test_root_endpoint_returns_welcome_message(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Welcome to CallInsights API")

    def test_health_endpoint_returns_ok_status(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "call-insights-api"})

    def test_dashboard_endpoint_returns_overview_and_calls(self) -> None:
        response = self.client.get("/rank1/dashboard")
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertIn("overview", payload)
        self.assertIn("issues", payload)
        self.assertIn("calls", payload)
        self.assertGreater(len(payload["calls"]), 0)

    def test_issue_detail_endpoint_returns_matching_issue(self) -> None:
        dashboard = self.client.get("/rank1/dashboard").json()
        issue_slug = dashboard["issues"][0]["slug"]
        response = self.client.get(f"/rank1/issues/{issue_slug}")
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["issue"], dashboard["issues"][0]["issue"])
        self.assertIn("evidence_calls", payload)

    def test_issue_detail_endpoint_returns_404_for_unknown_issue(self) -> None:
        response = self.client.get("/rank1/issues/does-not-exist")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Issue not found")

    def test_call_detail_endpoint_returns_matching_call(self) -> None:
        dashboard = self.client.get("/rank1/dashboard").json()
        call_id = dashboard["calls"][0]["call_id"]
        response = self.client.get(f"/rank1/calls/{call_id}")
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["call_id"], call_id)
        self.assertIn("turns", payload)
        self.assertIn("segments", payload)

    def test_call_detail_endpoint_returns_404_for_unknown_call(self) -> None:
        response = self.client.get("/rank1/calls/CALL-9999")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Call not found")

    def test_run_endpoint_forces_pipeline_and_reports_artifacts(self) -> None:
        response = self.client.post("/rank1/run")
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["status"], "ok")
        self.assertGreater(payload["call_count"], 0)
        self.assertGreater(payload["segment_count"], 0)
        self.assertIn("triple_engine", payload["output_files"])


if __name__ == "__main__":
    unittest.main()
