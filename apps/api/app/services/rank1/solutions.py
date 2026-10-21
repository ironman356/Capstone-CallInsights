"""Reproducible, local solution discovery. No transcript leaves this process.

Features use agent turns before outcome language and before the last 30% of a
call. Existing outcome-derived behavior labels are never model inputs.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from collections import Counter
from functools import lru_cache
from itertools import combinations

import numpy as np
from scipy.stats import fisher_exact
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction import DictVectorizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, brier_score_loss, f1_score, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import make_pipeline

RULES = {
    "acknowledge frustration": r"\b(understand|frustrat\w*|sorry|apolog\w*)\b",
    "explain process": r"\b(explain\w*|walk through|break down|review.*with you)\b",
    "review account": r"\b(review\w*|check\w*|look\w* into|investigat\w*)\b",
    "give timeline": r"\b(timeline|business days?|within|by tomorrow|next billing)\b",
    "document next steps": r"\b(document\w*|add notes|adding notes|note\w*.*account)\b",
    "offer action": r"\b(submit\w*|send\w*|request\w*|offer\w*|arrang\w*)\b",
    "verify details": r"\b(verif\w*|confirm\w*)\b",
    "transfer": r"\b(transfer\w*|supervisor|escalat\w*)\b",
    "hold": r"\b(hold|wait a moment)\b",
}
VERBS = {"review": r"review\w*", "explain": r"explain\w*", "confirm": r"confirm\w*",
         "document": r"document\w*", "submit": r"submit\w*", "send": r"send\w*",
         "check": r"check\w*", "understand": r"understand\w*", "transfer": r"transfer\w*"}
OUTCOME_CUE = re.compile(r"\b(resolved|unresolved|clear that up|that helps|now I understand|still not|"
                         r"will wait for|call back|callback|escalated|glad we were able|all fixed|problem is fixed)\b", re.I)
SOURCES = [
    {"title": "Sentence Transformers: semantic similarity", "url": "https://sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html", "use": "Implemented when locally cached: frozen MiniLM embeddings and semantic behavior retrieval. This is an established baseline, not a 2026 model."},
    {"title": "2026: Causal Effect Estimation with Latent Textual Treatments", "url": "https://arxiv.org/abs/2602.15730", "use": "Research only: SAE steering requires controlled text interventions; not run on these calls."},
    {"title": "2025: Causal Inference on Outcomes Learned from Text", "url": "https://arxiv.org/abs/2503.00725", "use": "Motivates separation of discovery and validation and human outcome review."},
    {"title": "ICML 2025: Isolated Causal Effects of Natural Language", "url": "https://proceedings.mlr.press/v267/lin25k.html", "use": "Motivates caution about language features that occur together."},
    {"title": "Scikit-learn: grouped cross-validation", "url": "https://scikit-learn.org/stable/modules/cross_validation.html", "use": "Implemented: opening-template groups stay together across train and validation folds."},
]


def extract(call: dict) -> dict:
    turns = call.get("turns", [])
    if not turns:
        turns = [{"speaker": m[0], "text": m[1]} for m in re.findall(r"(?im)^(Agent|Customer):\s*(.*)$", call.get("transcript_text", ""))]
    cutoff = max(1, int(len(turns) * .7))
    eligible = []
    for index, turn in enumerate(turns[:cutoff]):
        if OUTCOME_CUE.search(turn["text"]):
            break
        if turn["speaker"].lower() == "agent":
            eligible.append({"turn": index + 1, "text": turn["text"]})
    features, events, quotes = {}, [], {}
    for turn in eligible:
        for label, pattern in RULES.items():
            if re.search(pattern, turn["text"], re.I):
                key = "behavior: " + label
                features[key] = 1
                quotes.setdefault(key, []).append(turn)
                events.append((turn["turn"], label))
                if turn["turn"] <= max(1, len(turns) // 3):
                    early = "early: " + label
                    features[early] = 1
                    quotes.setdefault(early, []).append(turn)
        for label, pattern in VERBS.items():
            if re.search(r"\b" + pattern + r"\b", turn["text"], re.I):
                key = "verb: " + label
                features[key] = 1
                quotes.setdefault(key, []).append(turn)
    for (left, first), (right, second) in combinations(events, 2):
        if left < right and first != second:
            key = f"sequence: {first} → {second}"
            features[key] = 1
            quotes[key] = [next(t for t in eligible if t["turn"] == left), next(t for t in eligible if t["turn"] == right)]
    opening = next((t["text"] for t in turns if t["speaker"].lower() == "customer"), call.get("call_id", "unknown"))
    group = re.sub(r"\W+", " ", opening.lower()).strip()
    return {"call": call, "features": features, "quotes": quotes, "turns": eligible,
            "text": " ".join(t["text"] for t in eligible), "group": group}


@lru_cache(maxsize=1)
def semantic_model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", local_files_only=True, device="cpu")


def enrich_semantics(rows: list[dict]) -> str:
    if not rows or os.getenv("SOLUTION_ENABLE_SEMANTIC", "1") == "0":
        return "disabled"
    try:
        model = semantic_model()
        texts = list(dict.fromkeys([r["text"] for r in rows] + [t["text"] for r in rows for t in r["turns"]]))
        embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        lookup = dict(zip(texts, embeddings))
        descriptions = {
            "acknowledge frustration": "I understand your frustration and I am sorry this has been difficult.",
            "explain process": "I can explain the process and walk you through the next steps.",
            "review account": "I am checking the account details and reviewing the payment history.",
            "give timeline": "The review will take three business days and I will tell you when to expect a response.",
            "document next steps": "I am documenting our discussion and the next steps in the account notes.",
        }
        prototypes = model.encode(list(descriptions.values()), normalize_embeddings=True, show_progress_bar=False)
        for row in rows:
            row["embedding"] = lookup[row["text"]]
            for turn in row["turns"]:
                similarities = prototypes @ lookup[turn["text"]]
                best = int(np.argmax(similarities))
                if similarities[best] >= .55:
                    key = "semantic: " + list(descriptions)[best]
                    row["features"][key] = 1
                    row["quotes"].setdefault(key, []).append(turn)
        return "measured: cached MiniLM, cosine threshold 0.55 (heuristic, not calibrated)"
    except (ImportError, OSError, RuntimeError, ValueError) as exc:
        return f"unavailable: {type(exc).__name__}; local model only, no download attempted"


def benchmark(rows: list[dict]) -> dict:
    """Compare fixed models on identical out-of-fold predictions; no tuning on test folds."""
    y = np.array([r["call"].get("outcome") == "resolved" for r in rows], dtype=int)
    groups = np.array([r["group"] for r in rows])
    group_count = len(set(groups))
    if len(set(y)) < 2 or group_count < 3 or len(rows) < 12:
        return {"status": "insufficient data", "models": [], "groups": group_count, "folds": 0, "note": "Need both outcomes, at least 12 calls and 3 opening-template groups."}
    folds = list(StratifiedGroupKFold(n_splits=min(5, group_count), shuffle=True, random_state=42).split(rows, y, groups))
    if any(len(set(y[train])) < 2 for train, _ in folds):
        return {"status": "insufficient class overlap", "models": [], "groups": group_count, "folds": len(folds), "note": "Training folds need both outcomes."}
    lr = lambda: LogisticRegression(C=1, max_iter=1000, random_state=42)
    models = [
        ("Prior-only baseline", "baseline", make_pipeline(DictVectorizer(), DummyClassifier(strategy="prior"))),
        ("Behavior logistic regression", "behavior", make_pipeline(DictVectorizer(), lr())),
        ("Verbs logistic regression", "verb", make_pipeline(DictVectorizer(), lr())),
        ("Sequence + timing logistic regression", "sequence", make_pipeline(DictVectorizer(), lr())),
        ("Word TF-IDF + logistic regression", "text", make_pipeline(TfidfVectorizer(ngram_range=(1, 2), max_features=3000), lr())),
        ("Character TF-IDF + logistic regression", "text", make_pipeline(TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=4000), lr())),
        ("Word TF-IDF + Complement NB", "text", make_pipeline(TfidfVectorizer(ngram_range=(1, 2), max_features=3000), ComplementNB())),
        ("Behavior + sequence random forest", "all", make_pipeline(DictVectorizer(), RandomForestClassifier(n_estimators=100, max_depth=4, min_samples_leaf=3, random_state=42, n_jobs=1))),
    ]
    if all("embedding" in r for r in rows):
        models.extend([
            ("Frozen MiniLM + logistic regression", "embedding", lr()),
            ("Semantic behavior retrieval + logistic regression", "semantic", make_pipeline(DictVectorizer(), lr())),
        ])
    results = []
    for name, family, model in models:
        values = [r["text"] if family == "text" else {k: v for k, v in r["features"].items() if not k.startswith("phrase:") and (family in ("all", "baseline") or k.startswith(family + ":") or (family == "sequence" and k.startswith("early:")))} for r in rows]
        if family == "embedding":
            values = [r["embedding"] for r in rows]
        elif family != "text":
            values = [dict(v, intercept=1) for v in values]
        probabilities = np.zeros(len(rows))
        for train, test in folds:
            estimator = clone(model).fit([values[i] for i in train], y[train])
            probabilities[test] = estimator.predict_proba([values[i] for i in test])[:, 1]
        pred = probabilities >= .5
        results.append({"name": name, "brier": round(float(brier_score_loss(y, probabilities)), 4),
                        "balanced_accuracy": round(float(balanced_accuracy_score(y, pred)), 4),
                        "macro_f1": round(float(f1_score(y, pred, average="macro", zero_division=0)), 4),
                        "auc": round(float(roc_auc_score(y, probabilities)), 4)})
    baseline = results[0]["brier"]
    for result in results:
        result["improvement"] = round(baseline - result["brier"], 4)
    return {"status": "measured", "models": sorted(results, key=lambda r: r["brier"]), "groups": group_count, "folds": len(folds),
            "note": "Out-of-fold predictions grouped by normalized first customer turn. Lower Brier score is better. Fixed models; comparative discovery, no independent final test. Labels are existing pipeline outcomes."}


def cluster_report(rows: list[dict], issue: dict) -> dict:
    selected = [r for r in rows if r["call"].get("issue") == issue["issue"]]
    n = len(selected)
    positives = sum(r["call"].get("outcome") == "resolved" for r in selected)
    signals = []
    candidates = sorted(set(k for r in selected for k in r["features"]))
    for key in candidates:
        exposed = [r for r in selected if key in r["features"]]
        absent = [r for r in selected if key not in r["features"]]
        a = sum(r["call"].get("outcome") == "resolved" for r in exposed)
        c = sum(r["call"].get("outcome") == "resolved" for r in absent)
        b, d = len(exposed) - a, len(absent) - c
        if len(exposed) < 2:
            continue
        seed = int(hashlib.sha256((issue["issue"] + key).encode()).hexdigest()[:8], 16)
        rng = np.random.default_rng(seed)
        draws = rng.beta(a + 1, b + 1, 4000) - rng.beta(c + 1, d + 1, 4000)
        lo, hi = np.quantile(draws, [.025, .975]) * 100
        delta = (a / len(exposed) - c / len(absent)) * 100 if absent else None
        # Exact test and FDR are exploratory because candidates are discovered here.
        p = float(fisher_exact([[a, b], [c, d]]).pvalue) if absent else 1.0
        examples = [{"call_id": r["call"]["call_id"], "outcome": r["call"].get("outcome", "unknown"),
                     "quotes": r["quotes"].get(key, [])} for r in exposed]
        signals.append({"id": hashlib.sha256(key.encode()).hexdigest()[:12], "label": key.split(": ", 1)[1], "kind": key.split(":", 1)[0],
                        "support": len(exposed), "comparison_count": len(absent), "resolved": a, "other": b,
                        "rate": round(100 * a / len(exposed), 1), "without_rate": round(100 * c / len(absent), 1) if absent else None,
                        "delta": round(delta, 1) if delta is not None else None, "interval": [round(float(lo), 1), round(float(hi), 1)] if absent else None,
                        "p": p, "q": 1.0, "status": "insufficient comparison" if min(len(exposed), len(absent)) < 3 else "uncertain",
                        "examples": examples, "counterexamples": [e for e in examples if e["outcome"] != "resolved"],
                        "comparison_call_ids": [r["call"]["call_id"] for r in absent]})
    ordered = sorted(signals, key=lambda r: r["p"])
    previous = 1.0
    for rank in range(len(ordered), 0, -1):
        item = ordered[rank - 1]
        previous = min(previous, item["p"] * len(ordered) / rank)
        item["q"] = round(previous, 4)
        if item["status"] == "uncertain" and item["interval"] and item["q"] <= .05:
            if item["interval"][0] > 0:
                item["status"] = "higher resolution"
            elif item["interval"][1] < 0:
                item["status"] = "lower resolution"
    signals.sort(key=lambda r: (r["status"] == "insufficient comparison", -abs(r["delta"] or 0), -r["support"], r["label"]))
    return {"slug": issue["slug"], "issue": issue["issue"], "count": n, "resolved": positives,
            "baseline": round(100 * positives / n, 1) if n else 0, "signals": signals,
            "outcomes": dict(Counter(r["call"].get("outcome", "unknown") for r in selected))}


@lru_cache(maxsize=2)
def _report(serialized: str) -> dict:
    bundle = json.loads(serialized)
    rows = [extract(c) for c in bundle["calls"]]
    # Unsupervised vocabulary discovery. Prediction vocabularies are fitted within folds.
    if rows and any(r["text"].strip() for r in rows):
        vectorizer = TfidfVectorizer(ngram_range=(2, 3), min_df=2, max_df=.9, max_features=120)
        try:
            matrix = vectorizer.fit_transform([r["text"] for r in rows])
            names = vectorizer.get_feature_names_out()
            for index, row in enumerate(rows):
                for column in matrix[index].indices:
                    phrase = names[column]
                    key = "phrase: " + phrase
                    matching = [t for t in row["turns"] if phrase in t["text"].lower()]
                    if matching:
                        row["features"][key] = 1
                        row["quotes"][key] = matching
        except ValueError:
            pass  # No repeated non-universal phrases in a small corpus.
    semantic_status = enrich_semantics(rows)
    from .conversation_paths import build_paths
    clusters = [cluster_report(rows, issue) for issue in bundle["issues"]]
    return {"version": "3.0", "call_count": len(rows), "benchmark": benchmark(rows), "semantic_status": semantic_status,
            "clusters": clusters, "conversations": build_paths(rows, clusters, RULES), "sources": SOURCES + [
                {"title": "2026 RAPO: learning from customer reactions", "url": "https://arxiv.org/abs/2603.15434", "use": "Inspired observed next-reply analysis and contrastive continuation retrieval; does not reproduce RAPO reinforcement learning or simulate customer outcomes."},
                {"title": "Doubly robust learning", "url": "https://www.pywhy.org/EconML/spec/estimation/dr.html", "use": "Implemented cross-fitted AIPW diagnostic with propensity overlap checks using existing scikit-learn. Causal interpretation is withheld because confounders are incomplete."}],
            "notes": ["Current workspace uses synthetic development transcripts; repeated scripts and automatic outcome labels limit generalization.",
                      "Agent-only first 70% of turns, truncated at outcome cues. Outcome labels such as resolved calmly are excluded from features.",
                      "Edges describe observed co-occurrence. Same call can contribute to several signal paths; graph counts must not be added together.",
                      "Intervals are 95% Beta(1,1) posterior difference intervals under independent calls. Repeated templates can make them too narrow.",
                      "Fisher tests with Benjamini–Hochberg correction within each cluster are exploratory, not independent confirmation.",
                      "Semantic labels use a fixed cosine threshold of 0.55 against behavior descriptions; manual quote review is required. Encoder stays frozen across validation folds.",
                      "Causal forests, DML and 2026 SAE text interventions reviewed but not run: no randomized interventions or adequate pre-treatment confounders."]}


def build_solution_report(bundle: dict) -> dict:
    calls = list(bundle.get("call_details", {}).values())
    return _report(json.dumps({"calls": calls, "issues": bundle.get("issues", [])}, sort_keys=True))
