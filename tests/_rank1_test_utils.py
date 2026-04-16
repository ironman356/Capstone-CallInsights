from __future__ import annotations

import shutil
import uuid
from pathlib import Path


SAMPLE_TRANSCRIPTS: list[str] = [
    "\n".join(
        [
            "Agent: I understand why that is frustrating.",
            "Customer: My payment still shows pending even though I made the payment.",
            "Agent: Next step, I can submit a payment activity review today.",
            "Customer: Thank you, that helps.",
        ]
    ),
    "\n".join(
        [
            "Customer: My escrow analysis changed and the monthly payment went up.",
            "Agent: Let me explain the escrow shortage and projected disbursements.",
            "Customer: I am still not happy with that increase.",
            "Agent: We will follow-up after the review team completes the review.",
        ]
    ),
    "\n".join(
        [
            "Customer: I need a payoff statement for my closing.",
            "Agent: Please hold while I connect you to a specialist supervisor.",
            "Customer: Okay.",
        ]
    ),
]


def make_workspace_temp_dir(root: Path, prefix: str) -> Path:
    path = root / f"{prefix}_{uuid.uuid4().hex}"
    path.mkdir(parents=True, exist_ok=False)
    return path


def remove_workspace_temp_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)


def write_sample_transcripts(raw_dir: Path, transcripts: list[str] | None = None) -> list[Path]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    source_transcripts = transcripts or SAMPLE_TRANSCRIPTS
    paths: list[Path] = []
    for index, transcript in enumerate(source_transcripts, start=1):
        path = raw_dir / f"transcript_{index:03d}.txt"
        path.write_text(transcript, encoding="utf-8")
        paths.append(path)
    return paths
