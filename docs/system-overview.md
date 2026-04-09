# Call Insights System Overview

## Product Purpose

Call Insights helps managers review large volumes of historical call transcripts without listening to calls one by one. The system groups similar issues, highlights behavior patterns, provides evidence-backed summaries, and tracks operational strategies over time.

## Frontend

Frontend responsibilities:

- Present the prototype as a multi-page workflow instead of a single dense dashboard
- Render overview, pulse, recalibration, issue, call, strategy, report, and governance views
- Trigger backend actions for:
  - pipeline rerun
  - recalibration
  - strategy creation
  - strategy stage updates
  - PDF report download
- Keep theme switching and navigation responsive for live demos

Primary frontend areas:

- `apps/web/src/App.tsx`
- `apps/web/src/components/AppFrame.tsx`
- `apps/web/src/pages/*`
- `apps/web/src/api.ts`

## Backend

Backend responsibilities:

- Load and enrich transcript data
- Classify issues, outcomes, behaviors, and sentiment
- Build overview and issue-level analytics
- Expose issue, call, strategy, report, and governance endpoints
- Generate downloadable PDF reports for the evaluation/demo

Primary backend areas:

- `apps/api/app/services/rank1/pipeline.py`
- `apps/api/app/api/rank1.py`
- `apps/api/app/schemas/rank1.py`

## Data Flow

1. Transcript files are read from `data/raw/transcripts/`
2. The pipeline extracts turns, segments, issues, outcomes, behaviors, and sentiment
3. Ranked patterns and issue summaries are generated
4. The API exposes the processed data as:
   - workspace/dashboard views
   - issue detail
   - call detail
   - strategies
   - reports
   - governance
5. The frontend renders each concern in its own page and links all interactive actions to the backend

## Demo-Relevant Functionality

- Executive view for project overview
- Issue explorer and transcript drilldown for evidence-backed navigation
- Strategy workflow for closed-loop operational action
- Reports page with real PDF download
- Governance page showing transparency and auditability
