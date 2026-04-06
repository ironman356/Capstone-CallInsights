import { useEffect, useMemo, useState } from 'react';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';
const THEME_KEY = 'ci-theme-preference';

type Metric = { label: string; value: number | string; tone: string };
type Pattern = { issue: string; behavior: string; outcome: string; count: number; lift: number; call_ids: string[]; evidence: string };
type Call = {
  call_id: string;
  source_file: string;
  issue: string;
  outcome: string;
  behaviors: string[];
  summary: string;
  sentiments: { opening: number; mid: number; closing: number; shift: number };
};
type Issue = {
  issue: string;
  slug: string;
  count: number;
  summary: string;
  outcome_breakdown: Record<string, number>;
  top_behaviors: Array<{ label: string; count: number }>;
  representative_calls: Array<{ call_id: string; outcome: string; summary: string }>;
};
type Dashboard = {
  overview: {
    metrics: Metric[];
    issue_counts: Record<string, number>;
    outcome_counts: Record<string, number>;
    sentiment_summary: Record<string, number>;
    top_patterns: Pattern[];
    daily_brief: string[];
  };
  issues: Issue[];
  calls: Call[];
};
type CallDetail = Call & {
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
type Page =
  | 'overview'
  | 'pulse'
  | 'recalibration'
  | 'explorer'
  | 'drilldown'
  | 'strategy'
  | 'effectiveness'
  | 'reports'
  | 'compliance'
  | 'journey'
  | 'ask'
  | 'admin';
type Theme = 'light' | 'dark' | 'system';

const NAV: Array<{ section: string; items: Array<{ key: Page; label: string; subtitle: string }> }> = [
  {
    section: 'Operations',
    items: [
      { key: 'overview', label: 'Executive Overview', subtitle: 'Leadership snapshot and alerts' },
      { key: 'pulse', label: 'Daily Insights Pulse', subtitle: 'Feed of current signals' },
      { key: 'recalibration', label: 'Monthly Recalibration', subtitle: 'Strategy review workspace' },
      { key: 'explorer', label: 'Issue Explorer', subtitle: 'Investigate issues and evidence' },
      { key: 'drilldown', label: 'Call Drilldown', subtitle: 'Transcript analysis workspace' },
    ],
  },
  {
    section: 'Execution',
    items: [
      { key: 'strategy', label: 'Strategy Management', subtitle: 'Workflow board' },
      { key: 'effectiveness', label: 'Strategy Effectiveness', subtitle: 'Before and after impact' },
      { key: 'reports', label: 'Reports & Export', subtitle: 'Reporting workspace' },
    ],
  },
  {
    section: 'Controls',
    items: [
      { key: 'compliance', label: 'Compliance Dashboard', subtitle: 'Audit-oriented monitoring' },
      { key: 'journey', label: 'Customer Journey Explorer', subtitle: 'Timeline investigation' },
      { key: 'ask', label: 'Ask CI', subtitle: 'Evidence-backed assistant' },
      { key: 'admin', label: 'Admin & AI Governance', subtitle: 'Health and governance' },
    ],
  },
];

const PAGE_META = Object.fromEntries(
  NAV.flatMap((group) => group.items.map((item) => [item.key, { title: item.label, subtitle: item.subtitle }]))
) as Record<Page, { title: string; subtitle: string }>;

const readPage = (): Page => {
  const raw = window.location.hash.replace('#/', '');
  return raw && raw in PAGE_META ? (raw as Page) : 'overview';
};

const formatValue = (value: number | string) =>
  typeof value === 'number' && Number.isFinite(value) ? (Number.isInteger(value) ? String(value) : value.toFixed(2)) : value;

const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const slug = (value: string) => value.toLowerCase().replaceAll(' ', '-');

function EmptyState({ title, copy, action, onClick }: { title: string; copy: string; action?: string; onClick?: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">+</div>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action && onClick ? (
        <button type="button" className="primary-button" onClick={onClick}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

function App() {
  const [page, setPage] = useState<Page>(() => readPage());
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [issueSlug, setIssueSlug] = useState<string | null>(null);
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [call, setCall] = useState<CallDetail | null>(null);
  const [search, setSearch] = useState('');
  const [issueFilter, setIssueFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [range, setRange] = useState('Last 30 days');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'evidence' | 'call' | 'strategy'>('evidence');
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setPage(readPage());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    if (window.location.hash !== `#/${page}`) {
      window.history.replaceState(null, '', `#/${page}`);
    }
  }, [page]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      window.localStorage.setItem(THEME_KEY, theme);
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/rank1/dashboard`);
        if (!response.ok) throw new Error(`Dashboard request failed with ${response.status}`);
        const payload: Dashboard = await response.json();
        setDashboard(payload);
        setIssueSlug((current) => current ?? payload.issues[0]?.slug ?? null);
        setCallId((current) => current ?? payload.calls[0]?.call_id ?? null);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    if (!issueSlug) return;
    void fetch(`${API_BASE_URL}/api/rank1/issues/${issueSlug}`).then(async (response) => {
      if (response.ok) setIssue((await response.json()) as IssueDetail);
    });
  }, [issueSlug]);

  useEffect(() => {
    if (!callId) return;
    void fetch(`${API_BASE_URL}/api/rank1/calls/${callId}`).then(async (response) => {
      if (response.ok) setCall((await response.json()) as CallDetail);
    });
  }, [callId]);

  const filteredIssues = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.issues.filter((item) => {
      const matchesText = !issueFilter || item.issue.toLowerCase().includes(issueFilter.toLowerCase()) || item.summary.toLowerCase().includes(issueFilter.toLowerCase());
      const matchesOutcome = outcomeFilter === 'all' || item.outcome_breakdown[outcomeFilter] !== undefined;
      return matchesText && matchesOutcome;
    });
  }, [dashboard, issueFilter, outcomeFilter]);

  const metrics = useMemo(() => {
    if (!dashboard) return [];
    const total = dashboard.calls.length;
    const resolved = dashboard.calls.filter((item) => item.outcome === 'resolved').length;
    const escalated = dashboard.calls.filter((item) => item.outcome === 'escalated').length;
    const shift = dashboard.overview.sentiment_summary.average_shift ?? 0;
    return [
      { label: 'Call Volume', value: total, tone: 'neutral' },
      { label: 'Resolved Rate', value: `${Math.round((resolved / Math.max(total, 1)) * 100)}%`, tone: 'stable' },
      { label: 'Escalations', value: escalated, tone: 'risk' },
      { label: 'Repeat-Call Risk', value: `${dashboard.overview.top_patterns.filter((item) => item.outcome !== 'resolved').length} clusters`, tone: 'warning' },
      { label: 'Sentiment Trend', value: shift.toFixed(2), tone: shift >= 0 ? 'stable' : 'warning' },
    ];
  }, [dashboard]);

  const pulse = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.overview.top_patterns.slice(0, 8).map((item, index) => ({
      id: `${item.issue}-${item.behavior}-${index}`,
      title: item.issue,
      direction: item.outcome === 'escalated' ? 'Rising escalation pressure' : item.outcome === 'resolved' ? 'Stabilizing' : 'Needs review',
      summary: item.evidence,
      evidenceCount: item.count,
      confidence: item.lift >= 2 ? 'High confidence' : 'Moderate confidence',
      outcome: item.outcome,
      callIds: item.call_ids,
    }));
  }, [dashboard]);

  const strategies = useMemo(() => {
    if (!dashboard) return [];
    const stages = ['Proposed', 'Accepted', 'In Progress', 'Evaluating', 'Closed'] as const;
    const owners = ['Ops', 'Servicing', 'QA', 'Training', 'Leadership'];
    return dashboard.issues.slice(0, 5).map((item, index) => ({
      id: item.slug,
      title: `Reduce ${item.issue}`,
      issue: item.issue,
      stage: stages[index % stages.length],
      owner: owners[index % owners.length],
      impact: `${item.count} calls in current sample`,
      calls: item.representative_calls.map((entry) => entry.call_id),
    }));
  }, [dashboard]);

  const openCall = (nextCallId?: string | null) => {
    if (!nextCallId) return;
    setCallId(nextCallId);
    setDrawerMode('call');
    setDrawerOpen(true);
  };

  if (loading) {
    return (
      <div className="status-screen">
        <div className="status-card">
          <p className="eyebrow">CallInsights UI</p>
          <h1>Loading product shell</h1>
          <p>Preparing the Rank 1 workspace and evidence-backed pages.</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="status-screen">
        <div className="status-card">
          <p className="eyebrow">CallInsights UI</p>
          <h1>Unable to load Rank 1 data</h1>
          <p>{error ?? 'No dashboard payload returned.'}</p>
          <p>Start the API from `apps/api` and ensure `/api/rank1/dashboard` is available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">CI</div>
          <div>
            <strong>CallInsights</strong>
            <p>Evidence-first servicing intelligence</p>
          </div>
        </div>

        <input className="shell-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pages or prompts" />

        <nav className="sidebar-nav" aria-label="Primary">
          {NAV.map((group) => (
            <div key={group.section} className="nav-group">
              <p className="nav-title">{group.section}</p>
              {group.items
                .filter((item) => !search || item.label.toLowerCase().includes(search.toLowerCase()) || item.subtitle.toLowerCase().includes(search.toLowerCase()))
                .map((item) => (
                  <button key={item.key} type="button" className={`nav-item ${page === item.key ? 'active' : ''}`} onClick={() => setPage(item.key)}>
                    <span>{item.label}</span>
                    <small>{item.subtitle}</small>
                  </button>
                ))}
            </div>
          ))}
        </nav>

        <div className="mini-card">
          <span>Active escalations</span>
          <strong>{dashboard.overview.outcome_counts.escalated ?? 0}</strong>
          <p>Current escalated patterns visible to leadership.</p>
        </div>
      </aside>

      <main className="content-shell">
        <header className="topbar">
          <div>
            <div className="breadcrumb">CallInsights / {PAGE_META[page].title}</div>
            <h1>{PAGE_META[page].title}</h1>
            <p>{PAGE_META[page].subtitle}</p>
          </div>
          <div className="topbar-actions">
            <select className="shell-input compact-input" value={range} onChange={(event) => setRange(event.target.value)}>
              <option>Last 24 hours</option>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Quarter to date</option>
            </select>
            <div className="theme-toggle">
              {(['light', 'dark', 'system'] as Theme[]).map((mode) => (
                <button key={mode} type="button" className={`theme-chip ${theme === mode ? 'active' : ''}`} onClick={() => setTheme(mode)}>
                  {label(mode)}
                </button>
              ))}
            </div>
            <button type="button" className="icon-button" onClick={() => setPage('ask')}>
              Ask CI
            </button>
            <div className="profile-pill">PM</div>
          </div>
        </header>

        {(page === 'explorer' || page === 'reports' || page === 'compliance') && (
          <div className="filter-bar">
            <input className="shell-input" value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)} placeholder="Filter issues or reports" />
            <select className="shell-input compact-input" value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)}>
              <option value="all">All outcomes</option>
              <option value="resolved">Resolved</option>
              <option value="escalated">Escalated</option>
              <option value="follow-up needed">Follow-up needed</option>
              <option value="callback requested">Callback requested</option>
              <option value="unresolved">Unresolved</option>
            </select>
            <button type="button" className="secondary-button" onClick={() => setDrawerOpen((current) => !current)}>
              {drawerOpen ? 'Hide drawer' : 'Open evidence drawer'}
            </button>
          </div>
        )}

        <section className="page-body">
          {page === 'overview' && (
            <>
              <section className="hero-panel">
                <div className="hero-copy">
                  <p className="eyebrow">Leadership Landing Page</p>
                  <h2>Professional internal product for issue intelligence, evidence review, and strategy action.</h2>
                  <p>Move from summary to representative calls without falling back to a chart wall or spreadsheet layout.</p>
                  <div className="hero-actions">
                    <button type="button" className="primary-button" onClick={() => setPage('explorer')}>
                      Open Issue Explorer
                    </button>
                    <button type="button" className="secondary-button" onClick={() => setPage('reports')}>
                      Open Reports
                    </button>
                  </div>
                </div>
                <div className="hero-side">
                  <div className="alert-card">
                    <span className="eyebrow">What changed since yesterday</span>
                    {dashboard.overview.daily_brief.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>
              </section>

              <section className="kpi-grid">
                {metrics.map((item) => (
                  <button key={item.label} type="button" className={`kpi-card tone-${item.tone}`} onClick={() => setDrawerOpen(true)}>
                    <span>{item.label}</span>
                    <strong>{formatValue(item.value)}</strong>
                    <small>Open detailed breakdown</small>
                  </button>
                ))}
              </section>

              <section className="page-grid two-up">
                <article className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Trending issue cards</h3>
                      <p>Click into the issue explorer with evidence already selected.</p>
                    </div>
                  </div>
                  <div className="card-grid">
                    {dashboard.issues.slice(0, 4).map((item) => (
                      <button
                        key={item.slug}
                        type="button"
                        className="insight-card"
                        onClick={() => {
                          setIssueSlug(item.slug);
                          setCallId(item.representative_calls[0]?.call_id ?? null);
                          setPage('explorer');
                        }}
                      >
                        <div className="card-topline">
                          <span className="status-badge neutral">{item.count} calls</span>
                          <span className="muted">{item.top_behaviors[0]?.label ?? 'No signal yet'}</span>
                        </div>
                        <h4>{label(item.issue)}</h4>
                        <p>{item.summary}</p>
                      </button>
                    ))}
                  </div>
                </article>

                <article className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Evidence preview</h3>
                      <p>Representative calls that link directly into transcript drilldown.</p>
                    </div>
                  </div>
                  <div className="stack-list">
                    {dashboard.calls.slice(0, 5).map((item) => (
                      <button
                        key={item.call_id}
                        type="button"
                        className="list-card"
                        onClick={() => {
                          setCallId(item.call_id);
                          setPage('drilldown');
                        }}
                      >
                        <div className="card-topline">
                          <strong>{item.call_id}</strong>
                          <span className={`status-badge outcome-${slug(item.outcome)}`}>{item.outcome}</span>
                        </div>
                        <p>{item.summary}</p>
                      </button>
                    ))}
                  </div>
                </article>
              </section>
            </>
          )}

          {page === 'pulse' && (
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Daily Insights Pulse</h3>
                  <p>Feed-style insight cards ordered for quick scanning and direct action.</p>
                </div>
                <button type="button" className="secondary-button">
                  Export daily summary
                </button>
              </div>
              {!pulse.length ? (
                <EmptyState title="No significant anomalies" copy="No high-signal insight cards are available in the current range." />
              ) : (
                <div className="feed-list">
                  {pulse.map((item) => {
                    const isReviewed = reviewed.includes(item.id);
                    return (
                      <article key={item.id} className={`feed-card ${isReviewed ? 'reviewed' : ''}`}>
                        <div className="feed-header">
                          <div>
                            <span className="eyebrow">{item.direction}</span>
                            <h4>{label(item.title)}</h4>
                          </div>
                          <span className={`status-badge outcome-${slug(item.outcome)}`}>{item.outcome}</span>
                        </div>
                        <p>{item.summary}</p>
                        <div className="feed-meta">
                          <span>{item.evidenceCount} evidence calls</span>
                          <span>{item.confidence}</span>
                        </div>
                        <div className="action-row">
                          <button type="button" className="secondary-button" onClick={() => openCall(item.callIds[0])}>
                            View evidence
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              setCallId(item.callIds[0] ?? null);
                              setPage('drilldown');
                            }}
                          >
                            Open transcript
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setReviewed((current) => (isReviewed ? current.filter((value) => value !== item.id) : [...current, item.id]))}
                          >
                            {isReviewed ? 'Reviewed' : 'Mark reviewed'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </article>
          )}

          {page === 'recalibration' && (
            <section className="page-grid two-up">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Recurring issue ranking</h3>
                    <p>Month-over-month view framed as a review queue.</p>
                  </div>
                </div>
                <div className="stack-list">
                  {dashboard.issues.slice(0, 6).map((item, index) => (
                    <div key={item.slug} className="queue-card">
                      <div>
                        <span className="eyebrow">Rank {index + 1}</span>
                        <h4>{label(item.issue)}</h4>
                      </div>
                      <div className="queue-metrics">
                        <strong>{item.count}</strong>
                        <span>{['Up 18%', 'Up 9%', 'Flat', 'Down 6%', 'Down 12%'][index % 5]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Strategy recommendations</h3>
                    <p>Approve or reject evidence-derived recommendations.</p>
                  </div>
                </div>
                <div className="stack-list">
                  {strategies.slice(0, 3).map((item) => (
                    <div key={item.id} className="review-card">
                      <h4>{item.title}</h4>
                      <p>{item.impact}</p>
                      <div className="action-row">
                        <button type="button" className="primary-button" onClick={() => setPage('strategy')}>
                          Accept
                        </button>
                        <button type="button" className="secondary-button">
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          )}

          {page === 'explorer' && (
            <section className="page-grid explorer-grid">
              <aside className="panel sticky-panel">
                <div className="panel-header">
                  <div>
                    <h3>Issue list</h3>
                    <p>Sticky filters and searchable investigation entry points.</p>
                  </div>
                </div>
                <div className="stack-list">
                  {filteredIssues.map((item) => (
                    <button key={item.slug} type="button" className={`issue-row ${issueSlug === item.slug ? 'active' : ''}`} onClick={() => setIssueSlug(item.slug)}>
                      <div>
                        <strong>{label(item.issue)}</strong>
                        <small>{item.summary}</small>
                      </div>
                      <span>{item.count}</span>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h3>{issue ? label(issue.issue) : 'Issue Summary'}</h3>
                    <p>{issue?.summary ?? 'Select an issue cluster to begin investigation.'}</p>
                  </div>
                </div>
                {issue ? (
                  <>
                    <div className="detail-grid">
                      <div className="detail-card">
                        <span className="eyebrow">Issue frequency</span>
                        <strong>{issue.count} calls</strong>
                        <p>Evidence-backed sample size for the selected issue.</p>
                      </div>
                      <div className="detail-card">
                        <span className="eyebrow">Top behavior</span>
                        <strong>{issue.top_behaviors[0]?.label ?? 'No signal yet'}</strong>
                        <p>Leading behavior associated with current outcomes.</p>
                      </div>
                    </div>
                    <div className="panel-split">
                      <div className="subpanel">
                        <h4>Common customer phrasing</h4>
                        <div className="tag-row">
                          {[`why is ${issue.issue}`, `help with ${issue.issue}`, 'I already called last week'].map((phrase) => (
                            <button key={phrase} type="button" className="tag clickable" onClick={() => openCall(issue.evidence_calls[0]?.call_id)}>
                              {phrase}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="subpanel">
                        <h4>Outcome summary</h4>
                        {Object.entries(issue.outcome_breakdown).map(([name, count]) => (
                          <div key={name} className="line-card static">
                            <span>{name}</span>
                            <strong>{count}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState title="Choose an issue" copy="Select an issue cluster from the left panel to inspect phrases, outcomes, and evidence." />
                )}
              </section>

              <aside className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Representative evidence</h3>
                    <p>Open related calls in the drawer or transcript workspace.</p>
                  </div>
                </div>
                {issue?.evidence_calls.length ? (
                  <div className="stack-list">
                    {issue.evidence_calls.map((entry) => (
                      <button key={entry.call_id} type="button" className="list-card" onClick={() => openCall(entry.call_id)}>
                        <div className="card-topline">
                          <strong>{entry.call_id}</strong>
                          <span className={`status-badge outcome-${slug(entry.outcome)}`}>{entry.outcome}</span>
                        </div>
                        <p>{entry.summary}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No evidence loaded" copy="Issue evidence appears here after an issue is selected." />
                )}
              </aside>
            </section>
          )}

          {page === 'drilldown' && (
            <section className="page-grid drilldown-grid">
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Transcript panel</h3>
                    <p>{call ? `${call.call_id} from ${call.source_file}` : 'Transcript analysis workspace'}</p>
                  </div>
                  <button type="button" className="secondary-button">
                    Download transcript summary
                  </button>
                </div>
                {call ? (
                  <div className="transcript-list">
                    {call.turns.map((turn, index) => (
                      <div
                        key={`${turn.speaker}-${index}`}
                        className={`turn-card ${turn.speaker.toLowerCase()} ${turn.text.toLowerCase().includes('payment') || turn.text.toLowerCase().includes('escalate') ? 'highlight' : ''}`}
                      >
                        <span>{turn.speaker}</span>
                        <p>{turn.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Missing transcript" copy="Choose a representative call from overview, explorer, or pulse to inspect transcript details." action="Open Issue Explorer" onClick={() => setPage('explorer')} />
                )}
              </section>
              <aside className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Analysis workspace</h3>
                    <p>Issue tags, segment timeline, sentiment path, and behavior markers.</p>
                  </div>
                </div>
                {call ? (
                  <div className="stack-list">
                    <div className="detail-card">
                      <span className="eyebrow">Outcome summary</span>
                      <strong>{label(call.outcome)}</strong>
                      <p>{call.summary}</p>
                    </div>
                    <div className="detail-card">
                      <h4>Sentiment over time</h4>
                      <div className="timeline-grid">
                        {[
                          ['Opening', call.sentiments.opening],
                          ['Mid', call.sentiments.mid],
                          ['Closing', call.sentiments.closing],
                          ['Shift', call.sentiments.shift],
                        ].map(([name, value], index) => (
                          <div key={name} className={`timeline-pill ${index === 3 ? 'accent' : ''}`}>
                            <span>{name}</span>
                            <strong>{value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="detail-card">
                      <h4>Behavior markers</h4>
                      <div className="tag-row">
                        {call.behaviors.map((item) => (
                          <span key={item} className="tag">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="detail-card">
                      <h4>Segment timeline</h4>
                      {call.segments.map((segment) => (
                        <div key={segment.segment_id} className="line-card static">
                          <span>
                            Segment {segment.order}: {segment.issue}
                          </span>
                          <strong>{segment.turn_count} turns</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState title="Insufficient data" copy="Transcript analysis details appear after a call is selected." />
                )}
              </aside>
            </section>
          )}

          {page === 'strategy' && (
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Strategy management</h3>
                  <p>Workflow board for evidence-backed interventions instead of a spreadsheet grid.</p>
                </div>
              </div>
              <div className="kanban-grid">
                {(['Proposed', 'Accepted', 'In Progress', 'Evaluating', 'Closed'] as const).map((stage) => (
                  <div key={stage} className="kanban-column">
                    <div className="kanban-header">
                      <h4>{stage}</h4>
                      <span>{strategies.filter((item) => item.stage === stage).length}</span>
                    </div>
                    <div className="stack-list">
                      {strategies
                        .filter((item) => item.stage === stage)
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="kanban-card"
                            onClick={() => {
                              setIssueSlug(item.id);
                              setDrawerMode('strategy');
                              setDrawerOpen(true);
                            }}
                          >
                            <h5>{item.title}</h5>
                            <p>{item.impact}</p>
                            <div className="tag-row">
                              <span className="tag">Owner: {item.owner}</span>
                              <span className="tag">{item.calls.length} evidence links</span>
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}

          {page === 'effectiveness' && (
            <section className="page-grid two-up">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Before / after comparison</h3>
                    <p>Clean KPI blocks with sample-size caveats built into the copy.</p>
                  </div>
                </div>
                <div className="detail-grid">
                  {[
                    ['AHT change', '-7%'],
                    ['FCR change', '+11%'],
                    ['Escalation rate', '-4 pts'],
                    ['Sentiment change', '+0.21'],
                  ].map(([name, value]) => (
                    <div key={name} className="detail-card">
                      <span className="eyebrow">{name}</span>
                      <strong>{value}</strong>
                      <p>Confidence is moderate because Rank 1 still uses synthetic sample data.</p>
                    </div>
                  ))}
                </div>
              </article>
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Supporting call samples</h3>
                    <p>Open call evidence directly from effectiveness review.</p>
                  </div>
                </div>
                <div className="stack-list">
                  {dashboard.calls.slice(0, 4).map((item) => (
                    <button key={item.call_id} type="button" className="list-card" onClick={() => openCall(item.call_id)}>
                      <div className="card-topline">
                        <strong>{item.call_id}</strong>
                        <span>{item.sentiments.shift >= 0 ? 'Stabilizing' : 'Under pressure'}</span>
                      </div>
                      <p>{item.summary}</p>
                    </button>
                  ))}
                </div>
              </article>
            </section>
          )}

          {page === 'reports' && (
            <section className="page-grid two-up">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Report builder</h3>
                    <p>Controlled reporting workspace with obvious export actions.</p>
                  </div>
                </div>
                <div className="stack-list">
                  <label className="field-block">
                    <span>Report type</span>
                    <select className="shell-input">
                      <option>Executive summary</option>
                      <option>Issue review</option>
                      <option>Compliance pack</option>
                    </select>
                  </label>
                  <label className="field-block">
                    <span>Queue or team</span>
                    <select className="shell-input">
                      <option>All queues</option>
                      <option>Servicing</option>
                      <option>Escrow Ops</option>
                    </select>
                  </label>
                  <div className="action-row">
                    <button type="button" className="primary-button">
                      Export PDF
                    </button>
                    <button type="button" className="secondary-button">
                      Export CSV
                    </button>
                    <button type="button" className="secondary-button" onClick={() => setDrawerOpen(true)}>
                      Generate evidence pack
                    </button>
                  </div>
                </div>
              </article>
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Report preview</h3>
                    <p>Preview updates alongside the current evidence-backed range.</p>
                  </div>
                </div>
                <div className="preview-card">
                  <p>Top issue cluster: {dashboard.issues[0]?.issue ?? 'No issue data'}.</p>
                  <p>Escalated calls in current range: {dashboard.overview.outcome_counts.escalated ?? 0}.</p>
                  <p>Average sentiment shift: {dashboard.overview.sentiment_summary.average_shift ?? 0}.</p>
                  <p>Evidence pack seed: {dashboard.calls.slice(0, 4).map((item) => item.call_id).join(', ')}.</p>
                </div>
              </article>
            </section>
          )}

          {page === 'compliance' && (
            <section className="page-grid two-up">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Compliance summary</h3>
                    <p>Serious operational framing with audit-style evidence access.</p>
                  </div>
                </div>
                <div className="detail-grid">
                  {[
                    ['Compliance rate', '94%'],
                    ['Missing disclosure rate', '4%'],
                    ['Flagged categories', `${dashboard.issues.slice(0, 4).length}`],
                    ['Audit readiness', 'Stable'],
                  ].map(([name, value]) => (
                    <div key={name} className="detail-card">
                      <span className="eyebrow">{name}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </article>
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Non-compliant categories</h3>
                    <p>Representative snippets with direct drilldown actions.</p>
                  </div>
                </div>
                <div className="stack-list">
                  {dashboard.issues.slice(0, 4).map((item) => (
                    <button key={item.slug} type="button" className="list-card" onClick={() => openCall(item.representative_calls[0]?.call_id)}>
                      <div className="card-topline">
                        <strong>{label(item.issue)}</strong>
                        <span>{92 - dashboard.issues.indexOf(item) * 6}%</span>
                      </div>
                      <p>{item.representative_calls[0]?.summary ?? 'Representative snippet unavailable.'}</p>
                    </button>
                  ))}
                </div>
              </article>
            </section>
          )}

          {page === 'journey' && (
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h3>Customer journey explorer</h3>
                  <p>Timeline-first investigation across linked calls and issue changes.</p>
                </div>
              </div>
              <div className="timeline-track">
                {dashboard.calls.slice(0, 5).map((item, index) => (
                  <button key={item.call_id} type="button" className="journey-event" onClick={() => openCall(item.call_id)}>
                    <div className="journey-marker" />
                    <div className="journey-content">
                      <span className="eyebrow">Touchpoint {index + 1}</span>
                      <h4>{label(item.issue)}</h4>
                      <p>{item.summary}</p>
                      <span className={`status-badge outcome-${slug(item.outcome)}`}>{item.outcome}</span>
                    </div>
                  </button>
                ))}
              </div>
            </article>
          )}

          {page === 'ask' && (
            <section className="page-grid ask-grid">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Ask CI</h3>
                    <p>Chat-like assistant responses that stay tied to evidence and action.</p>
                  </div>
                </div>
                <div className="chat-shell">
                  <div className="chat-question">What should leadership review first this week?</div>
                  {[
                    {
                      title: 'What is driving escalations?',
                      summary: dashboard.overview.top_patterns.find((item) => item.outcome === 'escalated')
                        ? `${dashboard.overview.top_patterns.find((item) => item.outcome === 'escalated')?.issue} is the strongest escalated pattern in the current range.`
                        : 'Escalation signals are still thin in the current range.',
                      ids: dashboard.overview.top_patterns.find((item) => item.outcome === 'escalated')?.call_ids ?? [],
                    },
                    {
                      title: 'Which issue deserves immediate review?',
                      summary: dashboard.issues[0] ? `${dashboard.issues[0].issue} is the largest active issue cluster and should be reviewed first.` : 'No issue clusters are available yet.',
                      ids: dashboard.issues[0]?.representative_calls.map((entry) => entry.call_id) ?? [],
                    },
                  ].map((item) => (
                    <div key={item.title} className="chat-answer">
                      <h4>{item.title}</h4>
                      <p>{item.summary}</p>
                      <div className="tag-row">
                        {item.ids.map((id) => (
                          <button key={id} type="button" className="tag clickable" onClick={() => openCall(id)}>
                            {id}
                          </button>
                        ))}
                      </div>
                      <div className="action-row">
                        <button type="button" className="secondary-button" onClick={() => openCall(item.ids[0])}>
                          Open supporting calls
                        </button>
                        <button type="button" className="secondary-button" onClick={() => setPage('strategy')}>
                          Create strategy from this
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
              <aside className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Suggested questions</h3>
                    <p>Fast prompts for evidence-backed exploration.</p>
                  </div>
                </div>
                <div className="stack-list">
                  {['Show me the latest escalation themes', 'Compare top issue clusters', 'Which behaviors correlate with resolved calls?'].map((prompt) => (
                    <button key={prompt} type="button" className="list-card">
                      <strong>{prompt}</strong>
                      <p>Launch a guided answer using the current evidence pack.</p>
                    </button>
                  ))}
                </div>
              </aside>
            </section>
          )}

          {page === 'admin' && (
            <section className="page-grid two-up">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Admin & AI governance</h3>
                    <p>Pipeline health, model status, and governance posture in one control plane.</p>
                  </div>
                </div>
                <div className="detail-grid">
                  {[
                    ['Model version', 'Rank1-ruleset-v1'],
                    ['Pipeline health', 'Healthy'],
                    ['Audit logs', 'Updated today'],
                    ['Retention policy', 'Internal synthetic corpus'],
                  ].map(([name, value]) => (
                    <div key={name} className="detail-card">
                      <span className="eyebrow">{name}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </article>
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Job runs</h3>
                    <p>Intentional system states instead of raw fallback errors.</p>
                  </div>
                </div>
                <div className="stack-list">
                  {[
                    'Nightly pipeline completed successfully',
                    'Evidence pack refresh completed',
                    'Transcript ingestion healthy',
                    'No permission-limited views in current session',
                  ].map((item) => (
                    <div key={item} className="line-card static">
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          )}
        </section>
      </main>

      <aside className={`evidence-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div>
            <span className="eyebrow">Context drawer</span>
            <h3>{drawerMode === 'strategy' ? 'Strategy context' : drawerMode === 'call' ? 'Call details' : 'Evidence drawer'}</h3>
          </div>
          <button type="button" className="icon-button" onClick={() => setDrawerOpen(false)}>
            Close
          </button>
        </div>

        {drawerMode === 'strategy' ? (
          <div className="stack-list">
            <div className="detail-card">
              <span className="eyebrow">Linked issue</span>
              <strong>{dashboard.issues.find((item) => item.slug === issueSlug)?.issue ?? 'No issue selected'}</strong>
              <p>{dashboard.issues.find((item) => item.slug === issueSlug)?.summary ?? 'Select a strategy card to load issue context.'}</p>
            </div>
          </div>
        ) : drawerMode === 'call' && call ? (
          <div className="stack-list">
            <div className="detail-card">
              <span className="eyebrow">{call.call_id}</span>
              <strong>{label(call.issue)}</strong>
              <p>{call.summary}</p>
            </div>
            <div className="detail-card">
              <div className="line-card static">
                <span>Outcome</span>
                <strong>{call.outcome}</strong>
              </div>
              <div className="line-card static">
                <span>Sentiment shift</span>
                <strong>{call.sentiments.shift}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="stack-list">
            <div className="detail-card">
              <span className="eyebrow">Evidence pack</span>
              <strong>{dashboard.issues.find((item) => item.slug === issueSlug)?.issue ?? 'Current corpus context'}</strong>
              <p>Use this drawer to keep evidence visible while navigating across the shell.</p>
            </div>
            <div className="detail-card">
              <div className="tag-row">
                {(dashboard.issues.find((item) => item.slug === issueSlug)?.representative_calls ?? dashboard.calls.slice(0, 4)).map((item) => (
                  <button key={item.call_id} type="button" className="tag clickable" onClick={() => openCall(item.call_id)}>
                    {item.call_id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default App;
