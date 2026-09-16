# Hybrid LLM + ML Topic Modeling

## What Is Implemented

The hybrid pipeline uses two different reasoning mechanisms for different jobs:

1. An LLM segments a complete call into coherent customer problems and writes a grounded problem statement for each segment.
2. A sentence-embedding retriever finds the closest stable business topics.
3. The LLM reranks only those candidates using the original segment and may return `unknown_new_issue`.
4. Validation rejects overlapping spans, invalid labels, non-customer evidence, out-of-range turn IDs, and malformed output.
5. Low LLM confidence or low embedding similarity forces abstention to `unknown_new_issue`.
6. HDBSCAN groups unknown issue statements, and the LLM proposes a cluster name that requires human approval.

The same client supports a local vLLM server and an SPS-hosted OpenAI-compatible endpoint.
For synthetic development runs, the configured Gemini API can also be selected with `--provider gemini`.

## Why This Structure

- The LLM handles conversation context, paraphrases, implicit meaning, and issue boundaries.
- Embeddings provide fast, consistent retrieval against the approved taxonomy.
- Candidate-constrained reranking prevents uncontrolled free-form topic names.
- Unknown-topic abstention prevents forced assignments.
- Evidence validation makes every topic decision auditable.
- HDBSCAN is used for discovery only, not for silently changing production categories.

## Run Against a Local vLLM Server

Start an OpenAI-compatible model server on port 8011. Then run:

```powershell
python -m evaluation.run_hybrid_topics `
  --input data/evaluation/call_insights_benchmark.jsonl `
  --output data/evaluation/hybrid_predictions.jsonl `
  --model YOUR_LOCAL_MODEL `
  --base-url http://127.0.0.1:8011/v1 `
  --limit 10
```

If authentication is required, put the token in `CALL_INSIGHTS_LLM_API_KEY` or pass another variable name using `--api-key-env`.

## Create Offline Batch Tasks

```powershell
python -m evaluation.run_hybrid_topics `
  --input data/evaluation/call_insights_benchmark.jsonl `
  --output data/evaluation/hybrid_segmentation_tasks.jsonl `
  --mode segmentation-tasks `
  --model YOUR_SPS_MODEL
```

The output follows the OpenAI batch JSONL request shape supported by vLLM. Segmentation is stage one. Candidate retrieval runs locally after those responses are validated; reranking is stage two because its candidate list depends on the extracted problem statement.

## Run the Configured Gemini Development Provider

Only synthetic or otherwise approved data should be sent to this external provider.

```powershell
python -m evaluation.run_hybrid_topics `
  --input data/evaluation/call_insights_benchmark.jsonl `
  --output data/evaluation/hybrid_predictions_gemini.jsonl `
  --provider gemini `
  --limit 5
```

Gemini HTTP 429 responses are retried using the server-provided delay. Add `--resume` to preserve successful rows and retry only missing or failed calls.

## Evaluate Real Model Results

```powershell
python -m evaluation.evaluate_hybrid_results `
  --gold data/evaluation/call_insights_benchmark.jsonl `
  --predictions data/evaluation/hybrid_predictions.jsonl `
  --output data/evaluation/hybrid_metrics.json
```

The evaluator reports coverage, issue-count accuracy, exact issue-sequence accuracy, aligned segment accuracy and macro-F1, unknown rate, and valid evidence rate.

## Required Production Gates

- Validate the model on held-out SPS calls, not synthetic calls alone.
- Require evidence-turn validity of 100% after schema validation.
- Report per-topic F1 and confusion pairs, not accuracy alone.
- Tune abstention thresholds using a calibration set.
- Review unknown clusters before changing the taxonomy.
- Record model ID, prompt version, taxonomy version, thresholds, and generation settings with every result.

## Codex Benchmark

The blind Codex-agent run and its limitations are documented in `docs/hybrid-codex-results.md`. It achieved 1.000 topic macro-F1 and exact issue-sequence accuracy across 28 held-out synthetic calls and 46 segments. This validates the workflow on the synthetic benchmark but is not a substitute for SPS-model and SPS-data evaluation.
