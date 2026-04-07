## UI/UX Direction — Build a Professional Web App, Not a Dashboard

### Product goal

The CI frontend must feel like a real internal web application used daily by managers, analysts, and executives. It should not look like a generic BI dashboard. The UI should feel closer to a modern product such as Linear, Notion, Stripe, or a polished admin console: clean, structured, interactive, and workflow-oriented.

The interface must support:

- fast navigation across multiple pages
- evidence-first analysis
- drilldown from summary to transcript
- strategy lifecycle tracking
- AI-assisted exploration
- light mode and dark mode
- responsive layouts for desktop and laptop screens

### Core design principles

1. Web-app first, dashboard second.
2. Insight cards should be the primary building block, not tables.
3. Every summary metric should support click-through exploration.
4. Every insight must be linked to evidence or representative calls.
5. The UI must feel like a product users operate, not a report they read once.
6. Keep the visual language professional, sharp, and modern.
7. Use a consistent design system across all pages.
8. Prefer modular reusable components over page-specific one-off layouts.

### Theme and appearance

The app must support:

- a visible light/dark mode toggle in the top bar
- theme persistence across refresh
- a system-default option if easy to support
- styling that works well in both modes

Light mode should feel clean and spacious. Dark mode should feel premium and calm, not harsh. Use subtle borders, controlled contrast, and clear text hierarchy. Avoid overly saturated colors.

### Layout system

Use a shell-based app layout with:

- left sidebar navigation
- top header bar
- main content area
- optional right-side contextual drawer for evidence or details
- page-level filters in a sticky toolbar when needed

The shell should remain consistent across all pages.

### Navigation model

Use multi-page routing with the following top-level pages:

- Executive Overview
- Daily Insights Pulse
- Monthly Recalibration
- Issue Explorer
- Call Drilldown
- Strategy Management
- Strategy Effectiveness
- Reports & Export
- Compliance Dashboard
- Customer Journey Explorer
- Ask CI
- Admin & AI Governance

The sidebar should show only the main areas, with nested items where needed.

### Global header behavior

The header should include:

- page title and short subtitle
- global search or Ask CI entry point
- date range selector when relevant
- light/dark mode toggle
- user/profile menu
- notifications / alerts indicator if useful

### Visual language

The UI should use:

- rounded cards
- soft shadows
- subtle gradients only when helpful
- strong typography hierarchy
- clean spacing
- minimal clutter
- elegant data visualization
- compact but readable KPI blocks

Avoid:

- dense BI tables as the main experience
- overly technical chart-heavy pages
- too many colors
- default browser-looking inputs
- static layouts that feel like a spreadsheet

### Interaction model

The UI should feel interactive and exploratory:

- clicking a card opens a drawer or detail page
- filters update content instantly
- cards can expand to reveal evidence
- trend summaries can drill into the underlying calls
- every important item should have a clear next action

Preferred interactions:

- hover previews
- expandable evidence panels
- side drawers for transcript and evidence
- tabs inside detail views
- breadcrumb navigation
- empty states with helpful guidance
- loading skeletons instead of blank screens

### Page requirements

#### 1) Executive Overview

This is the leadership landing page. It should provide a quick health snapshot without feeling like a BI dashboard.

Include:

- top KPI strip for call volume, resolved rate, escalations, repeat-call risk, sentiment trend
- trending issue cards
- recent alerts and notable changes
- “what changed since yesterday” section
- quick access to issue explorer and reports
- a small evidence preview area showing representative calls

Behavior:

- clicking a KPI should open a detailed breakdown
- clicking an issue should open Issue Explorer filtered to that issue
- clicking an alert should open the relevant call or evidence pack

#### 2) Daily Insights Pulse

This should look like a high-signal insights feed, not a chart wall.

Include:

- feed-style insight cards ordered by severity or impact
- each card should show:
  - issue name
  - trend direction
  - summary insight
  - evidence count
  - affected team / queue if available
  - confidence or significance indicator
- “no significant anomalies” empty state
- quick export action for daily summary

Behavior:

- cards expand into supporting evidence
- analyst can mark an insight as reviewed
- the page should support quick scanning like a newsroom or operations feed

#### 3) Monthly Recalibration

This page should feel like a strategy review workspace.

Include:

- ranking of recurring issues
- month-over-month movement
- strategy recommendations generated from evidence
- accept / reject controls
- status of accepted strategies
- before/after impact summaries

Behavior:

- recommendations should be editable or approvable
- accepted strategies should flow into Strategy Management
- use a timeline or review queue style layout

#### 4) Issue Explorer

This is the most important analytical screen.

It should not look like a standard chart page. It should feel like an issue investigation workspace.

Layout suggestion:

- left panel: issue list, search, filters, status
- center panel: issue summary, trend, call pattern cards
- right panel: top behaviors, evidence, representative call snippets

Include:

- issue frequency over time
- most common customer phrasing
- top agent behaviors associated with outcomes
- outcome summary
- evidence samples
- correlation or lift summary if available

Behavior:

- clicking a behavior opens related transcripts
- clicking a phrase opens matched call snippets
- clicking evidence opens a drawer with supporting calls

#### 5) Call Drilldown

This should feel like a transcript analysis workspace.

Include:

- transcript panel with speaker labels
- issue tags
- segment timeline
- sentiment over time view
- behavior markers
- outcome summary
- evidence metadata
- download transcript summary action

Behavior:

- clicking a segment jumps transcript focus to that section
- transcript highlights important phrases
- show missing transcript / insufficient data states clearly

#### 6) Strategy Management

This page should look like a workflow board, not a spreadsheet.

Include:

- lifecycle columns:
  Proposed
  Accepted
  In Progress
  Evaluating
  Closed
- strategy cards with:
  title
  linked issue
  owner
  status
  impact snapshot
  evidence count

Behavior:

- drag or move cards between states if easy
- open strategy detail drawer on click
- link each strategy to evidence and affected calls

#### 7) Strategy Effectiveness

This page should feel analytical but clean.

Include:

- before/after comparison
- AHT change
- FCR change
- escalation rate change
- sentiment change
- drift indicator over time
- supporting call samples

Behavior:

- allow selecting a strategy from a dropdown or side list
- show trend over time
- provide confidence or sample-size warnings when data is thin

#### 8) Reports & Export

This should feel like a controlled reporting workspace.

Include:

- report builder panel
- filters for time window, issue, queue/team
- report preview
- export options for PDF and CSV
- evidence pack generation flow

Behavior:

- report preview should update as filters change
- downloads should be obvious and not buried
- show warnings if data is insufficient

#### 9) Compliance Dashboard

This page should feel serious and operational.

Include:

- compliance rate summary
- missing disclosure rate
- trend over time
- list of non-compliant call categories
- sample transcript snippets with highlighted missing phrases

Behavior:

- clicking a non-compliant category shows representative calls
- include clear audit-style presentation

#### 10) Customer Journey Explorer

This page should feel like a timeline investigation tool.

Include:

- customer journey timeline
- linked calls for the same customer or issue
- issue changes over time
- sentiment progression
- escalation events
- resolution points

Behavior:

- each timeline event opens the relevant call
- support filtering by customer, issue, or date range

#### 11) Ask CI

This page should feel like an AI assistant built into the product.

Include:

- chat-like interface
- suggested questions
- answer cards with citations to evidence packs
- “open supporting calls” links
- “create strategy from this” action

Behavior:

- responses should be concise, evidence-backed, and actionable
- assistant must always connect answers to evidence or metrics

#### 12) Admin & AI Governance

This page should feel like a system control panel.

Include:

- model/version status
- pipeline health
- audit logs
- role-based access settings
- data retention / governance notes
- processing status / job runs

### Data states to design

Every page should support:

- loading
- empty
- insufficient data
- error
- partial data
- permission-limited view

These states should look intentional and polished, not like fallback errors.

### Component library to build

Use reusable components such as:

- AppShell
- SidebarNav
- TopBar
- ThemeToggle
- KPIStatCard
- InsightCard
- EvidenceDrawer
- FilterBar
- TrendSparkline
- TranscriptPanel
- TranscriptSegmentCard
- StrategyCard
- StatusBadge
- EmptyState
- LoadingSkeleton
- AlertBanner
- SidePanel
- TimelineView
- AskCIChat

### Charts and visualizations

Use charts only when they add clarity. Prefer:

- sparklines
- compact trend lines
- stacked comparisons
- sentiment timelines
- small multiples
- simple network graph only when needed for the triple engine

Charts should support the story, not dominate the screen.

### Responsiveness

The product should be optimized for desktop first, but must still behave well on smaller screens.

- Sidebar collapses on narrower widths
- Cards stack cleanly
- Drawers become full-screen on small screens
- Filters remain usable
- Tables should not break layout

### Accessibility and polish

Implement:

- strong contrast in both themes
- readable font sizes
- keyboard-friendly navigation
- clear focus states
- consistent button hierarchy
- tooltips only when needed
- icons that support comprehension, not decoration

### Styling targets

The app should feel:

- premium
- calm
- trustworthy
- modern
- operational
- product-like

It should not feel:

- academic
- generic dashboard
- spreadsheet-like
- prototype-only
- visually noisy

### Implementation order

1. Build the shell, routing, sidebar, top bar, and theme toggle.
2. Build the shared design system components.
3. Build Executive Overview and Daily Insights first.
4. Build Issue Explorer and Call Drilldown next.
5. Build Strategy Management and Strategy Effectiveness next.
6. Build Reports, Compliance, Customer Journey, Ask CI, and Admin last.
7. Reuse all shared components across pages.
8. Keep the UI modular so future Rank 2 and Rank 3 features can be added without redesigning the shell.

### Codex implementation instruction

When implementing the UI:

- first inspect the repo structure
- identify the frontend stack
- reuse the existing framework and styling conventions
- do not introduce a new frontend architecture unless necessary
- build the app as a multi-page product with a persistent shell
- make the first version polished even if the underlying data is mocked
- prioritize consistency, clarity, and professionalism
