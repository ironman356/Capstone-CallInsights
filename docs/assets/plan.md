# Call Insights (CI) — Codex Build Plan

## Purpose

Use this document as the build brief for Codex CLI. The goal is to generate realistic dummy call transcripts first, then implement the Rank 1 features in a clean, testable order.

## Product Context

CI is a closed-loop call intelligence platform for an SPS mortgage servicing call center. It analyzes historical call transcripts to identify recurring issues, agent behaviors, sentiment shifts, and outcomes. The platform is evidence-first, batch-driven, and fully internal.

## Non-Negotiable Constraints

- Dummy data must be **transcript text only**.
- No real customer names, account numbers, phone numbers, addresses, SSNs, dates of birth, or loan numbers.
- Use mortgage servicing language that sounds like a real SPS call center.
- The system must remain modular so later layers can be added without redesigning Rank 1.
- Build everything as if it will run locally first.

## Dummy Data Rules

Create one transcript per file.

Suggested folder:

- `data/raw/transcripts/`

File format:

- Plain text only, no JSON wrappers.
- Use speaker labels like `Agent:` and `Customer:`.
- Keep the transcript realistic, with natural back-and-forth, interruptions, clarification, and occasional frustration.
- Include issue types common to mortgage servicing, such as:
  - payment posting confusion
  - escrow shortage / escrow analysis
  - late fee dispute
  - autopay not applied
  - payoff quote request
  - hardship / forbearance questions
  - refinance status
  - loan statement confusion
  - insurance proof / hazard insurance questions
  - tax increase / escrow adjustment
  - payment plan request
  - call transfer / hold friction

### Transcript style requirements

Each transcript should feel like a real mortgage servicing call:

- polite but sometimes frustrated customers
- verification steps
- brief compliance language
- references to monthly payment, escrow, due dates, delinquency, payoff, and billing cycles
- agent attempts to explain next steps clearly
- some calls resolve successfully, others end unresolved or escalated
- varied sentiment over the course of the call

### Transcript examples of natural phrasing

Use phrases like:

- “my payment still shows pending”
- “I got a letter about escrow and I do not understand it”
- “I was told autopay would come out automatically”
- “can you explain why there is a late fee”
- “I need the payoff amount for closing”
- “I am trying to avoid another missed payment”
- “the tax bill changed and now my payment went up”
- “I already called last week about this”

## Suggested Dummy Dataset Size

Start with:

- 50 transcripts for development
- 100+ transcripts when testing trend detection

Recommended mix:

- 40% common servicing issues
- 30% escalations / unresolved calls
- 20% resolved calls
- 10% edge cases and noisy calls

## Folder Structure to Create

```text
callinsight/
  data/
    raw/
      transcripts/
    processed/
    outputs/
  scripts/
  src/
    ingestion/
    processing/
    analytics/
    api/
    ui/
  tests/
```

## Rank 1 Features to Implement First

These are the only features that should be built before Rank 2 or Rank 3 work.

1. Transcript Ingestion
2. Call Segmentation
3. Issue Classification
4. Behavior Extraction
5. Sentiment Analysis
6. Outcome Classification
7. Triple Engine Analysis
8. Core Web Interface

## Build Order

### Phase 1 — Generate dummy transcripts

Goal: create realistic transcript files for mortgage servicing calls.

Codex task:

- create a transcript generator script
- write 50–100 transcript files to `data/raw/transcripts/`
- ensure each file contains only transcript content

Suggested script name:

- `scripts/generate_dummy_transcripts.py`

Suggested CLI:

```powershell
python scripts/generate_dummy_transcripts.py --count 50 --out data/raw/transcripts
```

### Phase 2 — Ingestion

Goal: read raw transcript files and load them into a normalized internal format.

Codex task:

- build a file loader
- capture transcript text
- assign internal IDs
- create a simple processed representation

Suggested output:

- `data/processed/calls.parquet` or `data/processed/calls.jsonl`

### Phase 3 — Segmentation

Goal: split one call into logical issue segments.

Codex task:

- detect turns and break transcripts into segments based on issue shifts
- keep segment text and segment order

### Phase 4 — Issue Classification

Goal: classify each transcript or segment into mortgage servicing issue types.

Initial label set:

- payment confusion
- escrow issue
- late fee dispute
- autopay issue
- payoff request
- hardship / forbearance
- refinance status
- insurance / tax escrow issue
- statement confusion
- other

### Phase 5 — Behavior Extraction

Goal: detect agent behaviors from transcript text.

Behavior labels:

- explained timeline early
- used empathy
- repeated policy clearly
- offered next steps
- transferred / escalated
- asked verification questions
- created confusion
- placed on hold
- resolved calmly
- failed to address concern

### Phase 6 — Sentiment Analysis

Goal: score sentiment for the opening, middle, and closing parts of each call.

Output should include:

- opening sentiment
- mid-call sentiment
- closing sentiment
- sentiment shift

### Phase 7 — Outcome Classification

Goal: classify each call or segment.

Labels:

- resolved
- unresolved
- escalated
- follow-up needed
- callback requested

### Phase 8 — Triple Engine Analysis

Goal: compute the core insight table.

Inputs:

- problem
- behavior
- outcome

Outputs:

- counts
- correlations / lift (even if initially simple)
- ranked patterns
- evidence references back to transcripts

### Phase 9 — Core Web Interface

Goal: show the first usable UI for the Rank 1 system.

Start with:

- executive overview
- issue explorer
- transcript drilldown
- a simple summary panel

## Suggested CLI Workflow

### 1) Create folders

```powershell
mkdir data\raw\transcripts
mkdir data\processed
mkdir data\outputs
mkdir scripts
mkdir src
mkdir src\ingestion
mkdir src\processing
mkdir src\analytics
mkdir src\api
mkdir src\ui
mkdir tests
```

### 2) Create Python environment

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -U pip
```

### 3) Install basic packages

Use only what is needed for the first milestone.

```powershell
pip install pandas pyarrow fastapi uvicorn pydantic
```

Add NLP packages later only if needed.

### 4) Generate dummy transcripts

```powershell
python scripts\generate_dummy_transcripts.py --count 50 --out data\raw\transcripts
```

### 5) Run ingestion

```powershell
python -m src.ingestion.load_transcripts --input data\raw\transcripts --output data\processed\calls.parquet
```

### 6) Run segmentation

```powershell
python -m src.processing.segment_calls --input data\processed\calls.parquet --output data\processed\segments.parquet
```

### 7) Run classification and analytics

```powershell
python -m src.processing.classify_issues --input data\processed\segments.parquet --output data\processed\issues.parquet
python -m src.processing.extract_behaviors --input data\processed\segments.parquet --output data\processed\behaviors.parquet
python -m src.processing.score_sentiment --input data\processed\segments.parquet --output data\processed\sentiment.parquet
python -m src.processing.classify_outcomes --input data\processed\segments.parquet --output data\processed\outcomes.parquet
python -m src.analytics.triple_engine --input data\processed --output data\outputs\triple_engine_summary.json
```

### 8) Start the API

```powershell
uvicorn src.api.main:app --reload
```

### 9) Start the frontend

If React is used later:

```powershell
npm install
npm run dev
```

## Suggested Codex Prompt Sequence

Use these prompts one at a time.

### Prompt 1 — Dummy transcript generator

"Create a Python script that generates realistic mortgage servicing call transcripts for an SPS call center. Output one transcript per file in `data/raw/transcripts/`. Each file should contain only dialogue text using `Agent:` and `Customer:` speaker labels. Include common mortgage servicing issues like escrow, autopay, late fees, payoff quotes, payment posting, forbearance, and refinance status. Make the calls feel realistic, with a mix of resolved, unresolved, and escalated outcomes."

### Prompt 2 — Ingestion pipeline

"Build the transcript ingestion layer for CI. Read transcript files from `data/raw/transcripts/`, assign internal IDs, and save a structured dataset to `data/processed/`. Keep the code modular and easy to extend for later NLP steps."

### Prompt 3 — Segmentation and labels

"Implement call segmentation and initial issue labeling for mortgage servicing transcripts. The segmentation should split calls into issue-focused chunks. The label set should include payment confusion, escrow issue, late fee dispute, autopay issue, payoff request, hardship, refinance status, insurance/tax issue, statement confusion, and other."

### Prompt 4 — Behavior and sentiment

"Add agent behavior extraction and sentiment scoring over the opening, middle, and closing parts of each call. Detect behaviors like empathy, timeline explanation, escalation, hold, transfer, and clear next steps."

### Prompt 5 — Outcomes and triple engine

"Add outcome classification and a triple-engine summary that correlates issue, behavior, and outcome. Output ranked patterns with references back to call transcripts."

### Prompt 6 — First UI

"Build the first CI web app views for executive overview, issue explorer, and transcript drilldown. Make it feel like a modern product, not a boring dashboard. Use cards, interaction, and evidence-first presentation."

## Acceptance Criteria for Rank 1

The first milestone is complete when:

- dummy transcript files exist and look realistic
- ingestion can load them without manual cleanup
- issue labels are produced consistently
- behavior labels are produced consistently
- sentiment and outcome are stored per call or segment
- a triple-engine summary can be generated from the data
- the web app can display the basic insights and drill down to transcripts

## Notes for Codex

- Keep code small and testable.
- Prefer simple, explicit logic before adding machine learning.
- Build the pipeline so later real SPS transcripts can replace dummy files without changing the architecture.
- Use evidence references everywhere possible.

## What Success Looks Like

After this first build, the team should be able to:

- browse realistic fake transcripts
- see recurring mortgage servicing issues
- observe behavior/outcome patterns
- click into a transcript
- understand how later dashboards will work before real data arrives

## UI Direction — Make CI Feel Like a Product, Not a Dashboard

### Design goals

- Make the interface feel like a modern operational product.
- Prioritize workflow, exploration, and decision-making over static charts.
- Use cards, panels, drilldowns, and insight feeds instead of dense reporting tables.
- Keep the UI evidence-first: every insight should link to supporting calls or evidence packs.

### Visual style

- Clean, modern layout with strong typography and generous spacing.
- Dark-mode friendly by default.
- Rounded cards, subtle shadows, soft borders, and restrained gradients.
- Minimal gridlines and fewer “Excel-style” chart visuals.
- Use color intentionally:
  - red = risk / escalation
  - amber = warning / emerging issue
  - green = resolved / stable
  - blue = informational / neutral
- Favor readable summaries and clear hierarchy over decoration.

### Screen patterns

#### Executive Overview

- Top KPI strip
- Trending issue cards
- “What changed since yesterday?” panel
- Recent evidence snapshots
- Clickable callouts to issue explorer and drilldown

#### Daily Insights Pulse

- News-feed style insight stream
- Each item as a card with:
  - issue
  - trend
  - evidence count
  - impact summary
  - action buttons

#### Issue Explorer

- Most important screen
- Left side: issue list / filters
- Center: issue summary and trend
- Right side: top behaviors, outcomes, evidence
- Include drill-in cards for representative calls

#### Call Drilldown

- Transcript on one side
- Structured extraction on the other side
- Timeline view for sentiment and behaviors
- Highlight key phrases and issue segments

#### Strategy Management

- Kanban-style lifecycle board:
  Proposed → Accepted → In Progress → Evaluating → Closed
- Strategy cards with impact metrics and linked evidence

#### Ask CI

- Chat-like assistant panel
- Answers should cite evidence packs and call IDs
- Response cards should summarize findings in plain language

### Interaction patterns

- Use expandable cards instead of forcing new pages.
- Use tabs for switching views inside the same topic.
- Keep filters sticky and easy to change.
- Every major insight should have actions like:
  - View evidence
  - Open transcript
  - Create strategy
  - Compare before/after

### Implementation note

When coding the UI, make it feel like a real web app:

- use reusable components
- use consistent spacing and typography
- avoid cluttered tables unless they are clearly the best fit
- make summary cards the default entry point
  .
