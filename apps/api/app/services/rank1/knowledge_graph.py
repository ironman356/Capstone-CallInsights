"""Persistable evidence graph for Rank 3 relationship exploration."""
from __future__ import annotations

import json
from pathlib import Path


def build_knowledge_graph(bundle: dict) -> dict:
    nodes: dict[str, dict] = {}
    edges: list[dict] = []
    for call in bundle["call_details"].values():
        call_id = call["call_id"]
        nodes[call_id] = {"id": call_id, "kind": "call", "label": call_id}
        issue_id = f"issue:{call['issue']}"
        nodes[issue_id] = {"id": issue_id, "kind": "issue", "label": call["issue"]}
        edges.append({"source": call_id, "target": issue_id, "kind": "has_issue"})
        for behavior in call["behaviors"]:
            behavior_id = f"behavior:{behavior}"
            nodes[behavior_id] = {"id": behavior_id, "kind": "behavior", "label": behavior}
            edges.append({"source": call_id, "target": behavior_id, "kind": "shows_behavior"})
    return {"nodes": list(nodes.values()), "edges": edges}


def add_annotation(path: Path, node_id: str, text: str, author: str) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    annotations = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    item = {"annotation_id": f"ann-{len(annotations)+1}", "node_id": node_id, "text": text.strip(), "author": author.strip()}
    annotations.append(item)
    path.write_text(json.dumps(annotations, indent=2), encoding="utf-8")
    return item
