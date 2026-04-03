# CallInsights API

This is a placeholder FastAPI backend for the CallInsights platform. 

## Structure
- `app/`: Core application code, routing, and configurations.
- `schemas/`: Pydantic models for request/response serialization.
- `services/`: Business logic and external service integrations.
- `tests/`: Automated test suite.

## Running Locally
From the `apps/api` directory:

1. Create a virtual environment: `python3 -m venv venv`
2. Activate it: `source venv/bin/activate` or `./venv/scripts/activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Run the server: `uvicorn app.main:app --reload`
