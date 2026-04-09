from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "call-insights-api"}
