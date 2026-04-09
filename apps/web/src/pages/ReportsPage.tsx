import type { WorkspacePayload } from "../types";
import { formatValue, titleCase } from "../utils";

interface ReportsPageProps {
  workspace: WorkspacePayload;
  exportPayload: WorkspacePayload["reports"] | null;
  syncing: boolean;
  onExport: () => void;
}

export function ReportsPage({ workspace, exportPayload, syncing, onExport }: ReportsPageProps) {
  const report = exportPayload ?? workspace.reports;

  return (
    <section className="layout-grid">
      <article className="panel">
        <div className="section-heading">
          <h2>Operational report package</h2>
          <p>Leadership summary, issue table, and KPI rollups can be regenerated on demand.</p>
        </div>
        <div className="report-summary">
          <div className="line-item">
            <span>Generated</span>
            <strong>{new Date(report.generated_at).toLocaleString()}</strong>
          </div>
          {Object.entries(report.totals).map(([key, value]) => (
            <div className="line-item" key={key}>
              <span>{titleCase(key)}</span>
              <strong>{formatValue(value)}</strong>
            </div>
          ))}
        </div>
        <button className="primary-button" type="button" onClick={onExport} disabled={syncing}>
          Generate fresh export
        </button>
      </article>

      <article className="panel">
        <div className="section-heading">
          <h2>Report highlights</h2>
          <p>Short executive notes generated from the latest workspace state.</p>
        </div>
        <div className="brief-stack">
          {report.highlights.map((item) => (
            <div className="brief-card" key={item}>
              {item}
            </div>
          ))}
        </div>
      </article>

      <article className="panel span-2">
        <div className="section-heading">
          <h2>Issue table</h2>
          <p>Quick handoff view for monthly reviews, exports, and audit-ready reporting.</p>
        </div>
        <div className="table-shell">
          {report.issue_table.map((row) => (
            <div className="table-row" key={row.issue}>
              <span>{titleCase(row.issue)}</span>
              <strong>{row.count} calls</strong>
              <em>{titleCase(row.top_outcome)}</em>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
