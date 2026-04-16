import type { DashboardIssue, WorkspacePayload } from "../types";
import { titleCase } from "../utils";

const BLIND_SPOT_GRID = [
  ["Managers rely on a handful of call samples", "Every call is analyzed consistently"],
  ["Issues feel random or anecdotal", "Recurring problems become visible and ranked"],
  ["Hard to tell which behaviors matter", "Evidence shows which agent actions stabilize calls"],
  ["Strategies get rolled out but not tracked", "Interventions stay measurable and auditable"],
];

interface OverviewPageProps {
  workspace: WorkspacePayload;
  onOpenIssue: (issue: DashboardIssue) => void;
  onOpenCall: (callId: string) => void;
}

export function OverviewPage({ workspace, onOpenIssue, onOpenCall }: OverviewPageProps) {
  const { dashboard } = workspace;

  return (
    <section className="layout-grid overview-grid">
      <article className="panel overview-issues">
        <div className="section-heading">
          <h2>Recurring issue field</h2>
          <p>Issue cards stay compact here and open into deeper dedicated pages when you need detail.</p>
        </div>
        <div className="issue-card-grid">
          {dashboard.issues.slice(0, 6).map((issue) => (
            <button className="issue-card" key={issue.slug} type="button" onClick={() => onOpenIssue(issue)}>
              <div className="issue-card-top">
                <strong>{titleCase(issue.issue)}</strong>
                <span>{issue.count} calls</span>
              </div>
              <p>{issue.summary}</p>
              <div className="tag-row">
                {issue.top_behaviors.slice(0, 2).map((behavior) => (
                  <span className="tag" key={behavior.behavior ?? behavior.label}>
                    {behavior.behavior ?? behavior.label}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="panel overview-pulse">
        <div className="section-heading">
          <h2>Daily pulse highlights</h2>
          <p>The AI layer surfaces the strongest movement from the last reporting cycle.</p>
        </div>
        <div className="brief-stack">
          {dashboard.overview.daily_brief.map((item) => (
            <div className="brief-card" key={item}>
              {item}
            </div>
          ))}
        </div>
      </article>

      <article className="panel overview-now">
        <div className="section-heading">
          <h2>Now You See</h2>
          <p>The platform frames repeatable signals instead of anecdotal hunches.</p>
        </div>
        <div className="benefit-grid">
          {BLIND_SPOT_GRID.map(([before, after]) => (
            <div className="benefit-card" key={before}>
              <span>Before</span>
              <h3>{before}</h3>
              <p>{after}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="panel overview-patterns">
        <div className="section-heading">
          <h2>Pattern constellation</h2>
          <p>High-lift combinations open directly into issue exploration and transcript evidence.</p>
        </div>
        <div className="pattern-grid">
          {dashboard.overview.top_patterns.slice(0, 6).map((pattern) => (
            <button
              className="pattern-card"
              key={`${pattern.issue}-${pattern.behavior}-${pattern.outcome}`}
              type="button"
              onClick={() => {
                const issue = dashboard.issues.find((item) => item.issue === pattern.issue);
                if (issue) {
                  onOpenIssue(issue);
                }
                if (pattern.call_ids[0]) {
                  onOpenCall(pattern.call_ids[0]);
                }
              }}
            >
              <span className="pattern-chip">{pattern.outcome}</span>
              <h3>{titleCase(pattern.issue)}</h3>
              <p>{pattern.behavior}</p>
              <div className="pattern-meta">
                <span>{pattern.count} evidence calls</span>
                <span>Lift {pattern.lift}</span>
              </div>
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}
