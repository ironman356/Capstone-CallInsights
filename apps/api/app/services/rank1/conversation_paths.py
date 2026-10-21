"""Exact dialogue paths, context-matched alternatives, and guarded DR diagnostics."""
from collections import Counter
import re

import numpy as np
from scipy.stats import beta
from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold

STAGES = ["Welcome", "Verify", "Understand", "Acknowledge", "Respond", "Close"]


def reaction(text):
    if re.search(r"that helps|now I understand|makes sense|clear now", text, re.I):
        return "understanding expressed"
    if re.search(r"call.*back|callback|follow.up|wait for", text, re.I):
        return "further contact requested"
    if re.search(r"still|not.*answer|supervisor|frustrat|not.*clear", text, re.I):
        return "concern continues"
    return "no explicit reaction signal"


def stages(call):
    """Agent-order scaffold for current corpus, never used as a learned label."""
    number, stage, result = 0, 0, []
    for index, turn in enumerate(call.get("turns", [])):
        if turn["speaker"].lower() == "agent":
            number += 1
            stage = 0 if number == 1 else 1 if number <= 3 else min(5, number - 2)
        result.append({"turn": index + 1, "speaker": turn["speaker"], "text": turn["text"], "stage": STAGES[stage]})
    return result


def doubly_robust(rows, rules):
    """Cross-fitted AIPW diagnostic at a fixed sixth-agent-turn decision.

    Context = first customer utterance (pre-treatment). No generated counterfactual
    outcomes. Missing operational confounders prohibit a causal interpretation.
    """
    eligible = []
    for row in rows:
        agents = [t for t in stages(row["call"]) if t["speaker"].lower() == "agent"]
        if len(agents) >= 6 and any(t["turn"] == agents[5]["turn"] for t in row["turns"]):
            eligible.append((row, agents[5]["text"]))
    if len(eligible) < 24 or len({r["group"] for r, _ in eligible}) < 3:
        return [{"behavior": "All actions", "status": "insufficient sample", "n": len(eligible), "estimate": None, "overlap": None}]
    groups = np.array([r["group"] for r, _ in eligible])
    x = HashingVectorizer(n_features=256, alternate_sign=False).transform(groups)
    y = np.array([r["call"].get("outcome") == "resolved" for r, _ in eligible], dtype=float)
    results = []
    folds = list(GroupKFold(n_splits=min(3, len(set(groups)))).split(x, y, groups))
    for label in ["offer action", "document next steps", "give timeline", "review account", "explain process"]:
        treatment = np.array([bool(re.search(rules[label], text, re.I)) for _, text in eligible], dtype=int)
        entry = {"behavior": label, "n": len(y), "treated": int(treatment.sum()), "estimate": None, "overlap": None, "status": "insufficient treatment overlap"}
        if min(treatment.sum(), len(y) - treatment.sum()) < 6:
            results.append(entry)
            continue
        propensity, mu0, mu1 = np.zeros(len(y)), np.zeros(len(y)), np.zeros(len(y))
        valid = True
        for train, test in folds:
            if len(set(treatment[train])) < 2:
                valid = False
                break
            propensity[test] = LogisticRegression(C=1, max_iter=500).fit(x[train], treatment[train]).predict_proba(x[test])[:, 1]
            for arm, target in [(0, mu0), (1, mu1)]:
                subset = train[treatment[train] == arm]
                if len(subset) < 3:
                    valid = False
                    break
                if len(set(y[subset])) < 2:
                    target[test] = (y[subset].sum() + 1) / (len(subset) + 2)
                else:
                    target[test] = LogisticRegression(C=1, max_iter=500).fit(x[subset], y[subset]).predict_proba(x[test])[:, 1]
        if valid:
            overlap = float(np.mean((propensity >= .1) & (propensity <= .9)))
            entry["overlap"] = round(overlap * 100, 1)
            if overlap >= .9:
                e = np.clip(propensity, .1, .9)
                score = mu1 - mu0 + treatment * (y - mu1) / e - (1 - treatment) * (y - mu0) / (1 - e)
                entry["estimate"] = round(float(score.mean()) * 100, 1)
                entry["status"] = "exploratory adjusted association; confounders incomplete"
        results.append(entry)
    return results


def build_paths(rows, clusters, rules):
    all_calls = [r["call"] for r in rows]
    row_by_id = {r["call"]["call_id"]: r for r in rows}
    # One reusable vector index over pre-response contexts. Purely unsupervised.
    context_texts, context_keys = [], []
    staged = {c["call_id"]: stages(c) for c in all_calls}
    for call in all_calls:
        prefix = []
        for turn in staged[call["call_id"]]:
            if turn["speaker"].lower() == "agent":
                context_keys.append((call["call_id"], turn["turn"]))
                context_texts.append(" ".join(prefix) or "start of conversation")
            prefix.append(turn["speaker"] + ": " + turn["text"])
    vectors = {}
    retrieval_method = "hashed lexical prefix cosine"
    if context_texts:
        if rows and all("embedding" in r for r in rows):
            from .solutions import semantic_model
            matrix = semantic_model().encode(context_texts, normalize_embeddings=True, show_progress_bar=False)
            retrieval_method = "frozen-transformer pre-response prefix cosine"
        else:
            matrix = HashingVectorizer(n_features=512, alternate_sign=False).transform(context_texts).toarray()
        vectors = dict(zip(context_keys, matrix))
    reports = []
    for cluster in clusters:
        calls = [c for c in all_calls if c.get("issue") == cluster["issue"]]
        exact = {}
        for call in calls:
            seen = set()
            for turn in staged[call["call_id"]]:
                if turn["speaker"].lower() != "agent" or turn["text"] in seen:
                    continue
                seen.add(turn["text"])
                item = exact.setdefault(turn["text"], {"text": turn["text"], "call_ids": [], "resolved_ids": [], "reactions": Counter()})
                item["call_ids"].append(call["call_id"])
                if call.get("outcome") == "resolved":
                    item["resolved_ids"].append(call["call_id"])
                following = next((t["text"] for t in staged[call["call_id"]][turn["turn"]:] if t["speaker"].lower() == "customer"), "")
                item["reactions"][reaction(following)] += 1
        line_stats = {}
        for text, item in exact.items():
            support, success = len(item["call_ids"]), len(item["resolved_ids"])
            absent = len(calls) - support
            other_success = cluster["resolved"] - success
            line_stats[text] = {**item, "reactions": dict(item["reactions"]), "support": support, "resolved": success,
                "rate": round(100 * success / support, 1), "without_count": absent,
                "without_resolved": other_success, "without_rate": round(100 * other_success / absent, 1) if absent else None,
                "lower_bound": round(float(beta.ppf(.1, success + 1, support - success + 1)) * 100, 1),
                "finding": "No comparison: used in every call" if absent == 0 else "Descriptive only: exact wording was selected on this sample"}
        paths = []
        for call in calls:
            path_turns = []
            row = row_by_id[call["call_id"]]
            eligible_turns = {t["turn"] for t in row["turns"]}
            for turn in staged[call["call_id"]]:
                is_agent = turn["speaker"].lower() == "agent"
                labels = [key for key, quotes in row["quotes"].items() if any(q["turn"] == turn["turn"] for q in quotes)] if is_agent else []
                linked = [s for s in cluster["signals"] if s["kind"] + ": " + s["label"] in labels]
                alternatives = {}
                if is_agent and turn["turn"] in eligible_turns:
                    source_vector = vectors[(call["call_id"], turn["turn"])]
                    for other in calls:
                        other_row = row_by_id[other["call_id"]]
                        for candidate in staged[other["call_id"]]:
                            if candidate["speaker"].lower() != "agent" or candidate["stage"] != turn["stage"] or candidate["text"] == turn["text"]:
                                continue
                            if candidate["turn"] not in {t["turn"] for t in other_row["turns"]}:
                                continue
                            score = float(source_vector @ vectors[(other["call_id"], candidate["turn"])] )
                            if score >= .65 and score > alternatives.get(candidate["text"], {}).get("similarity", -1):
                                alternatives[candidate["text"]] = {"text": candidate["text"], "call_id": other["call_id"], "turn": candidate["turn"], "similarity": round(score, 3), "stats": line_stats[candidate["text"]]}
                next_customer = next((t for t in staged[call["call_id"]][turn["turn"]:] if t["speaker"].lower() == "customer"), None) if is_agent else None
                path_turns.append({**turn, "eligible": turn["turn"] in eligible_turns,
                    "signals": [{"kind": s["kind"], "label": s["label"], "status": s["status"], "delta": s["delta"]} for s in linked],
                    "stats": line_stats.get(turn["text"]) if is_agent else None,
                    "next_customer": next_customer,
                    "alternatives": sorted(alternatives.values(), key=lambda a: (-a["similarity"], -a["stats"]["support"]))[:4]})
            score = sum(line_stats[t["text"]]["lower_bound"] for t in path_turns if t["eligible"] and t["speaker"].lower() == "agent")
            paths.append({"call_id": call["call_id"], "outcome": call.get("outcome", "unknown"), "turns": path_turns, "score": round(score, 1)})
        resolved = [p for p in paths if p["outcome"] == "resolved"]
        anchor = max(resolved or paths, key=lambda p: (p["score"], p["call_id"]), default=None)
        # Preserve a coherent observed path instead of splicing incompatible account facts.
        guide = {"title": "Conversation guide", "source_call_id": anchor["call_id"] if anchor else None,
                 "status": "Candidate for review; no validated improvement", "turns": anchor["turns"] if anchor else [],
                 "reason": "Retrieved complete observed path, ranked by conservative exact-line resolution support among resolved examples. Customer lines are historical examples, not promised replies. All source account facts require checking before reuse."}
        reports.append({"slug": cluster["slug"], "issue": cluster["issue"], "calls": paths, "guide": guide,
                        "exact_lines": sorted(line_stats.values(), key=lambda s: (-s["support"], s["text"]))})
    return {"clusters": reports, "retrieval_method": retrieval_method, "adjusted": doubly_robust(rows, rules),
            "causal_note": "Cross-fitted AIPW at the sixth agent turn, using only the opening customer context. Operational confounders and independent outcomes are missing, so estimates are exploratory adjusted associations, not causal effects."}
