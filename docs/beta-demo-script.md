# Call Insights Beta Demo Script (20 Minutes)

## Before staff arrive

- Screen 1 (Prachi): `https://localhost:4174/solutions`, with **Story → Solution** open and one issue cluster selected; API docs at `http://127.0.0.1:8000/docs`.
- Screen 2 (Alex): Story Dashboard open; VS Code tabs open for `ResultsPage.tsx`, `ApproachMatrixPage.tsx`, and `ApproachPortfolioPage.tsx`.
- Screen 3 (shared or another team member): GitLab Issues/board, branch graph, merge requests, and the test command/result.
- Preload the **Behavior map**, **Script route explorer**, one supporting transcript, and Swagger UI. Do not rerun the pipeline live unless it has been tested immediately beforehand.
- Do not claim a deployed server, authentication, a database, or production SPS integration unless it is running and can be shown.

## 0:00–1:30 — Prachi: purpose and Beta status

**Say:**

“Good [morning/afternoon]. We are Call Insights. It helps mortgage-servicing managers understand which agent behaviors are associated with calls resolving quickly, then inspect the exact evidence behind that result.”

“Our Beta is a working local web product. A manager can start with an issue, see what appears to work or not work, inspect the exact words and supporting calls, follow branching conversation routes, and turn the evidence into a testable action.”

**Show:** title slide, then Project Description and Beta State slides.

## 1:30–3:00 — Prachi: Alpha to Beta

**Say:**

“At the end of Alpha, our major deliverable was the Hybrid LLM + ML Model Approaches tab. It compares modeling approaches on the same benchmark.”

“Those Alpha models identified agent behaviors associated with higher resolution rates. But a manager still needed to ask: which exact words should I look at, what happened next, and which calls support the result?”

“In Beta, we built the Story → Solution workflow. It turns an issue into specific behaviors, observed outcomes, exact transcript lines, supporting calls, branching conversation routes, and a concrete hypothesis to test.”

**Show:** Alpha → Beta and Beta Storytelling Tabs slides.

## 3:00–5:00 — Prachi: architecture and technical layout

**Say:**

“This is the current local architecture. The existing transcript and model services supply evidence through FastAPI; React turns that evidence into an investigation workflow rather than exposing raw model output.”

“The important Beta path is: issue cluster → candidate response → observed outcome comparison → exact call evidence → conversation route → testable action. The frontend consumes validated API responses; it does not read model files directly.”

“For the SPS environment, the same evidence-first flow is intended to sit behind SPS servicing systems, a secure server/API layer, LLM services, and an audit trail. That production integration is future validation work; it is not what we are claiming to run locally today.”

**Show:** Architecture and Technology/Code Layout slides. Point to `apps/web/src/pages/SolutionStoryPage.tsx`, `apps/web/src/pages/TranscriptStoryGraph.tsx`, `apps/api/app/services/rank1/solutions.py`, and `apps/api/app/services/rank1/conversation_paths.py`.

## 5:00–8:00 — Prachi: Story → Solution workflow

**Say while navigating:**

“We start with an issue cluster. The Behavior map shows all matching response paths, not a summary table. Edge thickness represents observed call count.”

“I click one response. The product narrows to its observed resolution comparison, exact supporting lines, and the calls that contain it. Green means higher observed resolution, red means lower, and amber means the comparison is limited or uncertain.”

“Now I open one supporting call. A manager can read the actual conversation, not just accept a model score.”

“Next is the Script route explorer. One click reveals the next observed reply and comparable reply routes. Clicking a newly revealed route expands its own branch, so the manager can follow the conversation as a decision tree rather than a flat transcript.”

“The Conversation Guide then compares exact responses, customer reactions, alternatives in similar contexts, and recorded outcomes. The result becomes a coaching or experiment hypothesis; it is not presented as causal proof.”

**Show:** Story → Solution → Behavior map → select a response → supporting transcript → Script route explorer → expand two routes → Conversation Guide → existing experiment/action-plan state.

## 8:00–10:00 — Prachi: code and model proof

**Say:**

“My Beta contribution is the story and drilldown experience that turns model output into an investigation workflow.”

“`SolutionStoryPage.tsx` owns issue filters, the behavior map, selected evidence, exact-line comparison, and the handoff from a model signal to a transcript.”

“`TranscriptStoryGraph.tsx` implements both the conversation drilldown and the Script route explorer. The route explorer reveals the next observed turn and up to three comparable routes every time a card is clicked.”

“On the backend, `solutions.py` evaluates behavior, verb, sequence and timing, word and character TF-IDF, Naive Bayes, random forest, and semantic retrieval when available. `conversation_paths.py` prepares the exact-line and route evidence used by the UI.”

**Show:**

1. `apps/web/src/pages/SolutionStoryPage.tsx`: behavior map and selected evidence.
2. `apps/web/src/pages/TranscriptStoryGraph.tsx`: `RouteExplorer` and `nextRoutes`.
3. `apps/api/app/services/rank1/solutions.py` and `conversation_paths.py`.
4. `http://127.0.0.1:8000/docs`: local API contract.

## 10:00–13:00 — Alex: Story Dashboard

**Say:**

“I’m Alex. I built the Story Dashboard frontend so a manager can understand and compare the Alpha modeling results as an evidence-backed narrative.”

“Story Dashboard 1 starts with an issue, connects it to approaches, and shows the measured statistics. The evidence links below the statistics take the user back to the supporting transcript context.”

“Story Dashboard 2 is the approach/issue matrix. It makes the distribution of approaches across the issue set visible.”

“Story Dashboard 3 is the approach map. It gives the user a navigable view of the relationships instead of requiring them to read a raw model table.”

“Together with the new Story → Solution tab, these screens take the product from model comparison, to a clear evidence story, to a transcript-level investigation.”

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

“For Beta, our priority was making the validated modeling output usable. The product now includes issue and transcript exploration, Story → Solution drilldowns, strategy workflow, evidence packs, alerts, voice-transcript intake, and strategy measurement endpoints.”

“The next validation gate is evaluating the approaches in Anthony’s environment and deciding which techniques are accurate enough to carry into the existing SPS story dashboard. Our local story and drilldown workflow is ready to show that validated evidence.”

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

“To summarize: Alpha identified agent behaviors associated with faster call resolution. Beta makes that result usable: a manager can see what appears to work, what does not, the exact words and calls behind it, and the conversation routes that follow. We are done. What questions do you have?”

## Rubric checklist

- [x] Brief project description, users, value, and local Beta state.
- [x] Architecture/data flow and code layout.
- [x] Alpha models are framed as association discovery; Beta is the Story → Solution investigation workflow.
- [x] One contribution slot per member; Anshul/Abdul require final facts.
- [x] LOC/commit slide, with temporary AI split clearly labeled.
- [x] Prachi code proof centers `SolutionStoryPage.tsx`, `TranscriptStoryGraph.tsx`, `solutions.py`, and `conversation_paths.py`.
- [ ] Verify deployment/release tag, CI pipeline, GitLab estimates/spend, and authentication claims before presenting.
- [x] Explicit conclusion and request for questions.
