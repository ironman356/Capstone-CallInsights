# Hybrid Codex Topic-Modeling Results

## Run Summary

The hybrid LLM + ML topic-modeling design was evaluated with Codex agents on the frozen held-out test split.

- Test calls: 28
- Gold issue segments: 46
- Predicted issue segments: 46
- Failed or missing calls: 0
- Call coverage: 100%
- Issue-count accuracy: 100%
- Exact ordered issue-sequence accuracy: 100%
- Aligned segment topic accuracy: 100%
- Aligned segment topic macro-F1: 1.000
- Unknown-topic rate: 0%
- Valid customer evidence-turn rate: 100%

## Evaluation Integrity

The Codex agents received `data/evaluation/call_insights_benchmark_blind.jsonl`, which excludes gold segments and all `gold_*` turn fields. Each agent was instructed to decide from speaker and transcript text only. Predictions were frozen in four separate files before being merged and compared with the original gold corpus.

The evaluated output is `data/evaluation/hybrid_predictions_codex_test.jsonl`; machine-readable metrics are in `data/evaluation/hybrid_metrics_codex_test.json`.

## Comparison With Traditional Baselines

| Method | Segments supplied? | Issue macro-F1 | Exact multi-issue sequence |
|---|---|---:|---:|
| Codex LLM segmentation + stable topic mapping | No - model found boundaries | 1.000 | 1.000 |
| Taxonomy keyword rules | Yes - evaluated on gold segments | 0.830 | 0.714 |
| Character + word TF-IDF linear | Yes - evaluated on gold segments | 0.640 | 0.429 |
| LSA semantic linear | Yes - evaluated on gold segments | 0.575 | 0.429 |
| Word TF-IDF centroid | Yes - evaluated on gold segments | 0.553 | 0.357 |
| Existing keyphrase pipeline | Yes - evaluated on gold segments | 0.000 | 0.000 |

This comparison favors the traditional baselines because they were given the correct segment boundaries. The Codex run performed both segmentation and topic assignment and still produced the best result.

## Interpretation

The result supports using an LLM for call-level issue boundary detection and contextual topic decisions, with embeddings or another retrieval model constraining the stable taxonomy. It also shows that evidence-turn requirements do not prevent complete coverage on this dataset.

## Limitations

- The corpus is synthetic and has cleaner structure than real call-center transcripts.
- The test language is held out, but it comes from the same synthetic generator and six-topic domain.
- Every test issue belongs to the known taxonomy, so the 0% unknown rate does not measure open-set detection.
- The Codex agents are not the same model that SPS will deploy locally.
- Agentic evaluation is not a substitute for a reproducible SPS endpoint benchmark.
- Real calls will include transcription errors, interruptions, incomplete sentences, topic revisits, implicit goals, and mislabeled operational outcomes.

## Required Next Evaluation

1. Add out-of-taxonomy mortgage and non-mortgage problems to measure unknown-topic recall.
2. Add topic revisits where a call returns to an earlier problem.
3. Add overlapping and ambiguous issue statements.
4. Run the same blind evaluation on 50-100 anonymized, human-labeled SPS calls.
5. Repeat with the exact local/SPS model and serving configuration intended for production.
