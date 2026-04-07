import { useState, useEffect } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Node } from '@xyflow/react';

interface SidePanelProps {
  selectedNode: Node | null;
}

export default function SidePanel({ selectedNode }: SidePanelProps) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setIsSaved(false);
  }, [selectedNode?.id]);

  if (!selectedNode) {
    return (
      <div className="side-panel">
        <h2>Pipeline Configuration</h2>
        <p>Select a core intelligence layer from the pipeline to configure its operational settings.</p>
      </div>
    );
  }

  const { data } = selectedNode;
  const isContextNode = data.type === 'context';

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="side-panel">
      <h2>{data.label as string}</h2>
      <p className="side-panel-description">
        {data.description as string}
      </p>

      {isContextNode ? (
        <div className="context-note">
          This is an external integration point. Configuration is managed in a separate system.
        </div>
      ) : (
        <form onSubmit={handleSave} className="side-panel-form">
          <h4 className="side-panel-subheading">Layer Settings</h4>
          {renderLayerControls(data.layer as number)}
          
          <button 
            type="submit" 
            className={isSaved ? 'save-button is-saved' : 'save-button'}
          >
            {isSaved ? 'Settings Saved!' : 'Save Configuration'}
          </button>
        </form>
      )}
    </div>
  );
}

// Helper to render realistic mock settings for each of the 6 middle layers
function renderLayerControls(layerIndex: number) {
  const Label = ({ children }: { children: ReactNode }) => (
    <span className="field-label">
      {children}
    </span>
  );

  const selectStyle = { width: '100%' };
  const inputStyle = { ...selectStyle };

  switch (layerIndex) {
    case 1: // Data Ingestion
      return (
        <>
          <label>
            <Label>PII Masking</Label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label style={{ fontSize: '14px' }}><input type="radio" name="masking" defaultChecked /> Enabled</label>
              <label style={{ fontSize: '14px' }}><input type="radio" name="masking" /> Disabled</label>
            </div>
          </label>
          <label>
            <Label>Required Metadata Fields</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px' }}>
              <label><input type="checkbox" defaultChecked /> Call ID</label>
              <label><input type="checkbox" defaultChecked /> Agent ID</label>
              <label><input type="checkbox" defaultChecked /> Duration</label>
            </div>
          </label>
          <label>
            <Label>Transcript Source</Label>
            <select style={selectStyle}>
              <option>SPS Direct API</option>
              <option>S3 Batch Bucket</option>
              <option>Local Database</option>
            </select>
          </label>
        </>
      );
    case 2: // Transcript Processing
      return (
        <>
          <label>
            <Label>Segmentation</Label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label style={{ fontSize: '14px' }}><input type="radio" name="segmentation" defaultChecked /> Enabled</label>
              <label style={{ fontSize: '14px' }}><input type="radio" name="segmentation" /> Disabled</label>
            </div>
          </label>
          <label>
            <Label>Temporal Chunk Size (seconds)</Label>
            <input type="number" defaultValue={30} step={5} style={inputStyle} />
          </label>
          <label>
            <Label>Sentiment Checkpoints</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px' }}>
              <label><input type="checkbox" defaultChecked /> Start of Call</label>
              <label><input type="checkbox" defaultChecked /> Mid Call</label>
              <label><input type="checkbox" defaultChecked /> End of Call</label>
            </div>
          </label>
        </>
      );
    case 3: // Behavioral & Outcome Extraction
      return (
        <>
          <label>
            <Label>Behavior Detection Mode</Label>
            <select style={selectStyle}>
              <option>Strict NLP</option>
              <option>Heuristic Matching</option>
              <option>Semantic Hybrid</option>
            </select>
          </label>
          <label>
            <Label>Issue Classification Mode</Label>
            <select style={selectStyle}>
              <option>Semantic LLM Routing</option>
              <option>Keyword Triggers</option>
            </select>
          </label>
          <label>
            <Label>Outcome Labeling Mode</Label>
            <select style={selectStyle}>
              <option>Graded (0.0 to 1.0)</option>
              <option>Binary (Resolved / Unresolved)</option>
            </select>
          </label>
        </>
      );
    case 4: // Analytical Intelligence
      return (
        <>
          <label>
            <Label>Anomaly Sensitivity (0-10)</Label>
            <input type="range" min="0" max="10" defaultValue="7" style={inputStyle} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888' }}>
              <span>Low</span><span>High</span>
            </div>
          </label>
          <label>
            <Label>Macro Trend Window</Label>
            <select style={selectStyle}>
              <option>7 Days</option>
              <option>30 Days</option>
              <option>90 Days</option>
            </select>
          </label>
          <label>
            <Label>Triple-Engine Correlation Threshold (%)</Label>
            <input type="number" defaultValue={85} min={50} max={100} style={inputStyle} />
          </label>
        </>
      );
    case 6: // Strategy Learning
      return (
        <>
          <label>
            <Label>Evaluation Window</Label>
            <select style={selectStyle}>
              <option>Bi-weekly</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
          </label>
          <label>
            <Label>Active Strategy Lifecycle Stage</Label>
            <select style={selectStyle}>
              <option>Active (Monitoring)</option>
              <option>Proposed (Pending Review)</option>
              <option>Investigating (Data Gathering)</option>
            </select>
          </label>
          <label>
            <Label>Performance Comparison Mode</Label>
            <select style={selectStyle}>
              <option>Before / After Benchmark</option>
              <option>A/B Testing Groups</option>
            </select>
          </label>
        </>
      );
    case 5: // Evidence & Reporting
      return (
        <>
          <label>
            <Label>Export Format Target</Label>
            <select style={selectStyle}>
              <option>Enterprise PDF Report</option>
              <option>Raw JSON Trace</option>
              <option>CSV Aggregation</option>
            </select>
          </label>
          <label>
            <Label>Max Call IDs per Evidence Pack</Label>
            <input type="number" defaultValue={50} min={10} max={500} style={inputStyle} />
          </label>
          <label>
            <Label>Evidence Depth Level</Label>
            <select style={selectStyle}>
              <option>Full Transcript Injection</option>
              <option>Utterance Snippets Only</option>
              <option>Metadata Only</option>
            </select>
          </label>
        </>
      );
    default:
      return <p>No specific controls configured.</p>;
  }
}
