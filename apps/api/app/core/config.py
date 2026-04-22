from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_CONFIG_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _CONFIG_DIR.parents[3]
_load_env_file(_REPO_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    PROJECT_NAME: str = "CallInsights API"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    APP_DIR: Path = Path(__file__).resolve().parents[1]
    REPO_ROOT: Path = APP_DIR.parents[2]
    DATA_DIR: Path = REPO_ROOT / "data"
    RAW_TRANSCRIPTS_DIR: Path = DATA_DIR / "raw" / "transcripts"
    PROCESSED_DIR: Path = DATA_DIR / "processed"
    OUTPUTS_DIR: Path = DATA_DIR / "outputs"


settings = Settings()
