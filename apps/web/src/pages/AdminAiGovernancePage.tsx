import { useState } from 'react';
import type { Node } from '@xyflow/react';
import FlowDiagram from '../FlowDiagram';
import SidePanel from '../SidePanel';
import PageFrame from '../components/PageFrame';

export default function AdminAiGovernancePage() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  return (
    <PageFrame title="Admin & AI Governance" className="admin-page">
      <div className="admin-layout">
        <div className="flow-panel">
          <FlowDiagram onNodeSelect={setSelectedNode} />
        </div>
        <SidePanel selectedNode={selectedNode} />
      </div>
    </PageFrame>
  );
}

