# CallInsights Platform

Welcome to the CallInsights monorepo. This repository contains the Frontend application and Backend API for analyzing customer service call transcripts.

## Repository Structure

- `apps/web`: React + TypeScript frontend (currently a mock interactive React Flow diagram).
- `apps/api`: Python + FastAPI backend (placeholder foundation).
- `packages/shared`: Language-neutral definitions, contracts, and data.
- `docs/assets`: Associated architectural diagrams, design PDFs, and planning resources.

## Running the Application Locally

### 1. Web Application (UI)
The web interface is built using Vite and React Flow.
```bash
cd apps/web
npm install
npm run dev
```

### 2. Backend API
The backend interface is powered by FastAPI.
```bash
cd apps/api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
