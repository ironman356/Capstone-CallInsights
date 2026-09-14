# Call Insights Benchmark Results

Corpus: 144 calls, 240 issue segments, 28 held-out test calls.

## Issue Mapping

| Method | Macro F1 | Accuracy | Paraphrase same | Shared-vocabulary different | Multi-issue exact | Long single exact | Seconds |
|---|---:|---:|---:|---:|---:|---:|---:|
| taxonomy_keyword_rules | 0.830 | 0.848 | 0.774 | 0.977 | 0.714 | 1.000 | 0.006 |
| char_word_tfidf_linear | 0.640 | 0.609 | 0.439 | 0.927 | 0.429 | 1.000 | 0.186 |
| lsa_semantic_linear | 0.575 | 0.543 | 0.348 | 0.915 | 0.429 | 1.000 | 0.073 |
| word_tfidf_centroid | 0.553 | 0.543 | 0.387 | 0.898 | 0.357 | 1.000 | 0.027 |
| current_keyphrase_pipeline | 0.000 | 0.000 | 0.116 | 1.000 | 0.000 | 0.000 | 0.012 |

## Agent Approach Extraction

| Method | Macro F1 | Accuracy | Seconds |
|---|---:|---:|---:|
| char_word_tfidf_linear | 0.697 | 0.739 | 0.161 |
| lsa_semantic_linear | 0.532 | 0.609 | 0.063 |
| word_tfidf_centroid | 0.507 | 0.522 | 0.024 |
| taxonomy_keyword_rules | 0.029 | 0.130 | 0.005 |

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
