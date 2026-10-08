import { useState, type CSSProperties } from "react";
import type { CallCard, DashboardIssue } from "../types";
import { compareCallRecency, titleCase } from "../utils";

interface ApproachPortfolioPageProps {
  issues: DashboardIssue[];
  calls: CallCard[];
  onOpenCall: (callId: string) => void;
}

type PortfolioMetric = "fcr" | "sentiment" | "length";
type PortfolioMode = "adoption" | "reliability";

interface PortfolioApproach {
  id: string;
  label: string;
  behavior: string;
  usage: number;
  consistency: number;
  issueCoverage: number;
  confidence: "High" | "Medium";
  metrics: Record<PortfolioMetric, number>;
  why: string;
  risk: string;
  companion: string;
}

const METRICS: Record<PortfolioMetric, { label: string; high: string; low: string; range: number; contextSpread: number }> = {
  fcr: { label: "FCR lift", high: "Higher resolution", low: "Lower resolution", range: 24, contextSpread: 8 },
  sentiment: { label: "Sentiment", high: "Better sentiment", low: "Worse sentiment", range: 1.5, contextSpread: 0.45 },
  length: { label: "Call length", high: "Shorter calls", low: "Longer calls", range: 4, contextSpread: 1.1 },
};

const APPROACHES: PortfolioApproach[] = [
  {
    id: "explicit-next-steps",
    label: "Set explicit next steps",
    behavior: "set explicit next steps",
    usage: 52,
    consistency: 82,
    issueCoverage: 8,
    confidence: "High",
    metrics: { fcr: 16, sentiment: 0.7, length: 1.8 },
    why: "Clear ownership and timing turn an explanation into an action the borrower can follow.",
    risk: "The benefit falls away when the promised action depends on an unconfirmed handoff.",
    companion: "Explained policy clearly",
  },
  {
    id: "policy-clearly",
    label: "Explained policy clearly",
    behavior: "explained policy clearly",
    usage: 41,
    consistency: 76,
    issueCoverage: 8,
    confidence: "High",
    metrics: { fcr: 12, sentiment: 0.4, length: 1.2 },
    why: "Plain-language policy explanations reduce repeated questions and make decisions easier to understand.",
    risk: "Policy alone can feel like a dead end when no practical next step follows it.",
    companion: "Set explicit next steps",
  },
  {
    id: "offered-next-steps",
    label: "Offered next steps",
    behavior: "offered next steps",
    usage: 24,
    consistency: 68,
    issueCoverage: 7,
    confidence: "Medium",
    metrics: { fcr: 15, sentiment: 0.8, length: 1.6 },
    why: "Borrowers leave knowing what they can do next instead of only hearing an explanation.",
    risk: "Vague steps or missing timeframes create another contact instead of a resolution.",
    companion: "Used empathy",
  },
  {
    id: "empathy",
    label: "Used empathy",
    behavior: "used empathy",
    usage: 78,
    consistency: 54,
    issueCoverage: 10,
    confidence: "High",
    metrics: { fcr: 4, sentiment: 1.1, length: 0.3 },
    why: "Acknowledging customer effort creates room to explain a difficult process or decision.",
    risk: "Empathy can stabilize tone without resolving the underlying account problem.",
    companion: "Offered next steps",
  },
  {
    id: "servicing-timeline",
    label: "Explained servicing timeline",
    behavior: "explained servicing timeline",
    usage: 29,
    consistency: 70,
    issueCoverage: 6,
    confidence: "Medium",
    metrics: { fcr: 10, sentiment: 0.6, length: 1.9 },
    why: "A concrete sequence sets expectations and reduces uncertainty about what happens next.",
    risk: "A timeline is less useful when the borrower disputes the decision rather than the process.",
    companion: "Set explicit next steps",
  },
  {
    id: "repeat-explanation",
    label: "Prevented repeat explanation",
    behavior: "prevented repeat explanation",
    usage: 18,
    consistency: 61,
    issueCoverage: 5,
    confidence: "Medium",
    metrics: { fcr: 8, sentiment: 0.9, length: 2.2 },
    why: "Recognizing prior context reduces customer effort and keeps the call focused on unfinished work.",
    risk: "Acknowledgment helps less when the previous action is still incomplete or incorrect.",
    companion: "Used empathy",
  },
  {
    id: "transfer",
    label: "Transferred or escalated",
    behavior: "transferred or escalated",
    usage: 58,
    consistency: 72,
    issueCoverage: 9,
    confidence: "High",
    metrics: { fcr: -11, sentiment: -0.6, length: -2.7 },
    why: "Complex cases may reach a team with the authority needed to complete the work.",
    risk: "Transfers add effort when the reason, receiving team, or expected wait is unclear.",
    companion: "Explained policy clearly",
  },
  {
    id: "missed-concern",
    label: "Failed to address concern",
    behavior: "failed to address concern",
    usage: 18,
    consistency: 80,
    issueCoverage: 6,
    confidence: "High",
    metrics: { fcr: -20, sentiment: -1.2, length: -3.1 },
    why: "The central borrower question remains unanswered, even if the agent supplies related information.",
    risk: "Unaddressed concerns are likely to create escalation and repeat contact.",
    companion: "Left issue open",
  },
];

function hash(value: string) {
  return [...value].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 0);
}

function impactFor(approach: PortfolioApproach, metric: PortfolioMetric, issue: string) {
  const base = approach.metrics[metric];
  if (!issue) return base;
  const config = METRICS[metric];
  const adjustment = ((hash(`${approach.id}:${issue}`) % 17) - 8) / 8 * config.contextSpread;
  return Math.max(-config.range, Math.min(config.range, base + adjustment));
}

function displayImpact(metric: PortfolioMetric, value: number) {
  const rounded = Math.round(Math.abs(value) * 10) / 10;
  if (metric === "length") return `${value >= 0 ? "−" : "+"}${rounded} turns`;
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${rounded}${metric === "fcr" ? " pts" : ""}`;
}

function quadrant(mode: PortfolioMode, x: number, impact: number) {
  if (mode === "adoption") {
    if (impact >= 0) return x >= 50 ? "Scale / standardize" : "Promising / underused";
    return x >= 50 ? "Common friction" : "Investigate";
  }
  if (impact >= 0) return x >= 50 ? "Proven standard" : "Context-specific win";
  return x >= 50 ? "Consistent friction" : "Experimental";
}

export default function ApproachPortfolioPage({ issues, calls, onOpenCall }: ApproachPortfolioPageProps) {
  const [metric, setMetric] = useState<PortfolioMetric>("fcr");
  const [mode, setMode] = useState<PortfolioMode>("adoption");
  const [issue, setIssue] = useState("");
  const [selectedId, setSelectedId] = useState(APPROACHES[0].id);
  const selected = APPROACHES.find((approach) => approach.id === selectedId) ?? APPROACHES[0];
  const config = METRICS[metric];
  const points = APPROACHES.map((approach) => {
    const impact = impactFor(approach, metric, issue);
    const x = mode === "adoption" ? approach.usage : approach.consistency;
    return { approach, impact, x, quadrant: quadrant(mode, x, impact) };
  });
  const selectedPoint = points.find((point) => point.approach.id === selected.id)!;
  const scaleCount = points.filter((point) => point.impact >= 0 && point.x >= 50).length;
  const opportunityCount = points.filter((point) => point.impact >= 0 && point.x < 50).length;
  const frictionCount = points.filter((point) => point.impact < 0 && point.x >= 50).length;
  const evidenceCalls = calls
    .filter((call) => call.behaviors.includes(selected.behavior))
    .sort((left, right) => -compareCallRecency(left, right))
    .slice(0, 2);
  const issueScores = issues
    .map((item) => ({ issue: item.issue, value: impactFor(selected, metric, item.issue) }))
    .sort((left, right) => right.value - left.value);
  const contextCards = [...issueScores.slice(0, 2), ...issueScores.slice(-2)].filter((item, index, all) => all.findIndex((candidate) => candidate.issue === item.issue) === index);
  const quadrantLabels = mode === "adoption"
    ? ["Promising / underused", "Scale / standardize", "Investigate", "Common friction"]
    : ["Context-specific wins", "Proven standards", "Experimental", "Consistent friction"];

  return (
    <section className="portfolio-dashboard" aria-label="Story Dashboard 3 — Approach Portfolio Map">
      <div className="portfolio-summary-grid">
        <article className="panel-card portfolio-summary-card"><span>Approaches mapped</span><strong>{APPROACHES.length}</strong></article>
        <article className="panel-card portfolio-summary-card"><span>{mode === "adoption" ? "Scale candidates" : "Proven standards"}</span><strong>{scaleCount}</strong></article>
        <article className="panel-card portfolio-summary-card"><span>{mode === "adoption" ? "Underused opportunities" : "Context-specific wins"}</span><strong>{opportunityCount}</strong></article>
        <article className="panel-card portfolio-summary-card"><span>Friction signals</span><strong>{frictionCount}</strong></article>
      </div>

      <div className="panel-card portfolio-control-bar">
        <div>
          <p className="section-kicker">Prototype portfolio signals</p>
          <h3>Choose the decision lens</h3>
        </div>
        <div className="portfolio-control-group" role="group" aria-label="Map mode">
          <span>Map</span>
          <button type="button" className={mode === "adoption" ? "active" : ""} aria-pressed={mode === "adoption"} onClick={() => setMode("adoption")}>Adoption</button>
          <button type="button" className={mode === "reliability" ? "active" : ""} aria-pressed={mode === "reliability"} onClick={() => setMode("reliability")}>Reliability</button>
        </div>
        <div className="portfolio-control-group" role="group" aria-label="Outcome metric">
          <span>Outcome</span>
          {(Object.keys(METRICS) as PortfolioMetric[]).map((key) => (
            <button type="button" key={key} className={metric === key ? "active" : ""} aria-pressed={metric === key} onClick={() => setMetric(key)}>{METRICS[key].label}</button>
          ))}
        </div>
        <label className="portfolio-issue-filter">
          <span>Issue</span>
          <select className="dashboard-input" value={issue} onChange={(event) => setIssue(event.target.value)}>
            <option value="">All issues</option>
            {issues.map((item) => <option key={item.slug} value={item.issue}>{titleCase(item.issue)}</option>)}
          </select>
        </label>
      </div>

      <div className="portfolio-layout">
        <div className="panel-card portfolio-map-card">
          <div className="portfolio-map-heading">
            <div>
              <p className="section-kicker">{mode === "adoption" ? "Usage × outcome impact" : "Consistency × outcome impact"}</p>
              <h3>{issue ? titleCase(issue) : "All servicing issues"}</h3>
            </div>
            <span>Modeled prototype values</span>
          </div>

          <div className="portfolio-map">
            <span className="portfolio-quadrant-label top-left">{quadrantLabels[0]}</span>
            <span className="portfolio-quadrant-label top-right">{quadrantLabels[1]}</span>
            <span className="portfolio-quadrant-label bottom-left">{quadrantLabels[2]}</span>
            <span className="portfolio-quadrant-label bottom-right">{quadrantLabels[3]}</span>
            <span className="portfolio-axis-label axis-high">{config.high}</span>
            <span className="portfolio-axis-label axis-low">{config.low}</span>
            <span className="portfolio-axis-label axis-left">Low {mode === "adoption" ? "usage" : "consistency"}</span>
            <span className="portfolio-axis-label axis-right">High {mode === "adoption" ? "usage" : "consistency"}</span>
            <div className="portfolio-midline horizontal" />
            <div className="portfolio-midline vertical" />

            {points.map(({ approach, impact, x }) => {
              const left = 8 + x * 0.84;
              const top = 90 - ((impact + config.range) / (config.range * 2)) * 80;
              const bubbleSize = 48 + approach.issueCoverage * 3;
              const bubbleTone = impact < 0 ? "negative" : approach.consistency >= 70 ? "positive" : "mixed";
              const style = {
                left: `${left}%`,
                top: `${top}%`,
                "--bubble-size": `${bubbleSize}px`,
              } as CSSProperties;
              return (
                <button
                  type="button"
                  key={approach.id}
                  className={`portfolio-bubble ${bubbleTone} ${selectedId === approach.id ? "selected" : ""}`}
                  style={style}
                  aria-label={`${approach.label}: ${displayImpact(metric, impact)}, ${x}% ${mode}`}
                  aria-pressed={selectedId === approach.id}
                  onClick={() => setSelectedId(approach.id)}
                >
                  <strong>{displayImpact(metric, impact)}</strong>
                  <span>{approach.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="panel-card portfolio-detail">
          <div className="portfolio-detail-heading">
            <div>
              <p className="section-kicker">Selected approach</p>
              <h3>{selected.label}</h3>
            </div>
            <span className={`portfolio-status ${selectedPoint.impact < 0 ? "negative" : "positive"}`}>{selectedPoint.quadrant}</span>
          </div>

          <div className="portfolio-detail-metrics">
            <article><span>Modeled {config.label}</span><strong>{displayImpact(metric, selectedPoint.impact)}</strong></article>
            <article><span>Prototype usage</span><strong>{selected.usage}%</strong></article>
            <article><span>Cross-issue consistency</span><strong>{selected.consistency}%</strong></article>
            <article><span>Evidence confidence</span><strong>{selected.confidence}</strong></article>
          </div>

          <div className="portfolio-explanation">
            <h4>Why it may work</h4>
            <p>{selected.why}</p>
            <h4>Where it can fail</h4>
            <p>{selected.risk}</p>
            <span><strong>Common companion:</strong> {selected.companion}</span>
          </div>

          <div className="portfolio-context">
            <div className="portfolio-section-heading">
              <h4>Best and weakest contexts</h4>
              <span>{config.label}</span>
            </div>
            <div className="portfolio-context-grid">
              {contextCards.map((item) => (
                <article key={item.issue} className={item.value >= 0 ? "positive" : "negative"}>
                  <span>{titleCase(item.issue)}</span>
                  <strong>{displayImpact(metric, item.value)}</strong>
                </article>
              ))}
            </div>
          </div>

          <div className="portfolio-evidence">
            <div className="portfolio-section-heading">
              <h4>Supporting calls</h4>
              <span>{evidenceCalls.length} linked</span>
            </div>
            {evidenceCalls.length ? evidenceCalls.map((call) => (
              <button type="button" className="evidence-row" key={call.call_id} onClick={() => onOpenCall(call.call_id)}>
                <strong>{call.call_id}</strong>
                <span>{call.summary}</span>
                <small>{titleCase(call.outcome)} · {call.turn_count ?? "Unknown"} turns</small>
              </button>
            )) : <p>No matching evidence calls are available.</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}
