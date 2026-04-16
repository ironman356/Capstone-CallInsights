# Call Insights Demo Architecture Guide

This document explains how the frontend, backend, and data pipeline work together so you can walk through the product confidently during a demo.

## 1. High-Level System Map

At a high level, the system works like this:

1. Raw transcripts live in `data/raw/transcripts/`.
2. The backend pipeline reads those transcripts, classifies issues, detects behaviors, scores sentiment, builds summaries, and writes processed outputs into `data/processed/` and `data/outputs/`.
3. FastAPI exposes those processed insights as API endpoints.
4. The React frontend calls those endpoints and renders the results into focused pages like Overview, Issue Explorer, Drilldown, Strategy Workflow, Reports, and Governance.

The main files for that end-to-end path are:

- Frontend entry: `apps/web/src/main.tsx`
- Frontend app orchestration: `apps/web/src/App.tsx`
- Frontend API client: `apps/web/src/api.ts`
- Frontend shared response types: `apps/web/src/types.ts`
- Backend app setup: `apps/api/app/main.py`
- Backend API routes: `apps/api/app/api/rank1.py`
- Backend response schemas: `apps/api/app/schemas/rank1.py`
- Backend pipeline and business logic: `apps/api/app/services/rank1/pipeline.py`
- Backend path/config setup: `apps/api/app/core/config.py`
- Raw and generated data: `data/raw/`, `data/processed/`, `data/outputs/`

## 2. Frontend Architecture

### 2.1 Frontend entry point

The React app starts in `apps/web/src/main.tsx`. This file mounts `<App />` into the DOM and loads the shared stylesheet from `apps/web/src/styles.css`.

### 2.2 Frontend controller: `App.tsx`

`apps/web/src/App.tsx` is the main coordinator for the UI. It is effectively the frontend's application controller.

Its responsibilities are:

- Loading the full workspace on startup with `api.getWorkspace()`
- Tracking the active page based on URL path using `apps/web/src/navigation.ts`
- Holding shared app state such as:
  - `workspace`
  - `issueDetail`
  - `callDetail`
  - selected issue and call
  - strategy form state
  - loading, syncing, action message, and error states
- Fetching issue detail when the selected issue changes
- Fetching call detail when the selected call changes
- Handling mutations such as:
  - rerun pipeline
  - recalibration
  - create strategy
  - move strategy
  - export report

This file is the best place to explain frontend control flow in a demo because nearly every user action is routed through it.

### 2.3 Frontend API layer

`apps/web/src/api.ts` is the only place the frontend talks to the backend.

Key details:

- It sets `API_ROOT` to `VITE_API_ROOT` if defined, otherwise defaults to `http://127.0.0.1:8000/api/rank1`.
- It uses one generic `request<T>()` helper for JSON requests.
- It exposes purpose-specific methods such as:
  - `getWorkspace()`
  - `getIssue(issueSlug)`
  - `getCall(callId)`
  - `getStrategies()`
  - `createStrategy(payload)`
  - `updateStrategy(strategyId, payload)`
  - `rerunPipeline()`
  - `recalibrate()`
  - `exportReport()`
  - `downloadReportPdf()`

For demo explanation, this is the cleanest file to show how the frontend and backend are connected.

### 2.4 Shared frontend contracts

`apps/web/src/types.ts` defines the TypeScript shapes used across the UI. These mirror the backend response shapes in `apps/api/app/schemas/rank1.py`.

That mirroring matters because:

- The frontend knows exactly what fields to expect.
- The backend validates what it returns.
- The app stays consistent across pages because all pages use the same shared payload model.

### 2.5 Navigation and page structure

`apps/web/src/navigation.ts` defines the page list and path mapping:

- Executive Overview
- Daily Pulse
- Monthly Recalibration
- Issue Explorer
- Call Drilldown
- Strategy Workflow
- Reports & Export
- AI Governance

`apps/web/src/components/AppFrame.tsx` wraps every page with:

- left navigation
- top summary metrics
- action buttons for refresh, rerun, recalibration, and export
- theme toggle
- global success and error banners

This means the app is organized as a shared shell plus page-specific content.

### 2.6 What each page does

#### Executive Overview

File: `apps/web/src/pages/OverviewPage.tsx`

This page uses `workspace.dashboard` and shows:

- top issue cards
- daily brief items
- a "before vs after" value framing section
- top behavior/issue/outcome patterns

Interactive behavior:

- Clicking an issue card opens Issue Explorer for that issue.
- Clicking a pattern can open both an issue and a specific call.

#### Daily Pulse

File: `apps/web/src/pages/PulsePage.tsx`

This page shows `workspace.pulse_insights`.

Interactive behavior:

- Opens evidence calls directly
- Seeds the strategy form from a pulse insight
- Moves the user into the Strategy page to operationalize an insight

This is the clearest UI example of "analytics leading to action."

#### Monthly Recalibration

File: `apps/web/src/pages/MonthlyPage.tsx`

This page displays:

- recalibration metadata
- taxonomy notes
- "Ask CI" question-and-answer cards

Interactive behavior:

- Evidence call IDs on Ask CI cards open transcript drilldowns

#### Issue Explorer

File: `apps/web/src/pages/ExplorerPage.tsx`

This page is driven by:

- `workspace.dashboard.issues`
- `issueDetail`
- local filters for text query and outcome

Interactive behavior:

- Search and filter issue clusters
- Select an issue from the list
- See top behaviors, outcome mix, average sentiment impact, and evidence calls
- Open representative calls

#### Call Drilldown

File: `apps/web/src/pages/DrilldownPage.tsx`

This page renders:

- the transcript turns
- sentiment timeline
- detected behaviors
- segmented issue blocks

This page is where the user can connect the structured analytics back to actual transcript evidence.

#### Strategy Workflow

File: `apps/web/src/pages/StrategiesPage.tsx`

This page has two functions:

- Create a new strategy
- Manage existing strategies in a Kanban-like lifecycle

Interactive behavior:

- Strategy creation posts to the backend
- Back/Advance buttons patch the strategy status
- Evidence call IDs open drilldowns

#### Reports & Export

File: `apps/web/src/pages/ReportsPage.tsx`

This page shows:

- generated timestamp
- KPI totals
- report highlights
- issue table

Interactive behavior:

- Refresh report data fetches a new summary JSON
- Download PDF report triggers a backend-generated PDF download

#### AI Governance

Primary file: `apps/web/src/pages/AdminAiGovernancePage.tsx`

Supporting files:

- `apps/web/src/FlowDiagram.tsx`
- `apps/web/src/SidePanel.tsx`
- `apps/web/src/architectureData.ts`
- `apps/web/src/PipelineNode.tsx`

This page has two parts:

1. Backend-driven governance data from `workspace.governance`
2. A local interactive architecture diagram used to explain the pipeline conceptually

Important demo note:

The governance summary cards come from the backend, but the pipeline configuration diagram is currently a frontend-side explanatory UI. It does not persist settings to the backend.

## 3. Backend Architecture

### 3.1 Backend app setup

`apps/api/app/main.py` creates the FastAPI app and configures CORS for the frontend ports.

It mounts:

- `health` routes
- `rank1` routes directly
- `rank1` routes again under `/api`

That is why the frontend can call `http://127.0.0.1:8000/api/rank1/...`.

### 3.2 Backend configuration

`apps/api/app/core/config.py` defines the backend's important filesystem locations:

- repo root
- data directory
- raw transcripts directory
- processed directory
- outputs directory

This file is what allows the pipeline service to find transcript inputs and write generated artifacts.

### 3.3 Backend route layer

`apps/api/app/api/rank1.py` is the HTTP layer.

Its job is intentionally thin:

- receive the request
- call `Rank1PipelineService`
- transform or validate the returned payload through Pydantic schemas
- return the response

This file is a good demo reference because it clearly maps API routes to service methods.

### 3.4 Backend schema layer

`apps/api/app/schemas/rank1.py` defines response and request models for:

- dashboard
- issue detail
- call detail
- workspace
- strategies
- pipeline run response
- report export response
- governance response

These schemas serve as the contract between backend and frontend.

## 4. How Frontend and Backend Are Connected

The connection pattern is simple and consistent:

1. The frontend page or action calls a function in `apps/web/src/api.ts`.
2. That function hits a FastAPI route in `apps/api/app/api/rank1.py`.
3. The route delegates to `Rank1PipelineService` in `apps/api/app/services/rank1/pipeline.py`.
4. The service reads either:
   - cached generated files in `data/processed/` and `data/outputs/`, or
   - raw transcripts in `data/raw/transcripts/` if it needs to rerun the pipeline.
5. The backend returns a structured payload.
6. `App.tsx` stores that payload in state and passes the relevant slice into the active page component.

The shared contract between both sides is:

- frontend types: `apps/web/src/types.ts`
- backend schemas: `apps/api/app/schemas/rank1.py`

## 5. Backend Feature Logic in Detail

This is the most important section for demo explanations.

### 5.1 Health check

Route file:

- `apps/api/app/api/health.py`

Purpose:

- Confirms the backend is running

Logic:

- Returns a small JSON payload with service status
- No pipeline logic is involved

### 5.2 Workspace endpoint

Route:

- `GET /api/rank1/workspace`

Files involved:

- `apps/api/app/api/rank1.py`
- `apps/api/app/services/rank1/pipeline.py`

Core service method:

- `build_workspace()`

What it does:

- Loads or rebuilds the current analytics bundle
- Packages all major frontend sections into one payload:
  - dashboard
  - pulse insights
  - recalibration summary
  - strategy board
  - Ask CI
  - reports
  - governance

Why it exists:

- The frontend can render almost the entire application from one initial request
- This reduces repeated roundtrips and keeps page state aligned

Internal dependency chain:

- `build_workspace()`
- `load_or_run()`
- `build_pulse_insights()`
- `build_recalibration_summary()`
- `build_strategy_board()`
- `build_ask_ci()`
- `build_report_summary()`
- `build_governance_summary()`

### 5.3 Pipeline loading and caching

Core method:

- `load_or_run()`

What it does:

- Checks whether processed summary files already exist
- If they do, it reads them from:
  - `data/processed/calls.jsonl`
  - `data/outputs/triple_engine_summary.json`
- If not, or if `force=True`, it executes a full rebuild via `run()`

Why this matters in the demo:

- Most reads are fast because the backend usually reuses generated outputs
- "Re-run pipeline" and "Run recalibration" force regeneration when needed

### 5.4 Raw transcript ingestion

Core method:

- `ingest_calls()`

What it does:

- Reads every `.txt` transcript from `data/raw/transcripts/`
- Assigns synthetic call IDs like `CALL-0001`
- Parses the transcript into speaker turns
- Builds the initial per-call records with:
  - call ID
  - source file
  - full transcript text
  - turn list
  - turn count

Supporting helper:

- `_extract_turns()`

How `_extract_turns()` works:

- Reads transcript lines
- Splits only lines that contain `:`
- Accepts speakers only if they are `Customer` or `Agent`
- Produces normalized turn objects used by later analytics

### 5.5 Issue classification logic

Core method:

- `classify_issue()`

Supporting helper:

- `_score_keywords()`

How it works:

- The backend keeps a keyword dictionary called `ISSUE_KEYWORDS`
- For each transcript, it lowers the text and counts keyword matches per issue
- The issue with the highest score wins
- If nothing meaningful matches, the issue becomes `other`

Why this matters:

- Issue clustering is heuristic and deterministic in this prototype
- It is easy to explain in a demo because the categories come from explicit patterns in the transcript text

### 5.6 Outcome classification logic

Core method:

- `classify_outcome()`

How it works:

- Looks for phrases that imply:
  - callback requested
  - escalation
  - resolution
  - follow-up needed
- If none match, it falls back to `unresolved`

Why it is useful:

- It converts freeform transcript text into operational categories that can be counted and compared

### 5.7 Behavior extraction logic

Core method:

- `extract_behaviors()`

How it works:

- Uses the `BEHAVIOR_RULES` dictionary
- Searches transcript text for behavior-like patterns such as:
  - explained timeline early
  - used empathy
  - offered next steps
  - transferred / escalated
- Adds additional inferred labels in certain cases
  - for example, `resolved calmly` if the call resolved and contains positive language
  - `failed to address concern` if the call remained unresolved and contains frustration cues
- Deduplicates and sorts the final labels

Why this matters:

- These behavior labels are the bridge between transcript evidence and coaching or strategy decisions

### 5.8 Sentiment scoring logic

Core methods:

- `_split_sections()`
- `_score_sentiment()`
- `score_sentiment()`

How it works:

- Splits a call into opening, mid, and closing sections
- Counts simple positive and negative terms in each section
- Produces:
  - `opening`
  - `mid`
  - `closing`
  - `shift`

Why the `shift` metric matters:

- It gives the UI a simple way to show whether the call got better or worse by the end

### 5.9 Segmenting a call into issue blocks

Core method:

- `segment_call()`

How it works:

- Walks through the transcript turn by turn
- Reclassifies the current text as it goes
- Starts a new segment when the detected issue changes meaningfully
- Produces segment records with:
  - segment ID
  - call ID
  - order
  - issue
  - text
  - turn count

Why this matters:

- The drilldown page can show not just a whole call, but where issue focus changed inside that call

### 5.10 Call enrichment

Core method:

- `enrich_calls()`

What it does:

- Loops through all ingested calls
- For each call, computes:
  - issue
  - issue score details
  - outcome
  - behavior labels
  - sentiment scores
  - call segments
  - summary text

Outputs created:

- enriched call records
- segments
- issue records
- behavior records
- sentiment records
- outcome records

This method is the main single-call analytics layer.

### 5.11 Triple-engine analytics and dashboard rollup

Core method:

- `build_triple_engine()`

This is the backend's main aggregation layer.

What it does:

- Counts issue frequencies across all calls
- Counts outcome frequencies across all calls
- Counts behavior frequencies across all calls
- Builds combinations of:
  - issue
  - behavior
  - outcome

Then it calculates:

- combination count
- expected frequency
- `lift`

What `lift` means here:

- It shows whether a particular issue-behavior-outcome combination appears more often than expected
- That helps surface patterns that are not just common, but unusually important

The same method also builds:

- overview metrics
- outcome breakdowns
- ranked issue list
- representative calls per issue
- per-call dashboard cards
- daily brief text

This method is the reason the app can show both:

- single-call evidence
- portfolio-level operational patterns

### 5.12 Dashboard endpoint

Route:

- `GET /api/rank1/dashboard`

Files involved:

- `apps/api/app/api/rank1.py`
- `apps/api/app/services/rank1/pipeline.py`

What it returns:

- overview metrics
- ranked issues
- call cards

How it works:

- Calls `load_or_run()`
- Returns the `overview`, `issues`, and `calls` slices from the bundle

Note:

The UI currently leans more heavily on `/workspace` than on `/dashboard`, but this route still exposes the core dashboard data separately.

### 5.13 Issue detail endpoint

Route:

- `GET /api/rank1/issues/{issue_slug}`

Core logic:

- Loads the bundle
- Finds the matching issue by slug
- Returns:
  - issue name
  - count
  - summary
  - top behaviors
  - outcome breakdown
  - representative evidence calls

Why it exists:

- Keeps the explorer detail panel focused
- Allows the page to fetch deeper context only for the selected issue

### 5.14 Call detail endpoint

Route:

- `GET /api/rank1/calls/{call_id}`

Core logic:

- Loads the bundle
- Looks up the full enriched call in `call_details`
- Returns:
  - transcript text
  - turns
  - issue
  - outcome
  - behaviors
  - sentiment scores
  - summary
  - segments

Why it exists:

- This is the endpoint that lets the drilldown page tie the analytics back to concrete evidence

### 5.15 Pipeline rerun endpoint

Route:

- `POST /api/rank1/run`

Core service path:

- `run()`

What `run()` does:

- Ensures output directories exist
- Re-ingests raw transcripts
- Re-enriches all calls
- Rebuilds the triple-engine summary
- Writes output artifacts to disk

Artifacts written:

- `data/processed/calls.jsonl`
- `data/processed/segments.jsonl`
- `data/processed/issues.jsonl`
- `data/processed/behaviors.jsonl`
- `data/processed/sentiment.jsonl`
- `data/processed/outcomes.jsonl`
- `data/outputs/triple_engine_summary.json`

Why this matters in a demo:

- The "Re-run pipeline" button is not cosmetic
- It rebuilds the underlying analytical dataset from the raw transcripts

### 5.16 Strategy board logic

Files involved:

- `apps/api/app/api/rank1.py`
- `apps/api/app/services/rank1/pipeline.py`
- `data/outputs/strategy_board.json`

Key methods:

- `_build_default_strategies()`
- `load_strategies()`
- `save_strategies()`
- `build_strategy_board()`
- `create_strategy()`
- `update_strategy()`

How it works:

- Strategies are persisted in `data/outputs/strategy_board.json`
- If no strategy file exists, the backend seeds default strategies from the top issues
- Each strategy includes:
  - issue linkage
  - status
  - owner
  - hypothesis
  - KPI focus
  - evidence call IDs

`build_strategy_board()`:

- Reads the strategy list
- Computes counts per stage
- Returns both the stage summary and full list

`create_strategy()`:

- Validates the incoming issue slug against current ranked issues
- Creates a strategy record with timestamps and generated ID
- Defaults evidence calls to representative issue calls if none are supplied
- Inserts the new strategy at the top of the list

`update_strategy()`:

- Finds an existing strategy by ID
- Applies only provided fields
- Updates `updated_at`
- Saves the modified list back to disk

Important practical detail:

- The strategy workflow is stateful across sessions because it writes to disk

### 5.17 Recalibration logic

Route:

- `POST /api/rank1/recalibrate`

Core methods:

- `build_workspace(force=True)`
- `build_recalibration_summary()`

How it works:

- Forces a workspace rebuild
- Recomputes analytics from the latest data
- Produces a business-facing recalibration summary including:
  - completion timestamp
  - baseline window
  - detected new clusters
  - retired clusters
  - top issue
  - taxonomy notes

Why it exists:

- It gives leadership a narrative explanation of what changed in the taxonomy or pattern landscape

### 5.18 Ask CI logic

Core method:

- `build_ask_ci()`

How it works:

- Creates a small set of leadership-facing questions
- Answers them using:
  - top issues
  - top resolved pattern
  - top escalated pattern
- Attaches evidence call IDs to each answer

Why it is useful:

- It turns raw analytics into guided executive interpretation

### 5.19 Report summary and PDF generation

Routes:

- `POST /api/rank1/reports/export`
- `GET /api/rank1/reports/export.pdf`

Core methods:

- `build_report_summary()`
- `build_report_pdf()`

`build_report_summary()` does:

- Creates a report title
- Adds generated timestamp
- Rolls up KPI totals
- Pulls the daily brief as highlights
- Builds a simple issue table

`build_report_pdf()` does:

- Converts the report summary into a manually constructed PDF byte stream
- Escapes PDF-sensitive characters
- Wraps long lines
- Creates PDF objects, pages, font definitions, cross-reference table, and trailer

Important demo point:

- The PDF is generated directly by backend code, not by a browser print hack
- That makes the export reproducible from backend state alone

### 5.20 Governance summary logic

Route:

- `GET /api/rank1/governance`

Core method:

- `build_governance_summary()`

What it returns:

- evidence policy statements
- audit summary counts
- monitor health cards

How it is built:

- Pulls strategy board counts
- Pulls issue and pattern counts from the current bundle
- Produces a simple governance-friendly summary

Why it matters:

- It frames the product as evidence-backed and auditable, not just analytical

## 6. Frontend-to-Backend Feature Mapping

Use this section during a demo when someone asks, "What powers this page?"

| UI/Page | Frontend files | Backend endpoint(s) | Backend logic |
| --- | --- | --- | --- |
| App bootstrap | `apps/web/src/App.tsx`, `apps/web/src/api.ts` | `GET /api/rank1/workspace` | `build_workspace()` |
| Executive Overview | `apps/web/src/pages/OverviewPage.tsx` | Mostly from workspace payload | `build_triple_engine()` |
| Daily Pulse | `apps/web/src/pages/PulsePage.tsx` | Mostly from workspace payload | `build_pulse_insights()` |
| Monthly Recalibration | `apps/web/src/pages/MonthlyPage.tsx` | Mostly from workspace payload | `build_recalibration_summary()`, `build_ask_ci()` |
| Issue Explorer | `apps/web/src/pages/ExplorerPage.tsx` | `GET /api/rank1/issues/{issue_slug}` | issue lookup from bundle |
| Call Drilldown | `apps/web/src/pages/DrilldownPage.tsx` | `GET /api/rank1/calls/{call_id}` | enriched call lookup |
| Strategy Workflow | `apps/web/src/pages/StrategiesPage.tsx` | `GET/POST/PATCH /api/rank1/strategies` | strategy storage and lifecycle methods |
| Reports & Export | `apps/web/src/pages/ReportsPage.tsx` | `POST /api/rank1/reports/export`, `GET /api/rank1/reports/export.pdf` | `build_report_summary()`, `build_report_pdf()` |
| Global action buttons | `apps/web/src/components/AppFrame.tsx` | `/workspace`, `/run`, `/recalibrate`, `/reports/export.pdf` | refresh, rerun, recalibrate, export |
| Governance page | `apps/web/src/pages/AdminAiGovernancePage.tsx` | workspace governance data | `build_governance_summary()` |

## 7. Data Files You Can Mention in the Demo

These help explain that the app is not inventing outputs in memory only.

Input data:

- `data/raw/transcripts/`

Generated pipeline artifacts:

- `data/processed/calls.jsonl`
- `data/processed/segments.jsonl`
- `data/processed/issues.jsonl`
- `data/processed/behaviors.jsonl`
- `data/processed/sentiment.jsonl`
- `data/processed/outcomes.jsonl`

Generated rollups and state:

- `data/outputs/triple_engine_summary.json`
- `data/outputs/strategy_board.json`

## 8. Good Demo Narrative

A clean way to explain the system verbally is:

1. "The frontend is a React app organized into focused operational pages instead of one overloaded dashboard."
2. "On startup it loads a workspace payload from FastAPI, which is the backend summary of the current analytic state."
3. "The backend either reads cached generated outputs or rebuilds them from raw transcripts."
4. "Each transcript is parsed into turns, classified into issue and outcome categories, scored for behavior and sentiment, and optionally segmented into issue blocks."
5. "Those per-call signals are then aggregated into issue rankings, behavior-outcome patterns, pulse insights, strategy recommendations, report summaries, and governance views."
6. "When a user creates or moves a strategy, that is written back to disk so the workflow is persistent."
7. "When a user exports a report, the backend generates both a JSON summary and a real PDF artifact."

## 9. Most Important Files to Know Cold

If you only want a short list to study before the demo, focus on these:

- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/types.ts`
- `apps/web/src/pages/OverviewPage.tsx`
- `apps/web/src/pages/ExplorerPage.tsx`
- `apps/web/src/pages/DrilldownPage.tsx`
- `apps/web/src/pages/StrategiesPage.tsx`
- `apps/api/app/main.py`
- `apps/api/app/api/rank1.py`
- `apps/api/app/services/rank1/pipeline.py`
- `apps/api/app/core/config.py`
- `data/outputs/triple_engine_summary.json`
- `data/outputs/strategy_board.json`
