# Call Insights UI Plan

## Objective

Build a modern dashboard-style web application for the adaptive Call Insights backend so managers can understand issue clusters, evidence, operational risk, and strategy performance from one coherent interface.

## Product Direction

- Replace the current prototype-feel multi-page experience with a stronger executive dashboard shell.
- Keep the app web-native and fast with the existing React + Vite stack.
- Use the current backend API as the source of truth.
- Design around the actual adaptive backend:
  - issue clusters
  - evidence-backed patterns
  - strategy workflow
  - reports and governance
  - adaptive learning and incremental processing

## UI Sections

1. Executive Dashboard
- KPI hero
- issue cluster spotlight
- sentiment and escalation trends
- daily brief and operational narrative

2. Issue Intelligence
- ranked issue clusters
- evidence pack view
- top behavior-outcome patterns
- issue detail drawer or panel

3. Call Review
- transcript timeline
- segment breakdown
- extracted signals
- linked issue cluster and outcome

4. Strategy Operations
- lifecycle board
- strategy detail cards
- KPI focus and evidence references

5. Learning and Governance
- adaptive memory summary
- model/runtime status
- evidence policy and audit health
- report/export status

## Technical Approach

- Reuse existing React Query data loading.
- Keep the backend API contract stable.
- Consolidate the application around one dashboard shell with section routing.
- Use `recharts` for charts, `framer-motion` for staged reveals, and `lucide-react` for visual rhythm.
- Preserve responsive behavior for desktop and mobile.

## Deliverables

- New dashboard-oriented app layout
- Updated styling system for a more polished visual identity
- Backend explanation doc
- Usage instructions for local development
