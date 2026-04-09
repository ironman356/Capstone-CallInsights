import type { WorkspacePayload } from "../types";

interface MonthlyPageProps {
  workspace: WorkspacePayload;
  onOpenCall: (callId: string) => void;
}

export function MonthlyPage({ workspace, onOpenCall }: MonthlyPageProps) {
  return (
    <section className="layout-grid">
      <article className="panel">
        <div className="section-heading">
          <h2>Monthly recalibration</h2>
          <p>Closed-loop learning resets issue baselines and refreshes what the system treats as important.</p>
        </div>
        <div className="recalibration-grid">
          <div className="recalibration-metric">
            <span>Completed</span>
            <strong>{new Date(workspace.recalibration.completed_at).toLocaleString()}</strong>
          </div>
          <div className="recalibration-metric">
            <span>Window</span>
            <strong>{workspace.recalibration.baseline_window}</strong>
          </div>
          <div className="recalibration-metric">
            <span>New clusters</span>
            <strong>{workspace.recalibration.new_clusters_detected}</strong>
          </div>
          <div className="recalibration-metric">
            <span>Retired clusters</span>
            <strong>{workspace.recalibration.retired_clusters}</strong>
          </div>
        </div>
        <p className="focus-line">{workspace.recalibration.focus_summary}</p>
      </article>

      <article className="panel">
        <div className="section-heading">
          <h2>Taxonomy notes</h2>
          <p>The recalibration process explains what changed instead of only showing a timestamp.</p>
        </div>
        <div className="brief-stack">
          {workspace.recalibration.taxonomy_notes.map((note) => (
            <div className="brief-card" key={note}>
              {note}
            </div>
          ))}
        </div>
      </article>

      <article className="panel span-2">
        <div className="section-heading">
          <h2>Ask CI</h2>
          <p>Leadership-facing questions grounded in the same evidence pool that powers the other pages.</p>
        </div>
        <div className="ask-grid">
          {workspace.ask_ci.map((item) => (
            <article className="ask-card" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
              <div className="tag-row">
                {item.evidence_call_ids.map((callId) => (
                  <button className="tag action-tag" key={callId} type="button" onClick={() => onOpenCall(callId)}>
                    {callId}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
