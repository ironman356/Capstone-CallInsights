from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, rank1

app = FastAPI(
    title="CallInsights API",
    description="Backend API services for the CallInsights platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "http://127.0.0.1:4174",
        "http://localhost:4174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["system"])
app.include_router(rank1.router)
app.include_router(rank1.router, prefix="/api")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "Welcome to CallInsights API"}
