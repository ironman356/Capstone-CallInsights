from fastapi import FastAPI
from .api import health

app = FastAPI(
    title="CallInsights API",
    description="Backend API services for the CallInsights platform",
    version="0.1.0"
)

# Placeholder routers
app.include_router(health.router, prefix="/health", tags=["system"])

@app.get("/")
def read_root():
    return {"message": "Welcome to CallInsights API"}
