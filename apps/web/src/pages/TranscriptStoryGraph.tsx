import { useState } from "react";
import { Background, Controls, MarkerType, Position, ReactFlow, type Edge, type Node } from "@xyflow/react";
import type { ConversationCluster, DialogueTurn } from "../solutionTypes";

const stages = ["Welcome", "Verify", "Understand", "Acknowledge", "Respond", "Close"];

function LineEvidence({ turn, onOpenCall }: { turn: DialogueTurn; onOpenCall: (id: string) => void }) {
  return <div className="script-inspector">
    <p className="section-kicker">{turn.speaker} · exact turn {turn.turn}</p><blockquote>{turn.text}</blockquote>
    {turn.stats && <>
      <div className="discovery-rates"><div><strong>{turn.stats.resolved}/{turn.stats.support}</strong><span>calls with this exact line resolved ({turn.stats.rate}%)</span></div><div><strong>{turn.stats.without_resolved}/{turn.stats.without_count}</strong><span>without it {turn.stats.without_rate === null ? "— no comparison" : `(${turn.stats.without_rate}%)`}</span></div></div>
      <p>{turn.stats.finding}. {turn.eligible ? "Analyzed before outcome cues." : "Shown for transcript context; excluded from behavior-effect ranking."}</p>
      <details><summary>See observed reactions and call IDs</summary>{Object.entries(turn.stats.reactions).map(([label, count]) => <p key={label}>{label}: {count}</p>)}<div className="solution-evidence">{turn.stats.call_ids.map(id => <button key={id} onClick={() => onOpenCall(id)}>{id}</button>)}</div></details>
    </>}
    <details><summary>Words, behaviors and sequence evidence ({turn.signals.length})</summary>{turn.signals.length ? turn.signals.map((s, i) => <p key={i}><strong>{s.kind}: {s.label}</strong><br />{s.status}{s.delta === null ? "" : ` · ${s.delta > 0 ? "+" : ""}${s.delta} pts`}</p>) : <p>No eligible behavior signal on this turn.</p>}</details>
  </div>;
}

export default function TranscriptStoryGraph({ cluster, guide, onOpenCall }: {
  cluster: ConversationCluster; guide: boolean; onOpenCall: (id: string) => void;
}) {
  const [callId, setCallId] = useState(cluster.guide.source_call_id ?? cluster.calls[0]?.call_id ?? "");
  const [stage, setStage] = useState<string | null>(null);
  const [turnId, setTurnId] = useState<number | null>(null);
  const [alternativesOpen, setAlternativesOpen] = useState(false);
  const call = cluster.calls.find(c => c.call_id === callId) ?? cluster.calls[0];
  const turns = guide ? cluster.guide.turns : call?.turns ?? [];
  const source = guide ? cluster.guide.source_call_id : call?.call_id;
  const focused = turns.find(t => t.turn === turnId);
  const visible = turns.filter(t => t.stage === stage);
  const nodes: Node[] = [], edges: Edge[] = [];
  const base = { width: 340, background: "var(--panel-strong)", color: "var(--text)", border: "1px solid var(--line-strong)", borderRadius: 16, padding: 18, textAlign: "left" as const };
  function add(id: string, x: number, y: number, label: React.ReactNode, color = "#7ac8ff") {
    nodes.push({ id, position: { x, y }, sourcePosition: Position.Right, targetPosition: Position.Left, style: { ...base, borderColor: color }, data: { label } });
  }
  function connect(from: string, to: string, label = "") {
    edges.push({ id: `${from}-${to}`, source: from, target: to, label, style: { stroke: "#7ac8ff", strokeWidth: 1.5 }, labelStyle: { fill: "var(--text)", fontSize: 11 }, labelBgStyle: { fill: "var(--bg-soft)" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#7ac8ff" } });
  }
  function turnLabel(t: DialogueTurn, hint = "Click for words, behaviors and alternatives") {
    return <><small>{t.speaker.toUpperCase()} · TURN {t.turn}{guide && t.speaker.toLowerCase() === "customer" ? " · OBSERVED EXAMPLE" : ""}</small><p className="script-node-quote">“{t.text}”</p><em>{hint}</em></>;
  }
  if (focused) {
    add("focus", 0, 130, turnLabel(focused, "Exact source wording"));
    if (focused.next_customer) {
      add("reply", 440, 0, <><small>NEXT OBSERVED CUSTOMER REPLY</small><p className="script-node-quote">“{focused.next_customer.text}”</p><em>Historical reply in {source}</em></>, "#b7a1ff");
      connect("focus", "reply", "then customer said");
    }
    add("evidence", 440, 240, <><small>OBSERVED RESULTS</small><h3>{focused.stats ? `${focused.stats.resolved}/${focused.stats.support} resolved` : call?.outcome}</h3><p>{focused.stats?.finding ?? "Customer wording, not an intervention"}</p><em>Evidence and exact counts below</em></>, "#efc66d");
    connect("focus", "evidence", "associated outcomes");
    if (focused.alternatives.length) {
      if (!alternativesOpen) {
        add("alternatives", 0, 430, <><small>COMPARE THE RESPONSE</small><h3>{focused.alternatives.length} other exact replies</h3><p>Matched by issue, stage and conversation prefix.</p><em>Click to expand alternatives</em></>);
        connect("focus", "alternatives");
      } else {
        focused.alternatives.forEach((a, i) => {
          add(`alt-${i}`, 880, i * 245, <><small>OBSERVED ALTERNATIVE · {a.call_id}</small><p className="script-node-quote">“{a.text}”</p><span>{a.stats.resolved}/{a.stats.support} resolved · prefix similarity {a.similarity}</span><em>Click to open source transcript</em></>, "#efc66d");
          connect("focus", `alt-${i}`, "similar prior context");
        });
      }
    }
  } else if (stage) {
    visible.forEach((t, i) => {
      add(`turn-${t.turn}`, (i % 2) * 450, Math.floor(i / 2) * 280, turnLabel(t), t.speaker.toLowerCase() === "agent" ? "#7ac8ff" : "#b7a1ff");
      if (i) connect(`turn-${visible[i - 1].turn}`, `turn-${t.turn}`, "next turn");
    });
  } else {
    const available = stages.filter(s => turns.some(t => t.stage === s));
    available.forEach((s, i) => {
      const group = turns.filter(t => t.stage === s);
      add(`stage-${s}`, (i % 3) * 395, Math.floor(i / 3) * 290, <><small>{i + 1} / {s.toUpperCase()}</small><p className="script-node-quote">“{group[0].text}”</p><em>{group.length} exact turns · click to unfold</em></>);
      if (i) connect(`stage-${available[i - 1]}`, `stage-${s}`);
    });
  }
  function clickNode(id: string) {
    if (id.startsWith("stage-")) { setStage(id.slice(6)); setTurnId(null); }
    if (id.startsWith("turn-")) { setTurnId(Number(id.slice(5))); setAlternativesOpen(false); }
    if (id === "alternatives") setAlternativesOpen(true);
    if (id.startsWith("alt-") && focused) onOpenCall(focused.alternatives[Number(id.slice(4))].call_id);
  }
  return <section className="transcript-story">
    <div className="script-navigation">
      {!guide && <label>Observed call<select value={call?.call_id ?? ""} onChange={e => { setCallId(e.target.value); setStage(null); setTurnId(null); setAlternativesOpen(false); }}>{cluster.calls.map(c => <option key={c.call_id} value={c.call_id}>{c.call_id} · {c.outcome}</option>)}</select></label>}
      <button className="ghost-button" onClick={() => { setStage(null); setTurnId(null); setAlternativesOpen(false); }}>Collapse to full call</button>
      {stage && <button className="ghost-button" onClick={() => { setTurnId(null); setAlternativesOpen(false); }}>{stage} / all turns</button>}
      {alternativesOpen && <button className="ghost-button" onClick={() => setAlternativesOpen(false)}>Collapse alternatives</button>}
      {source && <button className="ghost-button" onClick={() => onOpenCall(source)}>Source: {source}</button>}
    </div>
    {guide && <p className="discovery-verdict">{cluster.guide.status}. {cluster.guide.reason}</p>}
    <p className="discovery-note">{stage ? `${guide ? "Conversation guide" : call?.call_id} / ${stage}${focused ? ` / turn ${focused.turn}` : ""}` : "Start with any script line. Click a stage, then a turn, then expand its alternatives."}</p>
    <div className="discovery-canvas script-canvas" aria-label={guide ? "Drilldown conversation guide graph" : "Drilldown exact transcript graph"}>
      <ReactFlow key={`${source}-${stage}-${turnId}-${alternativesOpen}`} nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: .12 }} nodesDraggable={false} nodesConnectable={false} minZoom={.3} maxZoom={1.5} onNodeClick={(_, node) => clickNode(node.id)}>
        <Background gap={24} color="var(--line-strong)" /><Controls showInteractive={false} />
      </ReactFlow>
    </div>
    {focused && <LineEvidence turn={focused} onOpenCall={onOpenCall} />}
    {guide && <details className="discovery-methods"><summary>Read the entire exact script as text</summary>{turns.map(t => <p key={t.turn}><strong>{t.speaker}{t.speaker.toLowerCase() === "customer" ? " (observed example)" : ""}:</strong> {t.text}</p>)}</details>}
  </section>;
}
