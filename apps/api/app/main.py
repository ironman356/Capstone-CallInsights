from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import health
from services.pipeline import router as pipeline_router

app = FastAPI(
    title="CallInsights API",
    description="Backend API services for the CallInsights platform",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Placeholder routers
app.include_router(health.router, prefix="/health", tags=["system"])
app.include_router(pipeline_router, prefix="/pipeline", tags=["pipeline"])

@app.get("/")
def read_root():
    return {"message": "Welcome to CallInsights API"}
