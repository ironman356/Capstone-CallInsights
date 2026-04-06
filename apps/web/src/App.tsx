import { useEffect, useMemo, useState } from 'react';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

type DashboardMetric = {
  label: string;
  value: number | string;
  tone: string;
};

type Pattern = {
  issue: string;
  behavior: string;
  outcome: string;
  count: number;
  lift: number;
  call_ids: string[];
  evidence: string;
};

type DashboardCall = {
  call_id: string;
  source_file: string;
  issue: string;
  outcome: string;
  behaviors: string[];
  summary: string;
  sentiments: {
    opening: number;
    mid: number;
    closing: number;
    shift: number;
  };
};

type DashboardIssue = {
  issue: string;
  slug: string;
  count: number;
  summary: string;
  outcome_breakdown: Record<string, number>;
  top_behaviors: Array<{ label: string; count: number }>;
  representative_calls: Array<{ call_id: string; outcome: string; summary: string }>;
};

type DashboardData = {
  overview: {
    metrics: DashboardMetric[];
    issue_counts: Record<string, number>;
    outcome_counts: Record<string, number>;
    sentiment_summary: Record<string, number>;
    top_patterns: Pattern[];
    daily_brief: string[];
  };
  issues: DashboardIssue[];
  calls: DashboardCall[];
};

type CallDetail = {
  call_id: string;
  source_file: string;
  issue: string;
  outcome: string;
  behaviors: string[];
  sentiments: {
    opening: number;
    mid: number;
    closing: number;
    shift: number;
  };
  summary: string;
  transcript_text: string;
  turns: Array<{ speaker: string; text: string }>;
  segments: Array<{ segment_id: string; order: number; issue: string; turn_count: number; text: string }>;
};

type IssueDetail = {
  issue: string;
  count: number;
  summary: string;
  top_behaviors: Array<{ label: string; count: number }>;
  outcome_breakdown: Record<string, number>;
  evidence_calls: Array<{ call_id: string; outcome: string; summary: string }>;
};

type ViewKey = 'overview' | 'pulse' | 'explorer' | 'drilldown' | 'strategy' | 'ask';
type StrategyStage = 'Proposed' | 'Accepted' | 'In Progress' | 'Evaluating' | 'Closed';

type StrategyCard = {
  id: string;
  title: string;
  stage: StrategyStage;
  impact: string;
  evidence: string[];
  owner: string;
};

type AskCard = {
  id: string;
  title: string;
  summary: string;
  evidence: string[];
};

const VIEW_LABELS: Array<{ key: ViewKey; label: string }> = [
  { key: 'overview', label: 'Executive Overview' },
  { key: 'pulse', label: 'Daily Insights Pulse' },
  { key: 'explorer', label: 'Issue Explorer' },
  { key: 'drilldown', label: 'Call Drilldown' },
  { key: 'strategy', label: 'Strategy Management' },
  { key: 'ask', label: 'Ask CI' },
];

function formatMetricValue(value: number | string) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  return value;
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [selectedIssueSlug, setSelectedIssueSlug] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueDetail | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallDetail | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>('overview');
  const [issueFilter, setIssueFilter] = useState('');
  const [selectedOutcomeFilter, setSelectedOutcomeFilter] = useState('all');
  const [expandedPulseId, setExpandedPulseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/rank1/dashboard`);
        if (!response.ok) {
          throw new Error(`Dashboard request failed with ${response.status}`);
        }

        const payload: DashboardData = await response.json();
        setDashboard(payload);
        setSelectedIssueSlug((current) => current ?? payload.issues[0]?.slug ?? null);
        setSelectedCallId((current) => current ?? payload.calls[0]?.call_id ?? null);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!selectedIssueSlug) {
      return;
    }

    async function loadIssueDetail() {
      const response = await fetch(`${API_BASE_URL}/api/rank1/issues/${selectedIssueSlug}`);
      if (!response.ok) {
        return;
      }
      const payload: IssueDetail = await response.json();
      setSelectedIssue(payload);
    }

    void loadIssueDetail();
  }, [selectedIssueSlug]);

  useEffect(() => {
    if (!selectedCallId) {
      return;
    }

    async function loadCallDetail() {
      const response = await fetch(`${API_BASE_URL}/api/rank1/calls/${selectedCallId}`);
      if (!response.ok) {
        return;
      }
      const payload: CallDetail = await response.json();
      setSelectedCall(payload);
    }

    void loadCallDetail();
  }, [selectedCallId]);

  const filteredIssues = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return dashboard.issues.filter((issue) => {
      const matchesText =
        issue.issue.toLowerCase().includes(issueFilter.toLowerCase()) ||
        issue.summary.toLowerCase().includes(issueFilter.toLowerCase());
      const matchesOutcome =
        selectedOutcomeFilter === 'all' || issue.outcome_breakdown[selectedOutcomeFilter] !== undefined;
      return matchesText && matchesOutcome;
    });
  }, [dashboard, issueFilter, selectedOutcomeFilter]);

  const selectedIssueFromList = useMemo(
    () => dashboard?.issues.find((issue) => issue.slug === selectedIssueSlug) ?? null,
    [dashboard, selectedIssueSlug]
  );

  const trendingIssues = useMemo(() => dashboard?.issues.slice(0, 4) ?? [], [dashboard]);
  const recentEvidence = useMemo(() => dashboard?.calls.slice(0, 5) ?? [], [dashboard]);

  const pulseCards = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return dashboard.overview.top_patterns.slice(0, 8).map((pattern, index) => ({
      id: `${pattern.issue}-${pattern.behavior}-${index}`,
      issue: pattern.issue,
      trend: pattern.outcome === 'escalated' ? 'Escalation pressure' : 'Stabilizing behavior',
      evidenceCount: pattern.count,
      impactSummary: pattern.evidence,
      behavior: pattern.behavior,
      callIds: pattern.call_ids,
      outcome: pattern.outcome,
    }));
  }, [dashboard]);

  const strategyCards = useMemo<StrategyCard[]>(() => {
    if (!dashboard) {
      return [];
    }

    const seedIssues = dashboard.issues.slice(0, 5);
    const stages: StrategyStage[] = ['Proposed', 'Accepted', 'In Progress', 'Evaluating', 'Closed'];
    return seedIssues.map((issue, index) => ({
      id: issue.slug,
      title: `Reduce ${issue.issue}`,
      stage: stages[index % stages.length],
      impact: `${issue.count} calls in current sample`,
      evidence: issue.representative_calls.slice(0, 2).map((call) => call.call_id),
      owner: ['Ops', 'Servicing', 'QA', 'Training', 'Leadership'][index % 5],
    }));
  }, [dashboard]);

  const askCards = useMemo<AskCard[]>(() => {
    if (!dashboard) {
      return [];
    }

    const worstPattern = dashboard.overview.top_patterns.find((pattern) => pattern.outcome === 'escalated');
    const bestPattern = dashboard.overview.top_patterns.find((pattern) => pattern.outcome === 'resolved');
    const leadIssue = dashboard.issues[0];

    return [
      {
        id: 'ask-1',
        title: 'What is driving escalations right now?',
        summary: worstPattern
          ? `${worstPattern.issue} combined with ${worstPattern.behavior} is surfacing most often in escalated calls.`
          : 'No dominant escalation cluster is available yet.',
        evidence: worstPattern?.call_ids ?? [],
      },
      {
        id: 'ask-2',
        title: 'Which issue deserves immediate review?',
        summary: leadIssue
          ? `${leadIssue.issue} is the largest cluster and should be the first stop for issue exploration.`
          : 'No issue cluster is available yet.',
        evidence: leadIssue?.representative_calls.map((call) => call.call_id) ?? [],
      },
      {
        id: 'ask-3',
        title: 'Where are agents stabilizing calls?',
        summary: bestPattern
          ? `${bestPattern.behavior} appears in the strongest resolved pattern for ${bestPattern.issue}.`
          : 'No stable resolved pattern is available yet.',
        evidence: bestPattern?.call_ids ?? [],
      },
    ];
  }, [dashboard]);

  if (loading) {
    return <div className="app-shell status-screen">Loading Rank 1 dashboard...</div>;
  }

  if (error || !dashboard) {
    return (
      <div className="app-shell status-screen">
        <div className="status-card">
          <h1>CallInsights Rank 1</h1>
          <p>Unable to load the dashboard.</p>
          <p>{error ?? 'No dashboard payload returned.'}</p>
          <p>Start the API with `uvicorn app.main:app --reload` from `apps/api`.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero-banner">
        <div className="hero-copy-block">
          <p className="eyebrow">CallInsights Rank 1</p>
          <h1>Evidence-first mortgage servicing intelligence</h1>
          <p className="hero-copy">
            A product-style operating surface for recurring issues, agent behaviors, outcomes, sentiment,
            evidence packs, and transcript drilldown from the synthetic servicing corpus.
          </p>
          <div className="hero-actions">
            <button className="hero-button" type="button" onClick={() => setActiveView('explorer')}>
              Open Issue Explorer
            </button>
            <button className="hero-button secondary" type="button" onClick={() => setActiveView('drilldown')}>
              Open Transcript Drilldown
            </button>
          </div>
        </div>

        <aside className="change-panel">
          <div className="change-panel-header">
            <span className="pulse-dot" />
            <h2>What changed since yesterday?</h2>
          </div>
          {dashboard.overview.daily_brief.map((item) => (
            <p key={item}>{item}</p>
          ))}
          <div className="summary-tags">
            {dashboard.overview.metrics.map((metric) => (
              <span key={metric.label} className={`tag tone-${metric.tone}`}>
                {metric.label}: {formatMetricValue(metric.value)}
              </span>
            ))}
          </div>
        </aside>
      </header>

      <section className="metric-strip">
        {dashboard.overview.metrics.map((metric) => (
          <article key={metric.label} className={`metric-card tone-${metric.tone}`}>
            <span>{metric.label}</span>
            <strong>{formatMetricValue(metric.value)}</strong>
          </article>
        ))}
      </section>

      <nav className="tabbar" aria-label="Primary views">
        {VIEW_LABELS.map((view) => (
          <button
            key={view.key}
            type="button"
            className={`tab-chip ${activeView === view.key ? 'active' : ''}`}
            onClick={() => setActiveView(view.key)}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {activeView === 'overview' && (
        <section className="view-grid overview-grid">
          <article className="panel wide-panel">
            <div className="section-heading">
              <h2>Trending Issue Cards</h2>
              <p>Most important issue clusters and direct paths into supporting evidence.</p>
            </div>
            <div className="card-grid">
              {trendingIssues.map((issue) => (
                <button
                  key={issue.slug}
                  type="button"
                  className="feature-card"
                  onClick={() => {
                    setSelectedIssueSlug(issue.slug);
                    setSelectedCallId(issue.representative_calls[0]?.call_id ?? null);
                    setActiveView('explorer');
                  }}
                >
                  <div className="feature-head">
                    <h3>{issue.issue}</h3>
                    <span className="count-pill">{issue.count}</span>
                  </div>
                  <p>{issue.summary}</p>
                  <div className="feature-footer">
                    {issue.top_behaviors.slice(0, 2).map((behavior) => (
                      <span key={behavior.label} className="tag neutral">
                        {behavior.label}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="section-heading">
              <h2>Recent Evidence Snapshots</h2>
              <p>Representative calls that can be opened directly from the overview.</p>
            </div>
            <div className="stack-list">
              {recentEvidence.map((call) => (
                <button
                  key={call.call_id}
                  type="button"
                  className="feed-card"
                  onClick={() => {
                    setSelectedCallId(call.call_id);
                    setActiveView('drilldown');
                  }}
                >
                  <div className="feed-card-head">
                    <strong>{call.call_id}</strong>
                    <span className={`chip outcome-${call.outcome.replaceAll(' ', '-')}`}>{call.outcome}</span>
                  </div>
                  <p>{call.summary}</p>
                </button>
              ))}
            </div>
          </article>

          <article className="panel wide-panel">
            <div className="section-heading">
              <h2>Top Pattern Callouts</h2>
              <p>Core problem-behavior-outcome combinations ranked from the triple engine.</p>
            </div>
            <div className="pattern-grid enhanced">
              {dashboard.overview.top_patterns.slice(0, 6).map((pattern) => (
                <button
                  key={`${pattern.issue}-${pattern.behavior}-${pattern.outcome}`}
                  type="button"
                  className="pattern-card"
                  onClick={() => {
                    const targetIssue = dashboard.issues.find((issue) => issue.issue === pattern.issue);
                    setSelectedIssueSlug(targetIssue?.slug ?? null);
                    setSelectedCallId(pattern.call_ids[0] ?? null);
                    setActiveView('explorer');
                  }}
                >
                  <span className="pattern-kicker">{pattern.count} evidence calls</span>
                  <h3>{pattern.issue}</h3>
                  <p>{pattern.behavior}</p>
                  <div className="pattern-footer">
                    <span className={`chip outcome-${pattern.outcome.replaceAll(' ', '-')}`}>{pattern.outcome}</span>
                    <span>Lift {pattern.lift}</span>
                  </div>
                </button>
              ))}
            </div>
          </article>
        </section>
      )}

      {activeView === 'pulse' && (
        <section className="view-grid single-column">
          <article className="panel">
            <div className="section-heading">
              <h2>Daily Insights Pulse</h2>
              <p>News-feed style insight cards with evidence counts and direct actions.</p>
            </div>
            <div className="pulse-feed">
              {pulseCards.map((card) => {
                const isExpanded = expandedPulseId === card.id;
                return (
                  <div key={card.id} className={`pulse-card ${isExpanded ? 'expanded' : ''}`}>
                    <div className="pulse-card-top">
                      <div>
                        <span className="pulse-label">{card.trend}</span>
                        <h3>{card.issue}</h3>
                      </div>
                      <span className={`chip outcome-${card.outcome.replaceAll(' ', '-')}`}>{card.outcome}</span>
                    </div>
                    <p>{card.impactSummary}</p>
                    <div className="pulse-meta">
                      <span>{card.evidenceCount} evidence calls</span>
                      <span>{card.behavior}</span>
                    </div>
                    {isExpanded && (
                      <div className="pulse-expand">
                        <p>Evidence: {card.callIds.join(', ')}</p>
                      </div>
                    )}
                    <div className="action-row">
                      <button
                        type="button"
                        className="inline-action"
                        onClick={() => setExpandedPulseId(isExpanded ? null : card.id)}
                      >
                        {isExpanded ? 'Collapse' : 'View evidence'}
                      </button>
                      <button
                        type="button"
                        className="inline-action"
                        onClick={() => {
                          setSelectedCallId(card.callIds[0] ?? null);
                          setActiveView('drilldown');
                        }}
                      >
                        Open transcript
                      </button>
                      <button type="button" className="inline-action" onClick={() => setActiveView('strategy')}>
                        Create strategy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>
      )}

      {activeView === 'explorer' && (
        <section className="view-grid explorer-layout">
          <aside className="panel sticky-panel">
            <div className="section-heading">
              <h2>Issue List</h2>
              <p>Sticky filters keep exploration stable while reviewing evidence.</p>
            </div>
            <div className="filter-stack">
              <input
                className="filter-input"
                placeholder="Filter issues"
                value={issueFilter}
                onChange={(event) => setIssueFilter(event.target.value)}
              />
              <select
                className="filter-input"
                value={selectedOutcomeFilter}
                onChange={(event) => setSelectedOutcomeFilter(event.target.value)}
              >
                <option value="all">All outcomes</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
                <option value="follow-up needed">Follow-up needed</option>
                <option value="callback requested">Callback requested</option>
                <option value="unresolved">Unresolved</option>
              </select>
            </div>
            <div className="issue-list">
              {filteredIssues.map((issue) => (
                <button
                  key={issue.slug}
                  className={`issue-item ${selectedIssueSlug === issue.slug ? 'active' : ''}`}
                  onClick={() => setSelectedIssueSlug(issue.slug)}
                  type="button"
                >
                  <span>{issue.issue}</span>
                  <strong>{issue.count}</strong>
                </button>
              ))}
            </div>
          </aside>

          <section className="panel">
            <div className="section-heading">
              <h2>{selectedIssue?.issue ?? selectedIssueFromList?.issue ?? 'Issue Summary'}</h2>
              <p>{selectedIssue?.summary ?? selectedIssueFromList?.summary ?? 'Select an issue cluster.'}</p>
            </div>
            <div className="detail-grid">
              <article className="detail-card">
                <h3>Top Behaviors</h3>
                {selectedIssue?.top_behaviors.map((behavior) => (
                  <div key={behavior.label} className="row-line">
                    <span>{behavior.label}</span>
                    <strong>{behavior.count}</strong>
                  </div>
                ))}
              </article>

              <article className="detail-card">
                <h3>Outcome Mix</h3>
                {selectedIssue && Object.entries(selectedIssue.outcome_breakdown).map(([label, count]) => (
                  <div key={label} className="row-line">
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </article>
            </div>

            <article className="detail-card trend-card">
              <h3>Issue Trend</h3>
              <p>
                {selectedIssueFromList?.issue ?? 'Issue'} represents {selectedIssueFromList?.count ?? 0} calls in
                the current corpus and is linked to {selectedIssueFromList?.top_behaviors[0]?.label ?? 'no leading behavior'}
                {' '}most often.
              </p>
            </article>
          </section>

          <aside className="panel">
            <div className="section-heading">
              <h2>Evidence</h2>
              <p>Representative calls and drill-in cards for immediate transcript review.</p>
            </div>
            <div className="evidence-list">
              {selectedIssue?.evidence_calls.map((call) => (
                <button
                  key={call.call_id}
                  className={`evidence-item ${selectedCallId === call.call_id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCallId(call.call_id);
                    setActiveView('drilldown');
                  }}
                  type="button"
                >
                  <div className="evidence-head">
                    <span>{call.call_id}</span>
                    <span className={`chip outcome-${call.outcome.replaceAll(' ', '-')}`}>{call.outcome}</span>
                  </div>
                  <p>{call.summary}</p>
                </button>
              ))}
            </div>
          </aside>
        </section>
      )}

      {activeView === 'drilldown' && selectedCall && (
        <section className="view-grid drilldown-layout">
          <section className="panel transcript-panel">
            <div className="section-heading">
              <h2>Transcript</h2>
              <p>{selectedCall.call_id} from {selectedCall.source_file}</p>
            </div>
            <div className="turn-list">
              {selectedCall.turns.map((turn, index) => {
                const highlighted = selectedCall.issue.toLowerCase().includes('payment') && turn.text.toLowerCase().includes('payment');
                return (
                  <div key={`${turn.speaker}-${index}`} className={`turn ${turn.speaker.toLowerCase()} ${highlighted ? 'highlight' : ''}`}>
                    <span>{turn.speaker}</span>
                    <p>{turn.text}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="panel structured-panel">
            <div className="section-heading">
              <h2>Structured Extraction</h2>
              <p>{selectedCall.summary}</p>
            </div>

            <article className="detail-card">
              <h3>Timeline View</h3>
              <div className="timeline">
                <div className="timeline-stop">
                  <strong>Opening</strong>
                  <span>{selectedCall.sentiments.opening}</span>
                </div>
                <div className="timeline-stop">
                  <strong>Mid Call</strong>
                  <span>{selectedCall.sentiments.mid}</span>
                </div>
                <div className="timeline-stop">
                  <strong>Closing</strong>
                  <span>{selectedCall.sentiments.closing}</span>
                </div>
                <div className="timeline-stop accent">
                  <strong>Shift</strong>
                  <span>{selectedCall.sentiments.shift}</span>
                </div>
              </div>
            </article>

            <article className="detail-card">
              <h3>Behavior Signals</h3>
              <div className="chip-wrap">
                {selectedCall.behaviors.map((behavior) => (
                  <span key={behavior} className="chip neutral-chip">
                    {behavior}
                  </span>
                ))}
              </div>
            </article>

            <article className="detail-card">
              <h3>Issue Segments</h3>
              {selectedCall.segments.map((segment) => (
                <div key={segment.segment_id} className="segment-item">
                  <div className="segment-head">
                    <strong>Segment {segment.order}</strong>
                    <span>{segment.issue}</span>
                  </div>
                  <p>{segment.turn_count} turns</p>
                </div>
              ))}
            </article>
          </aside>
        </section>
      )}

      {activeView === 'strategy' && (
        <section className="view-grid single-column">
          <article className="panel">
            <div className="section-heading">
              <h2>Strategy Management</h2>
              <p>Kanban-style lifecycle using issue evidence as the starting point for interventions.</p>
            </div>
            <div className="kanban-grid">
              {(['Proposed', 'Accepted', 'In Progress', 'Evaluating', 'Closed'] as StrategyStage[]).map((stage) => (
                <div key={stage} className="kanban-column">
                  <div className="kanban-header">
                    <h3>{stage}</h3>
                    <span>{strategyCards.filter((card) => card.stage === stage).length}</span>
                  </div>
                  <div className="kanban-stack">
                    {strategyCards
                      .filter((card) => card.stage === stage)
                      .map((card) => (
                        <article key={card.id} className="kanban-card">
                          <h4>{card.title}</h4>
                          <p>{card.impact}</p>
                          <div className="tag-row">
                            <span className="tag neutral">Owner: {card.owner}</span>
                            {card.evidence.map((evidenceId) => (
                              <button
                                key={evidenceId}
                                type="button"
                                className="tag link-tag"
                                onClick={() => {
                                  setSelectedCallId(evidenceId);
                                  setActiveView('drilldown');
                                }}
                              >
                                {evidenceId}
                              </button>
                            ))}
                          </div>
                        </article>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      {activeView === 'ask' && (
        <section className="view-grid ask-layout">
          <section className="panel">
            <div className="section-heading">
              <h2>Ask CI</h2>
              <p>Chat-like answer cards that summarize findings and cite evidence packs and call IDs.</p>
            </div>
            <div className="chat-stack">
              <div className="chat-question">What should leadership look at first?</div>
              {askCards.map((card) => (
                <article key={card.id} className="chat-card">
                  <h3>{card.title}</h3>
                  <p>{card.summary}</p>
                  <div className="tag-row">
                    {card.evidence.map((callId) => (
                      <button
                        key={callId}
                        type="button"
                        className="tag link-tag"
                        onClick={() => {
                          setSelectedCallId(callId);
                          setActiveView('drilldown');
                        }}
                      >
                        {callId}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="panel">
            <div className="section-heading">
              <h2>Suggested Prompts</h2>
              <p>Fast launch points for deeper review without leaving the workspace.</p>
            </div>
            <div className="stack-list">
              <button type="button" className="feed-card" onClick={() => setActiveView('pulse')}>
                <strong>Show me the latest escalation themes</strong>
                <p>Switch to the pulse feed and inspect the strongest escalation clusters.</p>
              </button>
              <button type="button" className="feed-card" onClick={() => setActiveView('explorer')}>
                <strong>Compare top issue clusters</strong>
                <p>Open the explorer and review behavior and outcome differences side by side.</p>
              </button>
              <button type="button" className="feed-card" onClick={() => setActiveView('strategy')}>
                <strong>Turn evidence into action</strong>
                <p>Move from issue evidence into strategy tracking and linked transcript review.</p>
              </button>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}

export default App;
