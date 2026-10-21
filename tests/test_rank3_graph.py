from __future__ import annotations
import sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))
from app.services.rank1.knowledge_graph import add_annotation, build_knowledge_graph  # noqa: E402

class Rank3GraphTests(unittest.TestCase):
    def test_graph_links_call_issue_and_behavior_and_persists_annotation(self):
        bundle={"call_details":{"CALL-1":{"call_id":"CALL-1","issue":"escrow","behaviors":["used empathy"]}}}
        graph=build_knowledge_graph(bundle)
        self.assertEqual(len(graph["nodes"]),3)
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(add_annotation(Path(d)/"a.json","CALL-1","Review this","QA")["author"],"QA")
