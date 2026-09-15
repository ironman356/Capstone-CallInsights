# Call Insights Evaluation Harness

This package creates a frozen, model-agnostic synthetic benchmark and evaluates multiple issue-mapping and agent-approach extraction methods on the same held-out calls.

The corpus explicitly includes:

- the same issue described with unseen paraphrases;
- different issues sharing mortgage vocabulary;
- calls with one, two, or three customer problems;
- one long problem spread across multiple customer turns;
- mixed segment outcomes, so one resolved issue cannot mark the whole call resolved;
- verification language, filler speech, transitions, and limited ASR-style noise;
- traceable gold spans for issue, agent approach, outcome, and evidence turns.

Synthetic data validates system behavior, not business effectiveness. Replace it with anonymized SPS calls and human-reviewed labels before making operational claims.

## Run

```powershell
pip install -r evaluation/requirements.txt
python -m evaluation.corpus
python -m evaluation.benchmark
```

Outputs:

- `data/evaluation/call_insights_benchmark.jsonl`
- `data/evaluation/benchmark_results.json`
- `docs/evaluation-results.md`

## Hybrid LLM + ML Topic Modeling

The production candidate is implemented in `evaluation/hybrid_topics.py`. It combines LLM segmentation, embedding retrieval, candidate-constrained LLM reranking, unknown-topic abstention, evidence validation, and HDBSCAN discovery. See `docs/hybrid-topic-modeling.md` for local vLLM, SPS endpoint, batch, and evaluation commands.

## Compared Methods

1. Current keyphrase pipeline: the repository's existing issue-label logic.
2. Taxonomy keyword rules: an interpretable domain baseline.
3. Word TF-IDF nearest centroid: a lightweight similarity baseline.
4. Character + word TF-IDF linear classifier: robust to spelling and ASR variation.
5. LSA semantic linear classifier: a classical low-dimensional semantic baseline.

These baselines are intentionally inexpensive and offline. The research recommendation is to add a sentence-transformer/SetFit model after SPS supplies reviewed examples, use BERTopic-style clustering only for discovery, and use an utterance-pair topic-boundary model or structured local LLM for segmentation and extraction.
