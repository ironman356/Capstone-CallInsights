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

type RouteReference = { callId: string; turn: number; depth: number };

function RouteExplorer({ cluster, onOpenCall }: { cluster: ConversationCluster; onOpenCall: (id: string) => void }) {
  const [rootCallId, setRootCallId] = useState(cluster.calls[0]?.call_id ?? "");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const rootCall = cluster.calls.find(call => call.call_id === rootCallId) ?? cluster.calls[0];
  const routeKey = (callId: string, turn: number) => `${callId}:${turn}`;
  const findTurn = (callId: string, turn: number) => cluster.calls.find(call => call.call_id === callId)?.turns.find(item => item.turn === turn);
  const nextRoutes = (callId: string, turn: number): Array<{ callId: string; turn: number }> => {
    const call = cluster.calls.find(item => item.call_id === callId);
    const currentIndex = call?.turns.findIndex(item => item.turn === turn) ?? -1;
    const current = currentIndex >= 0 ? call?.turns[currentIndex] : undefined;
    const direct = currentIndex >= 0 ? call?.turns[currentIndex + 1] : undefined;
    const alternatives = (current?.alternatives ?? [])
      .map(option => ({ callId: option.call_id, turn: option.turn }))
      .filter(option => Boolean(findTurn(option.callId, option.turn)));
    const unique = new Map<string, { callId: string; turn: number }>();
    if (direct) unique.set(routeKey(callId, direct.turn), { callId, turn: direct.turn });
    alternatives.forEach(option => unique.set(routeKey(option.callId, option.turn), option));
    return [...unique.values()].slice(0, 4);
  };

  const rootTurn = rootCall?.turns[0];
  const queue: RouteReference[] = rootTurn ? [{ callId: rootCall.call_id, turn: rootTurn.turn, depth: 0 }] : [];
  const seen = new Set(queue.map(route => routeKey(route.callId, route.turn)));
  const routes: RouteReference[] = [];
  const links: Array<{ from: string; to: string }> = [];
  while (queue.length) {
    const route = queue.shift();
    if (!route) continue;
    routes.push(route);
    if (route.depth >= 6 || !expanded.has(routeKey(route.callId, route.turn))) continue;
    nextRoutes(route.callId, route.turn).forEach(child => {
      const childKey = routeKey(child.callId, child.turn);
      links.push({ from: routeKey(route.callId, route.turn), to: childKey });
      if (!seen.has(childKey)) {
        seen.add(childKey);
        queue.push({ ...child, depth: route.depth + 1 });
      }
    });
  }

  const columns = new Map<number, RouteReference[]>();
  routes.forEach(route => columns.set(route.depth, [...(columns.get(route.depth) ?? []), route]));
  const nodes: Node[] = routes.map(route => {
    const current = findTurn(route.callId, route.turn);
    const column = columns.get(route.depth) ?? [];
    const row = column.findIndex(item => routeKey(item.callId, item.turn) === routeKey(route.callId, route.turn));
    const hasChildren = nextRoutes(route.callId, route.turn).length > 0;
    const isOpen = expanded.has(routeKey(route.callId, route.turn));
    const color = current?.speaker.toLowerCase() === "agent" ? "#7ac8ff" : "#b7a1ff";
    return { id: routeKey(route.callId, route.turn), position: { x: route.depth * 420, y: row * 225 }, sourcePosition: Position.Right, targetPosition: Position.Left, style: { width: 350, background: "var(--panel-strong)", color: "var(--text)", border: `2px solid ${color}`, borderRadius: 16, padding: 18, textAlign: "left" as const }, data: { label: <><small>{current?.speaker.toUpperCase()} / {route.callId} / TURN {route.turn}</small><p className="script-node-quote">{current?.text}</p><em>{hasChildren ? (isOpen ? "Click to collapse these routes" : `Click to reveal up to ${nextRoutes(route.callId, route.turn).length} next routes`) : "End of this observed route"}</em></> } };
  });
  const edges: Edge[] = links.map(link => ({ id: `${link.from}-${link.to}`, source: link.from, target: link.to, label: "next route", animated: true, style: { stroke: "#7ac8ff", strokeWidth: 1.8 }, labelStyle: { fill: "var(--text)", fontSize: 11 }, labelBgStyle: { fill: "var(--bg-soft)" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#7ac8ff" } }));
  const toggleRoute = (id: string) => setExpanded(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return <section className="transcript-story">
    <div className="script-navigation">
      <label>Start from observed call<select value={rootCall?.call_id ?? ""} onChange={event => { setRootCallId(event.target.value); setExpanded(new Set()); }}>{cluster.calls.map(call => <option key={call.call_id} value={call.call_id}>{call.call_id} / {call.outcome}</option>)}</select></label>
      {rootCall && <button className="ghost-button" onClick={() => onOpenCall(rootCall.call_id)}>Open full starting transcript</button>}
      <button className="ghost-button" onClick={() => setExpanded(new Set())}>Reset routes</button>
    </div>
    <p className="discovery-note">This is a progressive script tree built from observed calls. Click any card once to reveal its next observed reply and up to three comparable reply routes. Click an expanded card again to collapse that branch.</p>
    <div className="discovery-canvas script-canvas route-canvas" aria-label="Progressive branching script route explorer">
      <ReactFlow key={`${rootCall?.call_id}-${[...expanded].join("-")}`} nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: .12 }} nodesDraggable nodesConnectable={false} minZoom={.18} maxZoom={2} onNodeClick={(_, node) => toggleRoute(node.id)}>
        <Background gap={24} color="var(--line-strong)" /><Controls showInteractive={false} />
      </ReactFlow>
    </div>
  </section>;
}

export default function TranscriptStoryGraph({ cluster, guide, onOpenCall, mode = "linear" }: {
  cluster: ConversationCluster; guide: boolean; onOpenCall: (id: string) => void; mode?: "linear" | "routes";
}) {
  if (mode === "routes") return <RouteExplorer cluster={cluster} onOpenCall={onOpenCall} />;
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
