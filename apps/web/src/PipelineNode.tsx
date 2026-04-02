import { Handle, Position } from '@xyflow/react';

export default function PipelineNode({ data }: { data: any }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: '8px',
      background: '#fff',
      border: '1px solid #ddd',
      borderLeft: '5px solid #0056b3',
      boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
      width: '180px',
      fontFamily: 'sans-serif'
    }}>
      <Handle type="target" position={Position.Left} style={{ width: '8px', height: '8px', background: '#0056b3' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#888', fontWeight: 600, letterSpacing: '0.5px' }}>
          Layer {data.layer}
        </span>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#28a745' }} title="Active Process" />
      </div>

      <div style={{ fontWeight: 600, color: '#222', fontSize: '14px', lineHeight: 1.2 }}>
        {data.label}
      </div>

      <Handle type="source" position={Position.Right} style={{ width: '8px', height: '8px', background: '#0056b3' }} />
    </div>
  );
}
