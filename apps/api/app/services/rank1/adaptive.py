from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    left_norm = np.linalg.norm(left)
    right_norm = np.linalg.norm(right)
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0
    return float(np.dot(left, right) / (left_norm * right_norm))


@dataclass
class IssueAssignment:
    cluster_id: str
    label: str
    similarity: float
    created_new_cluster: bool


class HuggingFaceAdaptiveEngine:
    def __init__(self) -> None:
        test_mode = bool(os.getenv("PYTEST_CURRENT_TEST")) or any("unittest" in argument for argument in sys.argv)
        self.enabled = os.getenv("RANK1_ENABLE_HF", "1") != "0" and not test_mode
        if self.enabled:
            os.environ.setdefault("HF_HUB_OFFLINE", "1")
            os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
        self.deep_llm_enabled = os.getenv("RANK1_ENABLE_DEEP_LLM", "0") == "1"
        self.embedding_model_name = os.getenv("RANK1_HF_EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
        self.text_model_name = os.getenv("RANK1_HF_TEXT2TEXT_MODEL", "google/flan-t5-small")
        self.sentiment_model_name = os.getenv(
            "RANK1_HF_SENTIMENT_MODEL",
            "cardiffnlp/twitter-roberta-base-sentiment-latest",
        )
        self._generator_model = None
        self._generator_tokenizer = None
        self._sentiment = None
        self._embedder = None
        self._fallback_embedder = HashingVectorizer(n_features=512, alternate_sign=False, norm="l2")
        self._catalog_cache: dict[str, list[list[float]]] = {}

    def _load_generator(self):
        if not self.enabled or self._generator_model is not None:
            return self._generator_model, self._generator_tokenizer
        try:
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer  # type: ignore

            self._generator_tokenizer = AutoTokenizer.from_pretrained(self.text_model_name, local_files_only=True)
            self._generator_model = AutoModelForSeq2SeqLM.from_pretrained(self.text_model_name, local_files_only=True)
        except Exception:
            self._generator_model = None
            self._generator_tokenizer = None
            self.enabled = False
        return self._generator_model, self._generator_tokenizer

    def _load_sentiment(self):
        if not self.enabled or self._sentiment is not None:
            return self._sentiment
        try:
            from transformers import pipeline  # type: ignore

            self._sentiment = pipeline(
                "sentiment-analysis",
                model=self.sentiment_model_name,
                tokenizer=self.sentiment_model_name,
                device_map="auto",
                local_files_only=True,
            )
        except Exception:
            self._sentiment = None
        return self._sentiment

    def _load_embedder(self):
        if not self.enabled or self._embedder is not None:
            return self._embedder
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore

            self._embedder = SentenceTransformer(self.embedding_model_name, local_files_only=True)
        except Exception:
            self._embedder = None
        return self._embedder

    def embed_texts(self, texts: Iterable[str]) -> list[list[float]]:
        items = [text or "" for text in texts]
        model = self._load_embedder()
        if model is not None:
            vectors = model.encode(items, normalize_embeddings=True)
            return [vector.tolist() for vector in vectors]
        matrix = self._fallback_embedder.transform(items).toarray()
        return [row.tolist() for row in matrix]

    def generate_text(self, prompt: str, *, max_new_tokens: int = 64) -> str | None:
        model, tokenizer = self._load_generator()
        if model is None or tokenizer is None:
            return None
        try:
            inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
            output_ids = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
            result = tokenizer.decode(output_ids[0], skip_special_tokens=True).strip()
        except Exception:
            return None
        return result or None

    def generate_issue_label(self, transcript_text: str, fallback_label: str) -> str:
        response = self.generate_text(
            "Read the first customer problem statement from this service call and return a concise issue label in 2 to 4 words with no explanation.\n\n"
            f"{transcript_text[:2400]}",
            max_new_tokens=10,
        )
        if not response:
            return fallback_label
        cleaned = re.sub(r"^[^A-Za-z0-9]+", "", response).strip().lower()
        cleaned = re.split(r"[\n:]", cleaned)[0].strip()
        cleaned = re.sub(r"[^a-z0-9\s-]", "", cleaned).strip()
        words = cleaned.split()
        banned_fragments = {"service", "call", "return", "concise", "label", "problem statement"}
        transcript_lower = transcript_text.lower()
        if (
            not cleaned
            or len(words) > 5
            or words[0] in {"a", "an", "the", "i", "if"}
            or any(fragment in cleaned for fragment in banned_fragments)
            or not all(word in transcript_lower for word in words)
        ):
            return fallback_label
        return cleaned[:80] or fallback_label

    def classify_outcome(self, transcript_text: str, fallback: str) -> str:
        if not self.deep_llm_enabled:
            return fallback
        response = self.generate_text(
            "Classify the call outcome using exactly one label from: resolved, follow-up needed, callback requested, escalated, unresolved.\n\n"
            f"{transcript_text[:2600]}",
            max_new_tokens=8,
        )
        allowed = {"resolved", "follow-up needed", "callback requested", "escalated", "unresolved"}
        if response:
            lowered = response.lower()
            for label in allowed:
                if label in lowered:
                    return label
        return fallback

    def generate_list(self, instruction: str, transcript_text: str, fallback: list[str]) -> list[str]:
        if not self.deep_llm_enabled:
            return fallback
        response = self.generate_text(
            f"{instruction} Return a semicolon-separated list. If none, return none.\n\n{transcript_text[:2600]}",
            max_new_tokens=80,
        )
        if not response:
            return fallback
        lowered = response.strip().lower()
        if lowered == "none":
            return []
        items = [item.strip(" -.,") for item in re.split(r"[;\n]", response) if item.strip(" -.,")]
        return items or fallback

    def score_section_sentiment(self, text: str) -> float | None:
        classifier = self._load_sentiment()
        if classifier is None or not text.strip():
            return None
        try:
            result = classifier(text[:1600], truncation=True)[0]
        except Exception:
            return None
        label = str(result.get("label", "")).lower()
        score = float(result.get("score", 0.0))
        if "positive" in label:
            return round(score, 3)
        if "negative" in label:
            return round(-score, 3)
        return 0.0

    def summarize(self, transcript_text: str, fallback: str) -> str:
        if not self.deep_llm_enabled:
            return fallback
        response = self.generate_text(
            "Summarize this call in one sentence with issue, outcome, and agent approach. Ground only in the transcript.\n\n"
            f"{transcript_text[:2600]}",
            max_new_tokens=60,
        )
        if not response or len(response.split()) > 30:
            return fallback
        return response

    def select_labels_by_similarity(
        self,
        source_text: str,
        label_descriptions: dict[str, str],
        *,
        threshold: float = 0.26,
        max_labels: int = 4,
    ) -> list[str]:
        if not source_text.strip() or not label_descriptions:
            return []
        source_embedding = np.array(self.embed_texts([source_text])[0], dtype=float)
        cache_key = json.dumps(label_descriptions, sort_keys=True)
        if cache_key not in self._catalog_cache:
            self._catalog_cache[cache_key] = self.embed_texts(label_descriptions.values())
        scored: list[tuple[str, float]] = []
        for (label, _description), embedding in zip(label_descriptions.items(), self._catalog_cache[cache_key]):
            similarity = _cosine_similarity(source_embedding, np.array(embedding, dtype=float))
            if similarity >= threshold:
                scored.append((label, similarity))
        scored.sort(key=lambda item: (-item[1], item[0]))
        return [label for label, _score in scored[:max_labels]]


class AdaptiveIssueMemory:
    def __init__(self, store_path: Path, engine: HuggingFaceAdaptiveEngine) -> None:
        self.store_path = store_path
        self.engine = engine
        self.similarity_threshold = float(os.getenv("RANK1_CLUSTER_SIMILARITY", "0.52"))
        self.state = self._load()

    def _load(self) -> dict:
        if self.store_path.exists():
            try:
                return json.loads(self.store_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                pass
        return {"clusters": [], "updated_at": None}

    def save(self) -> None:
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        self.state["updated_at"] = _now_iso()
        self.store_path.write_text(json.dumps(self.state, indent=2) + "\n", encoding="utf-8")

    def assign(self, *, call_id: str, transcript_text: str, fallback_label: str) -> IssueAssignment:
        embedding = np.array(self.engine.embed_texts([transcript_text])[0], dtype=float)
        best_cluster = None
        best_similarity = -1.0
        for cluster in self.state["clusters"]:
            centroid = np.array(cluster["centroid"], dtype=float)
            if centroid.shape != embedding.shape:
                self.state["clusters"] = []
                best_cluster = None
                best_similarity = -1.0
                break
            similarity = _cosine_similarity(embedding, centroid)
            if similarity > best_similarity:
                best_similarity = similarity
                best_cluster = cluster

        if best_cluster is not None and best_similarity >= self.similarity_threshold:
            count = int(best_cluster["count"])
            old_centroid = np.array(best_cluster["centroid"], dtype=float)
            updated_centroid = ((old_centroid * count) + embedding) / (count + 1)
            best_cluster["centroid"] = updated_centroid.tolist()
            best_cluster["count"] = count + 1
            best_cluster["call_ids"].append(call_id)
            best_cluster["last_seen_at"] = _now_iso()
            if fallback_label and fallback_label != "other" and count < 3:
                best_cluster["candidate_labels"].append(fallback_label)
            label = best_cluster["label"]
            if count in {3, 10, 25}:
                label = self._refresh_cluster_label(best_cluster, fallback_label)
            return IssueAssignment(
                cluster_id=best_cluster["cluster_id"],
                label=label,
                similarity=round(best_similarity, 3),
                created_new_cluster=False,
            )

        generated_label = self.engine.generate_issue_label(transcript_text, fallback_label)
        cluster = {
            "cluster_id": f"ISSUE-{len(self.state['clusters']) + 1:04d}",
            "label": generated_label,
            "candidate_labels": [fallback_label] if fallback_label and fallback_label != "other" else [],
            "prototype_text": transcript_text[:2000],
            "centroid": embedding.tolist(),
            "count": 1,
            "call_ids": [call_id],
            "created_at": _now_iso(),
            "last_seen_at": _now_iso(),
        }
        self.state["clusters"].append(cluster)
        return IssueAssignment(
            cluster_id=cluster["cluster_id"],
            label=cluster["label"],
            similarity=1.0,
            created_new_cluster=True,
        )

    def _refresh_cluster_label(self, cluster: dict, fallback_label: str) -> str:
        label = self.engine.generate_issue_label(cluster["prototype_text"], fallback_label or cluster["label"])
        cluster["label"] = label
        return label

    def export_clusters(self) -> list[dict]:
        return [
            {
                "cluster_id": cluster["cluster_id"],
                "label": cluster["label"],
                "count": cluster["count"],
                "call_ids": cluster["call_ids"][:10],
                "last_seen_at": cluster["last_seen_at"],
            }
            for cluster in self.state["clusters"]
        ]
