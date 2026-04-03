import { useState } from 'react';
import FlowDiagram from './FlowDiagram';
import SidePanel from './SidePanel';
import type { Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function App() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  return (
    <div className="app-container">
      <header className="header">
        <h1>CallInsights Framework Overview</h1>
      </header>
      <main className="content-container">
        <div className="flow-container">
          <FlowDiagram onNodeSelect={setSelectedNode} />
        </div>
        <SidePanel selectedNode={selectedNode} />
      </main>
    </div>
  );
}

export default App;
