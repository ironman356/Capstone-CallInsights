import type { StrategyCreateInput, WorkspacePayload } from "../types";

interface PulsePageProps {
  workspace: WorkspacePayload;
  onOpenCall: (callId: string) => void;
  onSeedStrategy: (updater: (draft: StrategyCreateInput) => StrategyCreateInput) => void;
  onGoToStrategies: () => void;
}

export function PulsePage({ workspace, onOpenCall, onSeedStrategy, onGoToStrategies }: PulsePageProps) {
  const { dashboard, pulse_insights } = workspace;

  return (
    <section className="single-column">
      <article className="panel">
        <div className="section-heading">
          <h2>Daily Insights Pulse</h2>
          <p>Each card connects narrative summary, evidence calls, and action routing.</p>
        </div>
        <div className="pulse-list">
          {pulse_insights.map((insight) => (
            <article className="pulse-card" key={insight.insight_id}>
              <div className="pulse-head">
                <div>
                  <span className="pulse-label">{insight.trend}</span>
                  <h3>{insight.title}</h3>
                </div>
                <span className={`status-chip status-${insight.outcome.replace(/\s+/g, "-")}`}>{insight.outcome}</span>
              </div>
              <p>{insight.summary}</p>
              <div className="pulse-meta">
                <span>{insight.evidence_count} evidence calls</span>
                <span>{insight.behavior}</span>
                <span>Lift {insight.lift}</span>
              </div>
              <div className="tag-row">
                {insight.call_ids.slice(0, 3).map((callId) => (
                  <button className="tag action-tag" key={callId} type="button" onClick={() => onOpenCall(callId)}>
                    {callId}
                  </button>
                ))}
                <button
                  className="tag action-tag"
                  type="button"
                  onClick={() => {
                    const issue = dashboard.issues.find((item) => item.issue === insight.issue);
                    if (issue) {
                      onSeedStrategy((current) => ({
                        ...current,
                        issue_slug: issue.slug,
                        title: `Address ${issue.issue} trend`,
                        hypothesis: `Reduce ${issue.issue} by standardizing ${insight.behavior}.`,
                        evidence_call_ids: insight.call_ids.slice(0, 3),
                      }));
                    }
                    onGoToStrategies();
                  }}
                >
                  Turn into strategy
                </button>
              </div>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
