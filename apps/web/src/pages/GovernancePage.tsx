import type { WorkspacePayload } from "../types";
import { titleCase } from "../utils";

interface GovernancePageProps {
  workspace: WorkspacePayload;
}

export function GovernancePage({ workspace }: GovernancePageProps) {
  return (
    <section className="layout-grid">
      <article className="panel">
        <div className="section-heading">
          <h2>Evidence policy</h2>
          <p>Insights are visible only when supporting evidence is already attached.</p>
        </div>
        <div className="brief-stack">
          {workspace.governance.evidence_policy.map((item) => (
            <div className="brief-card" key={item}>
              {item}
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <div className="section-heading">
          <h2>Audit summary</h2>
          <p>Operational traceability remains visible inside its own governance workspace.</p>
        </div>
        <div className="report-summary">
          {Object.entries(workspace.governance.audit_summary).map(([key, value]) => (
            <div className="line-item" key={key}>
              <span>{titleCase(key)}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="panel span-2">
        <div className="section-heading">
          <h2>System monitors</h2>
          <p>Governance status cards keep model behavior, evidence availability, and workflow health visible.</p>
        </div>
        <div className="monitor-grid">
          {workspace.governance.monitors.map((monitor) => (
            <div className="monitor-card" key={monitor.label}>
              <span>{monitor.label}</span>
              <strong>{titleCase(monitor.status)}</strong>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
