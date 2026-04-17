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
- Mortgage-servicing demo corpus and generated insight outputs stored in `data/`
- Rank 1 backend supports plain transcript files, JSONL transcript feeds, adaptive issue clustering, and local Hugging Face models for embeddings, sentiment, and cluster naming

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

## SPS-Oriented Backend Scripts

```powershell
cd c:\Users\Prachi\OneDrive\Documents\callinsight\apps\api
python scripts\run_rank1_from_jsonl.py --input-jsonl C:\sps\data\transcripts.jsonl --output-dir C:\sps\ci-rank1
python scripts\build_rank1_llm_tasks.py --input-jsonl C:\sps\data\transcripts.jsonl --output-jsonl C:\sps\ci-rank1\tasks.jsonl
python scripts\run_rank1_incremental.py --raw-dir C:\sps\data\transcripts --workspace-dir C:\sps\ci-rank1
```

Runtime flags:

- `RANK1_ENABLE_HF=1` enables cached local Hugging Face models. Default is on outside unit tests.
- `RANK1_ENABLE_DEEP_LLM=1` enables slower per-call generative extraction for behaviors, actions, unresolved gaps, and summaries.
- Default local models:
  - `google/flan-t5-small`
  - `sentence-transformers/all-MiniLM-L6-v2`
  - `cardiffnlp/twitter-roberta-base-sentiment-latest`

The adaptive backend persists issue memory in `data/outputs/adaptive_issue_memory.json`, so when new transcripts arrive it can attach them to existing issue clusters or create new clusters instead of depending on a fixed label list.

## Important Docs

- [UI implementation doc](c:/Users/Prachi/OneDrive/Documents/callinsight/docs/ui-implementation.md)
- [Prototype evaluation guide](c:/Users/Prachi/OneDrive/Documents/callinsight/docs/prototype-evaluation-guide.md)
- [System overview](c:/Users/Prachi/OneDrive/Documents/callinsight/docs/system-overview.md)
