import type { Node, Edge } from '@xyflow/react';

const subtleGroupStyle = {
  backgroundColor: 'rgba(240, 248, 255, 0.2)',
  border: '2px dashed #bbb',
  borderRadius: '20px',
  color: '#888',
  fontSize: '14px',
};

export const initialNodes: Node[] = [
  // --- Outer Boundaries / Groups ---
  {
    id: 'callinsights-group',
    type: 'group',
    position: { x: 250, y: 0 },
    style: { width: 850, height: 750, ...subtleGroupStyle, border: '2px dashed #0056b3' },
    data: { label: 'CallInsights', layer: null, description: 'The main analytical platform boundary housing all layers.' }
  },
  {
    id: 'customizable-group',
    type: 'group',
    parentId: 'callinsights-group',
    position: { x: 50, y: 50 },
    style: { width: 350, height: 650, ...subtleGroupStyle, border: '1px dashed #666' },
    data: { label: 'Customizable', layer: null, description: 'Contains scoped analysis engines.' }
  },
  {
    id: 'individual-call-scope',
    type: 'group',
    parentId: 'customizable-group',
    position: { x: 25, y: 40 },
    style: { width: 300, height: 280, ...subtleGroupStyle, backgroundColor: 'rgba(255, 0, 0, 0.01)', border: '1px dashed #999' },
    data: { label: 'Individual Call Scope', layer: null, description: 'Extracts signals from single calls.' }
  },
  {
    id: 'multiple-calls-scope',
    type: 'group',
    parentId: 'customizable-group',
    position: { x: 25, y: 340 },
    style: { width: 300, height: 280, ...subtleGroupStyle, backgroundColor: 'rgba(0, 128, 0, 0.01)', border: '1px dashed #999' },
    data: { label: 'Multiple Calls Scope', layer: null, description: 'Finds macro trends and establishes strategy effectiveness over long periods.' }
  },

  // --- External Entities ---
  {
    id: 'sps-infra',
    position: { x: 0, y: 250 },
    style: { padding: '10px', border: '1px dashed #ccc', borderRadius: '10px', backgroundColor: '#fafafa', color: '#888', width: 140, textAlign: 'center' },
    data: { label: 'Existing SPS Infrastructure', layer: null, type: 'context', description: 'Legacy telephone infrastructure that generates the raw call transcripts.' }
  },

  // --- Core Processing Nodes (using type 'core' for the interactive pipeline look) ---
  {
    id: 'layer1',
    type: 'core',
    parentId: 'individual-call-scope',
    position: { x: 60, y: 40 },
    data: { label: 'Data Ingestion', layer: 1, type: 'core', description: 'Configure ingestion logic, PII masking, and format standardization.' }
  },
  {
    id: 'layer2',
    type: 'core',
    parentId: 'individual-call-scope',
    position: { x: 60, y: 120 },
    data: { label: 'Transcript Processing', layer: 2, type: 'core', description: 'Adjust call segmentation rules and temporal chunking.' }
  },
  {
    id: 'layer3',
    type: 'core',
    parentId: 'individual-call-scope',
    position: { x: 60, y: 200 },
    data: { label: 'Behavioral & Outcome', layer: 3, type: 'core', description: 'Tune semantic extraction for issue classification and behavior intents.' }
  },
  {
    id: 'layer4',
    type: 'core',
    parentId: 'multiple-calls-scope',
    position: { x: 60, y: 40 },
    data: { label: 'Analytical Intelligence', layer: 4, type: 'core', description: 'Triple-engine statistical thresholds (Problem-Behavior-Outcome correlation).' }
  },
  {
    id: 'layer6',
    type: 'core',
    parentId: 'multiple-calls-scope',
    position: { x: 60, y: 120 },
    data: { label: 'Strategy Learning', layer: 6, type: 'core', description: 'Define operational strategies evaluated against intelligence insights.' }
  },
  {
    id: 'layer5',
    type: 'core',
    parentId: 'multiple-calls-scope',
    position: { x: 60, y: 200 },
    data: { label: 'Evidence & Reporting', layer: 5, type: 'core', description: 'Customize confidence levels for Evidence Pack generation.' }
  },

  // --- De-emphasized Internal Context Nodes ---
  {
    id: 'layer8',
    parentId: 'callinsights-group',
    position: { x: -60, y: 350 },
    style: { padding: '8px', border: '1px dashed #ccc', borderRadius: '5px', backgroundColor: '#fafafa', color: '#888', width: 140 },
    data: { label: 'Pre-Call Pattern', layer: 8, type: 'context', description: 'Dynamic IVR shaping caller intent based on learned strategies.' }
  },
  {
    id: 'trace-db',
    parentId: 'callinsights-group',
    position: { x: 600, y: 100 },
    style: { padding: '10px', border: '1px dashed #ccc', borderRadius: '5px', backgroundColor: '#fafafa', color: '#888', width: 130 },
    data: { label: '"Traceability" DB', layer: null, type: 'context', description: 'The central database storing evidence and metadata mapped to transcripts.' }
  },
  {
    id: 'api1',
    parentId: 'callinsights-group',
    position: { x: 600, y: 220 },
    style: { padding: '10px', border: '1px dashed #ccc', borderRadius: '5px', backgroundColor: '#fafafa', color: '#888', width: 100 },
    data: { label: 'API', layer: null, type: 'context', description: 'Interface exposing traceability and reporting capabilities to Web UI.' }
  },
  {
    id: 'web-app',
    parentId: 'callinsights-group',
    position: { x: 550, y: 400 },
    style: { padding: '10px', border: '1px dashed #ccc', borderRadius: '5px', backgroundColor: '#fafafa', color: '#888', width: 150 },
    data: { label: 'Web Application', layer: 7, type: 'context', description: 'Layer 7 Platform: Provides UI modules like Issue Explorer and Strategy management.' }
  },
  {
    id: 'cache',
    parentId: 'callinsights-group',
    position: { x: 600, y: 550 },
    style: { padding: '10px', border: '1px dashed #ccc', borderRadius: '30px', backgroundColor: '#fafafa', color: '#888', width: 100 },
    data: { label: 'Cache', layer: null, type: 'context', description: 'Speeds up dashboard latency and query times for recurring metric lookups.' }
  },
  {
    id: 'api2',
    parentId: 'callinsights-group',
    position: { x: 450, y: 550 },
    style: { padding: '10px', border: '1px dashed #ccc', borderRadius: '5px', backgroundColor: '#fafafa', color: '#888', width: 100 },
    data: { label: 'API', layer: null, type: 'context', description: 'Secondary API connection serving data to the cache from reporting.' }
  }
];

export const initialEdges: Edge[] = [
  // Linear Flow Inside CI
  { id: 'e-sps-l1', source: 'sps-infra', target: 'layer1', animated: true, style: { strokeWidth: 2, stroke: '#aaa' } },
  { id: 'e-l1-l2', source: 'layer1', target: 'layer2', style: { strokeWidth: 2, stroke: '#0056b3' } },
  { id: 'e-l2-l3', source: 'layer2', target: 'layer3', style: { strokeWidth: 2, stroke: '#0056b3' } },
  { id: 'e-l3-l4', source: 'layer3', target: 'layer4', style: { strokeWidth: 2, stroke: '#0056b3' } },
  { id: 'e-l4-l6', source: 'layer4', target: 'layer6', style: { strokeWidth: 2, stroke: '#0056b3' } },
  { id: 'e-l6-l5', source: 'layer6', target: 'layer5', style: { strokeWidth: 2, stroke: '#0056b3' } },
  
  // Strategy learning loop
  { id: 'e-l6-layer8', source: 'layer6', target: 'layer8', animated: true, style: { stroke: '#aaa' } },
  { id: 'e-layer8-sps', source: 'layer8', target: 'sps-infra', animated: true, style: { stroke: '#aaa' } },
  
  // Reporting loop
  { id: 'e-l4-l5', source: 'layer4', target: 'layer5', style: { strokeDasharray: '5,5', stroke: '#0056b3' } },

  // Traceability Logic lines
  { id: 'e-trace1', source: 'layer1', target: 'trace-db', style: { strokeDasharray: '2,2', stroke: '#ccc' } },
  { id: 'e-trace2', source: 'layer2', target: 'trace-db', style: { strokeDasharray: '2,2', stroke: '#ccc' } },
  { id: 'e-trace3', source: 'layer3', target: 'trace-db', style: { strokeDasharray: '2,2', stroke: '#ccc' } },
  { id: 'e-trace4', source: 'layer4', target: 'trace-db', style: { strokeDasharray: '2,2', stroke: '#ccc' } },
  { id: 'e-trace5', source: 'layer6', target: 'trace-db', style: { strokeDasharray: '2,2', stroke: '#ccc' } },
  { id: 'e-trace6', source: 'layer5', target: 'trace-db', style: { strokeDasharray: '2,2', stroke: '#ccc' } },
  
  // UI infrastructure lines
  { id: 'e-trace-api', source: 'trace-db', target: 'api1', style: { stroke: '#ccc' } },
  { id: 'e-api-web', source: 'api1', target: 'web-app', style: { stroke: '#ccc' } },
  { id: 'e-web-cache', source: 'web-app', target: 'cache', style: { stroke: '#ccc' } },
  { id: 'e-cache-web', source: 'cache', target: 'web-app', style: { stroke: '#ccc' } },
  { id: 'e-api2-cache', source: 'api2', target: 'cache', type: 'smoothstep', style: { stroke: '#ccc' } },
  { id: 'e-l5-api2', source: 'layer5', target: 'api2', type: 'smoothstep', style: { stroke: '#ccc' } },
  { id: 'e-api2-web', source: 'api2', target: 'web-app', type: 'smoothstep', style: { stroke: '#ccc' } }
];
