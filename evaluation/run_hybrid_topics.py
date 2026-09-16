from __future__ import annotations

import argparse
import json
from pathlib import Path

from evaluation.hybrid_topics import (
    GeminiJsonLLM,
    HybridTopicModeler,
    OpenAICompatibleLLM,
    api_key_from_env,
    configured_value,
    load_jsonl,
    segmentation_batch_task,
    write_jsonl,
)


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
    parser.add_argument("--resume", action="store_true", help="Keep successful existing rows and retry missing/error calls.")
    args = parser.parse_args()

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
    modeler = HybridTopicModeler(
        llm,
        minimum_confidence=args.minimum_confidence,
        minimum_similarity=args.minimum_similarity,
    )
    existing = {}
    if args.resume and args.output.exists():
        existing = {str(row.get("call_id")): row for row in load_jsonl(args.output) if not row.get("error")}
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
