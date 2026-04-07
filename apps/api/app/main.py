from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import health, rank1

app = FastAPI(
    title="CallInsights API",
    description="Backend API services for the CallInsights platform",
    version="0.1.0"
)

app.include_router(health.router, prefix="/health", tags=["system"])
app.include_router(rank1.router, prefix="/api/rank1", tags=["rank1"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to CallInsights API", "rank1": "/api/rank1/dashboard"}
