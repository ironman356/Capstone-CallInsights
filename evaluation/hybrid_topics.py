from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np
from sklearn.cluster import HDBSCAN


@dataclass(frozen=True)
class TopicDefinition:
    topic_id: str
    name: str
    description: str
    examples: tuple[str, ...]


DEFAULT_TAXONOMY = (
    TopicDefinition(
        "payment_posting",
        "Payment posting or suspense",
        "A completed or initiated payment has not appeared correctly in the loan ledger, is pending, or is held in suspense.",
        ("The funds left my bank but are not applied.", "My payment is still pending in the portal."),
    ),
    TopicDefinition(
        "autopay_draft",
        "Automatic payment draft",
        "An automatic or recurring payment enrollment, scheduled withdrawal, bank account, or draft date did not work as expected.",
        ("Autopay skipped this month.", "The scheduled withdrawal never happened."),
    ),
    TopicDefinition(
        "escrow_shortage",
        "Escrow shortage or payment increase",
        "An escrow analysis, tax or insurance projection, shortage, deficit, or cushion changed the required monthly payment.",
        ("The escrow analysis raised my payment.", "I do not understand the shortage calculation."),
    ),
    TopicDefinition(
        "insurance_coverage",
        "Property insurance coverage",
        "The servicer has missing or incorrect proof of hazard insurance, lender-placed insurance, or a coverage mismatch.",
        ("I already have coverage but received a lender-placed notice.", "My declaration page was not matched."),
    ),
    TopicDefinition(
        "late_fee_dispute",
        "Late fee or delinquency dispute",
        "The customer disputes a late charge, delinquency state, grace-period decision, assessment date, or related credit reporting.",
        ("I paid within the grace period.", "The late charge should not be on the account."),
    ),
    TopicDefinition(
        "payoff_quote",
        "Payoff quote or refinance coordination",
        "A borrower or settlement party needs a payoff statement, good-through date, per-diem interest, or refinance closing coordination.",
        ("The title company needs a payoff statement.", "The quote expires before closing."),
    ),
)


SEGMENTATION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["segments"],
    "properties": {
        "segments": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["start_turn", "end_turn", "issue_statement", "issue_evidence_turns"],
                "properties": {
                    "start_turn": {"type": "integer", "minimum": 0},
                    "end_turn": {"type": "integer", "minimum": 0},
                    "issue_statement": {"type": "string", "minLength": 4},
                    "issue_evidence_turns": {
                        "type": "array",
                        "minItems": 1,
                        "items": {"type": "integer", "minimum": 0},
                    },
                },
            },
        }
    },
}


RERANK_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["topic_id", "confidence", "rationale", "evidence_turns"],
    "properties": {
        "topic_id": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "rationale": {"type": "string"},
        "evidence_turns": {"type": "array", "minItems": 1, "items": {"type": "integer", "minimum": 0}},
    },
}

NORMALIZATION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["canonical_issue"],
    "properties": {
        "canonical_issue": {"type": "string", "minLength": 4, "maxLength": 240},
    },
}

CLUSTER_LABEL_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["name", "description", "coherent"],
    "properties": {
        "name": {"type": "string", "minLength": 3, "maxLength": 80},
        "description": {"type": "string", "minLength": 8, "maxLength": 300},
        "coherent": {"type": "boolean"},
    },
}


class JsonLLM(Protocol):
    def complete_json(self, *, system: str, user: str, schema_name: str, schema: dict) -> dict:
        ...


class OpenAICompatibleLLM:
    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str | None = None,
        timeout_seconds: int = 120,
        temperature: float = 0.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.temperature = temperature

    def complete_json(self, *, system: str, user: str, schema_name: str, schema: dict) -> dict:
        payload = {
            "model": self.model,
            "temperature": self.temperature,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": schema_name, "strict": True, "schema": schema},
            },
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        request = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"LLM request failed: {exc}") from exc
        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError("LLM response did not contain choices[0].message.content") from exc
        if isinstance(content, dict):
            return content
        if not isinstance(content, str):
            raise RuntimeError("LLM response content was not JSON text")
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.IGNORECASE)
        try:
            result = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise RuntimeError("LLM returned invalid JSON") from exc
        if not isinstance(result, dict):
            raise RuntimeError("LLM JSON response must be an object")
        return result


def _gemini_schema(schema: dict) -> dict:
    supported = {
        "$id",
        "$defs",
        "$ref",
        "$anchor",
        "type",
        "format",
        "title",
        "description",
        "enum",
        "items",
        "prefixItems",
        "minItems",
        "maxItems",
        "minimum",
        "maximum",
        "anyOf",
        "oneOf",
        "properties",
        "additionalProperties",
        "required",
    }
    cleaned = {}
    for key, value in schema.items():
        if key not in supported:
            continue
        if key == "properties" and isinstance(value, dict):
            cleaned[key] = {name: _gemini_schema(item) for name, item in value.items()}
        elif key in {"items"} and isinstance(value, dict):
            cleaned[key] = _gemini_schema(value)
        elif key in {"prefixItems", "anyOf", "oneOf"} and isinstance(value, list):
            cleaned[key] = [_gemini_schema(item) for item in value]
        elif key == "$defs" and isinstance(value, dict):
            cleaned[key] = {name: _gemini_schema(item) for name, item in value.items()}
        else:
            cleaned[key] = value
    return cleaned


class GeminiJsonLLM:
    def __init__(self, *, api_key: str, model: str, timeout_seconds: int = 120, max_retries: int = 8) -> None:
        if not api_key.strip():
            raise ValueError("Gemini API key is required")
        self.api_key = api_key.strip()
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries

    def complete_json(self, *, system: str, user: str, schema_name: str, schema: dict) -> dict:
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "temperature": 0,
                "responseMimeType": "application/json",
                "responseJsonSchema": _gemini_schema(schema),
            },
        }
        request = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
            method="POST",
        )
        body = None
        for attempt in range(self.max_retries + 1):
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                    body = json.loads(response.read().decode("utf-8"))
                break
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")[:1000]
                if exc.code != 429 or attempt >= self.max_retries:
                    raise RuntimeError(f"Gemini request failed with HTTP {exc.code}: {detail[:500]}") from exc
                retry_match = re.search(r"retry in ([0-9.]+)(ms|s)", detail, flags=re.IGNORECASE)
                if retry_match:
                    delay = float(retry_match.group(1))
                    if retry_match.group(2).lower() == "ms":
                        delay /= 1000
                    delay += 1.0
                else:
                    delay = min(60.0, 2.0 ** attempt)
                time.sleep(delay)
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                raise RuntimeError(f"Gemini request failed: {exc}") from exc
        if body is None:
            raise RuntimeError("Gemini request exhausted retries")
        try:
            parts = body["candidates"][0]["content"]["parts"]
            content = "".join(str(part.get("text", "")) for part in parts).strip()
            result = json.loads(content)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Gemini returned an invalid {schema_name} response") from exc
        if not isinstance(result, dict):
            raise RuntimeError("Gemini JSON response must be an object")
        return result


class TaxonomyRetriever:
    def __init__(self, taxonomy: tuple[TopicDefinition, ...] = DEFAULT_TAXONOMY) -> None:
        from apps.api.app.services.rank1.adaptive import HuggingFaceAdaptiveEngine

        self.taxonomy = taxonomy
        self.engine = HuggingFaceAdaptiveEngine()
        catalog_texts = [self._topic_text(topic) for topic in taxonomy]
        self.catalog_embeddings = np.asarray(self.engine.embed_texts(catalog_texts), dtype=float)

    @staticmethod
    def _topic_text(topic: TopicDefinition) -> str:
        return f"{topic.name}. {topic.description} Examples: {' '.join(topic.examples)}"

    def embed(self, texts: list[str]) -> np.ndarray:
        return np.asarray(self.engine.embed_texts(texts), dtype=float)

    def retrieve(self, issue_statement: str, top_k: int = 4) -> list[dict]:
        query = self.embed([issue_statement])[0]
        query_norm = np.linalg.norm(query)
        catalog_norms = np.linalg.norm(self.catalog_embeddings, axis=1)
        denominator = np.maximum(query_norm * catalog_norms, 1e-12)
        scores = (self.catalog_embeddings @ query) / denominator
        ranked = np.argsort(-scores)[: max(1, min(top_k, len(self.taxonomy)))]
        return [
            {
                "topic_id": self.taxonomy[index].topic_id,
                "name": self.taxonomy[index].name,
                "description": self.taxonomy[index].description,
                "similarity": round(float(scores[index]), 4),
            }
            for index in ranked
        ]

class TopicClassificationStrategy(Protocol):
    """Classifies one already-segmented customer issue."""

    strategy_id: str

    def classify(
        self,
        *,
        segment: dict,
        turns: list[dict],
        retriever: TaxonomyRetriever,
        taxonomy: tuple[TopicDefinition, ...],
    ) -> dict:
        ...

class ProbabilisticTopicClassifier(Protocol):
    """A fitted supervised classifier that returns per-topic probabilities."""

    classes_: np.ndarray

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        ...

class DecisionFunctionTopicClassifier(Protocol):
    """A fitted supervised classifier that returns one score per topic."""

    classes_: np.ndarray

    def decision_function(self, texts: list[str]) -> np.ndarray:
        ...

class TopicLabelClassifier(Protocol):
    """A fitted supervised classifier that returns one topic label."""

    def predict(self, texts: list[str]) -> list[str]:
        ...

class EmbeddingRerankStrategy:
    """The existing approach: embedding retrieval followed by LLM reranking."""

    strategy_id = "embedding_retrieval_llm_reranking"

    def __init__(
        self,
        llm: JsonLLM,
        *,
        candidate_count: int = 4,
        minimum_confidence: float = 0.65,
        minimum_similarity: float = 0.18,
    ) -> None:
        self.llm = llm
        self.candidate_count = candidate_count
        self.minimum_confidence = minimum_confidence
        self.minimum_similarity = minimum_similarity

    def classify(
        self,
        *,
        segment: dict,
        turns: list[dict],
        retriever: TaxonomyRetriever,
        taxonomy: tuple[TopicDefinition, ...],
    ) -> dict:
        candidates = retriever.retrieve(segment["issue_statement"], self.candidate_count)
        allowed = {candidate["topic_id"] for candidate in candidates} | {"unknown_new_issue"}

        segment_text = "\n".join(
            f"[{index}] {turns[index]['speaker']}: {turns[index]['text']}"
            for index in range(segment["start_turn"], segment["end_turn"] + 1)
        )

        response = self.llm.complete_json(
            system=(
                "Choose the single best business topic for this customer-problem segment from the supplied candidates. "
                "Similar vocabulary is not enough; use the customer's actual goal. Choose unknown_new_issue if no candidate "
                "fits. Evidence must reference customer turns inside the segment. Return only schema-valid JSON."
            ),
            user=(
                f"Normalized problem: {segment['issue_statement']}\n\n"
                f"Candidate topics:\n{json.dumps(candidates, indent=2)}\n\nSegment:\n{segment_text}"
            ),
            schema_name="topic_rerank",
            schema=RERANK_SCHEMA,
        )

        topic_id = response.get("topic_id")
        confidence = response.get("confidence")
        rationale = response.get("rationale")
        evidence = response.get("evidence_turns")

        if topic_id not in allowed:
            raise ValueError("LLM selected a topic outside the retrieved candidates")
        if not isinstance(confidence, (int, float)) or not 0 <= float(confidence) <= 1:
            raise ValueError("Topic confidence must be between zero and one")
        if not isinstance(rationale, str) or not rationale.strip():
            raise ValueError("Topic rationale is required")
        if not isinstance(evidence, list) or not evidence or any(not isinstance(item, int) for item in evidence):
            raise ValueError("Topic decision requires evidence turns")
        if any(item < segment["start_turn"] or item > segment["end_turn"] for item in evidence):
            raise ValueError("Topic evidence must fall inside the segment")
        if any(turns[item]["speaker"].lower() != "customer" for item in evidence):
            raise ValueError("Topic evidence must reference customer turns")

        top_similarity = candidates[0]["similarity"] if candidates else 0.0
        abstention_reasons = []

        if float(confidence) < self.minimum_confidence:
            abstention_reasons.append("low_llm_confidence")
        if top_similarity < self.minimum_similarity:
            abstention_reasons.append("low_embedding_similarity")
        if abstention_reasons:
            topic_id = "unknown_new_issue"

        return {
            "topic_id": topic_id,
            "topic_confidence": round(float(confidence), 4),
            "embedding_top_similarity": top_similarity,
            "topic_rationale": rationale.strip(),
            "topic_evidence_turns": sorted(set(evidence)),
            "candidate_topics": candidates,
            "abstention_reasons": abstention_reasons,
        }

class NormalizedEmbeddingRerankStrategy:
    """LLM-normalize an issue before embedding retrieval and LLM reranking."""

    strategy_id = "llm_normalization_embedding_retrieval_llm_reranking"

    def __init__(
        self,
        llm: JsonLLM,
        *,
        candidate_count: int = 4,
        minimum_confidence: float = 0.65,
        minimum_similarity: float = 0.18,
    ) -> None:
        self.llm = llm
        self.reranker = EmbeddingRerankStrategy(
            llm,
            candidate_count=candidate_count,
            minimum_confidence=minimum_confidence,
            minimum_similarity=minimum_similarity,
        )

    def classify(
        self,
        *,
        segment: dict,
        turns: list[dict],
        retriever: TaxonomyRetriever,
        taxonomy: tuple[TopicDefinition, ...],
    ) -> dict:
        response = self.llm.complete_json(
            system=(
                "Rewrite the customer's issue as one short, factual mortgage-servicing problem statement. "
                "Remove greetings, emotion, filler, and agent language. Do not add facts or choose a topic. "
                "Return only schema-valid JSON."
            ),
            user=f"Customer issue: {segment['issue_statement']}",
            schema_name="canonical_issue_normalization",
            schema=NORMALIZATION_SCHEMA,
        )

        canonical_issue = response.get("canonical_issue")
        if not isinstance(canonical_issue, str) or len(canonical_issue.strip()) < 4:
            raise ValueError("LLM canonical issue is missing")

        normalized_segment = {
            **segment,
            "issue_statement": canonical_issue.strip(),
        }

        result = self.reranker.classify(
            segment=normalized_segment,
            turns=turns,
            retriever=retriever,
            taxonomy=taxonomy,
        )

        return {
            **result,
            "normalized_issue_statement": canonical_issue.strip(),
        }

class EmbeddingLLMConsensusStrategy:
    """Accept a topic only when embedding retrieval and LLM reranking agree."""

    strategy_id = "embedding_llm_consensus"

    def __init__(
        self,
        llm: JsonLLM,
        *,
        candidate_count: int = 4,
        minimum_confidence: float = 0.65,
        minimum_similarity: float = 0.18,
    ) -> None:
        self.reranker = EmbeddingRerankStrategy(
            llm,
            candidate_count=candidate_count,
            minimum_confidence=minimum_confidence,
            minimum_similarity=minimum_similarity,
        )

    def classify(
        self,
        *,
        segment: dict,
        turns: list[dict],
        retriever: TaxonomyRetriever,
        taxonomy: tuple[TopicDefinition, ...],
    ) -> dict:
        result = self.reranker.classify(
            segment=segment,
            turns=turns,
            retriever=retriever,
            taxonomy=taxonomy,
        )

        candidates = result["candidate_topics"]
        embedding_top_topic_id = candidates[0]["topic_id"] if candidates else "unknown_new_issue"

        if result["topic_id"] == "unknown_new_issue":
            return {
                **result,
                "embedding_top_topic_id": embedding_top_topic_id,
            }

        if result["topic_id"] != embedding_top_topic_id:
            return {
                **result,
                "topic_id": "unknown_new_issue",
                "embedding_top_topic_id": embedding_top_topic_id,
                "abstention_reasons": [
                    *result["abstention_reasons"],
                    "embedding_llm_disagreement",
                ],
            }

        return {
            **result,
            "embedding_top_topic_id": embedding_top_topic_id,
        }

class LLMFirstEmbeddingVerifierStrategy:
    """Use an LLM for full-taxonomy classification, then verify it with embeddings."""

    strategy_id = "llm_first_embedding_verification"

    def __init__(
        self,
        llm: JsonLLM,
        *,
        candidate_count: int = 4,
        minimum_confidence: float = 0.65,
        minimum_similarity: float = 0.18,
    ) -> None:
        self.llm = llm
        self.candidate_count = candidate_count
        self.minimum_confidence = minimum_confidence
        self.minimum_similarity = minimum_similarity

    def classify(
        self,
        *,
        segment: dict,
        turns: list[dict],
        retriever: TaxonomyRetriever,
        taxonomy: tuple[TopicDefinition, ...],
    ) -> dict:
        candidates = retriever.retrieve(segment["issue_statement"], self.candidate_count)

        catalog = [
            {
                "topic_id": topic.topic_id,
                "name": topic.name,
                "description": topic.description,
                "examples": list(topic.examples),
            }
            for topic in taxonomy
        ]

        segment_text = "\n".join(
            f"[{index}] {turns[index]['speaker']}: {turns[index]['text']}"
            for index in range(segment["start_turn"], segment["end_turn"] + 1)
        )

        response = self.llm.complete_json(
            system=(
                "Choose the single best business topic for this customer-problem segment from the full approved taxonomy. "
                "Choose unknown_new_issue only when none of the topics fit. Evidence must reference customer turns inside "
                "the segment. Return only schema-valid JSON."
            ),
            user=(
                f"Normalized problem: {segment['issue_statement']}\n\n"
                f"Approved taxonomy:\n{json.dumps(catalog, indent=2)}\n\n"
                f"Segment:\n{segment_text}"
            ),
            schema_name="llm_first_topic_choice",
            schema=RERANK_SCHEMA,
        )

        topic_id = response.get("topic_id")
        confidence = response.get("confidence")
        rationale = response.get("rationale")
        evidence = response.get("evidence_turns")
        allowed = {topic.topic_id for topic in taxonomy} | {"unknown_new_issue"}

        if topic_id not in allowed:
            raise ValueError("LLM selected a topic outside the approved taxonomy")
        if not isinstance(confidence, (int, float)) or not 0 <= float(confidence) <= 1:
            raise ValueError("Topic confidence must be between zero and one")
        if not isinstance(rationale, str) or not rationale.strip():
            raise ValueError("Topic rationale is required")
        if not isinstance(evidence, list) or not evidence or any(not isinstance(item, int) for item in evidence):
            raise ValueError("Topic decision requires evidence turns")
        if any(item < segment["start_turn"] or item > segment["end_turn"] for item in evidence):
            raise ValueError("Topic evidence must fall inside the segment")
        if any(turns[item]["speaker"].lower() != "customer" for item in evidence):
            raise ValueError("Topic evidence must reference customer turns")

        embedding_match = next(
            (candidate for candidate in candidates if candidate["topic_id"] == topic_id),
            None,
        )

        abstention_reasons = []
        if topic_id == "unknown_new_issue":
            abstention_reasons.append("llm_selected_unknown")
        if float(confidence) < self.minimum_confidence:
            abstention_reasons.append("low_llm_confidence")
        if topic_id != "unknown_new_issue" and embedding_match is None:
            abstention_reasons.append("llm_label_not_embedding_supported")
        if embedding_match is not None and embedding_match["similarity"] < self.minimum_similarity:
            abstention_reasons.append("low_embedding_similarity")

        final_topic_id = "unknown_new_issue" if abstention_reasons else topic_id

        return {
            "topic_id": final_topic_id,
            "topic_confidence": round(float(confidence), 4),
            "embedding_top_similarity": candidates[0]["similarity"] if candidates else 0.0,
            "embedding_selected_similarity": embedding_match["similarity"] if embedding_match else None,
            "topic_rationale": rationale.strip(),
            "topic_evidence_turns": sorted(set(evidence)),
            "candidate_topics": candidates,
            "abstention_reasons": abstention_reasons,
        }

class ExampleRetrievalLLMRerankStrategy:
    """Retrieve similar labeled examples with embeddings, then let the LLM choose."""

    strategy_id = "embedding_example_retrieval_llm_reranking"

    def __init__(
        self,
        llm: JsonLLM,
        *,
        example_count: int = 6,
        minimum_confidence: float = 0.65,
        minimum_similarity: float = 0.18,
    ) -> None:
        self.llm = llm
        self.example_count = example_count
        self.minimum_confidence = minimum_confidence
        self.minimum_similarity = minimum_similarity
        self._taxonomy_signature: tuple | None = None
        self._example_records: list[dict] = []
        self._example_embeddings: np.ndarray | None = None

    def _load_example_catalog(
        self,
        taxonomy: tuple[TopicDefinition, ...],
        retriever: TaxonomyRetriever,
    ) -> None:
        signature = tuple(
            (topic.topic_id, topic.name, topic.description, topic.examples)
            for topic in taxonomy
        )

        if signature == self._taxonomy_signature:
            return

        self._example_records = [
            {
                "topic_id": topic.topic_id,
                "name": topic.name,
                "description": topic.description,
                "example": example,
            }
            for topic in taxonomy
            for example in topic.examples
        ]

        self._example_embeddings = np.asarray(
            retriever.embed([record["example"] for record in self._example_records]),
            dtype=float,
        )
        self._taxonomy_signature = signature

    def classify(
        self,
        *,
        segment: dict,
        turns: list[dict],
        retriever: TaxonomyRetriever,
        taxonomy: tuple[TopicDefinition, ...],
    ) -> dict:
        self._load_example_catalog(taxonomy, retriever)

        if self._example_embeddings is None or not self._example_records:
            raise ValueError("Example catalog is unavailable")

        query = retriever.embed([segment["issue_statement"]])[0]
        query_norm = np.linalg.norm(query)
        example_norms = np.linalg.norm(self._example_embeddings, axis=1)
        scores = (self._example_embeddings @ query) / np.maximum(
            query_norm * example_norms,
            1e-12,
        )

        ranked_indexes = np.argsort(-scores)[: max(1, min(self.example_count, len(self._example_records)))]

        retrieved_examples = [
            {
                **self._example_records[index],
                "similarity": round(float(scores[index]), 4),
            }
            for index in ranked_indexes
        ]

        candidate_by_topic: dict[str, dict] = {}
        for example in retrieved_examples:
            topic_id = example["topic_id"]
            if topic_id not in candidate_by_topic:
                candidate_by_topic[topic_id] = {
                    "topic_id": topic_id,
                    "name": example["name"],
                    "description": example["description"],
                    "similarity": example["similarity"],
                    "retrieved_examples": [],
                }

            candidate_by_topic[topic_id]["retrieved_examples"].append(example["example"])

        candidates = list(candidate_by_topic.values())
        allowed = {candidate["topic_id"] for candidate in candidates} | {"unknown_new_issue"}

        segment_text = "\n".join(
            f"[{index}] {turns[index]['speaker']}: {turns[index]['text']}"
            for index in range(segment["start_turn"], segment["end_turn"] + 1)
        )

        response = self.llm.complete_json(
            system=(
                "Choose the single best business topic for this customer-problem segment using the retrieved labeled "
                "examples. Choose unknown_new_issue if none of the examples actually fit. Evidence must reference "
                "customer turns inside the segment. Return only schema-valid JSON."
            ),
            user=(
                f"Customer issue: {segment['issue_statement']}\n\n"
                f"Retrieved labeled examples:\n{json.dumps(retrieved_examples, indent=2)}\n\n"
                f"Segment:\n{segment_text}"
            ),
            schema_name="example_retrieval_topic_rerank",
            schema=RERANK_SCHEMA,
        )

        topic_id = response.get("topic_id")
        confidence = response.get("confidence")
        rationale = response.get("rationale")
        evidence = response.get("evidence_turns")

        if topic_id not in allowed:
            raise ValueError("LLM selected a topic outside the retrieved examples")
        if not isinstance(confidence, (int, float)) or not 0 <= float(confidence) <= 1:
            raise ValueError("Topic confidence must be between zero and one")
        if not isinstance(rationale, str) or not rationale.strip():
            raise ValueError("Topic rationale is required")
        if not isinstance(evidence, list) or not evidence or any(not isinstance(item, int) for item in evidence):
            raise ValueError("Topic decision requires evidence turns")
        if any(item < segment["start_turn"] or item > segment["end_turn"] for item in evidence):
            raise ValueError("Topic evidence must fall inside the segment")
        if any(turns[item]["speaker"].lower() != "customer" for item in evidence):
            raise ValueError("Topic evidence must reference customer turns")

        top_similarity = retrieved_examples[0]["similarity"] if retrieved_examples else 0.0
        abstention_reasons = []

        if float(confidence) < self.minimum_confidence:
            abstention_reasons.append("low_llm_confidence")
        if top_similarity < self.minimum_similarity:
            abstention_reasons.append("low_example_similarity")

        if abstention_reasons:
            topic_id = "unknown_new_issue"

        return {
            "topic_id": topic_id,
            "topic_confidence": round(float(confidence), 4),
            "embedding_top_similarity": top_similarity,
            "topic_rationale": rationale.strip(),
            "topic_evidence_turns": sorted(set(evidence)),
            "candidate_topics": candidates,
            "retrieved_examples": retrieved_examples,
            "abstention_reasons": abstention_reasons,
        }


class NormalizedLogisticRegressionStrategy:
    """Normalize the issue with an LLM, then classify it with logistic regression."""

    strategy_id = "llm_normalization_logistic_regression"

    def __init__(
        self,
        llm: JsonLLM,
        classifier: ProbabilisticTopicClassifier,
        *,
        candidate_count: int = 4,
        minimum_confidence: float = 0.65,
    ) -> None:
        self.llm = llm
        self.classifier = classifier
        self.candidate_count = candidate_count
        self.minimum_confidence = minimum_confidence

    def classify(
        self,
        *,
        segment: dict,
        turns: list[dict],
        retriever: TaxonomyRetriever,
        taxonomy: tuple[TopicDefinition, ...],
    ) -> dict:
        response = self.llm.complete_json(
            system=(
                "Rewrite the customer's issue as one short, factual mortgage-servicing problem statement. "
                "Remove greetings, emotion, filler, and agent language. Do not add facts or choose a topic. "
                "Return only schema-valid JSON."
            ),
            user=f"Customer issue: {segment['issue_statement']}",
            schema_name="canonical_issue_normalization",
            schema=NORMALIZATION_SCHEMA,
        )

        canonical_issue = response.get("canonical_issue")
        if not isinstance(canonical_issue, str) or len(canonical_issue.strip()) < 4:
            raise ValueError("LLM canonical issue is missing")
        canonical_issue = canonical_issue.strip()

        probabilities = np.asarray(
            self.classifier.predict_proba([canonical_issue]),
            dtype=float,
        )
        if probabilities.shape[0] != 1:
            raise ValueError("Supervised classifier must return one probability row")

        labels = [str(label) for label in self.classifier.classes_]
        scores = probabilities[0]
        if len(labels) != len(scores):
            raise ValueError("Supervised classifier labels do not match probabilities")

        topics_by_id = {topic.topic_id: topic for topic in taxonomy}
        unknown_labels = [label for label in labels if label not in topics_by_id]
        if unknown_labels:
            raise ValueError("Supervised classifier returned labels outside the taxonomy")

        ranked = sorted(
            zip(labels, scores),
            key=lambda item: -float(item[1]),
        )[: max(1, min(self.candidate_count, len(labels)))]

        candidates = [
            {
                "topic_id": topic_id,
                "name": topics_by_id[topic_id].name,
                "description": topics_by_id[topic_id].description,
                "probability": round(float(probability), 4),
            }
            for topic_id, probability in ranked
        ]

        top_candidate = candidates[0]
        abstention_reasons = []
        if top_candidate["probability"] < self.minimum_confidence:
            abstention_reasons.append("low_logistic_regression_confidence")

        return {
            "topic_id": (
                "unknown_new_issue"
                if abstention_reasons
                else top_candidate["topic_id"]
            ),
            "topic_confidence": top_candidate["probability"],
            "topic_rationale": (
                "Logistic regression classified the LLM-normalized customer issue "
                f"as {top_candidate['name']}."
            ),
            "topic_evidence_turns": segment["issue_evidence_turns"],
            "candidate_topics": candidates,
            "abstention_reasons": abstention_reasons,
            "normalized_issue_statement": canonical_issue,
            "supervised_top_probability": top_candidate["probability"],
        }

class LogisticRegressionLLMRerankStrategy:
    """Use logistic-regression top candidates, then let the LLM choose among them."""

    strategy_id = "logistic_regression_top_k_llm_reranking"

    def __init__(
        self,
        llm: JsonLLM,
        classifier: ProbabilisticTopicClassifier,
        *,
        candidate_count: int = 4,
        minimum_confidence: float = 0.65,
        minimum_probability: float = 0.18,
    ) -> None:
        self.llm = llm
        self.classifier = classifier
        self.candidate_count = candidate_count
        self.minimum_confidence = minimum_confidence
        self.minimum_probability = minimum_probability

    def classify(
        self,
        *,
        segment: dict,
        turns: list[dict],
        retriever: TaxonomyRetriever,
        taxonomy: tuple[TopicDefinition, ...],
    ) -> dict:
        probabilities = np.asarray(
            self.classifier.predict_proba([segment["issue_statement"]]),
            dtype=float,
        )
        if probabilities.shape[0] != 1:
            raise ValueError("Supervised classifier must return one probability row")

        labels = [str(label) for label in self.classifier.classes_]
        scores = probabilities[0]
        if len(labels) != len(scores):
            raise ValueError("Supervised classifier labels do not match probabilities")

        topics_by_id = {topic.topic_id: topic for topic in taxonomy}
        unknown_labels = [label for label in labels if label not in topics_by_id]
        if unknown_labels:
            raise ValueError("Supervised classifier returned labels outside the taxonomy")

        ranked = sorted(
            zip(labels, scores),
            key=lambda item: -float(item[1]),
        )[: max(1, min(self.candidate_count, len(labels)))]

        candidates = [
            {
                "topic_id": topic_id,
                "name": topics_by_id[topic_id].name,
                "description": topics_by_id[topic_id].description,
                "probability": round(float(probability), 4),
            }
            for topic_id, probability in ranked
        ]
        allowed = {candidate["topic_id"] for candidate in candidates} | {
            "unknown_new_issue"
        }

        segment_text = "\n".join(
            f"[{index}] {turns[index]['speaker']}: {turns[index]['text']}"
            for index in range(segment["start_turn"], segment["end_turn"] + 1)
        )

        response = self.llm.complete_json(
            system=(
                "Choose the single best business topic for this customer-problem segment "
                "from the supplied logistic-regression candidates. Similar vocabulary is "
                "not enough; use the customer's actual goal. Choose unknown_new_issue if "
                "none fit. Evidence must reference customer turns inside the segment. "
                "Return only schema-valid JSON."
            ),
            user=(
                f"Customer issue: {segment['issue_statement']}\n\n"
                f"Logistic-regression candidates:\n{json.dumps(candidates, indent=2)}\n\n"
                f"Segment:\n{segment_text}"
            ),
            schema_name="logistic_regression_topic_rerank",
            schema=RERANK_SCHEMA,
        )

        topic_id = response.get("topic_id")
        confidence = response.get("confidence")
        rationale = response.get("rationale")
        evidence = response.get("evidence_turns")

        if topic_id not in allowed:
            raise ValueError("LLM selected a topic outside the logistic-regression candidates")
        if not isinstance(confidence, (int, float)) or not 0 <= float(confidence) <= 1:
            raise ValueError("Topic confidence must be between zero and one")
        if not isinstance(rationale, str) or not rationale.strip():
            raise ValueError("Topic rationale is required")
        if not isinstance(evidence, list) or not evidence or any(
            not isinstance(item, int) for item in evidence
        ):
            raise ValueError("Topic decision requires evidence turns")
        if any(
            item < segment["start_turn"] or item > segment["end_turn"]
            for item in evidence
        ):
            raise ValueError("Topic evidence must fall inside the segment")
        if any(turns[item]["speaker"].lower() != "customer" for item in evidence):
            raise ValueError("Topic evidence must reference customer turns")

        selected_candidate = next(
            (candidate for candidate in candidates if candidate["topic_id"] == topic_id),
            None,
        )
        abstention_reasons = []

        if topic_id == "unknown_new_issue":
            abstention_reasons.append("llm_selected_unknown")
        if float(confidence) < self.minimum_confidence:
            abstention_reasons.append("low_llm_confidence")
        if (
            selected_candidate is not None
            and selected_candidate["probability"] < self.minimum_probability
        ):
            abstention_reasons.append("low_logistic_regression_probability")

        return {
            "topic_id": "unknown_new_issue" if abstention_reasons else topic_id,
            "topic_confidence": round(float(confidence), 4),
            "topic_rationale": rationale.strip(),
            "topic_evidence_turns": sorted(set(evidence)),
            "candidate_topics": candidates,
            "abstention_reasons": abstention_reasons,
            "supervised_top_probability": candidates[0]["probability"],
        }

class SVMTopKLLMRerankStrategy:
    """Use LinearSVC top candidates, then let the LLM choose among them."""

    strategy_id = "svm_top_k_llm_reranking"

    def __init__(
        self,
        llm: JsonLLM,
        classifier: DecisionFunctionTopicClassifier,
        *,
        candidate_count: int = 4,
        minimum_confidence: float = 0.65,
    ) -> None:
        self.llm = llm
        self.classifier = classifier
        self.candidate_count = candidate_count
        self.minimum_confidence = minimum_confidence

    def classify(
        self,
        *,
        segment: dict,
        turns: list[dict],
        retriever: TaxonomyRetriever,
        taxonomy: tuple[TopicDefinition, ...],
    ) -> dict:
        score_matrix = np.asarray(
            self.classifier.decision_function([segment["issue_statement"]]),
            dtype=float,
        )
        if score_matrix.ndim != 2 or score_matrix.shape[0] != 1:
            raise ValueError("SVM classifier must return one score row")

        labels = [str(label) for label in self.classifier.classes_]
        scores = score_matrix[0]
        if len(labels) != len(scores):
            raise ValueError("SVM classifier labels do not match decision scores")

        topics_by_id = {topic.topic_id: topic for topic in taxonomy}
        unknown_labels = [label for label in labels if label not in topics_by_id]
        if unknown_labels:
            raise ValueError("SVM classifier returned labels outside the taxonomy")

        ranked = sorted(
            zip(labels, scores),
            key=lambda item: -float(item[1]),
        )[: max(1, min(self.candidate_count, len(labels)))]

        candidates = [
            {
                "topic_id": topic_id,
                "name": topics_by_id[topic_id].name,
                "description": topics_by_id[topic_id].description,
                "decision_score": round(float(score), 4),
            }
            for topic_id, score in ranked
        ]
        allowed = {candidate["topic_id"] for candidate in candidates} | {
            "unknown_new_issue"
        }

        segment_text = "\n".join(
            f"[{index}] {turns[index]['speaker']}: {turns[index]['text']}"
            for index in range(segment["start_turn"], segment["end_turn"] + 1)
        )

        response = self.llm.complete_json(
            system=(
                "Choose the single best business topic for this customer-problem segment "
                "from the supplied SVM candidates. Similar vocabulary is not enough; use "
                "the customer's actual goal. Choose unknown_new_issue if none fit. "
                "Evidence must reference customer turns inside the segment. "
                "Return only schema-valid JSON."
            ),
            user=(
                f"Customer issue: {segment['issue_statement']}\n\n"
                f"SVM candidates:\n{json.dumps(candidates, indent=2)}\n\n"
                f"Segment:\n{segment_text}"
            ),
            schema_name="svm_topic_rerank",
            schema=RERANK_SCHEMA,
        )

        topic_id = response.get("topic_id")
        confidence = response.get("confidence")
        rationale = response.get("rationale")
        evidence = response.get("evidence_turns")

        if topic_id not in allowed:
            raise ValueError("LLM selected a topic outside the SVM candidates")
        if not isinstance(confidence, (int, float)) or not 0 <= float(confidence) <= 1:
            raise ValueError("Topic confidence must be between zero and one")
        if not isinstance(rationale, str) or not rationale.strip():
            raise ValueError("Topic rationale is required")
        if not isinstance(evidence, list) or not evidence or any(
            not isinstance(item, int) for item in evidence
        ):
            raise ValueError("Topic decision requires evidence turns")
        if any(
            item < segment["start_turn"] or item > segment["end_turn"]
            for item in evidence
        ):
            raise ValueError("Topic evidence must fall inside the segment")
        if any(turns[item]["speaker"].lower() != "customer" for item in evidence):
            raise ValueError("Topic evidence must reference customer turns")

        abstention_reasons = []
        if topic_id == "unknown_new_issue":
            abstention_reasons.append("llm_selected_unknown")
        if float(confidence) < self.minimum_confidence:
            abstention_reasons.append("low_llm_confidence")

        return {
            "topic_id": "unknown_new_issue" if abstention_reasons else topic_id,
            "topic_confidence": round(float(confidence), 4),
            "topic_rationale": rationale.strip(),
            "topic_evidence_turns": sorted(set(evidence)),
            "candidate_topics": candidates,
            "abstention_reasons": abstention_reasons,
            "supervised_top_margin": candidates[0]["decision_score"],
        }

class MLEnsembleLLMArbitrationStrategy:
    """Let multiple ML models vote, then have an LLM arbitrate among their choices."""

    strategy_id = "ml_ensemble_vote_llm_arbitration"

    def __init__(
        self,
        llm: JsonLLM,
        classifiers: dict[str, TopicLabelClassifier],
        *,
        candidate_count: int = 4,
        minimum_confidence: float = 0.65,
    ) -> None:
        if not classifiers:
            raise ValueError("At least one supervised classifier is required")
        self.llm = llm
        self.classifiers = classifiers
        self.candidate_count = candidate_count
        self.minimum_confidence = minimum_confidence

    def classify(
        self,
        *,
        segment: dict,
        turns: list[dict],
        retriever: TaxonomyRetriever,
        taxonomy: tuple[TopicDefinition, ...],
    ) -> dict:
        topics_by_id = {topic.topic_id: topic for topic in taxonomy}
        votes_by_topic: dict[str, list[str]] = {}
        model_votes: dict[str, str] = {}

        for model_name, classifier in self.classifiers.items():
            predictions = list(classifier.predict([segment["issue_statement"]]))
            if len(predictions) != 1:
                raise ValueError("Ensemble classifier must return one prediction")

            topic_id = str(predictions[0])
            if topic_id not in topics_by_id:
                raise ValueError("Ensemble classifier returned a label outside the taxonomy")

            model_votes[model_name] = topic_id
            votes_by_topic.setdefault(topic_id, []).append(model_name)

        ranked_topics = sorted(
            votes_by_topic.items(),
            key=lambda item: (-len(item[1]), item[0]),
        )[: max(1, min(self.candidate_count, len(votes_by_topic)))]

        candidates = [
            {
                "topic_id": topic_id,
                "name": topics_by_id[topic_id].name,
                "description": topics_by_id[topic_id].description,
                "vote_count": len(voters),
                "voters": sorted(voters),
            }
            for topic_id, voters in ranked_topics
        ]
        allowed = {candidate["topic_id"] for candidate in candidates} | {
            "unknown_new_issue"
        }

        segment_text = "\n".join(
            f"[{index}] {turns[index]['speaker']}: {turns[index]['text']}"
            for index in range(segment["start_turn"], segment["end_turn"] + 1)
        )

        response = self.llm.complete_json(
            system=(
                "Choose the single best business topic for this customer-problem segment "
                "from the supplied ensemble-vote candidates. Use the customer's actual "
                "goal and transcript evidence to arbitrate between models. Choose "
                "unknown_new_issue if none fit. Evidence must reference customer turns "
                "inside the segment. Return only schema-valid JSON."
            ),
            user=(
                f"Customer issue: {segment['issue_statement']}\n\n"
                f"Ensemble candidates:\n{json.dumps(candidates, indent=2)}\n\n"
                f"Individual model votes:\n{json.dumps(model_votes, indent=2)}\n\n"
                f"Segment:\n{segment_text}"
            ),
            schema_name="ml_ensemble_topic_arbitration",
            schema=RERANK_SCHEMA,
        )

        topic_id = response.get("topic_id")
        confidence = response.get("confidence")
        rationale = response.get("rationale")
        evidence = response.get("evidence_turns")

        if topic_id not in allowed:
            raise ValueError("LLM selected a topic outside the ensemble candidates")
        if not isinstance(confidence, (int, float)) or not 0 <= float(confidence) <= 1:
            raise ValueError("Topic confidence must be between zero and one")
        if not isinstance(rationale, str) or not rationale.strip():
            raise ValueError("Topic rationale is required")
        if not isinstance(evidence, list) or not evidence or any(
            not isinstance(item, int) for item in evidence
        ):
            raise ValueError("Topic decision requires evidence turns")
        if any(
            item < segment["start_turn"] or item > segment["end_turn"]
            for item in evidence
        ):
            raise ValueError("Topic evidence must fall inside the segment")
        if any(turns[item]["speaker"].lower() != "customer" for item in evidence):
            raise ValueError("Topic evidence must reference customer turns")

        abstention_reasons = []
        if topic_id == "unknown_new_issue":
            abstention_reasons.append("llm_selected_unknown")
        if float(confidence) < self.minimum_confidence:
            abstention_reasons.append("low_llm_confidence")

        return {
            "topic_id": "unknown_new_issue" if abstention_reasons else topic_id,
            "topic_confidence": round(float(confidence), 4),
            "topic_rationale": rationale.strip(),
            "topic_evidence_turns": sorted(set(evidence)),
            "candidate_topics": candidates,
            "abstention_reasons": abstention_reasons,
            "ensemble_model_votes": model_votes,
            "ensemble_top_vote_count": candidates[0]["vote_count"],
        }

class EmbeddingSupervisedLLMConsensusStrategy:
    """Require agreement between embeddings, supervised ML, and LLM reranking."""

    strategy_id = "embedding_supervised_ml_llm_consensus"

    def __init__(
        self,
        llm: JsonLLM,
        classifier: ProbabilisticTopicClassifier,
        *,
        candidate_count: int = 4,
        minimum_confidence: float = 0.65,
        minimum_similarity: float = 0.18,
        minimum_probability: float = 0.18,
    ) -> None:
        self.llm = llm
        self.classifier = classifier
        self.candidate_count = candidate_count
        self.minimum_confidence = minimum_confidence
        self.minimum_similarity = minimum_similarity
        self.minimum_probability = minimum_probability

    def classify(
        self,
        *,
        segment: dict,
        turns: list[dict],
        retriever: TaxonomyRetriever,
        taxonomy: tuple[TopicDefinition, ...],
    ) -> dict:
        embedding_candidates = retriever.retrieve(
            segment["issue_statement"],
            self.candidate_count,
        )

        probabilities = np.asarray(
            self.classifier.predict_proba([segment["issue_statement"]]),
            dtype=float,
        )
        if probabilities.shape[0] != 1:
            raise ValueError("Supervised classifier must return one probability row")

        labels = [str(label) for label in self.classifier.classes_]
        scores = probabilities[0]
        if len(labels) != len(scores):
            raise ValueError("Supervised classifier labels do not match probabilities")

        topics_by_id = {topic.topic_id: topic for topic in taxonomy}
        unknown_labels = [label for label in labels if label not in topics_by_id]
        if unknown_labels:
            raise ValueError("Supervised classifier returned labels outside the taxonomy")

        ranked_ml = sorted(
            zip(labels, scores),
            key=lambda item: -float(item[1]),
        )[: max(1, min(self.candidate_count, len(labels)))]

        ml_candidates = [
            {
                "topic_id": topic_id,
                "name": topics_by_id[topic_id].name,
                "description": topics_by_id[topic_id].description,
                "probability": round(float(probability), 4),
            }
            for topic_id, probability in ranked_ml
        ]

        combined_by_topic: dict[str, dict] = {}

        for candidate in embedding_candidates:
            combined_by_topic[candidate["topic_id"]] = {
                "topic_id": candidate["topic_id"],
                "name": candidate["name"],
                "description": candidate["description"],
                "embedding_similarity": candidate["similarity"],
                "logistic_regression_probability": None,
            }

        for candidate in ml_candidates:
            combined_by_topic.setdefault(
                candidate["topic_id"],
                {
                    "topic_id": candidate["topic_id"],
                    "name": candidate["name"],
                    "description": candidate["description"],
                    "embedding_similarity": None,
                    "logistic_regression_probability": None,
                },
            )
            combined_by_topic[candidate["topic_id"]][
                "logistic_regression_probability"
            ] = candidate["probability"]

        candidates = list(combined_by_topic.values())
        allowed = {candidate["topic_id"] for candidate in candidates} | {
            "unknown_new_issue"
        }

        segment_text = "\n".join(
            f"[{index}] {turns[index]['speaker']}: {turns[index]['text']}"
            for index in range(segment["start_turn"], segment["end_turn"] + 1)
        )

        response = self.llm.complete_json(
            system=(
                "Choose the single best business topic for this customer-problem segment "
                "using the supplied embedding and logistic-regression evidence. Similar "
                "vocabulary is not enough; use the customer's actual goal. Choose "
                "unknown_new_issue if none fit. Evidence must reference customer turns "
                "inside the segment. Return only schema-valid JSON."
            ),
            user=(
                f"Customer issue: {segment['issue_statement']}\n\n"
                f"Combined embedding and supervised-ML candidates:\n"
                f"{json.dumps(candidates, indent=2)}\n\n"
                f"Segment:\n{segment_text}"
            ),
            schema_name="embedding_supervised_ml_topic_consensus",
            schema=RERANK_SCHEMA,
        )

        topic_id = response.get("topic_id")
        confidence = response.get("confidence")
        rationale = response.get("rationale")
        evidence = response.get("evidence_turns")

        if topic_id not in allowed:
            raise ValueError("LLM selected a topic outside the combined candidates")
        if not isinstance(confidence, (int, float)) or not 0 <= float(confidence) <= 1:
            raise ValueError("Topic confidence must be between zero and one")
        if not isinstance(rationale, str) or not rationale.strip():
            raise ValueError("Topic rationale is required")
        if not isinstance(evidence, list) or not evidence or any(
            not isinstance(item, int) for item in evidence
        ):
            raise ValueError("Topic decision requires evidence turns")
        if any(
            item < segment["start_turn"] or item > segment["end_turn"]
            for item in evidence
        ):
            raise ValueError("Topic evidence must fall inside the segment")
        if any(turns[item]["speaker"].lower() != "customer" for item in evidence):
            raise ValueError("Topic evidence must reference customer turns")

        embedding_top_topic_id = embedding_candidates[0]["topic_id"]
        embedding_top_similarity = embedding_candidates[0]["similarity"]
        ml_top_topic_id = ml_candidates[0]["topic_id"]
        ml_top_probability = ml_candidates[0]["probability"]

        abstention_reasons = []
        if topic_id == "unknown_new_issue":
            abstention_reasons.append("llm_selected_unknown")
        if float(confidence) < self.minimum_confidence:
            abstention_reasons.append("low_llm_confidence")
        if embedding_top_similarity < self.minimum_similarity:
            abstention_reasons.append("low_embedding_similarity")
        if ml_top_probability < self.minimum_probability:
            abstention_reasons.append("low_logistic_regression_probability")
        if embedding_top_topic_id != ml_top_topic_id:
            abstention_reasons.append("embedding_logistic_regression_disagreement")
        if topic_id != "unknown_new_issue" and topic_id != embedding_top_topic_id:
            abstention_reasons.append("embedding_llm_disagreement")
        if topic_id != "unknown_new_issue" and topic_id != ml_top_topic_id:
            abstention_reasons.append("logistic_regression_llm_disagreement")

        return {
            "topic_id": "unknown_new_issue" if abstention_reasons else topic_id,
            "topic_confidence": round(float(confidence), 4),
            "embedding_top_similarity": embedding_top_similarity,
            "supervised_top_probability": ml_top_probability,
            "embedding_top_topic_id": embedding_top_topic_id,
            "supervised_top_topic_id": ml_top_topic_id,
            "topic_rationale": rationale.strip(),
            "topic_evidence_turns": sorted(set(evidence)),
            "candidate_topics": candidates,
            "abstention_reasons": abstention_reasons,
        }

class HybridTopicModeler:
    def __init__(
        self,
        llm: JsonLLM,
        *,
        taxonomy: tuple[TopicDefinition, ...] = DEFAULT_TAXONOMY,
        candidate_count: int = 4,
        minimum_confidence: float = 0.65,
        minimum_similarity: float = 0.18,
        strategy: TopicClassificationStrategy | None = None,
    ) -> None:
        self.llm = llm
        self.taxonomy = taxonomy
        self.topic_ids = {topic.topic_id for topic in taxonomy}
        self.retriever = TaxonomyRetriever(taxonomy)
        self.candidate_count = candidate_count
        self.minimum_confidence = minimum_confidence
        self.minimum_similarity = minimum_similarity
        self.strategy = strategy or EmbeddingRerankStrategy(llm,
                                                            candidate_count=candidate_count,
                                                            minimum_confidence=minimum_confidence,
                                                            minimum_similarity=minimum_similarity,
                                                            )

    @staticmethod
    def _numbered_transcript(turns: list[dict]) -> str:
        return "\n".join(f"[{index}] {turn['speaker']}: {turn['text']}" for index, turn in enumerate(turns))

    def segment(self, turns: list[dict]) -> list[dict]:
        if not turns:
            return []
        response = self.llm.complete_json(
            system=(
                "You segment customer-service calls by customer problem. A segment must contain one coherent customer "
                "problem and the agent response to it. Keep a long discussion of one problem as one segment. Start a new "
                "segment only when the customer introduces a genuinely different problem. Ignore greetings, verification, "
                "and closing pleasantries. Ground every issue statement in customer turns. Return only schema-valid JSON."
            ),
            user=f"Segment this numbered transcript into customer problems:\n\n{self._numbered_transcript(turns)}",
            schema_name="call_issue_segments",
            schema=SEGMENTATION_SCHEMA,
        )
        return self._validate_segments(response, turns)

    def _validate_segments(self, response: dict, turns: list[dict]) -> list[dict]:
        raw_segments = response.get("segments")
        if not isinstance(raw_segments, list) or not raw_segments:
            raise ValueError("LLM segmentation must include at least one segment")
        validated = []
        previous_end = -1
        for index, segment in enumerate(raw_segments, start=1):
            if not isinstance(segment, dict):
                raise ValueError("Every segment must be an object")
            start = segment.get("start_turn")
            end = segment.get("end_turn")
            statement = segment.get("issue_statement")
            evidence = segment.get("issue_evidence_turns")
            if not isinstance(start, int) or not isinstance(end, int) or not 0 <= start <= end < len(turns):
                raise ValueError("Segment turn range is invalid")
            if start <= previous_end:
                raise ValueError("LLM segments must be sorted and non-overlapping")
            if not isinstance(statement, str) or len(statement.strip()) < 4:
                raise ValueError("Segment issue statement is missing")
            if not isinstance(evidence, list) or not evidence or any(not isinstance(item, int) for item in evidence):
                raise ValueError("Segment requires evidence turn IDs")
            if any(item < start or item > end for item in evidence):
                raise ValueError("Issue evidence must fall inside its segment")
            if any(turns[item]["speaker"].lower() != "customer" for item in evidence):
                raise ValueError("Issue evidence must reference customer turns")
            validated.append(
                {
                    "segment_index": index,
                    "start_turn": start,
                    "end_turn": end,
                    "issue_statement": statement.strip(),
                    "issue_evidence_turns": sorted(set(evidence)),
                }
            )
            previous_end = end
        return validated

    def classify_segment(self, segment: dict, turns: list[dict]) -> dict:
        return {
            **segment,
            **self.strategy.classify(
                segment=segment,
                turns=turns,
                retriever=self.retriever,
                taxonomy=self.taxonomy,
            ),
        }

    def analyze_call(self, call: dict) -> dict:
        turns = call.get("turns")
        if not isinstance(turns, list) or not turns:
            raise ValueError("Call must contain a non-empty turns list")
        normalized_turns = []
        for turn in turns:
            if not isinstance(turn, dict) or str(turn.get("speaker", "")).lower() not in {"customer", "agent"}:
                raise ValueError("Every turn must contain Customer or Agent speaker and text")
            text = str(turn.get("text", "")).strip()
            if not text:
                raise ValueError("Turn text cannot be empty")
            normalized_turns.append({"speaker": str(turn["speaker"]).title(), "text": text})
        segments = [self.classify_segment(segment, normalized_turns) for segment in self.segment(normalized_turns)]
        return {
            "call_id": str(call.get("call_id") or "unknown-call"),
            "modeling_method": f"llm_segmentation_{self.strategy.strategy_id}",
            "segments": segments,
        }

    def cluster_unknown_segments(self, segments: list[dict], minimum_cluster_size: int = 3) -> list[dict]:
        unknown = [segment for segment in segments if segment.get("topic_id") == "unknown_new_issue"]
        if len(unknown) < minimum_cluster_size:
            return []
        embeddings = self.retriever.embed([segment["issue_statement"] for segment in unknown])
        labels = HDBSCAN(min_cluster_size=minimum_cluster_size, metric="euclidean").fit_predict(embeddings)
        clusters = []
        for cluster_label in sorted(set(int(label) for label in labels if label >= 0)):
            members = [segment for segment, label in zip(unknown, labels) if int(label) == cluster_label]
            statements = [member["issue_statement"] for member in members]
            response = self.llm.complete_json(
                system=(
                    "Name a proposed customer-service issue cluster. Decide whether the examples describe one coherent "
                    "customer goal. Use a concise neutral name and do not invent facts."
                ),
                user=f"Issue statements:\n{json.dumps(statements, indent=2)}",
                schema_name="unknown_topic_cluster",
                schema=CLUSTER_LABEL_SCHEMA,
            )
            clusters.append(
                {
                    "cluster_id": f"PROPOSED-{cluster_label + 1:04d}",
                    "name": str(response.get("name", "")).strip(),
                    "description": str(response.get("description", "")).strip(),
                    "coherent": bool(response.get("coherent")),
                    "sample_size": len(members),
                    "call_ids": sorted({member.get("call_id", "") for member in members if member.get("call_id")}),
                    "issue_statements": statements[:10],
                    "status": "requires_human_review",
                }
            )
        return clusters


def segmentation_batch_task(call: dict, model: str) -> dict:
    turns = call.get("turns") or []
    numbered = HybridTopicModeler._numbered_transcript(turns)
    return {
        "custom_id": str(call.get("call_id") or "unknown-call"),
        "method": "POST",
        "url": "/v1/chat/completions",
        "body": {
            "model": model,
            "temperature": 0,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Segment this customer-service call by coherent customer problem. Keep a long discussion of one "
                        "problem together, split genuinely different problems, ignore greetings and verification, and ground "
                        "every issue statement in customer turn IDs. Return only schema-valid JSON."
                    ),
                },
                {"role": "user", "content": f"Segment this numbered transcript:\n\n{numbered}"},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "call_issue_segments", "strict": True, "schema": SEGMENTATION_SCHEMA},
            },
        },
    }


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(row, ensure_ascii=True) for row in rows) + "\n", encoding="utf-8")


def api_key_from_env(variable_name: str) -> str | None:
    value = os.getenv(variable_name)
    if value and value.strip():
        return value.strip()
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return None
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, candidate = line.split("=", 1)
        if key.strip() == variable_name:
            cleaned = candidate.strip().strip('"').strip("'")
            return cleaned or None
    return None


def configured_value(variable_name: str) -> str | None:
    return api_key_from_env(variable_name)
