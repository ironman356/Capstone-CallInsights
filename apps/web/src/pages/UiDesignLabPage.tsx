import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Newspaper, Radar, Sparkles, Workflow, type LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar as RechartsRadar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardIssue, WorkspacePayload } from "../types";
import { formatValue, titleCase } from "../utils";

type DesignVariant =
  | "signal-canvas"
  | "mission-control"
  | "editorial"
  | "data-prism"
  | "neon-orbit";

interface UiDesignLabPageProps {
  workspace: WorkspacePayload;
  onOpenIssue: (issue: DashboardIssue) => void;
  onOpenCall: (callId: string) => void;
}

interface VariantDefinition {
  key: DesignVariant;
  label: string;
  description: string;
  icon: LucideIcon;
}

const VARIANTS: VariantDefinition[] = [
  {
    key: "signal-canvas",
    label: "Signal Canvas",
    description: "Bright control surface with clustered issue bubbles and pulse ribbons.",
    icon: Sparkles,
  },
  {
    key: "mission-control",
    label: "Mission Control",
    description: "Dense operations board with heatmaps, towers, and evidence scan.",
    icon: Workflow,
  },
  {
    key: "editorial",
    label: "Editorial Board",
    description: "Narrative dashboard with magazine pacing instead of equal-weight widgets.",
    icon: Newspaper,
  },
  {
    key: "data-prism",
    label: "Data Prism",
    description: "Chart-heavy concept with layered views and stronger analytical contrast.",
    icon: Activity,
  },
  {
    key: "neon-orbit",
    label: "Neon Orbit",
    description: "Futuristic command deck with radar, orbital cards, and elevated motion.",
    icon: Radar,
  },
];

const VARIANT_THEMES: Record<DesignVariant, string> = {
  "signal-canvas": "theme-aqua",
  "mission-control": "theme-ember",
  editorial: "theme-copper",
  "data-prism": "theme-prism",
  "neon-orbit": "theme-neon",
};

const CHART_COLORS = ["#8ef6c7", "#1bb7ff", "#ff9466", "#ffe27a", "#9f91ff"];

function sumValues(values: Record<string, number>) {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

export function UiDesignLabPage({ workspace, onOpenIssue, onOpenCall }: UiDesignLabPageProps) {
  const [variant, setVariant] = useState<DesignVariant>("signal-canvas");
  const { dashboard, pulse_insights, strategy_board, reports } = workspace;

  const topIssues = dashboard.issues.slice(0, 5);
  const topCalls = dashboard.calls.slice(0, 5);
  const topPatterns = dashboard.overview.top_patterns.slice(0, 5);
  const topPulse = pulse_insights.slice(0, 4);
  const outcomeEntries = Object.entries(dashboard.overview.outcome_counts);
  const toneMix = Object.entries(dashboard.overview.sentiment_summary);
  const issueMax = Math.max(...topIssues.map((issue) => issue.count), 1);
  const strategyMax = Math.max(...strategy_board.stages.map((stage) => stage.count), 1);
  const toneTotal = Math.max(sumValues(dashboard.overview.sentiment_summary), 1);

  const outcomeChart = useMemo(
    () =>
      outcomeEntries.map(([outcome, value], index) => ({
        name: titleCase(outcome),
        value,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [outcomeEntries],
  );

  const issueTrendChart = useMemo(
    () =>
      dashboard.issues.slice(0, 6).map((issue, index) => ({
        name: titleCase(issue.issue),
        calls: issue.count,
        shift: Number(issue.average_shift.toFixed(2)),
        tone: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [dashboard.issues],
  );

  const radarChart = useMemo(
    () =>
      topIssues.map((issue) => ({
        issue: titleCase(issue.issue),
        count: issue.count,
        shift: Math.max(0.4, Number((Math.abs(issue.average_shift) * 10).toFixed(1))),
      })),
    [topIssues],
  );

  const heatmapRows = useMemo(
    () =>
      dashboard.issues.slice(0, 4).map((issue) => ({
        issue,
        outcomes: outcomeEntries.slice(0, 4).map(([outcome]) => ({
          outcome,
          value: issue.outcome_breakdown[outcome] ?? 0,
        })),
      })),
    [dashboard.issues, outcomeEntries],
  );

  const heatmapMax = Math.max(
    ...heatmapRows.flatMap((row) => row.outcomes.map((item) => item.value)),
    1,
  );

  const renderVariant = () => {
    if (variant === "signal-canvas") {
      return (
        <div className="design-board signal-canvas-board">
          <article className="design-hero-card design-card">
            <div className="section-heading">
              <h2>Signal Canvas</h2>
              <p>Visual-first overview for scanning issue pressure, customer mood, and active intervention energy.</p>
            </div>
            <div className="metric-ribbon">
              {dashboard.overview.metrics.map((metric) => (
                <motion.div
                  key={metric.label}
                  className={`metric-ribbon-card tone-${metric.tone}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32 }}
                >
                  <span>{metric.label}</span>
                  <strong>{formatValue(metric.value)}</strong>
                </motion.div>
              ))}
            </div>
            <div className="pulse-stripe">
              {topPulse.map((insight, index) => (
                <motion.button
                  key={insight.insight_id}
                  type="button"
                  className="pulse-stripe-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: index * 0.05 }}
                  onClick={() => insight.call_ids[0] && onOpenCall(insight.call_ids[0])}
                >
                  <span>{insight.trend}</span>
                  <strong>{insight.title}</strong>
                  <p>{insight.summary}</p>
                </motion.button>
              ))}
            </div>
          </article>

          <article className="design-card issue-cluster-card">
            <div className="section-heading">
              <h2>Issue Cluster Constellation</h2>
              <p>The dominant issues are rendered as floating, scalable objects instead of plain list rows.</p>
            </div>
            <div className="issue-cluster-grid">
              {topIssues.map((issue, index) => (
                <motion.button
                  key={issue.slug}
                  type="button"
                  className={`issue-cluster issue-cluster-${index + 1}`}
                  style={{ width: `${46 + (issue.count / issueMax) * 74}px`, height: `${46 + (issue.count / issueMax) * 74}px` }}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4 + index, repeat: Infinity, ease: "easeInOut" }}
                  onClick={() => onOpenIssue(issue)}
                >
                  <strong>{titleCase(issue.issue)}</strong>
                  <span>{issue.count} calls</span>
                </motion.button>
              ))}
            </div>
          </article>

          <article className="design-card chart-card">
            <div className="section-heading">
              <h2>Outcome Distribution</h2>
              <p>A compact donut chart works better here than another KPI strip.</p>
            </div>
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={outcomeChart} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92}>
                    {outcomeChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="visual-bar-copy-grid">
              {outcomeChart.map((entry) => (
                <div className="visual-chip" key={entry.name}>
                  <span className="visual-chip-dot" style={{ backgroundColor: entry.fill }} />
                  <strong>{entry.name}</strong>
                  <span>{entry.value}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="design-card spectrum-card">
            <div className="section-heading">
              <h2>Sentiment Spectrum</h2>
              <p>The tonal mix is treated as a banded surface instead of a small table.</p>
            </div>
            <div className="spectrum-bar">
              {toneMix.map(([tone, value]) => (
                <div
                  key={tone}
                  className={`spectrum-segment spectrum-${tone}`}
                  style={{ width: `${(value / toneTotal) * 100}%` }}
                >
                  <span>{titleCase(tone)}</span>
                </div>
              ))}
            </div>
            <div className="spectrum-legend">
              {toneMix.map(([tone, value]) => (
                <div key={tone} className="line-item">
                  <span>{titleCase(tone)}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      );
    }

    if (variant === "mission-control") {
      return (
        <div className="design-board mission-control-board">
          <article className="design-card mission-kpi-card">
            <div className="section-heading">
              <h2>Mission Control</h2>
              <p>High-density layout focused on routing, pressure points, and intervention capacity.</p>
            </div>
            <div className="mission-kpi-grid">
              {reports.issue_table.slice(0, 4).map((row) => (
                <div className="mission-kpi" key={row.issue}>
                  <span>{titleCase(row.issue)}</span>
                  <strong>{row.count}</strong>
                  <p>{titleCase(row.top_outcome)}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="design-card heatmap-card">
            <div className="section-heading">
              <h2>Issue x Outcome Heatmap</h2>
              <p>A fast scan for over-indexing issue patterns and outcome pressure.</p>
            </div>
            <div className="heatmap-table">
              <div className="heatmap-header">
                <span>Issue</span>
                {outcomeEntries.slice(0, 4).map(([outcome]) => (
                  <span key={outcome}>{titleCase(outcome)}</span>
                ))}
              </div>
              {heatmapRows.map((row) => (
                <div className="heatmap-row" key={row.issue.slug}>
                  <strong>{titleCase(row.issue.issue)}</strong>
                  {row.outcomes.map((cell) => (
                    <div
                      key={`${row.issue.slug}-${cell.outcome}`}
                      className="heatmap-cell"
                      style={{ opacity: 0.22 + cell.value / heatmapMax }}
                    >
                      {cell.value}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </article>

          <article className="design-card stages-card">
            <div className="section-heading">
              <h2>Strategy Stage Load</h2>
              <p>Intervention workflow turns into a set of physical towers instead of counters.</p>
            </div>
            <div className="stage-towers">
              {strategy_board.stages.map((stage) => (
                <div className="stage-tower" key={stage.name}>
                  <div className="stage-tower-track">
                    <div className="stage-tower-fill" style={{ height: `${(stage.count / strategyMax) * 100}%` }} />
                  </div>
                  <strong>{stage.count}</strong>
                  <span>{stage.name}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="design-card evidence-card-variant">
            <div className="section-heading">
              <h2>Evidence Scan</h2>
              <p>Recent calls and high-lift patterns stay one action away from drilldown.</p>
            </div>
            <div className="evidence-scan-grid">
              {topCalls.map((call) => (
                <button
                  key={call.call_id}
                  type="button"
                  className="evidence-scan-item"
                  onClick={() => onOpenCall(call.call_id)}
                >
                  <span>{call.call_id}</span>
                  <strong>{titleCase(call.issue)}</strong>
                  <p>{call.summary}</p>
                </button>
              ))}
            </div>
            <div className="pattern-lift-strip">
              {topPatterns.map((pattern) => (
                <button
                  key={`${pattern.issue}-${pattern.behavior}-${pattern.outcome}`}
                  type="button"
                  className="pattern-lift-card"
                  onClick={() => {
                    const issue = dashboard.issues.find((item) => item.issue === pattern.issue);
                    if (issue) {
                      onOpenIssue(issue);
                    }
                  }}
                >
                  <span>{pattern.behavior}</span>
                  <strong>{titleCase(pattern.issue)}</strong>
                  <p>{pattern.count} calls · Lift {pattern.lift}</p>
                </button>
              ))}
            </div>
          </article>
        </div>
      );
    }

    if (variant === "editorial") {
      return (
        <div className="design-board editorial-board">
          <article className="design-card editorial-hero">
            <div className="editorial-hero-copy">
              <span className="editorial-kicker">Narrative Dashboard</span>
              <h2>Editorial Board</h2>
              <p>
                This concept treats the dashboard as a curated story about customer friction, recovery, and operating
                momentum rather than a bank of symmetrical widgets.
              </p>
            </div>
            <div className="editorial-stat-stack">
              {dashboard.overview.metrics.slice(0, 3).map((metric) => (
                <div className="editorial-stat" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{formatValue(metric.value)}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="design-card editorial-feature">
            <div className="section-heading">
              <h2>Feature Story</h2>
              <p>The highest-pressure issue gets feature treatment and visual hierarchy.</p>
            </div>
            {topIssues[0] ? (
              <button type="button" className="feature-story-card" onClick={() => onOpenIssue(topIssues[0])}>
                <span>Lead signal</span>
                <h3>{titleCase(topIssues[0].issue)}</h3>
                <p>{topIssues[0].summary}</p>
                <strong>{topIssues[0].count} calls carrying this issue</strong>
              </button>
            ) : null}
            <div className="storyline-grid">
              {topIssues.slice(1, 4).map((issue) => (
                <button key={issue.slug} type="button" className="storyline-card" onClick={() => onOpenIssue(issue)}>
                  <span>{issue.count} calls</span>
                  <strong>{titleCase(issue.issue)}</strong>
                  <p>{issue.summary}</p>
                </button>
              ))}
            </div>
          </article>

          <article className="design-card editorial-reel">
            <div className="section-heading">
              <h2>Call Reel</h2>
              <p>Evidence cards feel like snapshots pulled onto a curator board.</p>
            </div>
            <div className="call-reel">
              {topCalls.map((call) => (
                <button key={call.call_id} type="button" className="call-reel-card" onClick={() => onOpenCall(call.call_id)}>
                  <span>{call.call_id}</span>
                  <strong>{titleCase(call.issue)}</strong>
                  <p>{call.summary}</p>
                </button>
              ))}
            </div>
          </article>

          <article className="design-card editorial-patterns">
            <div className="section-heading">
              <h2>Pattern Notes</h2>
              <p>Pattern cards become editorial side notes that support the lead story.</p>
            </div>
            <div className="editorial-pattern-list">
              {topPatterns.map((pattern) => (
                <div className="editorial-pattern-item" key={`${pattern.issue}-${pattern.behavior}-${pattern.outcome}`}>
                  <span>{pattern.behavior}</span>
                  <strong>{titleCase(pattern.issue)}</strong>
                  <p>{titleCase(pattern.outcome)} appears in {pattern.count} calls with lift {pattern.lift}.</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      );
    }

    if (variant === "data-prism") {
      return (
        <div className="design-board data-prism-board">
          <article className="design-card chart-card span-2">
            <div className="section-heading">
              <h2>Data Prism</h2>
              <p>This version leans into charting and layered quantitative views instead of cards alone.</p>
            </div>
            <div className="dual-chart-grid">
              <div className="chart-shell">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={issueTrendChart}>
                    <defs>
                      <linearGradient id="issueCallsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1bb7ff" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#1bb7ff" stopOpacity={0.08} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(145, 180, 255, 0.16)" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={64} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="calls" stroke="#1bb7ff" fill="url(#issueCallsGradient)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-shell">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={issueTrendChart}>
                    <CartesianGrid stroke="rgba(145, 180, 255, 0.14)" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={64} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="shift" radius={[8, 8, 0, 0]}>
                      {issueTrendChart.map((entry) => (
                        <Cell key={entry.name} fill={entry.tone} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </article>

          <article className="design-card chart-card">
            <div className="section-heading">
              <h2>Outcome Mix</h2>
              <p>Compact radial treatment for the macro split.</p>
            </div>
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={outcomeChart} dataKey="value" nameKey="name" outerRadius={92}>
                    {outcomeChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="design-card chart-card">
            <div className="section-heading">
              <h2>Issue Radar</h2>
              <p>Comparative pressure and shift displayed in a more unusual geometry.</p>
            </div>
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarChart}>
                  <PolarGrid stroke="rgba(145, 180, 255, 0.2)" />
                  <PolarAngleAxis dataKey="issue" tick={{ fill: "currentColor", fontSize: 11 }} />
                  <RechartsRadar
                    dataKey="count"
                    stroke="#8ef6c7"
                    fill="#8ef6c7"
                    fillOpacity={0.28}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>
      );
    }

    return (
      <div className="design-board neon-orbit-board">
        <article className="design-card neon-hero span-2">
          <div className="section-heading">
            <h2>Neon Orbit</h2>
            <p>Deliberately futuristic concept with orbital navigation cues, radar geometry, and ambient motion.</p>
          </div>
          <div className="orbit-ring-shell">
            {topIssues.map((issue, index) => (
              <motion.button
                key={issue.slug}
                type="button"
                className={`orbit-node orbit-node-${index + 1}`}
                animate={{ rotate: 360 }}
                transition={{ duration: 18 + index * 4, repeat: Infinity, ease: "linear" }}
                onClick={() => onOpenIssue(issue)}
              >
                <span>{issue.count}</span>
                <strong>{titleCase(issue.issue)}</strong>
              </motion.button>
            ))}
            <div className="orbit-core">
              <strong>{dashboard.calls.length}</strong>
              <span>tracked calls</span>
            </div>
          </div>
        </article>

        <article className="design-card chart-card">
          <div className="section-heading">
            <h2>Radar Panel</h2>
            <p>The issue field is rendered as a radar sweep rather than a grid.</p>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarChart}>
                <PolarGrid stroke="rgba(145, 180, 255, 0.24)" />
                <PolarAngleAxis dataKey="issue" tick={{ fill: "currentColor", fontSize: 11 }} />
                <RechartsRadar dataKey="count" stroke="#9f91ff" fill="#9f91ff" fillOpacity={0.32} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="design-card neon-feed">
          <div className="section-heading">
            <h2>Orbit Feed</h2>
            <p>Pulse items become stacked transmissions with stronger visual energy.</p>
          </div>
          <div className="neon-feed-list">
            {topPulse.map((item) => (
              <button
                key={item.insight_id}
                type="button"
                className="neon-feed-item"
                onClick={() => item.call_ids[0] && onOpenCall(item.call_ids[0])}
              >
                <span>{item.trend}</span>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
              </button>
            ))}
          </div>
        </article>
      </div>
    );
  };

  return (
    <section className={`single-column design-lab ${VARIANT_THEMES[variant]}`}>
      <article className="panel design-lab-panel">
        <div className="section-heading">
          <h2>Dashboard concept lab</h2>
          <p>
            Five distinct directions built on the same call intelligence data. The goal is to push beyond generic
            enterprise dashboards and test stronger visual identities.
          </p>
        </div>

        <div className="design-variant-switch" role="tablist" aria-label="UI variants">
          {VARIANTS.map((item) => {
            const Icon = item.icon;
            const active = item.key === variant;

            return (
              <button
                key={item.key}
                type="button"
                className={`design-variant-pill ${active ? "active" : ""}`}
                onClick={() => setVariant(item.key)}
              >
                <div className="design-variant-title">
                  <Icon size={18} />
                  <strong>{item.label}</strong>
                </div>
                <span>{item.description}</span>
              </button>
            );
          })}
        </div>
      </article>

      <AnimatePresence mode="wait">
        <motion.div
          key={variant}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.28 }}
        >
          {renderVariant()}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
