import { BrainCircuit, CheckCircle2, Database, FlaskConical, GitCompareArrows, ShieldAlert, Sparkles, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { approachExtractionResults, benchmarkSummary, modelApproaches, type ModelFamily } from "../modelApproachData";

const FAMILY_COLORS: Record<ModelFamily, string> = {
  Hybrid: "#6ee7c8",
  "Supervised ML": "#7ac8ff",
  "Semantic ML": "#b7a1ff",
  Rules: "#ffc66b",
  Legacy: "#ff8b72",
};

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

export default function ModelApproachesPage() {
  const chartData = modelApproaches.map((approach) => ({
    name: approach.name.replace("Character", "Char").replace("Taxonomy keyword", "Taxonomy"),
    macroF1: Math.round(approach.macroF1 * 1000) / 10,
    multiIssue: Math.round(approach.multiIssue * 1000) / 10,
    fill: FAMILY_COLORS[approach.family],
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
          <div className="model-chart-box">
            <ResponsiveContainer width="100%" height={390}>
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 90 }}>
                <CartesianGrid vertical={false} stroke="rgba(122,148,190,0.14)" />
                <XAxis dataKey="name" interval={0} angle={-35} textAnchor="end" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Legend verticalAlign="top" height={34} />
                <Bar dataKey="macroF1" name="Macro-F1" fill="#6ee7c8" radius={[7, 7, 0, 0]} />
                <Bar dataKey="multiIssue" name="Multi-issue exact" fill="#7ac8ff" radius={[7, 7, 0, 0]} />
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
        <div className="model-table-scroll">
          <table className="model-results-table">
            <thead><tr><th>Method</th><th>Family</th><th>Macro-F1</th><th>Accuracy</th><th>Paraphrase</th><th>Confound split</th><th>Multi-issue</th><th>Runtime</th></tr></thead>
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
