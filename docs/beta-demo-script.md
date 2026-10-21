# Call Insights Beta Demo Script (20 Minutes)

## Before staff arrive

- Screen 1 (Prachi): running web app at `http://127.0.0.1:4173` and API at `http://127.0.0.1:8000/docs`.
- Screen 2 (Alex): Story Dashboard open; VS Code tabs open for `ResultsPage.tsx`, `ApproachMatrixPage.tsx`, and `ApproachPortfolioPage.tsx`.
- Screen 3 (shared or another team member): GitLab Issues/board, branch graph, merge requests, and the test command/result.
- Preload one representative issue, one transcript, one strategy, and Swagger UI. Do not rerun the pipeline live unless it has been tested immediately beforehand.
- Do not claim a deployed server, authentication, a database, or production SPS integration unless it is running and can be shown.

## 0:00–1:30 — Prachi: purpose and Beta status

**Say:**

“Good [morning/afternoon]. We are Call Insights. It helps mortgage-servicing managers turn a large transcript corpus into evidence they can act on. Instead of reviewing calls one by one, a manager can identify a recurring issue, inspect the supporting call, see the extracted behavior and outcome, and create an action plan.”

“Our Beta is a working local web product. A new user can open the workspace, explore the populated demo corpus, drill into transcript evidence, use the Story Dashboard, create or update an action plan, and inspect the API documentation without developer assistance.”

**Show:** title slide, then Project Description and Beta State slides.

## 1:30–3:00 — Prachi: Alpha to Beta

**Say:**

“At the end of Alpha, our major deliverable was the Hybrid LLM + ML Model Approaches tab. It compares modeling approaches on the same benchmark.”

“In Beta, we made the results usable. We added the three Story Dashboard views: issue-to-approach-to-statistics, the approach/issue matrix, and the approach map. We also connected evidence links, action-plan workflow, alerts, evidence packs, and API documentation.”

“The important shift is from ‘which model performed best?’ to ‘what should an operations manager investigate, and which calls support that conclusion?’”

**Show:** Alpha → Beta and Beta Storytelling Tabs slides.

## 3:00–5:00 — Prachi: architecture and technical layout

**Say:**

“This is the current local architecture. Raw transcripts are read by the Python analysis pipeline. The pipeline redacts direct identifiers, extracts turns, segments calls, classifies issue, behavior, sentiment, and outcome, and writes processed JSON/JSONL artifacts.”

“FastAPI reads those artifacts and exposes validated endpoints. The React application calls those endpoints and presents the Overview, Issue Explorer, Call Drilldown, Story Dashboard, strategies, reports, and governance views.”

“For the SPS environment, the same evidence-first flow is intended to sit behind SPS servicing systems, a secure server/API layer, LLM services, and an audit trail. That production integration is future validation work; it is not what we are claiming to run locally today.”

**Show:** Architecture and Technology/Code Layout slides. Point to `apps/web/src/api.ts`, `apps/api/app/api/rank1.py`, and `apps/api/app/services/rank1/pipeline.py`.

## 5:00–8:00 — Prachi: end-to-end product workflow

**Say while navigating:**

“We start in the Overview. This is the operating picture: current issue volume, outcomes, and leading patterns.”

“I will select an issue. The Issue Explorer narrows to supporting evidence, associated behaviors, outcomes, and representative calls.”

“Now I will open one call. The drilldown shows the transcript alongside the derived issue, segments, behaviors, sentiment, and outcome. This is the evidence trail that keeps the dashboard from being a black box.”

“From evidence, we can create or update an action plan. The strategy state persists locally, so the workflow survives a refresh.”

**Show:** Overview → Issue Explorer → Call Drilldown → Action Plans. If a strategy action is risky, show an existing strategy instead of editing live.

## 8:00–10:00 — Prachi: code and API proof

**Say:**

“My main contribution is the analysis and integration layer. In `pipeline.py`, the ingestion and enrichment flow turns transcript text into the structured signals we just saw. In `rank1.py`, each HTTP route is thin: it validates a request, calls the service, and returns a structured response.”

“The API is published locally through FastAPI. This Swagger page documents and allows us to exercise the same endpoints used by the web app.”

**Show:**

1. `apps/api/app/services/rank1/pipeline.py`: `ingest_calls`, `enrich_calls`, or `build_triple_engine`.
2. `apps/api/app/api/rank1.py`: `/workspace`, `/alerts`, `/evidence-packs`, or `/knowledge-graph`.
3. `http://127.0.0.1:8000/docs`.

## 10:00–13:00 — Alex: Story Dashboard

**Say:**

“I’m Alex. I built the Story Dashboard frontend so a manager can understand modeling results as an evidence-backed narrative.”

“Story Dashboard 1 starts with an issue, connects it to approaches, and shows the measured statistics. The evidence links below the statistics take the user back to the supporting transcript context.”

“Story Dashboard 2 is the approach/issue matrix. It makes the distribution of approaches across the issue set visible.”

“Story Dashboard 3 is the approach map. It gives the user a navigable view of the relationships instead of requiring them to read a raw model table.”

“These screens receive their data through the shared application state and API layer, so they remain connected to the same transcript evidence used in the rest of the product.”

**Show:**

1. Story Dashboard 1, then click an evidence link.
2. Story Dashboard 2 and Story Dashboard 3.
3. `apps/web/src/pages/ResultsPage.tsx`, `ApproachMatrixPage.tsx`, `ApproachPortfolioPage.tsx`.

## 13:00–14:30 — Anshul: placeholder handoff

**Replace before presenting.**

**Say:**

“I’m Anshul. I implemented **[exact feature]**. It solves **[specific user or system problem]**. It connects to **[frontend/API/pipeline component]** through **[endpoint/data artifact/function]**. I will show **[exact file and function]**.”

**Show:** `[exact page/file]`, then `[exact function/test]`.

## 14:30–16:00 — Abdul: placeholder handoff

**Confirm with Abdul before presenting.**

**Say:**

“I’m Abdul. I implemented the action-plan workflow improvements: **[confirm exact work]**. This lets a manager **[specific task]** and persists the result through **[API/storage path]**. I will show **[exact file and function]**.”

**Show:** action-plan interaction, then `[exact component path]` and `[test or API route]`.

## 16:00–17:30 — Rank 2 and Rank 3 status

**Say:**

“For Rank 2, the Beta includes issue and transcript exploration, strategy workflow, evidence packs, alert monitoring, voice-transcript intake, and strategy measurement endpoints.”

“For Rank 3, we have working local services for an evidence knowledge graph with persisted annotations, risk scoring, strategy recommendation logic, call simulation, and transparency output. The next validation step is evaluating modeling techniques in Anthony’s environment and connecting the validated results to the Story Dashboard.”

“We do not describe an SPS production deployment as complete. Our current deliverable is the local, working Beta and the infrastructure needed to validate it in that environment.”

**Show:** Rank 3 Readiness slide and, only if tested, `/knowledge-graph`, `/simulate-call`, and a transparency endpoint in Swagger.

## 17:30–19:00 — Software practices and repository proof

**Say:**

“We used feature branches and merge requests to isolate work, and GitLab Issues to track tasks, ownership, labels, estimates, and time spent. We use Python unit/API tests, and FastAPI publishes the endpoint contract through Swagger.”

“Here is the branch graph, the active/recent issue board, and the test suite. The presentation deck also contains current-main LOC and all-repository commit totals. The AI-assisted split is marked as temporary until every contributor confirms their declaration.”

**Show:** GitLab board, branch graph, a recent merge request, `python -m unittest tests.test_rank1_api tests.test_rank3_services`, and Swagger.

**Must verify before presenting:** CI pipeline status, release tag/version, Issue labels, estimates/spend, and whether the web app is deployed. Do not claim any missing item.

## 19:00–20:00 — close

**Say exactly:**

“To summarize: Alpha gave us comparable modeling approaches. Beta turns those results into a working evidence-to-action product with transcript drilldown, Story Dashboard navigation, operational workflows, published API documentation, and a foundation for Rank 3 validation. We are done. What questions do you have?”

## Rubric checklist

- [x] Brief project description, users, value, and local Beta state.
- [x] Architecture/data flow and code layout.
- [x] Alpha-to-Beta comparison.
- [x] One contribution slot per member; Anshul/Abdul require final facts.
- [x] LOC/commit slide, with temporary AI split clearly labeled.
- [x] Live product, code, GitLab, tests, and Swagger screen plan.
- [ ] Verify deployment/release tag, CI pipeline, GitLab estimates/spend, and authentication claims before presenting.
- [x] Explicit conclusion and request for questions.
