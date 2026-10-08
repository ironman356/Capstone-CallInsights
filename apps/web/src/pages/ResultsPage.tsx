import { useState } from "react";
import type { CallCard, DashboardIssue } from "../types";
import { titleCase } from "../utils";

interface ResultsPageProps {
  issues: DashboardIssue[];
  calls: CallCard[];
}

export default function ResultsPage({ issues, calls }: ResultsPageProps) {
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [selectedApproach, setSelectedApproach] = useState<string | null>(null);
  const issue = issues.find((item) => item.slug === selectedIssue);
  const issueCalls = issue ? calls.filter((call) => call.issue === issue.issue) : [];
  const approaches = [...new Set(issueCalls.flatMap((call) => call.behaviors))].sort();
  const approachCalls = selectedApproach ? issueCalls.filter((call) => call.behaviors.includes(selectedApproach)) : [];
  const outcomes = approachCalls.reduce<Record<string, number>>((counts, call) => {
    counts[call.outcome] = (counts[call.outcome] ?? 0) + 1;
    return counts;
  }, {});
  const turnCounts = approachCalls.map((call) => call.turn_count).filter((count): count is number => typeof count === "number");
  const averageTurns = turnCounts.length
    ? (turnCounts.reduce((sum, count) => sum + count, 0) / turnCounts.length).toFixed(1)
    : null;

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

      {selectedApproach && approachCalls.length ? (
        <div className="panel-card results-column">
          <h3>Statistics</h3>
          <p className="results-selected-approach">{titleCase(selectedApproach)}</p>
          <div className="results-stat-row"><span>Calls</span><strong>{approachCalls.length}</strong></div>
          <div className="results-stat-row"><span>Average call length</span><strong>{averageTurns === null ? "N/A" : `${averageTurns} turns`}</strong></div>
          {Object.entries(outcomes).map(([outcome, count]) => (
            <div className="results-stat-row" key={outcome}><span>{titleCase(outcome)}</span><strong>{count}</strong></div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
