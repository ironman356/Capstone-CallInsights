from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parents[3]
    api_root = repo_root / "apps" / "api"
    if str(api_root) not in sys.path:
        sys.path.insert(0, str(api_root))

    from app.services.rank1.pipeline import Rank1PipelineService

    parser = argparse.ArgumentParser(description="Run Rank 1 processing on an SPS-local JSONL transcript file.")
    parser.add_argument("--input-jsonl", required=True, help="Path to a JSONL file stored inside SPS.")
    parser.add_argument("--output-dir", required=True, help="Directory for processed outputs.")
    args = parser.parse_args()

    input_path = Path(args.input_jsonl).resolve()
    output_dir = Path(args.output_dir).resolve()
    raw_dir = output_dir / "raw"
    processed_dir = output_dir / "processed"
    outputs_dir = output_dir / "outputs"
    raw_dir.mkdir(parents=True, exist_ok=True)

    target_input = raw_dir / input_path.name
    if input_path != target_input:
        target_input.write_text(input_path.read_text(encoding="utf-8"), encoding="utf-8")

    service = Rank1PipelineService()
    service.raw_dir = raw_dir
    service.processed_dir = processed_dir
    service.outputs_dir = outputs_dir
    bundle = service.run()

    print(f"Processed {len(bundle['calls'])} calls")
    print(f"Outputs written to {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
