import { Handle, Position } from '@xyflow/react';

export default function PipelineNode({ data }: { data: any }) {
  return (
    <div className="pipeline-node">
      <Handle type="target" position={Position.Left} className="pipeline-node-handle" />

      <div className="pipeline-node-meta">
        <span className="pipeline-node-layer">
          Layer {data.layer}
        </span>
        <div className="pipeline-node-status" title="Active Process" />
      </div>

      <div className="pipeline-node-label">
        {data.label}
      </div>

      <Handle type="source" position={Position.Right} className="pipeline-node-handle" />
    </div>
  );
}
