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
            <p>Customer-facing insights remain visible only when supporting evidence is attached and reviewable.</p>
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
            <p>Operational traceability stays visible inside the governance workspace for review and sign-off.</p>
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
            <h2>Control checks</h2>
            <p>Use these checks to confirm evidence availability, workflow health, and governance status before action is taken.</p>
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
        <h2>Architecture map</h2>
        <p style={{ color: "var(--muted)", marginBottom: "20px" }}>Select a layer in the system map to review its purpose, controls, and operating settings.</p>
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
