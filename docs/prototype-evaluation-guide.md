# Call Insights Prototype Evaluation Guide

## Team Ownership

- Alex: UI / frontend page structure, presentation layout, navigation
- Abdul: UI / frontend interactions, reports view, display polish
- Anshul: backend endpoints, report/PDF export, workflow APIs
- Prachi: backend integration, pipeline-backed data flow, frontend-backend connection

## What We Are Showing

Call Insights is an evidence-first prototype that turns historical call transcripts into:

- recurring issue clusters
- behavior and outcome patterns
- transcript drilldowns
- strategy tracking
- downloadable reports

The core message for the TA:

We already have working code that runs locally, supports multiple product areas, connects frontend and backend logic, and demonstrates visible progress toward the end-of-semester prototype.

## Evaluation Meeting Itinerary

1. Arrive 5+ minutes early
2. Confirm backend and frontend are already running
3. Confirm the PDF report button works before the TA joins
4. Start the live demo immediately when asked
5. Transition into individual environment/code walkthroughs

## Demo Plan

### Demo Roles

- Demo driver / screen share: Alex
- Main product narration: Abdul
- Backend/API explanation during transitions: Anshul
- Data flow and integration explanation: Prachi

### 5-Minute Demo Flow

1. Open Executive Overview
   - Explain the problem space and the "blind spot -> now you see" framing
   - Show that the app is running and populated with real data

2. Open Daily Pulse
   - Show evidence-backed insight cards
   - Point out that each insight links to calls and strategy actions

3. Open Issue Explorer
   - Filter/select an issue cluster
   - Show that issue summaries, behaviors, outcomes, and evidence calls update

4. Open Call Drilldown
   - Show a transcript
   - Show sentiment, behavior signals, and segments
   - Emphasize evidence grounding and transparency

5. Open Strategy Workflow
   - Show that strategies can be created and advanced across lifecycle states
   - Explain closed-loop accountability

6. Open Reports & Export
   - Click `Download PDF report`
   - Show the downloaded PDF artifact
   - Explain that the system now produces a demo-ready report deliverable

### Core Achieved Functionality

- Running full-stack prototype
- Multi-page product interface
- Real backend-driven issue and call analytics
- Strategy workflow integration
- Real downloadable PDF report

## How to Show Code Working

- Keep the app and API running before the meeting begins
- Use the UI first, not raw code, to establish credibility quickly
- Use the PDF download as the clearest proof that an action results in a real artifact
- Use transcript drilldown to show the evidence path behind the analytics

## Demo Reset Plan

There is no mutable production database in this prototype, so reset is lightweight:

- Use `Refresh workspace` if the UI needs to re-fetch
- Use `Re-run pipeline` if the generated data needs to be refreshed
- If needed, restart:

```powershell
cd c:\Users\Prachi\OneDrive\Documents\callinsight\apps\api
uvicorn app.main:app --reload
```

```powershell
cd c:\Users\Prachi\OneDrive\Documents\callinsight\apps\web
npm run dev
```

## Individual IDE & Code Walkthrough Plan

Each person should show one focused code area for under 3 minutes.

### Alex

Show:

- `apps/web/src/components/AppFrame.tsx`
- `apps/web/src/navigation.ts`

One-sentence description:

Built the multi-page navigation shell and page-based structure so the UI has clear separation of concerns and is easier to present.

### Abdul

Show:

- `apps/web/src/pages/ReportsPage.tsx`
- `apps/web/src/styles.css`

One-sentence description:

Built the presentation-facing report screen and polished the UI interactions and styling for a cleaner prototype experience.

### Anshul

Show:

- `apps/api/app/api/rank1.py`
- `apps/api/app/services/rank1/pipeline.py`

One-sentence description:

Implemented backend endpoints and report-generation logic, including the PDF download path used in the demo.

### Prachi

Show:

- `apps/web/src/api.ts`
- `apps/api/app/schemas/rank1.py`
- `apps/web/src/App.tsx`

One-sentence description:

Connected frontend workflows to backend endpoints and coordinated the end-to-end data flow for reports, strategies, and drilldowns.

## Suggested Talking Points if Asked

### Why this is meaningful progress

- The prototype is not static; it is interactive and backed by actual API endpoints.
- Multiple concerns are separated into dedicated pages and workflows.
- The system already produces a management-facing artifact through PDF export.

### How contributions are visible

- Frontend ownership is visible in navigation, screens, interactions, and demo polish.
- Backend ownership is visible in APIs, pipeline-backed workspace data, strategy actions, and report generation.

### What is not in scope yet

- Real-time in-call assistance
- Full production integrations with external platforms
- Live operational deployment

## Rubric Mapping

### Part 1 - Working Demo

Show:

- Running UI
- Real navigation
- Real evidence drilldown
- Real PDF report download

Why it helps:

- Demonstrates visible progress
- Shows professional preparation
- Gives confidence that the team is on track

### Part 2 - IDE & Code Produced

Show:

- Each member opens their own code area
- Each member explains one concrete behavior they implemented
- Each member confirms they can run the project locally

Why it helps:

- Demonstrates real development environment ownership
- Shows individual code contribution

## Quick Pre-Meeting Checklist

- Backend server running
- Frontend server running
- Issue Explorer page loads correctly
- Transcript drilldown opens correctly
- Strategy page loads correctly
- PDF download button tested once before the meeting
- Each member knows exactly which file(s) they will screen share
- Each member knows their one-sentence description of their work
