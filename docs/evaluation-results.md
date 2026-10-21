# Call Insights Benchmark Results

Corpus: 144 calls, 240 issue segments, 28 held-out test calls.

## Issue Mapping

| Method | Macro F1 | Accuracy | Paraphrase same | Shared-vocabulary different | Multi-issue exact | Long single exact | Seconds |
|---|---:|---:|---:|---:|---:|---:|---:|
| taxonomy_keyword_rules | 0.830 | 0.848 | 0.774 | 0.977 | 0.714 | 1.000 | 0.003 |
| char_word_tfidf_linear | 0.640 | 0.609 | 0.439 | 0.927 | 0.429 | 1.000 | 0.081 |
| char_tfidf_linear_svm | 0.621 | 0.609 | 0.497 | 0.961 | 0.357 | 1.000 | 0.064 |
| word_tfidf_ridge | 0.601 | 0.565 | 0.368 | 0.915 | 0.429 | 1.000 | 0.024 |
| lsa_semantic_linear | 0.575 | 0.543 | 0.348 | 0.915 | 0.429 | 1.000 | 0.042 |
| word_tfidf_centroid | 0.553 | 0.543 | 0.387 | 0.898 | 0.357 | 1.000 | 0.015 |
| word_tfidf_complement_nb | 0.503 | 0.478 | 0.342 | 0.904 | 0.357 | 1.000 | 0.011 |
| char_tfidf_sgd_huber | 0.408 | 0.478 | 0.490 | 0.859 | 0.286 | 1.000 | 0.046 |
| current_keyphrase_pipeline | 0.000 | 0.000 | 0.116 | 1.000 | 0.000 | 0.000 | 0.011 |

## Hybrid Issue Mapping (End-to-End)

These methods perform both LLM segmentation and topic assignment; they are reported separately from models evaluated with gold segment boundaries.

| Method | Macro F1 | Accuracy | Call coverage | Issue-count accuracy | Exact sequence | Unknown rate | Valid evidence |
|---|---:|---:|---:|---:|---:|---:|---:|
| svm_top_k_llm_reranking | 0.952 | 0.935 | 1.000 | 1.000 | 0.893 | 0.043 | 1.000 |
| ml_ensemble_vote_llm_arbitration | 0.899 | 0.848 | 1.000 | 1.000 | 0.750 | 0.109 | 1.000 |
| logistic_regression_top_k_llm_reranking | 0.879 | 0.783 | 1.000 | 1.000 | 0.643 | 0.217 | 1.000 |
| embedding_supervised_ml_llm_consensus | 0.487 | 0.348 | 1.000 | 1.000 | 0.179 | 0.652 | 1.000 |
| llm_normalization_logistic_regression | 0.094 | 0.065 | 1.000 | 1.000 | 0.071 | 0.935 | 1.000 |

## Agent Approach Extraction

| Method | Macro F1 | Accuracy | Seconds |
|---|---:|---:|---:|
| char_tfidf_linear_svm | 0.759 | 0.804 | 0.072 |
| char_word_tfidf_linear | 0.697 | 0.739 | 0.063 |
| char_tfidf_sgd_huber | 0.581 | 0.652 | 0.041 |
| word_tfidf_ridge | 0.547 | 0.609 | 0.022 |
| lsa_semantic_linear | 0.532 | 0.609 | 0.025 |
| word_tfidf_centroid | 0.507 | 0.522 | 0.010 |
| word_tfidf_complement_nb | 0.464 | 0.543 | 0.010 |
| taxonomy_keyword_rules | 0.029 | 0.130 | 0.002 |

## Resolution Attribution

- segment_evidence_gate: macro F1 0.243, accuracy 0.522
- whole_call_label_applied_to_segments: macro F1 0.171, accuracy 0.522

## Observed Agent-Approach Effectiveness

Synthetic rates validate the analytics and must not be presented as SPS findings.

| Agent approach | n | Resolved | Rate | Lift | Wilson 95% CI | Evidence calls |
|---|---:|---:|---:|---:|---:|---|
| teach_back | 30 | 27 | 0.900 | +0.354 | [0.744, 0.965] | SYN-0008, SYN-0017, SYN-0018 |
| ledger_walkthrough | 30 | 25 | 0.833 | +0.287 | [0.664, 0.927] | SYN-0002, SYN-0010, SYN-0011 |
| timeline_explanation | 30 | 19 | 0.633 | +0.087 | [0.455, 0.781] | SYN-0013, SYN-0021, SYN-0022 |
| case_ownership | 30 | 18 | 0.600 | +0.054 | [0.423, 0.754] | SYN-0011, SYN-0012, SYN-0027 |
| document_request | 30 | 13 | 0.433 | -0.113 | [0.274, 0.608] | SYN-0014, SYN-0022, SYN-0024 |
| policy_citation | 30 | 12 | 0.400 | -0.146 | [0.246, 0.577] | SYN-0010, SYN-0018, SYN-0033 |
| warm_transfer | 30 | 10 | 0.333 | -0.212 | [0.192, 0.512] | SYN-0024, SYN-0031, SYN-0047 |
| generic_reassurance | 30 | 7 | 0.233 | -0.312 | [0.118, 0.409] | SYN-0006, SYN-0029, SYN-0060 |
