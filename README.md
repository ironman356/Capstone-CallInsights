# Call Insights

Call Insights is an evidence-first analytics prototype for reviewing historical call transcripts, identifying recurring customer issues, surfacing agent behavior patterns, and tracking response strategies through a management workflow.

## Current Prototype

- Multi-page React UI for:
  - Executive Overview
  - Daily Pulse
  - Monthly Recalibration
  - Issue Explorer
  - Call Drilldown
  - Strategy Workflow
  - Reports & Export
  - AI Governance
- FastAPI backend for:
  - dashboard/workspace data
  - issue detail and call drilldown
  - strategy creation and updates
  - report export
  - recalibration and governance summaries
- Synthetic transcript corpus and generated insight outputs stored in `data/`

## Stack

- Frontend: React, TypeScript, Vite
- Backend: FastAPI, Pydantic, Python
- Data flow: transcript files -> pipeline enrichment -> ranked issues/patterns -> workflow/report APIs

## Run Locally

### Backend

```powershell
cd c:\Users\Prachi\OneDrive\Documents\callinsight\apps\api
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```powershell
cd c:\Users\Prachi\OneDrive\Documents\callinsight\apps\web
npm run dev
```

Open:

- UI: `http://127.0.0.1:4173`
- API root: `http://127.0.0.1:8000`

## Demo-Useful Actions

- Use the side navigation to move through focused pages instead of one dense dashboard.
- Use `Run recalibration` or `Re-run pipeline` from the left control rail to refresh the prototype state.
- Use `Reports & Export -> Download PDF report` to download a real PDF artifact for the demo.

## Important Docs

- [UI implementation doc](c:/Users/Prachi/OneDrive/Documents/callinsight/docs/ui-implementation.md)
- [Prototype evaluation guide](c:/Users/Prachi/OneDrive/Documents/callinsight/docs/prototype-evaluation-guide.md)
- [System overview](c:/Users/Prachi/OneDrive/Documents/callinsight/docs/system-overview.md)
