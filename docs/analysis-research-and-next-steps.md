# Call Insights Analysis Research and Next Steps

## Executive Recommendation

Use a hybrid, segment-first architecture:

1. Detect issue boundaries at the utterance-pair level.
2. Map each segment to a stable issue taxonomy with a supervised sentence-transformer model, while allowing an unknown label.
3. Discover genuinely new issue families separately with embedding clustering and human review.
4. Extract agent approaches and outcomes with constrained structured output, requiring evidence turn IDs for every field.
5. Compare approach effectiveness only within the same issue, with sample size, confidence intervals, agent/time controls, and representative calls.

Do not use one model or one call-level label for all five jobs. The repository's current behavior confirms why: issue discovery, stable classification, segmentation, extraction, and statistical comparison have different failure modes.

## Repository and Design Review

The 44-page final design document defines the correct analytical unit as an issue-specific call segment and requires a Triple Engine linking Customer Problem + Agent Behavior + Outcome. It also requires sample size, lift/significance, representative call IDs, privacy-preserving on-premises deployment, and batch processing.

The implemented repository includes the React application, FastAPI service, adaptive issue memory, transcript ingestion, local Hugging Face hooks, generated artifacts, batch-task creation, incremental processing, evidence views, strategy workflow, tests, and a 100-call mortgage demo corpus.

Important gaps found in the current analysis layer:

- The 100 calls come from five short templates with one issue per source call, but current output reports two or three segments for every call.
- Current issue labels are extracted keyphrases such as `payment online` or `title company needs`, not stable business issue IDs.
- Outcomes are exactly 25/25/25/25 by generator construction, so current outcome rates are not evidence that the pipeline discriminates outcomes.
- Behavior labels partly depend on the already-predicted outcome, which creates target leakage in approach-outcome comparisons.
- Most calls contain the same verification, empathy, repeat-contact, and note-taking language, making approach discovery artificially easy.
- Call-level outcome classification is reused downstream even though the design requires mixed outcomes across issue segments.
- The current lift calculation is descriptive. It does not yet control for agent, issue difficulty, time, or repeated customers, and therefore must not be described as causal effectiveness.

## New Evaluation Corpus

`data/evaluation/call_insights_benchmark.jsonl` is a deterministic, synthetic, model-agnostic corpus with 144 calls and 240 labeled issue segments. It is separate from the demo data.

Coverage includes:

- held-out paraphrase families used only in the test split;
- pairs of different problems that share vocabulary, including payment posting vs. autopay and escrow shortage vs. insurance coverage;
- single-problem, long-single-problem, two-problem, and three-problem calls;
- segment-level mixed resolved, follow-up, unresolved, and escalated outcomes;
- eight concrete agent approaches rather than broad sentiment-like behaviors;
- gold issue spans, approach evidence turns, outcome evidence turns, agent IDs, queue metadata, fillers, transitions, and limited ASR noise.

Synthetic outcomes are intentionally generated with varied probabilities by approach so the statistical reporting path can be tested. Those rates are test fixtures, not SPS business findings.

## Local Benchmark Results

All methods use the same frozen train/test split. Held-out test language is not present in the training templates.

| Issue mapping method | Macro F1 | Accuracy | Same issue, new wording | Different issue, shared vocabulary | Multi-issue exact sequence |
|---|---:|---:|---:|---:|---:|
| Taxonomy keyword rules | 0.830 | 0.848 | 0.774 | 0.977 | 0.714 |
| Character + word TF-IDF linear | 0.640 | 0.609 | 0.439 | 0.927 | 0.429 |
| LSA semantic linear | 0.575 | 0.543 | 0.348 | 0.915 | 0.429 |
| Word TF-IDF centroid | 0.553 | 0.543 | 0.387 | 0.898 | 0.357 |
| Current keyphrase pipeline | 0.000 | 0.000 | 0.116 | 1.000 | 0.000 |

The current pipeline scores zero against stable issue IDs because it emits ad hoc phrases rather than taxonomy labels. Its 1.000 shared-vocabulary separation is not success: nearly every prediction is a different phrase, including paraphrases of the same issue.

| Agent-approach extraction method | Macro F1 | Accuracy |
|---|---:|---:|
| Character + word TF-IDF linear | 0.697 | 0.739 |
| LSA semantic linear | 0.532 | 0.609 |
| Word TF-IDF centroid | 0.507 | 0.522 |
| Taxonomy keyword rules | 0.029 | 0.130 |

The segment-level outcome classifier reaches 0.243 macro-F1 on held-out outcome wording. Applying a whole-call label back to every segment falls to 0.171 macro-F1. This is a deliberate hard test and shows that resolution evidence needs semantic modeling and segment-aware labels before the Triple Engine is reliable.

The generated statistical check ranks `teach_back` at 90.0% resolved (n=30, Wilson 95% CI 74.4%–96.5%) and `ledger_walkthrough` at 83.3% (n=30, 66.4%–92.7%). Again, these numbers prove the reporting mechanics only; they were generated, not observed at SPS.

## Researched Production Approaches

### 1. Sentence Embeddings + Similarity/Clustering

Sentence Transformers is the standard practical bi-encoder pattern for semantic similarity, paraphrase mining, retrieval, and clustering. Its documentation uses normalized embeddings and cosine/dot-product similarity, and supports efficient corpus search. This directly addresses same-problem/different-wording cases. For discovery, BERTopic combines transformer embeddings, UMAP, HDBSCAN, and class-based TF-IDF to form interpretable topic clusters.

Use this for candidate retrieval and unknown-issue discovery, not as the only production classifier. Add a similarity rejection threshold and route low-confidence segments to human review. Sources: [Sentence Transformers semantic similarity](https://sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html), [Sentence Transformers clustering](https://sbert.net/examples/sentence_transformer/applications/clustering/README.html), and the [BERTopic paper](https://arxiv.org/abs/2203.05794).

### 2. Few-Shot Supervised Sentence Transformer (SetFit/FastFit Family)

Once SPS supplies reviewed examples, fine-tune an embedding model on positive pairs (same issue/approach) and hard negatives (different issue with shared vocabulary). SetFit was designed for prompt-free few-shot classification using contrastive sentence-transformer training plus a classification head. FastFit extends this direction for many-class classification and reports stronger speed/accuracy tradeoffs.

This is the recommended primary stable-taxonomy mapper after labels exist. It should outperform lexical baselines on paraphrases while preserving low-latency batch inference. Sources: [SetFit paper](https://arxiv.org/abs/2209.11055) and [FastFit paper](https://arxiv.org/abs/2404.12365).

### 3. Utterance-Pair Dialogue Segmentation

Treat boundary detection as a separate sequential problem: score whether adjacent utterances belong to the same issue, then decode coherent segments. The 2025 UPS work unifies supervised and unsupervised utterance-pair modeling and reports that supervised domain models can still outperform LLM-based unsupervised segmentation. Earlier work similarly uses utterance-pair coherence scoring, while joint segmentation/categorization models add dialogue context.

This is the best match for long single issues and multi-issue calls. Start with labeled boundary pairs from the synthetic benchmark, then fine-tune on SPS-reviewed calls. Sources: [UPS dialogue topic segmentation](https://aclanthology.org/2025.naacl-long.252/), [utterance-pair coherence scoring](https://aclanthology.org/2021.sigdial-1.18/), and [joint segmentation and categorization](https://aclanthology.org/2023.emnlp-industry.19/).

### 4. Structured Local LLM Extraction

Use a local instruction model to return a strict schema containing segment spans, normalized issue, concrete agent action, outcome, and evidence turn IDs. Reject outputs without valid evidence or with overlapping/invalid spans. This is especially valuable for novel wording, analogies, troubleshooting sequences, and implicit resolution evidence.

Run it as a second-stage extractor on candidate segments, not as an unconstrained whole-call prompt. vLLM supports offline batch inference using the OpenAI batch JSONL shape and constrained structured outputs using JSON schema, regex, choice, or grammar. This matches the SPS GPU/on-premises requirement and the repository's existing JSONL task builder. Sources: [vLLM offline OpenAI batch format](https://docs.vllm.ai/en/v0.20.0/examples/offline_inference/openai_batch/) and [vLLM structured outputs](https://docs.vllm.ai/en/v0.17.1/features/structured_outputs/).

### 5. Human-in-the-Loop Intent Discovery

For genuinely new issue families, keep discovery separate from production labels. The 2025 Dial-In LLM work is directly relevant: it studies LLM-in-the-loop intent clustering for customer-service dialogues, including context-aware clustering, coherence evaluation, and cluster naming on more than 100,000 real calls and 1,507 annotated clusters.

Use this monthly or during recalibration. A human should approve cluster merges, splits, and names before the new taxonomy is used for reporting. Source: [Dial-In LLM](https://aclanthology.org/2025.emnlp-main.300/).

## Recommended Prototype Workflow

1. Ingest and mask transcripts, preserving stable call, turn, agent, customer, and timestamp identifiers.
2. Detect candidate issue boundaries with an utterance-pair model.
3. Map each segment using a SetFit-style classifier trained with paraphrases and shared-vocabulary hard negatives.
4. Reject low-confidence mappings as unknown; send them to BERTopic/Dial-In-style discovery and review.
5. Run a structured local LLM over each segment to extract concrete approaches and outcome evidence.
6. Require evidence turn IDs and keep unresolved unless explicit evidence supports resolution.
7. Aggregate Customer Problem + Agent Approach + Outcome with Wilson intervals at minimum.
8. Before claiming an approach works, fit a hierarchical logistic model controlling for agent, issue subtype, time, and repeat customer, then validate on a later time window.
9. Display sample size, uncertainty, model/version, filters, and representative calls with every recommendation.

## SPS GPU and Batch Integration

The safest integration contract is an OpenAI-compatible internal endpoint served by vLLM, plus an offline batch mode using the same request JSONL. Ask SPS for:

- VPN/SSH or internal network path, hostname, port, TLS requirements, and authentication method;
- GPU type/count and memory, approved models, model storage path, and maximum context length;
- whether vLLM, Hugging Face TGI, Triton, or another serving layer is already standard;
- request concurrency, token/rate limits, batch window, job scheduler, and output storage location;
- container/runtime requirements, Python/CUDA versions, and whether Docker/Apptainer is allowed;
- the transcript input schema, masking policy, retention policy, and approved evidence fields;
- a small anonymized sample plus human labels for issue boundaries, issue IDs, approaches, and outcomes.

Implement one provider interface with two transports: local in-process batch and OpenAI-compatible HTTP. Keep prompts, schemas, model IDs, sampling settings, and code versions in every output record.

## Immediate Next Steps

1. Have two reviewers label 50–100 anonymized SPS calls at the segment, issue, approach, outcome, and evidence-turn levels.
2. Run the new frozen benchmark on every pipeline change; do not replace it with a model-specific dataset.
3. Add a sentence-transformer/SetFit candidate and an utterance-pair boundary model when approved models are available locally or on the SPS GPU.
4. Add strict structured-output execution to the existing LLM batch task builder.
5. Define acceptance gates before integration: per-class F1, paraphrase accuracy, confound separation, boundary F1, segment outcome macro-F1, calibration, abstention coverage, and evidence validity.
6. Defer the hologram visualization until multi-issue segmentation and outcome attribution meet those gates.

## Implemented Hybrid Candidate

The repository now includes the recommended hybrid topic model in `evaluation/hybrid_topics.py`, an OpenAI-compatible local/SPS runner in `evaluation/run_hybrid_topics.py`, offline segmentation-task generation, strict evidence and confidence validation, unknown-topic HDBSCAN discovery, and `evaluation/evaluate_hybrid_results.py` for scoring real model output. No LLM accuracy is claimed yet because no local or SPS model endpoint was supplied for this run.
