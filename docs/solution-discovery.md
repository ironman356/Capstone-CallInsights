# Story → Solution

Open `/solutions` in the running React app. The API is `/api/rank1/solutions`.
The default **Call conversation** graph starts collapsed: stage → exact turn →
observed customer reply, source-linked outcome counts, and expandable alternatives.
**Conversation guide** is a second drilldown graph and full-text script from a
complete observed resolved call, ranked by conservative exact-line support. It is
a candidate, not a validated optimal policy. Historical customer replies are not
promised replies, and account-specific statements must be verified before reuse.
Stages currently use the synthetic corpus's agent-turn order, not learned intent.
Select an existing issue cluster, then choose behaviors, semantic behaviors,
verbs, phrases, sequences, or early actions. Click a graph response or list row
to inspect exact agent turns, outcomes, counterexamples, and comparison calls.
Graph paths overlap: one call can contribute to multiple paths.

## Implemented analysis

- Agent-only extraction from the first 70% of turns, stopped at detected outcome
  language. Existing outcome-derived labels (such as `resolved calmly`) are not
  predictive features. The old workspace contrast ranking is retired.
- Explicit behavior rules and action-verb lexicon, with source turn numbers.
- Two- and three-word TF-IDF phrase discovery (maximum 120 corpus phrases).
- Ordered behavior pairs across distinct turns, plus first-third timing flags.
- Cached frozen MiniLM sentence embeddings, nearest behavior-description matching
  at cosine similarity 0.55, and semantic prediction comparisons. This is an
  established model already cached locally, not a newly trained 2026 model.
  Semantic matching is heuristic and needs quote review. No model download or
  external transcript transmission occurs.
- Within-cluster rate differences, Beta(1,1) posterior intervals (4,000 seeded
  draws), Fisher exact tests and Benjamini–Hochberg correction per cluster.
  At least three calls per comparison arm and q <= .05 plus an interval excluding
  zero are required for a directional label; other results remain uncertain.
- Ten fixed predictive comparisons with five-fold StratifiedGroupKFold. Groups
  are normalized first customer turns, so identical opening templates never cross
  training/validation boundaries. TF-IDF vocabularies fit only on training folds.
  Full-corpus discovered phrase indicators are excluded from prediction features.

## Measured on October 8, 2026

100 existing synthetic calls, 15 issue clusters, 15 opening-template groups.
Lower Brier score means better probability prediction.

| Method | Out-of-fold Brier |
| --- | ---: |
| Prior-only baseline | 0.1883 |
| Semantic behavior retrieval + logistic regression | 0.1897 |
| Frozen MiniLM + logistic regression | 0.1919 |
| Character TF-IDF + logistic regression | 0.2016 |
| Behavior logistic regression | 0.2029 |
| Word TF-IDF + logistic regression | 0.2058 |
| Verbs logistic regression | 0.2102 |
| Behavior + sequence random forest (includes semantic indicators) | 0.2234 |
| Word TF-IDF + Complement NB | 0.2342 |
| Sequence + timing logistic regression | 0.2454 |

No method beat the prior-only baseline on this metric. No response should be
recommended as a proven solution on these results. Model scores measure prediction,
not behavior-extraction accuracy or treatment effects. This comparison itself is
discovery: there is no independent final test set. Synthetic script repetition,
shared language across different opening groups, and machine-inferred outcomes
limit the result. Repeated calls also violate the independent-call assumption of
the posterior intervals and tests; these are exploratory screens only.

## Recent research considered

- [Listening to the Echo (2026)](https://arxiv.org/abs/2603.15434): inspired the
  next-customer-reaction inspection and contrastive response retrieval. Implemented
  same-issue/stage alternatives matched on pre-response prefix cosine (>= .65),
  using cached MiniLM or a labeled lexical fallback. Reaction tags are explicit
  lexical rules. The paper's trained reinforcement-learning method is **not** run.
- [Doubly robust estimation](https://www.pywhy.org/EconML/spec/estimation/dr.html):
  implemented three-fold opening-group cross-fitted AIPW diagnostics at the sixth
  agent turn, with opening-text propensity/outcome models and overlap gates.
  These lack adequate confounders, uncertainty intervals and randomized treatment;
  outcome-cue eligibility also selects the sample. They are exploratory adjusted
  associations, never a causal ranking. No EconML dependency was added.

- [Causal Effect Estimation with Latent Textual Treatments (2026)](https://arxiv.org/abs/2602.15730): sparse-autoencoder steering and residualized effect estimation
  concern controlled text interventions. Reviewed, not implemented: this corpus
  has neither randomized interventions nor a suitable steering model.
- [Causal Inference on Outcomes Learned from Text (2025)](https://arxiv.org/abs/2503.00725): motivates separate discovery/validation and human labeling.
- [Isolated Causal Effects of Natural Language, ICML 2025](https://proceedings.mlr.press/v267/lin25k.html): language features co-occur; associations are not isolated effects.
- [Grouped cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html): implemented grouped validation with fold-local text fitting.
- [Sentence Transformers similarity](https://sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html): implemented local semantic retrieval and frozen-encoder comparisons.

DML, causal forests, and LLM causal explanations are not advertised as measured.
The next valid step is randomized coaching with independent resolution and repeat
contact outcomes, or a larger observational corpus recording adequate pre-treatment
controls (difficulty, queue, prior contact, agent experience) and overlap.

## Reproduce

From the repository root:

```powershell
python scripts/run_solution_discovery.py --output tmp/solution-discovery.json
$env:SOLUTION_ENABLE_SEMANTIC='0'
python -m unittest tests.test_solution_discovery tests.test_rank1_service tests.test_rank1_api
```

The script reads existing processed calls and cluster membership; it does not
regenerate data or rerun clustering. Set `SOLUTION_ENABLE_SEMANTIC=0` for a fast
eight-method run. With the cached model available the default includes all ten.
Missing semantic dependencies or cached weights are reported as unavailable.
The API caches reports by complete input content, so changed calls invalidate it.

Runtime uses the existing NumPy/scikit-learn/SciPy installation. API requirements
now declare them explicitly. Sentence Transformers remains optional, as in the
existing adaptive engine.

## Controlled intervention setup

The page can prepare frozen script A versus script A plus one teach-back question.
The local `/api/rank1/script-experiments` registry stores prospective 50/50 random
assignments, stable pseudonymous customer-issue units, exact scripts, timestamps,
delivery confirmation and append-only independent outcome references. Results
retain assigned arms even when delivery fails; missing outcomes are not failures.
Seven days must elapse before recording resolution and repeat-contact outcomes.
It does not contact customers, connect to a dialer, or manufacture observations.
The registry is designed for a single local API worker, not concurrent production workers.

Add independently checked resolved/not-resolved labels, seven-day same-issue
repeat contacts, delivery flags and a QA/CRM reference for each assignment.
Operational deployment additionally needs approved wording, privacy/access controls,
agent/queue/difficulty/prior-contact covariates and a reviewed trial protocol.
The displayed sample size is illustrative, not a completed power analysis.

Exact-line example in `monthly-payment-right` (10 synthetic calls):
“The next step is to complete the hardship package so the review queue can evaluate
the account.” appeared in 4 calls, 3 resolved, versus 1/6 without that exact line.
“I can submit the assistance packet request and note that you are preparing the
documents.” appeared in 3 calls, 0 resolved, versus 4/7 without it. These tiny,
selected observational comparisons do not establish what works or causes harm.
