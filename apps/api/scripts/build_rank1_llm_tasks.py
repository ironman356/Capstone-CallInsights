from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parents[3]
    api_root = repo_root / "apps" / "api"
    if str(api_root) not in sys.path:
        sys.path.insert(0, str(api_root))

    from app.services.rank1.pipeline import Rank1PipelineService

    parser = argparse.ArgumentParser(description="Build grounded Rank 1 LLM tasks from SPS-local transcripts.")
    parser.add_argument("--input-jsonl", required=True, help="Path to the SPS-local transcript JSONL file.")
    parser.add_argument("--output-jsonl", required=True, help="Path for the generated task JSONL file.")
    args = parser.parse_args()

    input_path = Path(args.input_jsonl).resolve()
    output_path = Path(args.output_jsonl).resolve()
    raw_dir = output_path.parent / "_rank1_raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    staged_input = raw_dir / input_path.name
    if input_path != staged_input:
        staged_input.write_text(input_path.read_text(encoding="utf-8"), encoding="utf-8")

    service = Rank1PipelineService()
    service.raw_dir = raw_dir
    calls = service.ingest_calls()
    tasks = service.build_llm_batch_tasks(calls)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(json.dumps(task) for task in tasks) + "\n", encoding="utf-8")
    print(f"Wrote {len(tasks)} LLM tasks to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
