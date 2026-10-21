import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ArrowUpRight, Plus, X } from "lucide-react";
import { api } from "../api";
import { callApproaches, compareCohorts, summarizeApproach, usesApproach } from "../approachComparison";
import type { CallCard, DashboardIssue } from "../types";
import { compareCallRecency, titleCase } from "../utils";

type Summary = ReturnType<typeof summarizeApproach>;
const number = (value: number | null, unit = "") => value === null ? "—" : `${Math.round(value * 10) / 10}${unit}`;
const OUTCOMES = ["resolved", "follow-up needed", "callback requested", "escalated", "unresolved"];
const OUTCOME_LINKED = new Set(["resolved calmly", "stabilized borrower", "left issue open", "failed to address concern"]);
const SIDES = ["a", "b", "c", "d"];

function EvidenceCall({ call, onOpenCall }: { call: CallCard; onOpenCall: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const query = useQuery({ queryKey: ["call", call.call_id], queryFn: () => api.getCall(call.call_id), enabled: expanded });
  return <article className="compare-call">
    <div><strong>{call.call_id}</strong><span>{titleCase(call.outcome)}</span></div>
    <p>{call.summary}</p>
    <footer><span>{titleCase(call.issue)} · {call.turn_count ?? "Unknown"} turns</span>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Hide transcript" : "Quick read"}</button>
      <button type="button" onClick={() => onOpenCall(call.call_id)} aria-label={`Open transcript ${call.call_id}`}><ArrowUpRight size={15} />Open</button>
    </footer>
    {expanded ? <div className="compare-excerpt">
      {query.isPending ? <p role="status">Loading transcript…</p> : query.isError ? <p role="alert">Couldn’t load the transcript. <button type="button" onClick={() => query.refetch()}>Try again</button></p>
        : query.data.turns.map((turn, index) => <p key={index}><strong>{turn.speaker}</strong> {turn.text}</p>)}
    </div> : null}
  </article>;
}

function ApproachPanel({ side, approach, calls, summary, observed, total, onOpenCall }: {
  side: string; approach: string; calls: CallCard[]; summary: Summary;
  observed: number; total: number; onOpenCall: (id: string) => void;
}) {
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [visibleCalls, setVisibleCalls] = useState(3);
  const evidence = calls.filter((call) => evidenceFilter === "all" || call.outcome === evidenceFilter)
    .sort((left, right) => -compareCallRecency(left, right));
  const companions = Object.entries(calls.flatMap(callApproaches).filter((label) => label !== approach)
    .reduce<Record<string, number>>((counts, label) => { counts[label] = (counts[label] ?? 0) + 1; return counts; }, {}))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
  const outcomeEntries = Object.entries(summary.outcomes).sort(([left], [right]) => OUTCOMES.indexOf(left) - OUTCOMES.indexOf(right));
  return <section className={`compare-study compare-${side}`} aria-label={`Approach ${side.toUpperCase()}: ${titleCase(approach)}`}>
    <header><span className="compare-letter">{side.toUpperCase()}</span><div><h3>{titleCase(approach) || "Choose an approach"}</h3>
      <p>{number(total ? observed / total * 100 : null, "%")} usage{OUTCOME_LINKED.has(approach) ? " · Outcome-linked" : ""}</p></div>
    </header>
    <div className="compare-study-summary">
      <div title={summary.interval ? `95% resolution interval: ${number(summary.interval[0], "%")}–${number(summary.interval[1], "%")}` : "No calls"}><span>Resolved</span><strong>{number(summary.resolution, "%")}</strong><small>{summary.resolved}/{summary.count} calls{summary.count > 0 && summary.count < 10 ? " · Small sample" : ""}</small></div>
    </div>
    <div className="compare-outcomes" aria-label="Outcome distribution">
      <div className="compare-outcome-bar">{outcomeEntries.map(([outcome, count]) =>
        <span key={outcome} className={`compare-outcome-${outcome.replaceAll(" ", "-")}`} style={{ width: `${count / summary.count * 100}%` }} title={`${titleCase(outcome)}: ${count} calls`} />)}</div>
      <div className="compare-outcome-legend">{outcomeEntries.map(([outcome, count]) => <span key={outcome}><i className={`compare-outcome-${outcome.replaceAll(" ", "-")}`} />{titleCase(outcome)} <strong>{count}</strong></span>)}</div>
    </div>
    <div className="compare-companions"><h4>Used alongside</h4>{companions.length ? companions.map(([label, count]) => <span key={label}>{titleCase(label)} <strong>{count}/{summary.count}</strong></span>) : <p>None observed.</p>}</div>
    <div className="compare-evidence-heading"><h4>Transcripts</h4><label><span className="sr-only">Filter approach {side.toUpperCase()} evidence by outcome</span>
      <select value={evidenceFilter} onChange={(event) => { setEvidenceFilter(event.target.value); setVisibleCalls(3); }}><option value="all">All outcomes</option>{OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{titleCase(outcome)}</option>)}</select></label></div>
    <div className="compare-evidence-list">{evidence.slice(0, visibleCalls).map((call) => <EvidenceCall key={call.call_id} call={call} onOpenCall={onOpenCall} />)}
      {!evidence.length ? <p className="compare-empty">No matching calls.</p> : <div className="compare-evidence-pagination"><small>{Math.min(evidence.length, visibleCalls)}/{evidence.length} calls</small>
        {visibleCalls < evidence.length ? <button type="button" onClick={() => setVisibleCalls(visibleCalls + 3)}>Show more calls</button> : null}
        {visibleCalls > 3 ? <button type="button" onClick={() => setVisibleCalls(3)}>Show fewer</button> : null}</div>}
    </div>
  </section>;
}

export default function ApproachComparisonPage({ issues, calls, onOpenCall }: {
  issues: DashboardIssue[]; calls: CallCard[]; onOpenCall: (id: string) => void;
}) {
  const available = [...new Set(calls.flatMap(callApproaches))].sort();
  const [issue, setIssue] = useState("");
  const [selected, setSelected] = useState(["offered next steps", "transferred / escalated"]);
  const [excludeShared, setExcludeShared] = useState(true);
  const [rankingMetric, setRankingMetric] = useState("resolution");
  const scrollPosition = useRef(0);
  useLayoutEffect(() => {
    window.scrollTo({ top: scrollPosition.current, behavior: "instant" });
    return () => { scrollPosition.current = window.scrollY; };
  }, []);
  const approaches = [...new Set(selected.filter((item) => available.includes(item)))];
  for (const approach of available) {
    if (approaches.length >= Math.min(Math.max(2, selected.length), available.length, 4)) break;
    if (!approaches.includes(approach)) approaches.push(approach);
  }
  function selectApproach(index: number, approach: string) {
    const next = [...approaches];
    const existing = next.indexOf(approach);
    if (existing >= 0) next[existing] = next[index];
    next[index] = approach;
    setSelected(next);
  }
  const scoped = calls.filter((call) => !issue || call.issue === issue);
  const { groups, shared } = compareCohorts(scoped, approaches, excludeShared);
  const summaries = groups.map(summarizeApproach);
  const metricRows = [
    { label: "Calls", values: summaries.map((item) => item.count), unit: "", deltaUnit: "", higher: null },
    { label: "Resolution", values: summaries.map((item) => item.resolution), unit: "%", deltaUnit: " pp", higher: true },
    { label: "Sentiment change", values: summaries.map((item) => item.sentiment.value), unit: "", deltaUnit: " pts", higher: true },
    { label: "Average length", values: summaries.map((item) => item.turns.value), unit: " turns", deltaUnit: " turns", higher: false },
    { label: "Hold / transfer", values: summaries.map((item) => item.friction), unit: "%", deltaUnit: " pp", higher: false },
    { label: "Escalation", values: summaries.map((item) => item.escalation), unit: "%", deltaUnit: " pp", higher: false },
  ];
  const ranked = available.map((approach) => ({ approach, summary: summarizeApproach(scoped.filter((call) => usesApproach(call, approach))) }))
    .sort((x, y) => {
      const value = (summary: Summary) => rankingMetric === "sentiment" ? summary.sentiment.value : rankingMetric === "length" ? summary.turns.value : summary.resolution;
      const xv = value(x.summary), yv = value(y.summary);
      if (xv === null || yv === null) return xv === yv ? 0 : xv === null ? 1 : -1;
      return (rankingMetric === "length" ? xv - yv : yv - xv) || y.summary.count - x.summary.count || x.approach.localeCompare(y.approach);
    });
  const issueMix = issues.map((item) => ({ label: item.issue, counts: groups.map((group) => group.filter((call) => call.issue === item.issue).length) }))
    .filter((item) => item.counts.some(Boolean)).sort((x, y) => y.counts.reduce((sum, count) => sum + count, 0) - x.counts.reduce((sum, count) => sum + count, 0));

  if (available.length < 2) return <section className="panel-card compare-empty"><h3>At least two approaches are needed.</h3></section>;

  return <section className="compare-dashboard" aria-label="Approach comparison dashboard" style={{ "--compare-count": approaches.length } as CSSProperties}>
    <section className="panel-card compare-controls" aria-label="Comparison controls">
      <div className="compare-toolbar">
        <label className="compare-scope">Issue<select value={issue} onChange={(event) => setIssue(event.target.value)}><option value="">All issues</option>{issues.map((item) => <option key={item.slug} value={item.issue}>{titleCase(item.issue)}</option>)}</select></label>
        <label className="compare-overlap"><input type="checkbox" checked={excludeShared} onChange={(event) => setExcludeShared(event.target.checked)} />Exclude shared calls</label>
        <span className="compare-scope-count" aria-live="polite">{scoped.length} calls · {shared.length} shared{excludeShared ? " excluded" : " included"}</span>
        {approaches.length === 2 ? <button className="compare-swap" type="button" aria-label="Swap approaches" onClick={() => setSelected([...approaches].reverse())}><ArrowLeftRight size={16} /></button> : null}
        <button className="compare-add" type="button" disabled={approaches.length >= 4 || approaches.length >= available.length} onClick={() => setSelected([...approaches, available.find((item) => !approaches.includes(item))!])}><Plus size={16} />Add approach</button>
      </div>
      <div className="compare-selections">
        {approaches.map((approach, index) => <div className={`compare-choice compare-${SIDES[index]}`} key={index}>
          <div className="compare-choice-heading"><label htmlFor={`compare-approach-${index}`}>Approach {SIDES[index].toUpperCase()}</label>
            {approaches.length > 2 ? <button type="button" aria-label={`Remove approach ${SIDES[index].toUpperCase()}`} onClick={() => setSelected(approaches.filter((_, position) => position !== index))}><X size={15} /></button> : null}</div>
          <select id={`compare-approach-${index}`} value={approach} onChange={(event) => selectApproach(index, event.target.value)}>{available.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select>
        </div>)}
      </div>
      {excludeShared && shared.length > 0 && groups.every((group) => !group.length) ? <button type="button" className="compare-include-shared" onClick={() => setExcludeShared(false)}>No exclusive calls. Include shared calls</button> : null}
    </section>

    <section className="panel-card compare-metrics"><div className="compare-section-heading"><h3>Comparison</h3><span>Differences vs A</span></div>
      <div className="compare-table-scroll"><table><thead><tr><th scope="col">Measure</th>{approaches.map((approach, index) => <th scope="col" className={`compare-${SIDES[index]}-text`} key={approach} title={titleCase(approach)}>{SIDES[index].toUpperCase()}</th>)}</tr></thead>
        <tbody>{metricRows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, index) => {
          const delta = value === null || row.values[0] === null ? null : Math.round((value - row.values[0]) * 10) / 10;
          const sampleCount = row.label === "Sentiment change" ? summaries[index].sentiment.count : row.label === "Average length" ? summaries[index].turns.count : null;
          return <td key={index} title={sampleCount === null ? undefined : `${sampleCount} calls with data`}><strong>{number(value, row.unit)}</strong>
            {index > 0 && row.higher !== null && delta !== null ? <span>{delta > 0 ? "+" : ""}{number(delta, row.deltaUnit)}</span> : null}</td>;
        })}</tr>)}</tbody></table></div>
    </section>

    <div className="compare-studies" data-count={approaches.length}>
      {approaches.map((approach, index) => <ApproachPanel key={`${issue}:${approaches.join("|")}:${approach}:${excludeShared}`} side={SIDES[index]} approach={approach} calls={groups[index]} summary={summaries[index]} observed={scoped.filter((call) => usesApproach(call, approach)).length} total={scoped.length} onOpenCall={onOpenCall} />)}
    </div>

    <div className="compare-bottom-grid">
      <section className="panel-card"><div className="compare-section-heading"><h3>Issue mix</h3></div>
        <div className="compare-mix-legend">{summaries.map((summary, index) => <span className={`compare-${SIDES[index]}-text`} key={index}>{SIDES[index].toUpperCase()} · {summary.count} calls</span>)}</div>
        {issueMix.length ? issueMix.map((item) => <div className="compare-mix-row" key={item.label}><strong>{titleCase(item.label)}</strong><div>
          {item.counts.map((count, index) => { const total = summaries[index].count; const percent = total ? count / total * 100 : 0; return <div className={`compare-mix-track compare-${SIDES[index]}`} key={index}><span style={{ width: `${percent}%` }} /><small>{SIDES[index].toUpperCase()} {count} · {number(percent, "%")}</small></div>; })}
        </div></div>) : <p className="compare-empty">No comparison calls.</p>}
      </section>
      <section className="panel-card"><div className="compare-section-heading"><h3>Approaches</h3><label><span className="sr-only">Rank approaches by</span><select value={rankingMetric} onChange={(event) => setRankingMetric(event.target.value)}><option value="resolution">Resolution</option><option value="sentiment">Sentiment</option><option value="length">Call length</option></select></label></div>
        <div className="compare-ranking">{ranked.map(({ approach, summary }) => <div key={approach}><div><strong title={OUTCOME_LINKED.has(approach) ? "This label is partly derived from call outcomes." : undefined}>{titleCase(approach)}</strong><small>{summary.count} calls · {number(rankingMetric === "sentiment" ? summary.sentiment.value : rankingMetric === "length" ? summary.turns.value : summary.resolution, rankingMetric === "resolution" ? "% resolved" : rankingMetric === "length" ? " turns" : " sentiment")}</small></div>
          {approaches.map((selectedApproach, index) => <button type="button" className={`compare-${SIDES[index]}-text`} key={index} aria-label={`Compare ${titleCase(approach)} as ${SIDES[index].toUpperCase()}`} aria-pressed={selectedApproach === approach} onClick={() => selectApproach(index, approach)}>{SIDES[index].toUpperCase()}</button>)}</div>)}</div>
      </section>
    </div>
  </section>;
}
