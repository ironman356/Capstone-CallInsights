# Placeholder configuration settings
import os

class Settings:
    PROJECT_NAME: str = "CallInsights API"
    # To be populated with full pydantic BaseSettings later
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

settings = Settings()
