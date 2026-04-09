import { useState } from 'react';
import '@xyflow/react/dist/style.css';
import type { Node } from '@xyflow/react';
import FlowDiagram from '../FlowDiagram';
import SidePanel from '../SidePanel';
import type { WorkspacePayload } from '../types';
import { titleCase } from '../utils';

interface AdminAiGovernancePageProps {
  workspace: WorkspacePayload;
}

export default function AdminAiGovernancePage({ workspace }: AdminAiGovernancePageProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  return (
    <div className="admin-page" style={{ display: 'grid', gap: '32px' }}>
      <section className="layout-grid" style={{ marginTop: 0 }}>
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

      <div>
        <h2>Pipeline Configuration</h2>
        <p style={{ color: "var(--muted)", marginBottom: "20px" }}>Select a core intelligence layer from the pipeline to configure its operational settings.</p>
        <div className="admin-layout">
        <div className="flow-panel">
          <FlowDiagram onNodeSelect={setSelectedNode} />
        </div>
        <SidePanel selectedNode={selectedNode} />
      </div>
      </div>
    </div>
  );
}
