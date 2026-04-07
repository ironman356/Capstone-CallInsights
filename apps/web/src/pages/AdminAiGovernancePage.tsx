import { useState } from 'react';
import '@xyflow/react/dist/style.css';
import type { Node } from '@xyflow/react';
import FlowDiagram from '../FlowDiagram';
import SidePanel from '../SidePanel';

export default function AdminAiGovernancePage() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  return (
    <div className="admin-page">
      <div className="admin-layout">
        <div className="flow-panel">
          <FlowDiagram onNodeSelect={setSelectedNode} />
        </div>
        <SidePanel selectedNode={selectedNode} />
      </div>
    </div>
  );
}
