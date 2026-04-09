import type { DashboardIssue, IssueDetail } from "../types";
import { titleCase } from "../utils";

interface ExplorerPageProps {
  issues: DashboardIssue[];
  selectedIssueSlug: string | null;
  selectedIssueCard: DashboardIssue | null;
  issueDetail: IssueDetail | null;
  issueQuery: string;
  outcomeFilter: string;
  onIssueQueryChange: (value: string) => void;
  onOutcomeFilterChange: (value: string) => void;
  onOpenIssue: (issue: DashboardIssue) => void;
  onOpenCall: (callId: string) => void;
}

export function ExplorerPage({
  issues,
  selectedIssueSlug,
  selectedIssueCard,
  issueDetail,
  issueQuery,
  outcomeFilter,
  onIssueQueryChange,
  onOutcomeFilterChange,
  onOpenIssue,
  onOpenCall,
}: ExplorerPageProps) {
  return (
    <section className="explorer-grid">
      <aside className="panel">
        <div className="section-heading">
          <h2>Issue Explorer</h2>
          <p>Filter, scan, and jump into evidence without mixing every concern into one page.</p>
        </div>
        <div className="control-stack">
          <input
            className="input"
            value={issueQuery}
            onChange={(event) => onIssueQueryChange(event.target.value)}
            placeholder="Search issue themes"
          />
          <select className="input" value={outcomeFilter} onChange={(event) => onOutcomeFilterChange(event.target.value)}>
            <option value="all">All outcomes</option>
            <option value="resolved">Resolved</option>
            <option value="escalated">Escalated</option>
            <option value="follow-up needed">Follow-up needed</option>
            <option value="unresolved">Unresolved</option>
          </select>
        </div>
        <div className="list-stack">
          {issues.map((issue) => (
            <button
              key={issue.slug}
              type="button"
              className={`list-card ${selectedIssueSlug === issue.slug ? "active" : ""}`}
              onClick={() => onOpenIssue(issue)}
            >
              <span>{titleCase(issue.issue)}</span>
              <strong>{issue.count}</strong>
            </button>
          ))}
        </div>
      </aside>

      <article className="panel">
        <div className="section-heading">
          <h2>{titleCase(issueDetail?.issue ?? selectedIssueCard?.issue ?? "Issue summary")}</h2>
          <p>{issueDetail?.summary ?? selectedIssueCard?.summary ?? "Select an issue cluster to inspect."}</p>
        </div>
        <div className="issue-summary-grid">
          <article className="mini-panel">
            <h3>Top behaviors</h3>
            {(issueDetail?.top_behaviors ?? selectedIssueCard?.top_behaviors ?? []).map((behavior) => (
              <div className="line-item" key={behavior.behavior ?? behavior.label}>
                <span>{behavior.behavior ?? behavior.label}</span>
                <strong>{behavior.count}</strong>
              </div>
            ))}
          </article>
          <article className="mini-panel">
            <h3>Outcome mix</h3>
            {Object.entries(issueDetail?.outcome_breakdown ?? selectedIssueCard?.outcome_breakdown ?? {}).map(
              ([key, value]) => (
                <div className="line-item" key={key}>
                  <span>{titleCase(key)}</span>
                  <strong>{value}</strong>
                </div>
              ),
            )}
          </article>
          <article className="mini-panel">
            <h3>Observed impact</h3>
            <p>
              {selectedIssueCard
                ? `${titleCase(selectedIssueCard.issue)} appears in ${selectedIssueCard.count} calls with an average sentiment shift of ${selectedIssueCard.average_shift.toFixed(3)}.`
                : "No issue selected."}
            </p>
          </article>
        </div>
      </article>

      <aside className="panel">
        <div className="section-heading">
          <h2>Evidence calls</h2>
          <p>Representative call snapshots act as the entry point into transcript review.</p>
        </div>
        <div className="list-stack">
          {(issueDetail?.evidence_calls ?? []).map((call) => (
            <button key={call.call_id} type="button" className="evidence-card" onClick={() => onOpenCall(call.call_id)}>
              <div className="evidence-head">
                <strong>{call.call_id}</strong>
                <span>{call.source_file}</span>
              </div>
              <p>{call.summary}</p>
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
}
