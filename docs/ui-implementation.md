# Call Insights UI Implementation

## What Was Built

- A rebuilt React + Vite frontend source tree under `apps/web` so the UI can be maintained and built from source again.
- A route-based multi-page UI with dedicated workspaces instead of one dense dashboard surface.
- A high-contrast interactive product-style interface instead of a plain dashboard layout.
- Light mode and dark mode switching with local persistence in browser storage.
- An executive overview that turns the provided "Blind spot -> Now you see" framing into visual UI cards.
- A Daily Pulse workspace driven by backend-generated insight cards.
- A Monthly Recalibration view showing taxonomy notes, baseline status, and AI Q&A summaries.
- An Issue Explorer with search, outcome filtering, and direct evidence-call navigation.
- A Call Drilldown screen for transcript turns, sentiment timeline, behavior signals, and issue segments.
- A Strategy Workflow board with create and stage-advance controls.
- A Reports & Export screen backed by a report export endpoint.
- An AI Governance screen showing evidence policy, audit summary, and monitor health.
- A persistent navigation rail and page shell so managers can move between focused workspaces without losing context.

## Backend Connections

- `GET /api/rank1/workspace`
  Provides the main workspace payload used by the executive, pulse, recalibration, report, and governance views.

- `GET /api/rank1/issues/{issue_slug}`
  Powers Issue Explorer detail updates.

- `GET /api/rank1/calls/{call_id}`
  Powers Call Drilldown transcript and structured extraction views.

- `POST /api/rank1/run`
  Re-runs the batch pipeline from the UI.

- `POST /api/rank1/recalibrate`
  Refreshes the workspace with a forced backend recalibration cycle.

- `GET /api/rank1/strategies`
  Returns the strategy workflow board.

- `POST /api/rank1/strategies`
  Creates new strategies from the UI form.

- `PATCH /api/rank1/strategies/{strategy_id}`
  Advances or moves strategies across lifecycle stages.

- `POST /api/rank1/reports/export`
  Generates a fresh export-ready report payload.

- `GET /api/rank1/governance`
  Exposes governance and audit-oriented status data.

## Interaction Notes

- Every visible action button in the new UI performs a real navigation or backend action.
- Each primary product area now has its own page path for clearer separation of concerns:
  `/`, `/daily-pulse`, `/monthly-recalibration`, `/issue-explorer`, `/call-drilldown`, `/strategy-workflow`, `/reports`, `/governance`
- Theme switching is immediate and does not require a page reload.
- Strategy cards are interactive and update workflow stages through the API.
- Evidence call chips jump directly into transcript drilldown.
- Recalibration, refresh, rerun, and export actions return visible status feedback in the UI.

## Files Added Or Updated

- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `apps/web/index.html`
- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/types.ts`
- `apps/web/src/styles.css`
- `apps/api/app/api/rank1.py`
- `apps/api/app/schemas/rank1.py`
- `apps/api/app/services/rank1/pipeline.py`
- `docs/ui-implementation.md`
