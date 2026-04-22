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

    parser = argparse.ArgumentParser(description="Process only transcripts that are new to the Rank 1 workspace.")
    parser.add_argument("--raw-dir", required=True, help="Directory containing transcript txt/jsonl sources.")
    parser.add_argument("--workspace-dir", required=True, help="Directory holding processed and output artifacts.")
    args = parser.parse_args()

    raw_dir = Path(args.raw_dir).resolve()
    workspace_dir = Path(args.workspace_dir).resolve()

    service = Rank1PipelineService()
    service.raw_dir = raw_dir
    service.processed_dir = workspace_dir / "processed"
    service.outputs_dir = workspace_dir / "outputs"
    bundle = service.run_incremental()

    print(f"Workspace now tracks {len(bundle['calls'])} calls")
    print(f"Issue clusters tracked: {len(bundle['overview']['issue_counts'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
