import { useEffect, useState } from 'react';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

type DashboardMetric = {
  label: string;
  value: number | string;
  tone: string;
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
    top_patterns: Array<{
      issue: string;
      behavior: string;
      outcome: string;
      count: number;
      lift: number;
      call_ids: string[];
      evidence: string;
    }>;
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

function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [selectedIssueSlug, setSelectedIssueSlug] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueDetail | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallDetail | null>(null);
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

        const firstIssue = payload.issues[0];
        const firstCall = payload.calls[0];

        setSelectedIssueSlug((current) => current ?? firstIssue?.slug ?? null);
        setSelectedCallId((current) => current ?? firstCall?.call_id ?? null);
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
      <header className="hero">
        <div>
          <p className="eyebrow">CallInsights</p>
          <h1>Rank 1 Mortgage Servicing Intelligence</h1>
          <p className="hero-copy">
            Evidence-first issue detection, behavior signals, sentiment shifts, and transcript drilldown
            from the synthetic servicing corpus.
          </p>
        </div>
        <div className="hero-brief">
          <h2>Daily Insights Pulse</h2>
          {dashboard.overview.daily_brief.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </header>

      <section className="metric-strip">
        {dashboard.overview.metrics.map((metric) => (
          <article key={metric.label} className={`metric-card tone-${metric.tone}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="top-patterns">
        <div className="section-heading">
          <h2>Executive Overview</h2>
          <p>Top problem-behavior-outcome patterns ranked from the current transcript set.</p>
        </div>
        <div className="pattern-grid">
          {dashboard.overview.top_patterns.slice(0, 6).map((pattern) => (
            <article key={`${pattern.issue}-${pattern.behavior}-${pattern.outcome}`} className="pattern-card">
              <span className="pattern-kicker">{pattern.count} calls</span>
              <h3>{pattern.issue}</h3>
              <p>{pattern.behavior}</p>
              <div className="pattern-footer">
                <span className={`chip outcome-${pattern.outcome.replaceAll(' ', '-')}`}>{pattern.outcome}</span>
                <span>Lift {pattern.lift}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <main className="workspace">
        <section className="panel explorer-panel">
          <div className="section-heading">
            <h2>Issue Explorer</h2>
            <p>Choose an issue cluster to inspect behavior and outcome patterns.</p>
          </div>
          <div className="issue-list">
            {dashboard.issues.map((issue) => (
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
        </section>

        <section className="panel detail-panel">
          <div className="section-heading">
            <h2>{selectedIssue?.issue ?? 'Issue Detail'}</h2>
            <p>{selectedIssue?.summary ?? 'Select an issue to inspect evidence.'}</p>
          </div>

          {selectedIssue && (
            <>
              <div className="detail-grid">
                <article className="detail-card">
                  <h3>Top Behaviors</h3>
                  {selectedIssue.top_behaviors.map((behavior) => (
                    <div key={behavior.label} className="row-line">
                      <span>{behavior.label}</span>
                      <strong>{behavior.count}</strong>
                    </div>
                  ))}
                </article>

                <article className="detail-card">
                  <h3>Outcome Mix</h3>
                  {Object.entries(selectedIssue.outcome_breakdown).map(([label, count]) => (
                    <div key={label} className="row-line">
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </article>
              </div>

              <article className="detail-card evidence-card">
                <h3>Representative Calls</h3>
                <div className="evidence-list">
                  {selectedIssue.evidence_calls.map((call) => (
                    <button
                      key={call.call_id}
                      className={`evidence-item ${selectedCallId === call.call_id ? 'active' : ''}`}
                      onClick={() => setSelectedCallId(call.call_id)}
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
              </article>
            </>
          )}
        </section>

        <aside className="panel drilldown-panel">
          <div className="section-heading">
            <h2>Transcript Drilldown</h2>
            <p>Structured extraction and the underlying dialogue for the selected call.</p>
          </div>

          {selectedCall && (
            <>
              <article className="detail-card drilldown-summary">
                <div className="drilldown-meta">
                  <span>{selectedCall.call_id}</span>
                  <span>{selectedCall.issue}</span>
                  <span className={`chip outcome-${selectedCall.outcome.replaceAll(' ', '-')}`}>{selectedCall.outcome}</span>
                </div>
                <p>{selectedCall.summary}</p>
                <div className="sentiment-strip">
                  <span>Open {selectedCall.sentiments.opening}</span>
                  <span>Mid {selectedCall.sentiments.mid}</span>
                  <span>Close {selectedCall.sentiments.closing}</span>
                  <span>Shift {selectedCall.sentiments.shift}</span>
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

              <article className="detail-card transcript-card">
                <h3>Transcript</h3>
                <div className="turn-list">
                  {selectedCall.turns.map((turn, index) => (
                    <div key={`${turn.speaker}-${index}`} className={`turn ${turn.speaker.toLowerCase()}`}>
                      <span>{turn.speaker}</span>
                      <p>{turn.text}</p>
                    </div>
                  ))}
                </div>
              </article>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;
