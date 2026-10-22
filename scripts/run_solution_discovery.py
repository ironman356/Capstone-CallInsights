"""Reproduce the solution comparison without rerunning or changing clustering."""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))
from app.services.rank1.solutions import build_solution_report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Optional full JSON evidence report path")
    args = parser.parse_args()
    calls = [json.loads(line) for line in (ROOT / "data/processed/calls.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    summary = json.loads((ROOT / "data/outputs/triple_engine_summary.json").read_text(encoding="utf-8"))
    report = build_solution_report({"call_details": {c["call_id"]: c for c in calls}, "issues": summary["issues"]})
    print(json.dumps({"semantic_status": report["semantic_status"], **report["benchmark"]}, indent=2))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2, ensure_ascii=True, allow_nan=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
