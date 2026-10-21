import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Background, Controls, MarkerType, Position, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { ArrowRight, FlaskConical, Network, RefreshCw } from "lucide-react";
import "@xyflow/react/dist/style.css";
import "./solutionStory.css";
import { api } from "../api";
import type { DiscoverySignal, SolutionCluster } from "../solutionTypes";
import type { WorkspacePayload } from "../types";
import TranscriptStoryGraph from "./TranscriptStoryGraph";
import ScriptPilotPanel from "./ScriptPilotPanel";

const pct = (value: number) => `${Math.round(value * 100)}%`;
const deltaLabel = (value: number | null) => value === null ? "No comparison" : `${value > 0 ? "+" : ""}${value} pts`;
const tone = (s: DiscoverySignal) => s.status === "higher resolution" ? "#6ee7b7" : s.status === "lower resolution" ? "#fb927d" : "#efc66d";

function StoryGraph({ cluster, signals, selected, onSelect }: {
  cluster: SolutionCluster; signals: DiscoverySignal[]; selected?: DiscoverySignal; onSelect: (id: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const base = { background: "var(--panel-strong)", color: "var(--text)", border: "1px solid var(--line-strong)", borderRadius: 18, padding: 18, width: 235, textAlign: "left" as const };
    const nodes: Node[] = [{ id: "issue", position: { x: 0, y: 215 }, sourcePosition: Position.Right, style: { ...base, borderColor: "#7ac8ff" }, data: { label: <><small>01 / CUSTOMER PROBLEM</small><h3>{cluster.issue}</h3><span>{cluster.count} calls · {cluster.baseline}% resolved</span></> } }];
    const edges: Edge[] = [];
    signals.slice(0, 5).forEach((s, index) => {
      nodes.push({ id: s.id, position: { x: 340, y: index * 155 }, sourcePosition: Position.Right, targetPosition: Position.Left, style: { ...base, width: 275, borderColor: tone(s), boxShadow: s.id === selected?.id ? `0 0 0 3px ${tone(s)}55` : undefined }, data: { label: <><small>02 / {s.kind.toUpperCase()}</small><h3>{s.label}</h3><span>{s.support} calls · {deltaLabel(s.delta)}</span><em>{s.status}</em></> } });
      edges.push({ id: `in-${s.id}`, source: "issue", target: s.id, style: { stroke: "#7ac8ff", strokeWidth: 1.7 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#7ac8ff" } });
      for (const [target, count, color] of [["resolved", s.resolved, "#6ee7b7"], ["other", s.other, "#fb927d"]] as const) {
        if (count) edges.push({ id: `${s.id}-${target}`, source: s.id, target, label: `${count} calls`, animated: s.id === selected?.id, style: { stroke: color, strokeWidth: 1 + count / Math.max(1, cluster.count) * 6, opacity: selected && selected.id !== s.id ? .35 : .85 }, labelStyle: { fill: "var(--text)", fontSize: 12 }, labelBgStyle: { fill: "var(--bg-soft)" }, markerEnd: { type: MarkerType.ArrowClosed, color } });
      }
    });
    nodes.push({ id: "resolved", position: { x: 765, y: 120 }, targetPosition: Position.Left, style: { ...base, borderColor: "#6ee7b7" }, data: { label: <><small>03 / CALL OUTCOME</small><h3>Resolved</h3><span>{cluster.resolved} unique calls in cluster</span></> } },
      { id: "other", position: { x: 765, y: 415 }, targetPosition: Position.Left, style: { ...base, borderColor: "#fb927d" }, data: { label: <><small>03 / CALL OUTCOME</small><h3>Not recorded as resolved</h3><span>{cluster.count - cluster.resolved} unique calls</span><em>Follow-up, callback, escalation or unresolved</em></> } });
    return { nodes, edges };
  }, [cluster, signals, selected]);
  return <div className="discovery-canvas" aria-label="Interactive issue to behavior to outcome graph">
    <ReactFlow key={`${cluster.slug}-${signals.slice(0, 5).map(s => s.id).join()}`} nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: .15 }} minZoom={.35} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} onNodeClick={(_, node) => { if (signals.some(s => s.id === node.id)) onSelect(node.id); }}>
      <Background color="var(--line-strong)" gap={24} /><Controls showInteractive={false} />
    </ReactFlow>
  </div>;
}

export default function SolutionStoryPage({ workspace, onOpenCall, onNavigate }: {
  workspace: WorkspacePayload; onOpenCall: (id: string) => void; onNavigate: (page: "strategies") => void;
}) {
  const query = useQuery({ queryKey: ["solutions", workspace], queryFn: api.getSolutions, staleTime: 60000 });
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState("behavior");
  const [selectedId, setSelectedId] = useState("");
  const [evidenceMode, setEvidenceMode] = useState("all");
  const [search, setSearch] = useState("");
  const [graphView, setGraphView] = useState("transcript");
  if (query.isLoading) return <div className="panel-card"><h3>Comparing language models across your calls…</h3><p>Building grouped validation results and evidence paths. The first request also loads the local semantic model.</p></div>;
  if (query.error || !query.data) return <div className="panel-card" role="alert"><h3>Solution analysis could not load</h3><p>{query.error instanceof Error ? query.error.message : "No response"}</p><button className="ghost-button" onClick={() => void query.refetch()}>Retry</button></div>;
  const report = query.data;
  const cluster = report.clusters.find(c => c.slug === slug) ?? report.clusters[0];
  if (!cluster) return <div className="panel-card">No clusters available. Load transcripts to begin.</div>;
  const signals = cluster.signals.filter(s => (kind === "all" || s.kind === kind) && s.label.toLowerCase().includes(search.toLowerCase()));
  const selected = signals.find(s => s.id === selectedId) ?? signals[0];
  const graphSignals = selected && !signals.slice(0, 5).includes(selected) ? [selected, ...signals.slice(0, 4)] : signals;
  const examples = selected ? evidenceMode === "counter" ? selected.counterexamples : selected.examples : [];
  const winner = report.benchmark.models[0];
  const conversation = report.conversations?.clusters.find(c => c.slug === cluster.slug);
  const directional = report.clusters.flatMap(c => c.signals).filter(s => s.status === "higher resolution" || s.status === "lower resolution").length;
  const eligibleText = new Set(conversation?.calls.flatMap(c => c.turns.filter(t => t.eligible).map(t => t.text)) ?? []);
  const exactLines = conversation?.exact_lines.filter(l => eligibleText.has(l.text)).sort((a, b) => Number(b.without_count > 0) - Number(a.without_count > 0) || Math.abs(b.rate - (b.without_rate ?? b.rate)) - Math.abs(a.rate - (a.without_rate ?? a.rate))).slice(0, 8) ?? [];
  return <section className="discovery-page">
    <header className="discovery-hero panel-card">
      <div><p className="section-kicker">The conversation / exact words and evidence</p><h2>Follow the words.<br />See what happened next.</h2><p>Start at “hello.” Unfold a stage, inspect the actual agent line, and compare what customers said next. Switch to Conversation guide for a complete source-backed script.</p></div>
      <div className="discovery-summary"><Network /><strong>{report.clusters.length}</strong><span>issue clusters</span><strong>{report.call_count}</strong><span>calls analyzed</span></div>
    </header>
    <div className="discovery-toolbar panel-card">
      <label>Issue cluster<select value={cluster.slug} onChange={e => { setSlug(e.target.value); setSelectedId(""); }}>
        {report.clusters.map(c => <option key={c.slug} value={c.slug}>{c.issue} ({c.count} calls)</option>)}
      </select></label>
      <label>Signal family<select value={kind} onChange={e => { setKind(e.target.value); setSelectedId(""); }}>
        {["behavior", "semantic", "verb", "phrase", "sequence", "early", "all"].map(k => <option key={k} value={k}>{k === "early" ? "Early actions" : k === "all" ? "All signals" : k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
      </select></label>
      <label>Find a response<input value={search} onChange={e => setSearch(e.target.value)} placeholder="explain, review, document…" /></label>
      <button className="ghost-button" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={15} /> Refresh</button>
    </div>
    <section className="panel-card">
      <div className="discovery-tabs" role="tablist" aria-label="Graph views">{[["transcript", "Call conversation"], ["guide", "Conversation guide"], ["signals", "Behavior map"]].map(([key, label]) => <button role="tab" aria-selected={graphView === key} className="ghost-button" key={key} onClick={() => setGraphView(key)}>{label}</button>)}</div>
      {graphView !== "signals" && conversation ? <TranscriptStoryGraph key={`${cluster.slug}-${graphView}`} cluster={conversation} guide={graphView === "guide"} onOpenCall={onOpenCall} /> : graphView !== "signals" ? <p>Restart the API to load the transcript graph.</p> : <p>Explore aggregate behavior associations below.</p>}
    </section>
    <section className="panel-card"><p className="section-kicker">Exactly what was observed / {cluster.issue}</p><h3>Exact wording and observed outcomes</h3><p>{cluster.resolved}/{cluster.count} calls resolved in this cluster. {directional} signals passed the adjusted evidence threshold across this corpus; these remain observational, not proven effects. Counts below describe the exact line, not a generic behavior label.</p>
      <div className="discovery-table-wrap"><table><thead><tr><th>Exact agent line</th><th>Resolved with it</th><th>Resolved without it</th><th>Reading</th></tr></thead><tbody>{exactLines.map(l => <tr key={l.text}><td className="exact-line-cell">“{l.text}”</td><td>{l.resolved}/{l.support} ({l.rate}%)</td><td>{l.without_count ? `${l.without_resolved}/${l.without_count} (${l.without_rate}%)` : "No comparator"}</td><td>{!l.without_count ? "Cannot isolate effect" : l.rate > (l.without_rate ?? 0) ? "Higher observed rate; unvalidated" : l.rate < (l.without_rate ?? 0) ? "Lower observed rate; unvalidated" : "Same observed rate"}</td></tr>)}</tbody></table></div>
    </section>
    <details open={graphView === "signals"} className="panel-card"><summary>Behavior map and statistical evidence</summary>
    <section className="discovery-graph-panel panel-card">
      <div className="panel-heading"><div><p className="section-kicker">01 / Follow the paths</p><h3>{cluster.issue}</h3></div><span>{cluster.baseline}% cluster resolution</span></div>
      <div className="discovery-legend"><span className="positive">Higher resolution</span><span className="negative">Lower resolution</span><span className="uncertain">Uncertain / limited comparison</span></div>
      {signals.length ? <StoryGraph cluster={cluster} signals={graphSignals} selected={selected} onSelect={id => { setSelectedId(id); setEvidenceMode("all"); }} /> : <p className="empty-copy">No repeated signals match this filter. Try another signal family or cluster.</p>}
      <p className="discovery-note">Showing up to five paths. Line width represents call count. Calls may share several paths; the graph describes association. Escalation or follow-up can be an appropriate outcome.</p>
    </section>
    <div className="discovery-detail-grid">
      <section className="panel-card"><p className="section-kicker">02 / Compare responses</p><h3>What looks helpful—and what is unclear</h3><div className="discovery-signal-list">
        {signals.map(s => <button key={s.id} aria-pressed={s.id === selected?.id} className={`discovery-signal ${s.id === selected?.id ? "active" : ""}`} onClick={() => { setSelectedId(s.id); setEvidenceMode("all"); }}>
          <span><strong>{s.label}</strong><small>{s.support} with · {s.comparison_count} without · {s.status}</small></span><b style={{ color: tone(s) }}>{deltaLabel(s.delta)}</b>
        </button>)}
      </div></section>
      <section className="panel-card discovery-evidence"><p className="section-kicker">03 / Check the evidence</p>{selected ? <>
        <h3>{selected.label}</h3><p className="discovery-verdict" style={{ color: tone(selected) }}>{selected.status}</p>
        <div className="discovery-rates"><div><strong>{selected.rate}%</strong><span>with response · n={selected.support}</span></div><div><strong>{selected.without_rate === null ? "—" : `${selected.without_rate}%`}</strong><span>without · n={selected.comparison_count}</span></div></div>
        <p>{selected.interval ? `Estimated difference: ${deltaLabel(selected.delta)}. 95% posterior interval: ${selected.interval[0]} to ${selected.interval[1]} points. Adjusted q=${selected.q}.` : "Every compared call contains this response, so its effect cannot be separated from the cluster baseline."}</p>
        <div className="discovery-tabs"><button className="ghost-button" aria-pressed={evidenceMode === "all"} onClick={() => setEvidenceMode("all")}>All evidence ({selected.examples.length})</button><button className="ghost-button" aria-pressed={evidenceMode === "counter"} onClick={() => setEvidenceMode("counter")}>Not resolved ({selected.counterexamples.length})</button></div>
        <div className="discovery-quotes">{examples.length ? examples.map(e => <article key={e.call_id}><div><strong>{e.call_id}</strong><span>{e.outcome}</span></div>{e.quotes.map((q, i) => <blockquote key={`${q.turn}-${i}`}><small>Agent · turn {q.turn}</small>{q.text}</blockquote>)}<button className="ghost-button small" onClick={() => onOpenCall(e.call_id)}>Open transcript <ArrowRight size={14} /></button></article>) : <p>No counterexamples in this sample. This does not establish general reliability.</p>}</div>
        <details><summary>Comparison calls without this response ({selected.comparison_count})</summary><div className="solution-evidence">{selected.comparison_call_ids.map(id => <button key={id} onClick={() => onOpenCall(id)}>{id}</button>)}</div></details>
      </> : <p>Select a response to inspect its supporting turns.</p>}</section>
    </div>
    </details>
    <details className="panel-card"><summary>Measured techniques and prediction results</summary>
    <section className="panel-card"><div className="panel-heading"><div><p className="section-kicker">04 / What survived validation?</p><h3>{report.benchmark.models.length} approaches, the same held-out calls</h3></div><FlaskConical /></div>
      <p>{report.benchmark.note}</p><p>{report.benchmark.groups} opening-template groups · {report.benchmark.folds} folds · {report.benchmark.status}</p><p>Semantic comparison: {report.semantic_status}</p>
      {winner && <p className="discovery-verdict">{winner.improvement > 0 ? `${winner.name} has the lowest measured prediction error (${winner.brier} Brier). This ranks prediction methods; it does not prove an action solves the issue.` : "No tested method beats the prior-only baseline on Brier score. More varied evidence is needed before recommending a response."}</p>}
      <div className="discovery-table-wrap"><table><thead><tr><th>Method</th><th>Brier ↓</th><th>Gain vs baseline ↑</th><th>Balanced accuracy</th><th>Macro F1</th><th>ROC AUC</th></tr></thead><tbody>{report.benchmark.models.map(m => <tr key={m.name}><td>{m.name}</td><td>{m.brier.toFixed(4)}</td><td>{m.improvement > 0 ? "+" : ""}{m.improvement.toFixed(4)}</td><td>{pct(m.balanced_accuracy)}</td><td>{pct(m.macro_f1)}</td><td>{m.auc.toFixed(3)}</td></tr>)}</tbody></table></div>
    </section>
    <section className="panel-card"><h3>Context-adjusted action comparison</h3><p>{report.conversations?.causal_note}</p><p>Alternative replies are retrieved using {report.conversations?.retrieval_method}. Matching does not make different calls randomized counterfactuals.</p>
      <div className="discovery-table-wrap"><table><thead><tr><th>Action at sixth agent turn</th><th>Calls</th><th>Overlap</th><th>Adjusted difference</th><th>Status</th></tr></thead><tbody>{report.conversations?.adjusted.map(a => <tr key={a.behavior}><td>{a.behavior}</td><td>{a.n}</td><td>{a.overlap === null ? "—" : `${a.overlap}%`}</td><td>{a.estimate === null ? "Withheld" : `${a.estimate} pts`}</td><td>{a.status}</td></tr>)}</tbody></table></div>
    </section>
    </details>
    <ScriptPilotPanel key={cluster.slug} slug={cluster.slug} />
    <section className="panel-card"><p className="section-kicker">05 / What to test next</p><h3>Use a response as a coaching hypothesis</h3><p>Choose an action before the outcome, define independent resolution and repeat-contact measures, then compare coached and control calls within comparable issues. Current data contains repeated synthetic scripts and inferred outcomes.</p><button className="primary-button" onClick={() => onNavigate("strategies")}>Open action plans <ArrowRight size={15} /></button>
      <details className="discovery-methods"><summary>Methods, limitations, and 2025–2026 research</summary><p>Implemented: evidence-linked rule extraction, action-verb lexicon, TF-IDF phrase discovery, ordered behavior pairs, early-turn features, grouped model comparison, Beta posterior intervals, Fisher exact tests and Benjamini–Hochberg correction.</p>{report.notes.map(note => <p key={note}>{note}</p>)}{report.sources.map(s => <p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a><br />{s.use}</p>)}</details>
    </section>
  </section>;
}
