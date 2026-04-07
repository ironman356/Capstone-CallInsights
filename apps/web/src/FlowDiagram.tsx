import { useCallback } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState
} from '@xyflow/react';
import type { Node, NodeMouseHandler } from '@xyflow/react';
import PipelineNode from './PipelineNode';

import { initialNodes, initialEdges } from './architectureData';

const nodeTypes = {
  core: PipelineNode
};

interface FlowDiagramProps {
  onNodeSelect: (node: Node | null) => void;
}

export default function FlowDiagram({ onNodeSelect }: FlowDiagramProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      // Pass the selected node upwards to the App container and SidePanel
      onNodeSelect(node);
    },
    [onNodeSelect]
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  return (
    <ReactFlow
      className="flow-canvas"
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      attributionPosition="bottom-left"
    >
      <Background color="#ccc" gap={16} />
      <Controls />
    </ReactFlow>
  );
}
