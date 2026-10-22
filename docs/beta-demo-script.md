# Call Insights Beta Demo Script (20 Minutes)

## Before staff arrive

- Prachi shares `https://localhost:4174/solutions`; preload **Behavior map**, **Script route explorer**, and VS Code with `SolutionStoryPage.tsx` and `TranscriptStoryGraph.tsx`.
- Alex shares the Alpha Model Approaches / Story Dashboard and VS Code with `ResultsPage.tsx`, `ApproachMatrixPage.tsx`, and `ApproachPortfolioPage.tsx`.
- Anshul shares only their implemented feature and the exact source file/test they own. Do not use another person’s screen for this handoff.
- Abdul shares only their implemented workflow and the exact component/API/storage code they own. Do not use another person’s screen for this handoff.
- Keep a fifth shared screen ready for GitLab Issues, the branch graph, merge requests, build/test result, Swagger, and version/tag evidence.
- Preload the **Behavior map**, **Script route explorer**, one supporting transcript, and Swagger UI. Do not rerun the pipeline live unless it has been tested immediately beforehand.
- Do not claim a deployed server, authentication, a database, or production SPS integration unless it is running and can be shown.

## 0:00–2:00 - Prachi: top-down purpose and Beta status

**Speaker notes:**

“Good [morning/afternoon]. We are Call Insights. It helps mortgage-servicing managers understand which agent behaviors are associated with calls resolving quickly, then inspect the exact evidence behind that result.”

“Our Beta is a working local web product. A manager can start with an issue, see what appears to work or not work, inspect the exact words and supporting calls, follow branching conversation routes, and turn the evidence into a testable action.”

**Show:** title slide, then Project Description and Beta State slides.

## 2:00–3:30 - Prachi: Alpha to Beta

**Speaker notes:**

“At the end of Alpha, our major deliverable was the Hybrid LLM + ML Model Approaches tab. It compares modeling approaches on the same benchmark.”

“Those Alpha models identified agent behaviors associated with higher resolution rates. But a manager still needed to ask: which exact words should I look at, what happened next, and which calls support the result?”

“In Beta, we built the Story → Solution workflow. It turns an issue into specific behaviors, observed outcomes, exact transcript lines, supporting calls, branching conversation routes, and a concrete hypothesis to test.”

**Show:** Alpha → Beta and Beta Storytelling Tabs slides.

## 3:30–4:30 - Prachi: architecture and technical layout

**Speaker notes:**

“This is the current local architecture. The existing transcript and model services supply evidence through FastAPI; React turns that evidence into an investigation workflow rather than exposing raw model output.”

“The important Beta path is: issue cluster → candidate response → observed outcome comparison → exact call evidence → conversation route → testable action. The frontend consumes validated API responses; it does not read model files directly.”

“For the SPS environment, the same evidence-first flow is intended to sit behind SPS servicing systems, a secure server/API layer, LLM services, and an audit trail. That production integration is future validation work; it is not what we are claiming to run locally today.”

**Show:** Architecture and Technology/Code Layout slides. Point to `apps/web/src/pages/SolutionStoryPage.tsx`, `apps/web/src/pages/TranscriptStoryGraph.tsx`, `apps/api/app/services/rank1/solutions.py`, and `apps/api/app/services/rank1/conversation_paths.py`.

## 4:30–7:30 - Prachi screen share: Story → Solution workflow

**Speaker notes while navigating:**

“We start with an issue cluster. The Behavior map shows all matching response paths, not a summary table. Edge thickness represents observed call count.”

“I click one response. The product narrows to its observed resolution comparison, exact supporting lines, and the calls that contain it. Green means higher observed resolution, red means lower, and amber means the comparison is limited or uncertain.”

“Now I open one supporting call. A manager can read the actual conversation, not just accept a model score.”

“Next is the Script route explorer. One click reveals the next observed reply and comparable reply routes. Clicking a newly revealed route expands its own branch, so the manager can follow the conversation as a decision tree rather than a flat transcript.”

“The Conversation Guide then compares exact responses, customer reactions, alternatives in similar contexts, and recorded outcomes. The result becomes a coaching or experiment hypothesis; it is not presented as causal proof.”

**Show:** Story → Solution → Behavior map → select a response → supporting transcript → Script route explorer → expand two routes → Conversation Guide → existing experiment/action-plan state.

## 7:30–9:00 - Prachi screen share: code and model proof

**Speaker notes:**

“My Beta contribution is the story and drilldown experience that turns model output into an investigation workflow.”

“`SolutionStoryPage.tsx` owns issue filters, the behavior map, selected evidence, exact-line comparison, and the handoff from a model signal to a transcript.”

“`TranscriptStoryGraph.tsx` implements both the conversation drilldown and the Script route explorer. The route explorer reveals the next observed turn and up to three comparable routes every time a card is clicked.”

“On the backend, `solutions.py` evaluates behavior, verb, sequence and timing, word and character TF-IDF, Naive Bayes, random forest, and semantic retrieval when available. `conversation_paths.py` prepares the exact-line and route evidence used by the UI.”

**Show:**

1. `apps/web/src/pages/SolutionStoryPage.tsx`: behavior map and selected evidence.
2. `apps/web/src/pages/TranscriptStoryGraph.tsx`: `RouteExplorer` and `nextRoutes`.
3. `apps/api/app/services/rank1/solutions.py` and `conversation_paths.py`.
4. `http://127.0.0.1:8000/docs`: local API contract.

## 9:00–11:30 - Alex screen share: Story Dashboard

**Speaker notes:**

“I’m Alex. I built the Story Dashboard frontend so a manager can understand and compare the Alpha modeling results as an evidence-backed narrative.”

“Story Dashboard 1 starts with an issue, connects it to approaches, and shows the measured statistics. The evidence links below the statistics take the user back to the supporting transcript context.”

“Story Dashboard 2 is the approach/issue matrix. It makes the distribution of approaches across the issue set visible.”

“Story Dashboard 3 is the approach map. It gives the user a navigable view of the relationships instead of requiring them to read a raw model table.”

“I also added comparison views, phrase and transcript context, evidence filtering, navigation, and clearer issue-level statistics. Together with the new Story → Solution tab, these screens take the product from model comparison, to a clear evidence story, to a transcript-level investigation.”

**Show:**

1. Story Dashboard 1, then click an evidence link.
2. Story Dashboard 2 and Story Dashboard 3.
3. `apps/web/src/pages/ResultsPage.tsx`, `ApproachMatrixPage.tsx`, `ApproachPortfolioPage.tsx`, and `approachComparison.ts`.

## 11:30–13:30 - Anshul screen share: hybrid ML + LLM modeling

**Speaker notes:**

“I’m Anshul. I expanded the hybrid topic-classification pipeline with five supervised-ML and LLM approaches. These include logistic-regression and SVM candidate retrieval with LLM reranking, ensemble LLM arbitration, normalization-based classification, and embedding + ML + LLM consensus.”

“I also added deterministic unit tests, CLI support to train and evaluate the strategies, cached prediction outputs, and end-to-end held-out benchmark reporting. The strongest evaluated strategy was SVM top-k plus LLM reranking: 95.17% macro-F1 and 93.48% accuracy across the 28-call test set.”

“These approaches feed the shared comparison data. Alex’s model views compare them, and Prachi’s Story → Solution workflow makes their transcript evidence inspectable.”

**Show on Anshul’s screen:**

1. `evaluation/hybrid_topics.py`: the SVM top-k + LLM reranking strategy and one other hybrid strategy.
2. `evaluation/run_hybrid_topics.py`: the CLI strategy choices and runner wiring.
3. `tests/test_hybrid_topics.py`: a deterministic test for candidate reranking or consensus behavior.
4. `apps/web/src/modelApproachData.ts`: the 95.17% macro-F1 / 93.48% accuracy comparison row.

**Close with:** “This code produces reproducible predictions and benchmark rows for the same shared product-not an isolated experiment.”

## 13:30–15:30 - Abdul screen share: workflow foundation and model-approaches UI

**Speaker notes:**

“I’m Abdul. I established the React/FastAPI monorepo foundation and built workflow improvements including action-plan drag-and-drop status changes, persisted deadlines, edit dialogs, and evidence-link updates.”

“I also added Model Approaches charts, metric-help tooltips, navigation, comparison screens, and evidence-view links. These features connect a manager’s workflow actions and model comparisons to the shared application state and API.”

**Show on Abdul’s screen:**

1. `ModelApproachesPage.tsx` and `ApproachComparisonPage.tsx`: charts, metrics, and navigation.
2. `ApproachViewLinks.tsx` and `approachComparison.ts`: evidence-view linking and comparison data.
3. `App.tsx`: action-plan drag-and-drop, deadlines, editing, or evidence-link interaction that has been tested immediately before the presentation.
4. `apps/api/app/api/rank1.py`: the shared API boundary used by the workflow.

**Close with:** “My frontend workflows keep model comparisons and manager actions connected to the same application state and evidence routes.”

## 15:30–17:00 - Prachi screen share: integration and final-release readiness

**Speaker notes:**

“For Beta, our priority was making the validated modeling output usable. The product now includes issue and transcript exploration, Story → Solution drilldowns, strategy workflow, evidence packs, alerts, voice-transcript intake, and strategy measurement endpoints.”

“The next validation gate is evaluating the approaches in Anthony’s environment and deciding which techniques are accurate enough to carry into the existing SPS story dashboard. Our local story and drilldown workflow is ready to show that validated evidence.”

“We do not describe an SPS production deployment as complete. Our current deliverable is the local, working Beta and the infrastructure needed to validate it in that environment.”

**Show:** Validation Readiness slide and, only if tested, `/knowledge-graph`, `/simulate-call`, and a transparency endpoint in Swagger.

## 17:00–19:00 - Shared engineering screen: practices and repository proof

**Speaker notes:**

“We used feature branches and merge requests to isolate work, and GitLab Issues to track tasks, ownership, labels, estimates, and time spent. We use Python unit/API tests, and FastAPI publishes the endpoint contract through Swagger.”

“Here is the branch graph, the active/recent issue board, and the test suite. The deck’s LOC is a current-main Git-blame count after fetching every GitLab branch; commit totals combine all fetched GitLab refs and each contributor’s known author identities. The handwritten and AI-assisted columns use our team-reported 60% / 40% estimate for each member’s current-main LOC. Git cannot infer AI use.”

**Show:** GitLab board, branch graph, a recent merge request, `python -m unittest tests.test_rank1_api tests.test_rank3_services`, and Swagger.

**Must verify before presenting:** the current CI pipeline is green, GitLab Issues show labels and estimates/spend, and the local demo path is running. The published release tag is `v0.2.0-beta.2`; show the successful Pages artifact, not a live Pages URL, because the course GitLab instance does not host Pages.

## 19:00–20:00 - close

**Closing words:**

“To summarize: Alpha identified agent behaviors associated with faster call resolution. Beta makes that result usable: a manager can see what appears to work, what does not, the exact words and calls behind it, and the conversation routes that follow. We are done. What questions do you have?”

## Rubric checklist

- [x] Brief project description, users, value, and local Beta state.
- [x] Architecture/data flow and code layout.
- [x] Alpha models are framed as association discovery; Beta is the Story → Solution investigation workflow.
- [x] Every member has a timed screen-share handoff: live feature, own code, integration explanation, and next speaker.
- [x] Anshul’s hybrid-model feature, code, benchmark, and own-screen handoff are verified.
- [x] Abdul’s merged workflow-foundation and Model Approaches UI contribution has a verified own-screen handoff and code paths.
- [x] LOC/commit slide uses current main blame attribution and all fetched GitLab branches; AI declarations are explicitly separated from Git-derived data.
- [x] Prachi code proof centers `SolutionStoryPage.tsx`, `TranscriptStoryGraph.tsx`, `solutions.py`, and `conversation_paths.py`.
- [x] Shared engineering screen covers GitLab board, branch graph, versioning, build/test, and published API documentation.
- [ ] Confirm the current CI pipeline, GitLab Issue labels and estimates/spend, and local demo startup immediately before presenting. The release tag, published release, and Pages artifact are complete; do not claim a live GitLab Pages site.
- [x] Explicit conclusion and request for questions.
