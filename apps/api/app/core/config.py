from __future__ import annotations

import os
from pathlib import Path


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
