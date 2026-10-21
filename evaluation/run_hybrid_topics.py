from __future__ import annotations

import argparse
import json
from pathlib import Path

from evaluation.benchmark import fit_hybrid_topic_classifiers

from evaluation.hybrid_topics import (
    EmbeddingLLMConsensusStrategy,
    EmbeddingRerankStrategy,
    EmbeddingSupervisedLLMConsensusStrategy,
    ExampleRetrievalLLMRerankStrategy,
    GeminiJsonLLM,
    HybridTopicModeler,
    LLMFirstEmbeddingVerifierStrategy,
    LogisticRegressionLLMRerankStrategy,
    MLEnsembleLLMArbitrationStrategy,
    NormalizedEmbeddingRerankStrategy,
    NormalizedLogisticRegressionStrategy,
    OpenAICompatibleLLM,
    SVMTopKLLMRerankStrategy,
    api_key_from_env,
    configured_value,
    load_jsonl,
    segmentation_batch_task,
    write_jsonl,
)

HYBRID_STRATEGIES = (
    "embedding_retrieval_llm_reranking",
    "llm_normalization_embedding_retrieval_llm_reranking",
    "embedding_llm_consensus",
    "llm_first_embedding_verification",
    "embedding_example_retrieval_llm_reranking",
    "llm_normalization_logistic_regression",
    "logistic_regression_top_k_llm_reranking",
    "svm_top_k_llm_reranking",
    "ml_ensemble_vote_llm_arbitration",
    "embedding_supervised_ml_llm_consensus",
)


def _load_supervised_training_rows(
    path: Path,
    split: str,
) -> tuple[list[str], list[str]]:
    texts: list[str] = []
    labels: list[str] = []

    for call in load_jsonl(path):
        if call.get("split") != split:
            continue

        turns = call.get("turns")
        if not isinstance(turns, list):
            raise ValueError("Supervised training calls must contain turns")

        for segment in call.get("segments", []):
            if not isinstance(segment, dict):
                raise ValueError("Supervised training segments must be objects")

            start_turn = segment.get("start_turn")
            end_turn = segment.get("end_turn")
            topic_id = segment.get("issue_label")

            if not isinstance(start_turn, int) or not isinstance(end_turn, int):
                raise ValueError("Supervised training segments need valid turn ranges")
            if not isinstance(topic_id, str) or not topic_id.strip():
                raise ValueError("Supervised training segments need issue_label values")

            customer_text = " ".join(
                str(turn.get("text", "")).strip()
                for turn in turns[start_turn : end_turn + 1]
                if str(turn.get("speaker", "")).lower() == "customer"
            ).strip()

            if not customer_text:
                raise ValueError("Each supervised training segment needs customer text")

            texts.append(customer_text)
            labels.append(topic_id.strip())

    if not texts:
        raise ValueError(f"No supervised training segments found for split {split!r}")

    return texts, labels


def _build_strategy(args: argparse.Namespace, llm):
    common = {
        "candidate_count": args.candidate_count,
        "minimum_confidence": args.minimum_confidence,
    }
    embedding_common = {
        **common,
        "minimum_similarity": args.minimum_similarity,
    }

    if args.strategy == "embedding_retrieval_llm_reranking":
        return EmbeddingRerankStrategy(llm, **embedding_common)

    if args.strategy == "llm_normalization_embedding_retrieval_llm_reranking":
        return NormalizedEmbeddingRerankStrategy(llm, **embedding_common)

    if args.strategy == "embedding_llm_consensus":
        return EmbeddingLLMConsensusStrategy(llm, **embedding_common)

    if args.strategy == "llm_first_embedding_verification":
        return LLMFirstEmbeddingVerifierStrategy(llm, **embedding_common)

    if args.strategy == "embedding_example_retrieval_llm_reranking":
        return ExampleRetrievalLLMRerankStrategy(
            llm,
            example_count=args.example_count,
            minimum_confidence=args.minimum_confidence,
            minimum_similarity=args.minimum_similarity,
        )

    if args.supervised_training_input is None:
        raise ValueError(
            "--supervised-training-input is required for supervised ML hybrid strategies"
        )

    texts, labels = _load_supervised_training_rows(
        args.supervised_training_input,
        args.supervised_training_split,
    )
    classifiers = fit_hybrid_topic_classifiers(texts, labels)
    logistic_regression = classifiers["logistic_regression"]
    linear_svm = classifiers["linear_svm"]

    if args.strategy == "llm_normalization_logistic_regression":
        return NormalizedLogisticRegressionStrategy(
            llm,
            logistic_regression,
            **common,
        )

    if args.strategy == "logistic_regression_top_k_llm_reranking":
        return LogisticRegressionLLMRerankStrategy(
            llm,
            logistic_regression,
            **common,
            minimum_probability=args.minimum_probability,
        )

    if args.strategy == "svm_top_k_llm_reranking":
        return SVMTopKLLMRerankStrategy(
            llm,
            linear_svm,
            **common,
        )

    if args.strategy == "ml_ensemble_vote_llm_arbitration":
        return MLEnsembleLLMArbitrationStrategy(
            llm,
            classifiers,
            **common,
        )

    if args.strategy == "embedding_supervised_ml_llm_consensus":
        return EmbeddingSupervisedLLMConsensusStrategy(
            llm,
            logistic_regression,
            **embedding_common,
            minimum_probability=args.minimum_probability,
        )

    raise ValueError(f"Unsupported hybrid strategy: {args.strategy}")

def main() -> int:
    parser = argparse.ArgumentParser(description="Run hybrid LLM + embedding topic modeling.")
    parser.add_argument("--input", type=Path, required=True, help="JSONL calls containing call_id and turns.")
    parser.add_argument("--output", type=Path, required=True, help="JSONL analysis output or batch tasks.")
    parser.add_argument("--mode", choices=("online", "segmentation-tasks"), default="online")
    parser.add_argument("--provider", choices=("openai-compatible", "gemini"), default="openai-compatible")
    parser.add_argument("--base-url", default="http://127.0.0.1:8011/v1")
    parser.add_argument("--model")
    parser.add_argument("--api-key-env", default="CALL_INSIGHTS_LLM_API_KEY")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--split", choices=("train", "test"))
    parser.add_argument("--minimum-confidence", type=float, default=0.65)
    parser.add_argument("--minimum-similarity", type=float, default=0.18)
    parser.add_argument(
        "--strategy",
        choices=HYBRID_STRATEGIES,
        default="embedding_retrieval_llm_reranking",
    )
    parser.add_argument("--candidate-count", type=int, default=4)
    parser.add_argument("--example-count", type=int, default=6)
    parser.add_argument("--minimum-probability", type=float, default=0.18)
    parser.add_argument(
        "--supervised-training-input",
        type=Path,
        help="Labeled JSONL corpus used to fit LR and SVM strategies.",
    )
    parser.add_argument(
        "--supervised-training-split",
        choices=("train", "test"),
        default="train",
    )
    parser.add_argument("--resume", action="store_true", help="Keep successful existing rows and retry missing/error calls.")
    args = parser.parse_args()

    if args.candidate_count < 1:
        parser.error("--candidate-count must be at least 1")
    if args.example_count < 1:
        parser.error("--example-count must be at least 1")

    model = args.model or (configured_value("ASK_CI_GEMINI_MODEL") if args.provider == "gemini" else None)
    if not model:
        parser.error("--model is required unless ASK_CI_GEMINI_MODEL is configured for Gemini")
    calls = load_jsonl(args.input)
    if args.split:
        calls = [call for call in calls if call.get("split") == args.split]
    if args.limit > 0:
        calls = calls[: args.limit]
    if args.mode == "segmentation-tasks":
        write_jsonl(args.output, [segmentation_batch_task(call, model) for call in calls])
        print(f"Wrote {len(calls)} OpenAI-compatible segmentation tasks to {args.output}")
        return 0

    if args.provider == "gemini":
        api_key = api_key_from_env("GEMINI_API_KEY")
        if not api_key:
            parser.error("GEMINI_API_KEY is not configured")
        llm = GeminiJsonLLM(api_key=api_key, model=model)
    else:
        llm = OpenAICompatibleLLM(
            base_url=args.base_url,
            model=model,
            api_key=api_key_from_env(args.api_key_env),
        )
    strategy = _build_strategy(args, llm)
    modeler = HybridTopicModeler(
        llm,
        candidate_count=args.candidate_count,
        minimum_confidence=args.minimum_confidence,
        minimum_similarity=args.minimum_similarity,
        strategy=strategy,
    )
    
    existing = {}
    if args.resume and args.output.exists():
        expected_method = f"llm_segmentation_{args.strategy}"
        existing = {
            str(row.get("call_id")): row
            for row in load_jsonl(args.output)
            if not row.get("error")
            and row.get("modeling_method") == expected_method
        }
    results_by_id = dict(existing)
    for call in calls:
        call_id = str(call.get("call_id"))
        if call_id in existing:
            continue
        try:
            results_by_id[call_id] = modeler.analyze_call(call)
        except (RuntimeError, ValueError) as exc:
            results_by_id[call_id] = {"call_id": call.get("call_id"), "error": str(exc)}
        write_jsonl(args.output, [results_by_id[str(item.get("call_id"))] for item in calls if str(item.get("call_id")) in results_by_id])
    results = [results_by_id[str(call.get("call_id"))] for call in calls if str(call.get("call_id")) in results_by_id]
    write_jsonl(args.output, results)
    failures = sum("error" in result for result in results)
    print(json.dumps({"processed": len(results), "failures": failures, "output": str(args.output)}, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
