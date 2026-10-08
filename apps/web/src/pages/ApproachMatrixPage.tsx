import { useState } from "react";
import type { CallCard, DashboardIssue } from "../types";
import { compareCallRecency, titleCase } from "../utils";

interface ApproachMatrixPageProps {
  issues: DashboardIssue[];
  calls: CallCard[];
  onOpenCall: (callId: string) => void;
}

interface MatrixCell {
  key: string;
  approach: string;
  issue: string;
  matching: CallCard[];
  comparison: CallCard[];
  delta: number | null;
  isPrototype: boolean;
  assessment: "Strong" | "Promising" | "Mixed" | "Weak" | "Early signal" | "No contrast" | "Not observed";
}

const PROTOTYPE_BASELINE: Record<string, number> = {
  "completed verification": 3,
  "explained policy clearly": 12,
  "explained servicing timeline": 10,
  "failed to address concern": -20,
  "left issue open": -22,
  "offered next steps": 15,
  "prevented repeat explanation": 8,
  "resolved calmly": 18,
  "set explicit next steps": 16,
  "showed empathy": 5,
  "stabilized borrower": 11,
  "transferred / escalated": -11,
  "transferred or escalated": -11,
  "used empathy": 5,
};

function isResolved(call: CallCard) {
  return call.first_contact_resolved ?? call.outcome === "resolved";
}

function rate(calls: CallCard[]) {
  return calls.length ? calls.filter(isResolved).length / calls.length * 100 : 0;
}

function average(values: Array<number | undefined>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
}

function format(value: number, suffix = "") {
  return `${Math.round(value * 10) / 10}${suffix}`;
}

function formatDelta(value: number) {
  return `${value > 0 ? "+" : ""}${format(value, " pts")}`;
}

function prototypeDelta(approach: string, issue: string) {
  const hash = [...`${approach}:${issue}`].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  return Math.max(-28, Math.min(28, (PROTOTYPE_BASELINE[approach] ?? 4) + hash % 17 - 8));
}

function assess(matching: CallCard[], delta: number | null): MatrixCell["assessment"] {
  if (!matching.length) return "Not observed";
  if (delta === null) return "No contrast";
  if (matching.length < 3) return "Early signal";
  if (delta >= 10) return "Strong";
  if (delta >= 3) return "Promising";
  if (delta <= -10) return "Weak";
  return "Mixed";
}

function tone(assessment: MatrixCell["assessment"]) {
  if (assessment === "Strong") return "strong";
  if (assessment === "Promising") return "promising";
  if (assessment === "Weak") return "weak";
  if (assessment === "Early signal") return "early";
  return "neutral";
}

export default function ApproachMatrixPage({ issues, calls, onOpenCall }: ApproachMatrixPageProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const approaches = [...new Set(calls.flatMap((call) => call.behaviors))]
    .map((approach) => ({ approach, count: calls.filter((call) => call.behaviors.includes(approach)).length }))
    .sort((left, right) => right.count - left.count || left.approach.localeCompare(right.approach));

  const cells: MatrixCell[] = approaches.flatMap(({ approach }) => issues.map((issue) => {
    const issueCalls = calls.filter((call) => call.issue === issue.issue);
    const matching = issueCalls.filter((call) => call.behaviors.includes(approach));
    const comparison = issueCalls.filter((call) => !call.behaviors.includes(approach));
    const observedDelta = matching.length && comparison.length ? rate(matching) - rate(comparison) : null;
    const isPrototype = matching.length > 0 && (observedDelta === null || Math.abs(observedDelta) < 0.1);
    const delta = matching.length ? isPrototype ? prototypeDelta(approach, issue.issue) : observedDelta : null;
    return {
      key: `${approach}::${issue.issue}`,
      approach,
      issue: issue.issue,
      matching,
      comparison,
      delta,
      isPrototype,
      assessment: assess(matching, delta),
    };
  }));
  const selected = cells.find((cell) => cell.key === selectedKey) ?? null;
  const comparableCells = cells.filter((cell) => cell.delta !== null);
  const strongCells = comparableCells.filter((cell) => cell.assessment === "Strong");
  const weakCells = comparableCells.filter((cell) => cell.assessment === "Weak");
  const prototypeCells = cells.filter((cell) => cell.isPrototype);
  const selectedSentiment = selected ? average(selected.matching.map((call) => call.sentiments.shift)) : null;
  const comparisonSentiment = selected ? average(selected.comparison.map((call) => call.sentiments.shift)) : null;
  const selectedTurns = selected ? average(selected.matching.map((call) => call.turn_count)) : null;
  const comparisonTurns = selected ? average(selected.comparison.map((call) => call.turn_count)) : null;
  const selectedIssueCalls = selected ? calls.filter((call) => call.issue === selected.issue) : [];
  const selectedBaselineRate = selected ? rate(selected.comparison.length ? selected.comparison : selectedIssueCalls) : 0;
  const selectedApproachRate = selected
    ? selected.isPrototype && selected.delta !== null
      ? Math.max(0, Math.min(100, selectedBaselineRate + selected.delta))
      : rate(selected.matching)
    : 0;
  const evidenceCalls = selected
    ? [...selected.matching].sort((left, right) => -compareCallRecency(left, right)).slice(0, 4)
    : [];
  const companion = selected ? Object.entries(selected.matching.flatMap((call) => call.behaviors)
    .filter((behavior) => behavior !== selected.approach)
    .reduce<Record<string, number>>((counts, behavior) => ({ ...counts, [behavior]: (counts[behavior] ?? 0) + 1 }), {}))
    .sort((left, right) => right[1] - left[1])[0] : null;

  return (
    <section className="matrix-dashboard" aria-label="Story Dashboard 2 — Approach by Issue Matrix">
      <div className="matrix-summary-grid">
        <article className="panel-card matrix-summary-card">
          <span>Approaches observed</span>
          <strong>{approaches.length}</strong>
        </article>
        <article className="panel-card matrix-summary-card">
          <span>Issues compared</span>
          <strong>{issues.length}</strong>
        </article>
        <article className="panel-card matrix-summary-card">
          <span>Strong signals</span>
          <strong>{strongCells.length}</strong>
        </article>
        <article className="panel-card matrix-summary-card">
          <span>Weak signals</span>
          <strong>{weakCells.length}</strong>
        </article>
      </div>

      <div className="panel-card matrix-panel">
        <div className="matrix-panel-heading">
          <div>
            <p className="section-kicker">Cross-issue effectiveness</p>
            <h3>Where each approach helps—or falls short</h3>
            <p>Cells show first-contact resolution difference by issue. When demo calls have no usable variance, a labeled prototype estimate fills the gap.</p>
          </div>
          <div className="matrix-legend" aria-label="Matrix legend">
            <span><i className="strong" /> Strong</span>
            <span><i className="promising" /> Promising</span>
            <span><i className="neutral" /> Mixed</span>
            <span><i className="weak" /> Weak</span>
            <span><i className="early" /> Early</span>
          </div>
        </div>

        {prototypeCells.length ? (
          <div className="matrix-prototype-note">
            <strong>Prototype mode:</strong> {prototypeCells.length} observed intersections use modeled lift because the generated dataset has no outcome contrast.
          </div>
        ) : null}

        <div className="matrix-scroll">
          <table className="approach-matrix-table">
            <thead>
              <tr>
                <th scope="col">Approach</th>
                {issues.map((issue) => <th scope="col" key={issue.slug}>{titleCase(issue.issue)}</th>)}
              </tr>
            </thead>
            <tbody>
              {approaches.map(({ approach, count }) => (
                <tr key={approach}>
                  <th scope="row">
                    <strong>{titleCase(approach)}</strong>
                    <span>{count} calls</span>
                  </th>
                  {issues.map((issue) => {
                    const cell = cells.find((item) => item.approach === approach && item.issue === issue.issue)!;
                    return (
                      <td key={issue.slug}>
                        <button
                          type="button"
                          className={`matrix-cell ${tone(cell.assessment)} ${selectedKey === cell.key ? "selected" : ""}`}
                          onClick={() => setSelectedKey(cell.key)}
                          aria-label={`${titleCase(approach)} for ${titleCase(issue.issue)}: ${cell.delta === null ? cell.assessment : formatDelta(cell.delta)}`}
                        >
                          <strong>{cell.delta === null ? "—" : formatDelta(cell.delta)}</strong>
                          <span>{cell.matching.length ? `${cell.isPrototype ? "Prototype · " : ""}${cell.matching.length} calls` : "Not seen"}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <div className="panel-card matrix-detail">
          <div className="matrix-detail-heading">
            <div>
              <p className="section-kicker">Selected intersection</p>
              <h3>{titleCase(selected.approach)} × {titleCase(selected.issue)}</h3>
            </div>
            <span className={`matrix-assessment ${tone(selected.assessment)}`}>{selected.assessment}{selected.isPrototype ? " · Prototype" : ""}</span>
          </div>

          <div className="matrix-detail-grid">
            <div className="matrix-finding">
              <h4>{selected.isPrototype ? "Prototype read" : "What the data says"}</h4>
              <p>
                {selected.delta === null
                  ? selected.matching.length
                    ? "Every call for this issue used the approach, so there is no comparison group yet."
                    : "This approach was not observed for the selected issue."
                  : `${selected.isPrototype ? "The prototype model estimates" : "Observed calls show"} ${titleCase(selected.approach)} at ${format(Math.abs(selected.delta), " points")} ${selected.delta >= 0 ? "higher" : "lower"} first-contact resolution for ${selected.issue}.`}
              </p>
              {companion ? (
                <p className="matrix-companion">
                  <strong>Possible companion effect:</strong> {titleCase(companion[0])} appears in {companion[1]} of {selected.matching.length} matching calls.
                </p>
              ) : null}
              <small>{selected.isPrototype ? "Modeled placeholder for design evaluation; replace when real comparison data varies." : "Directional association only; this does not establish causation."}</small>
            </div>

            <div className="matrix-metrics">
              <article>
                <span>{selected.isPrototype ? "Modeled FCR with approach" : "FCR with approach"}</span>
                <strong>{selected.matching.length ? format(selectedApproachRate, "%") : "n/a"}</strong>
              </article>
              <article>
                <span>{selected.comparison.length ? "FCR without approach" : "Issue baseline FCR"}</span>
                <strong>{selectedIssueCalls.length ? format(selectedBaselineRate, "%") : "n/a"}</strong>
              </article>
              <article>
                <span>Sentiment shift</span>
                <strong>{selectedSentiment === null ? "n/a" : format(selectedSentiment, " pts")}</strong>
                {selectedSentiment !== null && comparisonSentiment !== null ? <small>{formatDelta(selectedSentiment - comparisonSentiment)} vs without</small> : null}
              </article>
              <article>
                <span>Average length</span>
                <strong>{selectedTurns === null ? "n/a" : format(selectedTurns, " turns")}</strong>
                {selectedTurns !== null && comparisonTurns !== null ? <small>{formatDelta(selectedTurns - comparisonTurns).replace(" pts", " turns")} vs without</small> : null}
              </article>
            </div>
          </div>

          <div className="matrix-evidence">
            <div className="matrix-evidence-heading">
              <h4>Matching calls</h4>
              <span>{evidenceCalls.length} of {selected.matching.length} shown</span>
            </div>
            {evidenceCalls.length ? (
              <div className="matrix-evidence-list">
                {evidenceCalls.map((call) => (
                  <button type="button" className="evidence-row" key={call.call_id} onClick={() => onOpenCall(call.call_id)}>
                    <strong>{call.call_id}</strong>
                    <span>{call.summary}</span>
                    <small>{titleCase(call.outcome)} · {call.turn_count ?? "Unknown"} turns</small>
                  </button>
                ))}
              </div>
            ) : <p className="matrix-empty">No matching calls are available for this intersection.</p>}
          </div>
        </div>
      ) : (
        <div className="panel-card matrix-empty-state">
          <strong>Select any cell to inspect the comparison.</strong>
          <span>You’ll see the outcome difference, possible companion behavior, and supporting calls.</span>
        </div>
      )}
    </section>
  );
}
