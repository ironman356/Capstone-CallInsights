import { BrainCircuit, CheckCircle2, Database, FlaskConical, GitCompareArrows, HelpCircle, ShieldAlert, Sparkles, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Text, Tooltip, XAxis, YAxis } from "recharts";
import { approachExtractionResults, benchmarkSummary, modelApproaches, type ModelFamily } from "../modelApproachData";

const FAMILY_COLORS: Record<ModelFamily, string> = {
  Hybrid: "#6ee7c8",
  "Supervised ML": "#7ac8ff",
  "Semantic ML": "#b7a1ff",
  Rules: "#ffc66b",
  Legacy: "#ff8b72",
};

const METRIC_COLORS = {
  macroF1: "#6ee7c8",
  multiIssue: "#7ac8ff",
} as const;

const TOOLTIP_STYLE = {
  background: "var(--tooltip-bg)",
  border: "1px solid var(--tooltip-border)",
  borderRadius: 14,
  color: "var(--tooltip-text)",
};

function percent(value: number | null) {
  return value === null ? "Not measured" : `${(value * 100).toFixed(1)}%`;
}

function seconds(value: number | null) {
  return value === null ? "API dependent" : `${value.toFixed(3)}s`;
}

const METRIC_HELP = {
  macroF1: { label: "Macro-F1", description: "Balances missed issues and incorrect predictions for each category, then averages the scores so every category counts equally." },
  accuracy: { label: "Accuracy", description: "The percentage of individual issue predictions that match the correct answer." },
  multiIssue: { label: "Multi-issue", description: "Measures whether the model gets all issues in a call correct, rather than only some of them." },
};

function MetricHeader({ metric }: { metric: keyof typeof METRIC_HELP }) {
  const definition = METRIC_HELP[metric];
  return (
    <span className="model-metric-help">
      <span>{definition.label}</span>
      <button type="button" className="model-metric-info" aria-label={`What is ${definition.label}?`} aria-describedby={`metric-help-${metric}`}>
        <HelpCircle size={15} aria-hidden="true" />
      </button>
      <span className="model-metric-tooltip" id={`metric-help-${metric}`} role="tooltip">{definition.description}</span>
    </span>
  );
}

function ModelNameTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return <Text x={x - 10} y={y} width={220} textAnchor="end" verticalAnchor="middle" fill="var(--text)" fontSize={12}>{payload?.value ?? ""}</Text>;
}

export default function ModelApproachesPage() {
  const chartData = modelApproaches.map((approach) => ({
    name: approach.name,
    macroF1: Math.round(approach.macroF1 * 1000) / 10,
    multiIssue: Math.round(approach.multiIssue * 1000) / 10,
  }));

  return (
    <section className="model-approaches-page">
      <div className="model-hero panel-card">
        <div>
          <p className="section-kicker">Decision Lab</p>
          <h3>Compare call-modelling approaches on one frozen benchmark.</h3>
          <p>Every result below uses the same synthetic mortgage-call split. The hybrid score is a blind transcript-only Codex-agent run; all other scores come from the local reproducible benchmark.</p>
        </div>
        <div className="model-hero-badge"><Sparkles size={18} /><span>Recommended</span><strong>Hybrid LLM + ML</strong></div>
      </div>

      <div className="model-summary-grid">
        <article className="model-summary-card"><Database size={18} /><span>Benchmark</span><strong>{benchmarkSummary.calls} calls</strong><small>{benchmarkSummary.segments} issue segments</small></article>
        <article className="model-summary-card"><FlaskConical size={18} /><span>Held out</span><strong>{benchmarkSummary.testCalls} calls</strong><small>{benchmarkSummary.testSegments} unseen segments</small></article>
        <article className="model-summary-card"><GitCompareArrows size={18} /><span>Compared</span><strong>{modelApproaches.length} methods</strong><small>Rules, ML, semantic, hybrid</small></article>
        <article className="model-summary-card"><Target size={18} /><span>Best topic F1</span><strong>100.0%</strong><small>Hybrid synthetic result</small></article>
      </div>

      <div className="model-dashboard-grid">
        <article className="panel-card model-chart-panel">
          <div className="panel-heading">
            <div><p className="section-kicker">Topic Mapping</p><h3>Macro-F1 and multi-issue accuracy</h3></div>
            <BrainCircuit size={19} />
          </div>
          <p className="model-chart-note">Bar colors represent the metric. Model family is shown in the comparison table below.</p>
          <div className="model-readable-chart" role="region" aria-label="Topic mapping chart; scroll horizontally on small screens" tabIndex={0}>
            <ResponsiveContainer width="100%" minWidth={620} height={modelApproaches.length * 58 + 76}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 20, left: 10, bottom: 8 }}>
                <CartesianGrid horizontal={false} stroke="rgba(122,148,190,0.14)" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={240} interval={0} tick={<ModelNameTick />} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Legend verticalAlign="top" height={34} />
                <Bar dataKey="macroF1" name="Macro-F1" fill={METRIC_COLORS.macroF1} radius={[0, 5, 5, 0]} />
                <Bar dataKey="multiIssue" name="Multi-issue exact" fill={METRIC_COLORS.multiIssue} radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel-card model-decision-card">
          <div className="panel-heading"><div><p className="section-kicker">Recommendation</p><h3>Use hybrid for the SPS pilot</h3></div><CheckCircle2 size={19} /></div>
          <div className="model-decision-score"><strong>1.000</strong><span>topic macro-F1</span></div>
          <p>The LLM first separates genuine customer problems. Embedding retrieval then limits choices to approved SPS topics, and a second LLM decision validates the label against quoted transcript evidence.</p>
          <div className="model-decision-list">
            <span><CheckCircle2 size={15} />Exact issue count on 28/28 test calls</span>
            <span><CheckCircle2 size={15} />Valid evidence on every predicted segment</span>
            <span><ShieldAlert size={15} />Synthetic six-topic result, not production accuracy</span>
          </div>
        </article>
      </div>

      <article className="panel-card model-table-panel">
        <div className="panel-heading"><div><p className="section-kicker">Full Comparison</p><h3>All topic-modelling approaches</h3></div><GitCompareArrows size={19} /></div>
        <div className="model-metric-guide" role="note">
          <strong>How to read the main scores</strong>
          <span><b>Macro-F1:</b> balanced performance across issue categories.</span>
          <span><b>Accuracy:</b> how many individual predictions were correct.</span>
          <span><b>Multi-issue:</b> whether all problems in a call were found correctly.</span>
          <span>Higher is better. These are saved benchmark results, not live scores. Hover over or focus a question mark for more detail.</span>
        </div>
        <div className="model-table-scroll">
          <table className="model-results-table">
            <thead><tr><th>Method</th><th>Family</th><th><MetricHeader metric="macroF1" /></th><th><MetricHeader metric="accuracy" /></th><th>Paraphrase</th><th>Confound split</th><th><MetricHeader metric="multiIssue" /></th><th>Runtime</th></tr></thead>
            <tbody>
              {modelApproaches.map((approach) => (
                <tr key={approach.id}>
                  <td><strong>{approach.name}</strong><small>{approach.summary}</small></td>
                  <td><span className="model-family-pill" style={{ borderColor: FAMILY_COLORS[approach.family], color: FAMILY_COLORS[approach.family] }}>{approach.family}</span></td>
                  <td className="model-score-cell">{percent(approach.macroF1)}</td>
                  <td>{percent(approach.accuracy)}</td>
                  <td>{percent(approach.paraphrase)}</td>
                  <td>{percent(approach.confound)}</td>
                  <td>{percent(approach.multiIssue)}</td>
                  <td>{seconds(approach.runtimeSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <div className="model-dashboard-grid lower">
        <article className="panel-card model-chart-panel">
          <div className="panel-heading"><div><p className="section-kicker">Agent Behaviors</p><h3>Approach-extraction results</h3></div><Target size={19} /></div>
          <div className="model-chart-box compact">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={approachExtractionResults} layout="vertical" margin={{ left: 40, right: 20 }}>
                <CartesianGrid horizontal={false} stroke="rgba(122,148,190,0.14)" />
                <XAxis type="number" domain={[0, 1]} tickFormatter={(value) => `${Math.round(value * 100)}%`} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={160} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => percent(Number(value))} />
                <Legend />
                <Bar dataKey="macroF1" name="Macro-F1" fill="#b7a1ff" radius={[0, 7, 7, 0]} />
                <Bar dataKey="accuracy" name="Accuracy" fill="#6ee7c8" radius={[0, 7, 7, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel-card model-notes-card">
          <div className="panel-heading"><div><p className="section-kicker">Interpretation</p><h3>What the new methods taught us</h3></div><FlaskConical size={19} /></div>
          {modelApproaches.slice(1, 9).map((approach) => (
            <div className="model-note" key={approach.id}>
              <span style={{ background: FAMILY_COLORS[approach.family] }} />
              <div><strong>{approach.name}</strong><p>{approach.tradeoff}</p></div>
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}
