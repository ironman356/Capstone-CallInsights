from __future__ import annotations

from fastapi import FastAPI

from app.api import health, rank1

app = FastAPI(
    title="CallInsights API",
    description="Backend API services for the CallInsights platform",
    version="0.1.0",
)

app.include_router(health.router, prefix="/health", tags=["system"])
app.include_router(rank1.router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "Welcome to CallInsights API"}
