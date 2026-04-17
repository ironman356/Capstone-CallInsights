from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
API_ROOT = REPO_ROOT / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.services.rank1.pipeline import Rank1PipelineService  # noqa: E402

from tests._rank1_test_utils import (  # noqa: E402
    SAMPLE_TRANSCRIPTS,
    make_workspace_temp_dir,
    remove_workspace_temp_dir,
    write_sample_transcripts,
)


class Rank1ServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_base = make_workspace_temp_dir(REPO_ROOT / "tests", "tmp_service")
        base = self.temp_base
        self.raw_dir = base / "raw" / "transcripts"
        self.processed_dir = base / "processed"
        self.outputs_dir = base / "outputs"
        write_sample_transcripts(self.raw_dir)

        self.service = Rank1PipelineService()
        self.service.raw_dir = self.raw_dir
        self.service.processed_dir = self.processed_dir
        self.service.outputs_dir = self.outputs_dir

    def tearDown(self) -> None:
        remove_workspace_temp_dir(self.temp_base)

    def test_ingest_calls_loads_source_files_and_turns(self) -> None:
        calls = self.service.ingest_calls()
        self.assertEqual(len(calls), len(SAMPLE_TRANSCRIPTS))
        self.assertEqual(calls[0]["call_id"], "CALL-0001")
        self.assertEqual(calls[0]["source_file"], "transcript_001.txt")
        self.assertGreater(calls[0]["turn_count"], 0)

    def test_ingest_calls_raises_for_missing_raw_dir(self) -> None:
        self.service.raw_dir = self.raw_dir / "missing"
        with self.assertRaises(FileNotFoundError):
            self.service.ingest_calls()

    def test_enrich_calls_adds_rank1_fields(self) -> None:
        calls = self.service.ingest_calls()
        enriched_calls, segments, issues, behaviors, sentiments, outcomes = self.service.enrich_calls(calls)
        self.assertEqual(len(enriched_calls), len(calls))
        self.assertEqual(len(issues), len(calls))
        self.assertEqual(len(behaviors), len(calls))
        self.assertEqual(len(sentiments), len(calls))
        self.assertEqual(len(outcomes), len(calls))
        self.assertGreater(len(segments), 0)
        first_call = enriched_calls[0]
        self.assertIn("issue", first_call)
        self.assertIn("outcome", first_call)
        self.assertIn("behaviors", first_call)
        self.assertIn("sentiments", first_call)
        self.assertIn("segments", first_call)
        self.assertIn("summary", first_call)

    def test_build_triple_engine_returns_issue_rollups_and_patterns(self) -> None:
        calls, *_ = self.service.enrich_calls(self.service.ingest_calls())
        bundle = self.service.build_triple_engine(calls)
        self.assertIn("overview", bundle)
        self.assertIn("issues", bundle)
        self.assertIn("calls", bundle)
        self.assertGreater(len(bundle["overview"]["top_patterns"]), 0)
        self.assertGreater(len(bundle["issues"]), 0)
        self.assertEqual(bundle["overview"]["metrics"][0]["label"], "Calls Indexed")

    def test_build_triple_engine_handles_missing_behaviors(self) -> None:
        calls = [
            {
                "call_id": "CALL-0001",
                "source_file": "sample.txt",
                "issue": "payment confusion",
                "outcome": "unresolved",
                "behaviors": [],
                "summary": "sample",
                "sentiments": {"opening": 0.0, "mid": 0.0, "closing": 0.0, "shift": 0.0},
            }
        ]
        bundle = self.service.build_triple_engine(calls)
        self.assertEqual(bundle["overview"]["issue_counts"]["payment confusion"], 1)
        self.assertEqual(bundle["calls"][0]["behaviors"], [])

    def test_run_writes_all_expected_artifacts(self) -> None:
        bundle = self.service.run()
        self.assertIn("call_details", bundle)
        expected_files = {
            self.processed_dir / "calls.jsonl",
            self.processed_dir / "segments.jsonl",
            self.processed_dir / "issues.jsonl",
            self.processed_dir / "behaviors.jsonl",
            self.processed_dir / "sentiment.jsonl",
            self.processed_dir / "outcomes.jsonl",
            self.outputs_dir / "triple_engine_summary.json",
        }
        for path in expected_files:
            self.assertTrue(path.exists(), str(path))
            self.assertGreater(path.stat().st_size, 0)

    def test_run_writes_valid_jsonl_and_json(self) -> None:
        self.service.run()
        calls_path = self.processed_dir / "calls.jsonl"
        summary_path = self.outputs_dir / "triple_engine_summary.json"
        calls = [json.loads(line) for line in calls_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        self.assertEqual(len(calls), len(SAMPLE_TRANSCRIPTS))
        self.assertIn("overview", summary)
        self.assertIn("issues", summary)
        self.assertIn("calls", summary)

    def test_load_or_run_uses_cached_files_when_available(self) -> None:
        self.service.run()

        def fail_if_called() -> dict:
            raise AssertionError("run() should not be called when cache is present")

        self.service.run = fail_if_called  # type: ignore[method-assign]
        bundle = self.service.load_or_run()
        self.assertIn("call_details", bundle)
        self.assertEqual(len(bundle["call_details"]), len(SAMPLE_TRANSCRIPTS))

    def test_load_or_run_force_bypasses_cache(self) -> None:
        self.service.run()
        sentinel = {"overview": {}, "issues": [], "calls": [], "call_details": {}}

        def forced_run() -> dict:
            return sentinel

        self.service.run = forced_run  # type: ignore[method-assign]
        self.assertIs(self.service.load_or_run(force=True), sentinel)

    def test_ensure_output_dirs_creates_missing_directories(self) -> None:
        self.service.ensure_output_dirs()
        self.assertTrue(self.processed_dir.exists())
        self.assertTrue(self.outputs_dir.exists())

    def test_run_incremental_only_adds_new_calls(self) -> None:
        first_bundle = self.service.run()
        original_count = len(first_bundle["calls"])

        extra_transcript = "\n".join(
            [
                "Customer: My insurance premium changed and I need to know whether escrow was updated.",
                "Agent: I can review the escrow disbursement activity and coverage update with you.",
                "Customer: Thank you.",
            ]
        )
        (self.raw_dir / "transcript_999.txt").write_text(extra_transcript, encoding="utf-8")

        second_bundle = self.service.run_incremental()
        self.assertEqual(len(second_bundle["calls"]), original_count + 1)


if __name__ == "__main__":
    unittest.main()
