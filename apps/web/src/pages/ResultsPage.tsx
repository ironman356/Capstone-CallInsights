import { useState } from "react";
import type { CallCard, DashboardIssue } from "../types";
import { titleCase } from "../utils";

interface ResultsPageProps {
  issues: DashboardIssue[];
  calls: CallCard[];
}

interface StatRow {
  label: string;
  value: number;
  average: number;
  higherIsBetter: boolean;
  suffix: string;
  values: Array<{ approach: string; value: number }>;
}

function formatStat(value: number, suffix: string) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}${suffix}`;
}

function formatDelta(value: number, suffix: string) {
  return `${value > 0 ? "+" : ""}${formatStat(value, suffix)}`;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function hasHoldOrTransfer(call: CallCard) {
  return call.behaviors.some((behavior) => behavior === "placed on hold" || behavior === "transferred / escalated");
}

function isFirstContactResolved(call: CallCard) {
  return call.first_contact_resolved ?? call.outcome === "resolved";
}

export default function ResultsPage({ issues, calls }: ResultsPageProps) {
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [selectedApproach, setSelectedApproach] = useState<string | null>(null);
  const issue = issues.find((item) => item.slug === selectedIssue);
  const issueCalls = issue ? calls.filter((call) => call.issue === issue.issue) : [];
  const approaches = [...new Set(issueCalls.flatMap((call) => call.behaviors))].sort();
  const outcomeLabels = [...new Set(issueCalls.map((call) => call.outcome))].sort();
  const approachMetrics = approaches.map((approach) => {
    const matchingCalls = issueCalls.filter((call) => call.behaviors.includes(approach));
    const turnCounts = matchingCalls.map((call) => call.turn_count).filter((count): count is number => typeof count === "number");
    const sentimentShifts = matchingCalls.map((call) => call.sentiments.shift).filter((shift): shift is number => typeof shift === "number");
    return {
      approach,
      calls: matchingCalls.length,
      averageTurns: turnCounts.length ? turnCounts.reduce((sum, count) => sum + count, 0) / turnCounts.length : null,
      medianTurns: median(turnCounts),
      sentimentImprovement: sentimentShifts.length ? sentimentShifts.reduce((sum, shift) => sum + shift, 0) / sentimentShifts.length : null,
      holdTransferRate: matchingCalls.filter(hasHoldOrTransfer).length / matchingCalls.length * 100,
      firstContactResolutionRate: matchingCalls.filter(isFirstContactResolved).length / matchingCalls.length * 100,
      outcomeRates: Object.fromEntries(outcomeLabels.map((outcome) => [
        outcome,
        matchingCalls.filter((call) => call.outcome === outcome).length / matchingCalls.length * 100,
      ])),
    };
  });
  const selectedMetrics = approachMetrics.find((metrics) => metrics.approach === selectedApproach);
  const issueTurnCounts = issueCalls.map((call) => call.turn_count).filter((count): count is number => typeof count === "number");
  const issueSentimentShifts = issueCalls.map((call) => call.sentiments.shift).filter((shift): shift is number => typeof shift === "number");
  const issueAverageTurns = issueTurnCounts.length
    ? issueTurnCounts.reduce((sum, count) => sum + count, 0) / issueTurnCounts.length
    : null;
  const statRows: StatRow[] = selectedMetrics ? [
    {
      label: "Calls",
      value: selectedMetrics.calls,
      average: approachMetrics.reduce((sum, metrics) => sum + metrics.calls, 0) / approachMetrics.length,
      higherIsBetter: true,
      suffix: "",
      values: approachMetrics.map((metrics) => ({ approach: metrics.approach, value: metrics.calls })),
    },
    ...(selectedMetrics.averageTurns !== null && issueAverageTurns !== null ? [{
      label: "Average call length",
      value: selectedMetrics.averageTurns,
      average: issueAverageTurns,
      higherIsBetter: false,
      suffix: " turns",
      values: approachMetrics
        .filter((metrics) => metrics.averageTurns !== null)
        .map((metrics) => ({ approach: metrics.approach, value: metrics.averageTurns as number })),
    }] : []),
    ...(selectedMetrics.medianTurns !== null && issueTurnCounts.length ? [{
      label: "Median call length",
      value: selectedMetrics.medianTurns,
      average: median(issueTurnCounts) as number,
      higherIsBetter: false,
      suffix: " turns",
      values: approachMetrics
        .filter((metrics) => metrics.medianTurns !== null)
        .map((metrics) => ({ approach: metrics.approach, value: metrics.medianTurns as number })),
    }] : []),
    ...(selectedMetrics.sentimentImprovement !== null && issueSentimentShifts.length ? [{
      label: "Sentiment improvement",
      value: selectedMetrics.sentimentImprovement,
      average: issueSentimentShifts.reduce((sum, shift) => sum + shift, 0) / issueSentimentShifts.length,
      higherIsBetter: true,
      suffix: " pts",
      values: approachMetrics
        .filter((metrics) => metrics.sentimentImprovement !== null)
        .map((metrics) => ({ approach: metrics.approach, value: metrics.sentimentImprovement as number })),
    }] : []),
    {
      label: "Hold / transfer rate",
      value: selectedMetrics.holdTransferRate,
      average: issueCalls.filter(hasHoldOrTransfer).length / issueCalls.length * 100,
      higherIsBetter: false,
      suffix: "%",
      values: approachMetrics.map((metrics) => ({ approach: metrics.approach, value: metrics.holdTransferRate })),
    },
    {
      label: "First-contact resolution",
      value: selectedMetrics.firstContactResolutionRate,
      average: issueCalls.filter(isFirstContactResolved).length / issueCalls.length * 100,
      higherIsBetter: true,
      suffix: "%",
      values: approachMetrics.map((metrics) => ({ approach: metrics.approach, value: metrics.firstContactResolutionRate })),
    },
    ...outcomeLabels.map((outcome) => ({
      label: `${titleCase(outcome)} rate`,
      value: selectedMetrics.outcomeRates[outcome],
      average: issueCalls.filter((call) => call.outcome === outcome).length / issueCalls.length * 100,
      higherIsBetter: outcome === "resolved",
      suffix: "%",
      values: approachMetrics.map((metrics) => ({ approach: metrics.approach, value: metrics.outcomeRates[outcome] })),
    })),
  ] : [];

  return (
    <section className="results-layout" aria-label="Story Dashboard 1">
      <div className="panel-card results-column">
        <h3>Issues</h3>
        <div className="results-list">
          {issues.map((item) => (
            <button
              key={item.slug}
              type="button"
              className={item.slug === selectedIssue ? "active" : ""}
              aria-pressed={item.slug === selectedIssue}
              onClick={() => { setSelectedIssue(item.slug); setSelectedApproach(null); }}
            >
              {titleCase(item.issue)}
            </button>
          ))}
        </div>
      </div>

      {issue ? (
        <div className="panel-card results-column">
          <h3>Approaches</h3>
          <div className="results-list">
            {approaches.map((approach) => (
              <button
                key={approach}
                type="button"
                className={approach === selectedApproach ? "active" : ""}
                aria-pressed={approach === selectedApproach}
                onClick={() => setSelectedApproach(approach)}
              >
                {titleCase(approach)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selectedMetrics ? (
        <div className="panel-card results-column">
          <h3>Statistics</h3>
          <p className="results-selected-approach">{titleCase(selectedApproach)}</p>
          <div className="results-stats-scroll">
            <table className="results-stats-table">
              <thead><tr><th scope="col">Metric</th><th scope="col">Selected</th><th scope="col">Vs avg</th><th scope="col">Vs best</th><th scope="col">Vs worst</th></tr></thead>
              <tbody>
                {statRows.map((row) => {
                  const sorted = [...row.values].sort((left, right) => left.value - right.value);
                  const best = row.higherIsBetter ? sorted.at(-1)! : sorted[0];
                  const worst = row.higherIsBetter ? sorted[0] : sorted.at(-1)!;
                  const difference = row.value - row.average;
                  const direction = difference > 0 ? "Above" : difference < 0 ? "Below" : "At";
                  const bestDifference = row.value - best.value;
                  const worstDifference = row.value - worst.value;
                  const tone = (value: number) => value === 0 ? "neutral" : (value > 0) === row.higherIsBetter ? "positive" : "negative";
                  return (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td><strong>{formatStat(row.value, row.suffix)}</strong></td>
                      <td><strong className={`results-delta ${tone(difference)}`}>{formatDelta(difference, row.suffix)}</strong><span>{direction} Avg</span></td>
                      <td><strong className={`results-delta ${tone(bestDifference)}`}>{formatDelta(bestDifference, row.suffix)}</strong><button type="button" className="results-approach-link" onClick={() => setSelectedApproach(best.approach)}>{titleCase(best.approach)}</button></td>
                      <td><strong className={`results-delta ${tone(worstDifference)}`}>{formatDelta(worstDifference, row.suffix)}</strong><button type="button" className="results-approach-link" onClick={() => setSelectedApproach(worst.approach)}>{titleCase(worst.approach)}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
