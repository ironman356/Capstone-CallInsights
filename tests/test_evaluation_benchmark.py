from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from evaluation.benchmark import run_benchmark
from evaluation.corpus import build_corpus, write_jsonl


class EvaluationBenchmarkTests(unittest.TestCase):
    def test_corpus_contains_required_challenges_and_segment_evidence(self) -> None:
        rows = build_corpus(count=60, seed=4000)
        challenges = {challenge for row in rows for challenge in row["challenge_types"]}
        self.assertTrue({"held_out_paraphrase", "multiple_problems", "one_long_problem"} <= challenges)
        self.assertTrue(any(len(row["segments"]) == 3 for row in rows))
        for row in rows:
            for segment in row["segments"]:
                self.assertTrue(segment["approach_evidence_turns"])
                self.assertTrue(segment["resolution_evidence_turns"])

    def test_benchmark_runs_four_or_more_issue_methods(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            corpus_path = Path(directory) / "benchmark.jsonl"
            write_jsonl(corpus_path, build_corpus(count=60, seed=4000))
            results = run_benchmark(corpus_path)
        self.assertGreaterEqual(len(results["issue_mapping"]), 4)
        self.assertIn("segment_evidence_gate", results["resolution_attribution"])
        self.assertTrue(results["agent_approach_effectiveness"])


if __name__ == "__main__":
    unittest.main()
