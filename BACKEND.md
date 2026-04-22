# Call Insights Backend Guide

## What The Backend Does

The backend is an adaptive transcript analytics system for mortgage-servicing calls.

It takes transcript files or JSONL transcript feeds and turns them into:

- issue clusters
- call-level outcomes
- behavior signals
- sentiment movement
- evidence-backed patterns
- strategy workflow data
- governance and reporting summaries

The API is implemented in FastAPI under `apps/api/app`.

## Main Runtime Flow

The main service lives in:

- [pipeline.py](/C:/Users/Prachi/OneDrive/Documents/callinsight/apps/api/app/services/rank1/pipeline.py)
- [adaptive.py](/C:/Users/Prachi/OneDrive/Documents/callinsight/apps/api/app/services/rank1/adaptive.py)

Pipeline flow:

1. Ingest transcript sources from `txt` or `jsonl`.
2. Parse turns into `Customer` and `Agent` utterances.
3. Infer a seed issue label from the opening customer problem statement.
4. Embed the issue text with a local Hugging Face sentence-transformer.
5. Match that call into adaptive issue memory.
6. Create a new issue cluster if similarity is too low.
7. Score sentiment with a local Hugging Face sentiment model.
8. Extract behavior signals using embedding similarity plus fallback rules.
9. Build issue rollups, pattern lift, strategy board, governance summary, and report payloads.
10. Persist processed artifacts and adaptive memory to disk.

## Adaptive Learning

The system is not supposed to depend on fixed issue labels.

Adaptive learning is handled through:

- `adaptive_issue_memory.json`
- `adaptive_issue_clusters.json`

Those files store learned issue clusters across runs.

When new transcripts arrive:

- similar calls attach to existing clusters
- new themes create new clusters
- cluster labels can be refreshed with the local text model

This is the main mechanism that lets the backend adapt when the real SPS data changes over time.

## Hugging Face Models Used

Local default models:

- `sentence-transformers/all-MiniLM-L6-v2`
- `cardiffnlp/twitter-roberta-base-sentiment-latest`
- `google/flan-t5-small`

Current usage:

- embeddings: issue clustering and behavior similarity
- sentiment: opening/mid/closing sentiment scoring
- generation: concise cluster naming

Optional deeper generation is available through:

- `RANK1_ENABLE_DEEP_LLM=1`

That slower path can also generate:

- richer behavior lists
- customer action lists
- unresolved issue lists
- one-line summaries

It is off by default because local CPU inference is slower and less stable than the embedding-driven path.

## Main API Endpoints

Defined in:

- [rank1.py](/C:/Users/Prachi/OneDrive/Documents/callinsight/apps/api/app/api/rank1.py)

Key endpoints:

- `GET /api/rank1/workspace`
- `GET /api/rank1/issues/{issue_slug}`
- `GET /api/rank1/calls/{call_id}`
- `POST /api/rank1/run`
- `POST /api/rank1/recalibrate`
- `GET /api/rank1/strategies`
- `POST /api/rank1/strategies`
- `PATCH /api/rank1/strategies/{strategy_id}`
- `POST /api/rank1/reports/export`
- `GET /api/rank1/reports/export.pdf`
- `GET /api/rank1/governance`

The frontend dashboard is built primarily on `workspace`, `issue detail`, `call detail`, `strategies`, and `reports`.

## Scripts

Backend scripts:

- [run_rank1_from_jsonl.py](/C:/Users/Prachi/OneDrive/Documents/callinsight/apps/api/scripts/run_rank1_from_jsonl.py)
- [build_rank1_llm_tasks.py](/C:/Users/Prachi/OneDrive/Documents/callinsight/apps/api/scripts/build_rank1_llm_tasks.py)
- [run_rank1_incremental.py](/C:/Users/Prachi/OneDrive/Documents/callinsight/apps/api/scripts/run_rank1_incremental.py)

Use them for:

- initial workspace build
- grounded batch LLM task generation
- incremental processing of newly arrived transcripts

## Important Output Files

Generated under `data/processed` and `data/outputs`:

- `calls.jsonl`
- `segments.jsonl`
- `issues.jsonl`
- `behaviors.jsonl`
- `sentiment.jsonl`
- `outcomes.jsonl`
- `triple_engine_summary.json`
- `llm_batch_tasks.jsonl`
- `adaptive_issue_memory.json`
- `adaptive_issue_clusters.json`

## How The UI Maps To Backend Data

Executive Dashboard:

- `workspace.dashboard.overview`
- `workspace.dashboard.issues`
- `workspace.pulse_insights`

Issue Intelligence:

- `workspace.dashboard.issues`
- `GET /issues/{issue_slug}`

Call Review:

- `workspace.dashboard.calls`
- `GET /calls/{call_id}`

Strategy Ops:

- `workspace.strategy_board`
- `POST/PATCH /strategies`

Learning System:

- `workspace.recalibration`
- `workspace.governance`
- adaptive issue memory files

Reports:

- `workspace.reports`
- export endpoints

## Run Locally

Backend:

```powershell
cd C:\Users\Prachi\OneDrive\Documents\callinsight\apps\api
uvicorn app.main:app --reload
```

Frontend:

```powershell
cd C:\Users\Prachi\OneDrive\Documents\callinsight\apps\web
npm run dev
```

Type-check frontend:

```powershell
cd C:\Users\Prachi\OneDrive\Documents\callinsight\apps\web
npx tsc --noEmit
```

Run backend tests:

```powershell
cd C:\Users\Prachi\OneDrive\Documents\callinsight
python -m unittest discover -s tests -p "test_rank1*.py"
```

## What To Say In A Demo

Short explanation:

"The backend does not rely on a frozen list of SPS issues. It embeds new calls, matches them into learned issue clusters, creates new clusters when needed, scores sentiment locally with Hugging Face models, and keeps all surfaced insights tied to evidence and reproducible artifacts."
