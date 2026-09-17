import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, BrainCircuit, FileDown, GitBranchPlus, Pencil, RefreshCw, ShieldCheck, Sparkles, Target, X } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "./api";
import { pageFromPath, pathFromPage, type PageKey } from "./navigation";
import AdminAiGovernancePage from "./pages/AdminAiGovernancePage";
import AskCiPage from "./pages/AskCiPage";
import FieldModePage from "./pages/FieldModePage";
import LiveIncidentCommandPage from "./pages/LiveIncidentCommandPage";
import ModelApproachesPage from "./pages/ModelApproachesPage";
import { UiDesignLabPage } from "./pages/UiDesignLabPage";
import type { CallCard, StrategyCreateInput, StrategyRecord, WorkspacePayload } from "./types";

type ThemeMode = "light" | "dark";

interface StrategyEditForm {
  title: string;
  owner: string;
  hypothesis: string;
  notes: string;
  kpi_focus: string[];
  evidence_call_ids: string[];
}

const STAGE_ORDER = ["Proposed", "Accepted", "In Progress", "Evaluating", "Closed"];
const CALLS_PER_PAGE = 14;
const KPI_OPTIONS = ["AHT", "FCR", "Repeat Calls", "Escalation Rate", "Sentiment"];
const OUTCOME_COLORS = ["#69d2ff", "#8ce99a", "#ffc96c", "#ff8d72", "#b7a1ff"];
const TONE_COLORS: Record<string, string> = {
  neutral: "#7cc6ff",
  info: "#6ad5c2",
  risk: "#ff8a66",
  stable: "#84d66e",
  warning: "#ffc857",
};

function formatStrategyDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function deadlineState(strategy: StrategyRecord) {
  if (!strategy.due_date) return { label: "No deadline", tone: "none" };
  if (strategy.status === "Closed") return { label: `Deadline ${formatStrategyDate(strategy.due_date)}`, tone: "closed" };

  const today = localDateKey();
  const daysRemaining = Math.ceil((new Date(`${strategy.due_date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);
  if (daysRemaining < 0) return { label: `Overdue · ${formatStrategyDate(strategy.due_date)}`, tone: "overdue" };
  if (daysRemaining === 0) return { label: "Due today", tone: "soon" };
  if (daysRemaining <= 7) return { label: `Due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`, tone: "soon" };
  return { label: `Due ${formatStrategyDate(strategy.due_date)}`, tone: "scheduled" };
}

function isValidDeadline(value: string) {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || Number(match[1]) < 1900) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && localDateKey(date) === value;
}

function StrategyDeadlineEditor({
  strategy,
  disabled,
  onSave,
}: {
  strategy: StrategyRecord;
  disabled: boolean;
  onSave: (strategy: StrategyRecord, dueDate: string) => Promise<void>;
}) {
  const savedDate = strategy.due_date ?? "";
  const [draftDate, setDraftDate] = useState(savedDate);
  const valid = isValidDeadline(draftDate);
  const changed = draftDate !== savedDate;
  const inputId = `strategy-deadline-${strategy.strategy_id}`;

  useEffect(() => {
    setDraftDate(savedDate);
  }, [savedDate]);

  function saveDraft() {
    if (!disabled && changed && valid) void onSave(strategy, draftDate);
  }

  return (
    <div className="strategy-deadline-field">
      <label htmlFor={inputId}>{strategy.due_date ? "Change deadline" : "Add deadline"}</label>
      <span className="strategy-deadline-control">
        <input
          id={inputId}
          type="date"
          className="dashboard-input"
          value={draftDate}
          min="1900-01-01"
          disabled={disabled}
          aria-invalid={!valid}
          onChange={(event) => setDraftDate(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              saveDraft();
            }
            if (event.key === "Escape") setDraftDate(savedDate);
          }}
        />
        <button type="button" className="ghost-button small" disabled={disabled || !changed || !valid} onClick={saveDraft}>
          Save
        </button>
      </span>
      {!valid ? <small className="deadline-error">Enter a complete four-digit year (1900 or later).</small> : null}
    </div>
  );
}

const PAGE_META: Record<PageKey, { title: string; description: string; kicker: string }> = {
  overview: {
    title: "Overview",
    description: "Executive view of call drivers, outcomes, sentiment movement, and active action plans.",
    kicker: "Executive Summary",
  },
  issues: {
    title: "Issues",
    description: "Track recurring customer problems, supporting evidence, and patterns across calls.",
    kicker: "Issue Analysis",
  },
  calls: {
    title: "Calls",
    description: "Review representative calls, transcript details, and signal extraction for specific interactions.",
    kicker: "Call Review",
  },
  strategies: {
    title: "Action Plans",
    description: "Manage improvement plans, ownership, and progress against the issues driving performance.",
    kicker: "Action Management",
  },
  learning: {
    title: "Monitoring",
    description: "See refresh status, control checks, and the operating health of the analytics workflow.",
    kicker: "Controls & Monitoring",
  },
  "model-approaches": {
    title: "Model Approaches",
    description: "Compare topic-mapping and agent-approach extraction methods on the same frozen benchmark.",
    kicker: "Model Evaluation",
  },
  "ask-ci": {
    title: "Ask CI",
    description: "Use the assistant to find the right page, explain a metric, or navigate directly to supporting detail.",
    kicker: "Assistant",
  },
  "live-command": {
    title: "Live Incident Command",
    description: "Leadership-ready incident room with executive brief, change detection, evidence routing, guided answers, and AR field mode.",
    kicker: "Incident Room",
  },
  field: {
    title: "Field Mode",
    description: "Phone-first issue field with camera-gated AR controls.",
    kicker: "Field",
  },
  governance: {
    title: "Governance",
    description: "Review architecture, evidence policy, and control surfaces in one governed workspace.",
    kicker: "Governance",
  },
  "visual-lab": {
    title: "Visual Lab",
    description: "Design exploration workspace.",
    kicker: "Design Lab",
  },
  reports: {
    title: "Reports",
    description: "Leadership-ready export package with totals, highlights, and issue-level reporting.",
    kicker: "Reporting",
  },
};

const NAV_ITEMS: Array<[PageKey, string, string]> = [
  ["overview", "Overview", "Top KPIs, call drivers, and operating picture"],
  ["issues", "Issues", "Recurring customer problems and supporting evidence"],
  ["calls", "Calls", "Representative calls, transcripts, and call detail"],
  ["strategies", "Action Plans", "Improvement plans and ownership tracking"],
  ["learning", "Monitoring", "Trend movement, model monitoring, and controls"],
  ["model-approaches", "Model Approaches", "Side-by-side benchmark methods and measured results"],
  ["ask-ci", "Ask CI", "Assistant for pages, metrics, and workflow questions"],
  ["live-command", "Live Command", "War-room brief, evidence routing, and tablet AR scene"],
  ["governance", "Governance", "Architecture, controls, and audit review"],
  ["reports", "Reports", "Leadership-ready summary and export package"],
];

function compareCallRecency(left: CallCard, right: CallCard) {
  const leftDate = Date.parse(left.timestamp_start ?? left.timestamp_end ?? "");
  const rightDate = Date.parse(right.timestamp_start ?? right.timestamp_end ?? "");
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
    return leftDate - rightDate;
  }
  if (!Number.isNaN(leftDate)) {
    return -1;
  }
  if (!Number.isNaN(rightDate)) {
    return 1;
  }
  const leftSequence = Number(left.call_id.match(/\d+$/)?.[0] ?? 0);
  const rightSequence = Number(right.call_id.match(/\d+$/)?.[0] ?? 0);
  return leftSequence - rightSequence || left.call_id.localeCompare(right.call_id);
}

function App() {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem("ci-theme");
    return stored === "light" || stored === "dark" ? stored : "dark";
  });
  const [page, setPage] = useState<PageKey>(() => pageFromPath(window.location.pathname));
  const [issueFilter, setIssueFilter] = useState("");
  const [callIssueFilter, setCallIssueFilter] = useState("");
  const [callIssueSort, setCallIssueSort] = useState<"issue-asc" | "issue-desc" | "recent" | "oldest">("issue-asc");
  const [callPage, setCallPage] = useState(1);
  const [selectedIssueSlug, setSelectedIssueSlug] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const draggedStrategyRef = useRef<string | null>(null);
  const [draggedStrategyId, setDraggedStrategyId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportSnapshot, setReportSnapshot] = useState<WorkspacePayload["reports"] | null>(null);
  const [editingStrategy, setEditingStrategy] = useState<StrategyRecord | null>(null);
  const [strategyEditForm, setStrategyEditForm] = useState<StrategyEditForm | null>(null);
  const [formState, setFormState] = useState<StrategyCreateInput>({
    issue_slug: "",
    title: "",
    owner: "Operations",
    hypothesis: "",
    notes: "",
    kpi_focus: ["AHT", "FCR"],
    evidence_call_ids: [],
    due_date: "",
  });

  const workspaceQuery = useQuery({ queryKey: ["workspace"], queryFn: api.getWorkspace });
  const workspace = workspaceQuery.data ?? null;
  const dashboard = workspace?.dashboard ?? null;

  const issueDetailQuery = useQuery({
    queryKey: ["issue", selectedIssueSlug],
    queryFn: () => api.getIssue(selectedIssueSlug!),
    enabled: Boolean(selectedIssueSlug),
  });
  const callDetailQuery = useQuery({
    queryKey: ["call", selectedCallId],
    queryFn: () => api.getCall(selectedCallId!),
    enabled: Boolean(selectedCallId),
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("ci-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onPopState = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!editingStrategy) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !syncing) {
        setEditingStrategy(null);
        setStrategyEditForm(null);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [editingStrategy, syncing]);

  useEffect(() => {
    if (!dashboard) {
      return;
    }
    const firstIssue = dashboard.issues[0]?.slug ?? null;
    const firstCall = dashboard.calls[0]?.call_id ?? null;
    setSelectedIssueSlug((current) => current ?? firstIssue);
    setSelectedCallId((current) => current ?? firstCall);
    setFormState((current) => ({
      ...current,
      issue_slug: current.issue_slug || firstIssue || "",
      evidence_call_ids: current.evidence_call_ids.length ? current.evidence_call_ids : firstCall ? [firstCall] : [],
    }));
  }, [dashboard]);

  const issueCards = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    const query = issueFilter.trim().toLowerCase();
    return dashboard.issues.filter((issue) => !query || issue.issue.toLowerCase().includes(query) || issue.summary.toLowerCase().includes(query));
  }, [dashboard, issueFilter]);

  const issueVolumeData = useMemo(
    () => issueCards.slice(0, 8).map((issue) => ({ issue: compactLabel(issue.issue), count: issue.count })),
    [issueCards],
  );
  const filteredCalls = useMemo(() => {
    const query = callIssueFilter.trim().toLowerCase();
    return [...(dashboard?.calls ?? [])]
      .filter((call) => !query || (call.issues ?? [call.issue]).some((issue) => issue.toLowerCase().includes(query)))
      .sort((left, right) => {
        if (callIssueSort === "recent" || callIssueSort === "oldest") {
          const order = compareCallRecency(left, right);
          return callIssueSort === "recent" ? -order : order;
        }
        const order = left.issue.localeCompare(right.issue) || left.call_id.localeCompare(right.call_id);
        return callIssueSort === "issue-asc" ? order : -order;
      });
  }, [callIssueFilter, callIssueSort, dashboard]);
  const callPageCount = Math.max(1, Math.ceil(filteredCalls.length / CALLS_PER_PAGE));
  const visibleCalls = useMemo(
    () => filteredCalls.slice((callPage - 1) * CALLS_PER_PAGE, callPage * CALLS_PER_PAGE),
    [callPage, filteredCalls],
  );

  useEffect(() => {
    setCallPage((current) => Math.min(current, callPageCount));
  }, [callPageCount]);

  useEffect(() => {
    setSelectedCallId((current) => current && visibleCalls.some((call) => call.call_id === current) ? current : visibleCalls[0]?.call_id ?? null);
  }, [visibleCalls]);
  const outcomeData = useMemo(
    () => Object.entries(dashboard?.overview.outcome_counts ?? {}).map(([name, value]) => ({ name, value })),
    [dashboard],
  );
  const sentimentData = useMemo(() => {
    const sentiment = dashboard?.overview.sentiment_summary;
    if (!sentiment) {
      return [];
    }
    return [
      { stage: "Opening", value: sentiment.opening },
      { stage: "Closing", value: sentiment.closing },
    ];
  }, [dashboard]);
  function navigate(nextPage: PageKey) {
    startTransition(() => {
      setPage(nextPage);
      window.history.pushState({}, "", pathFromPage(nextPage));
    });
  }

  async function refreshWorkspace(mode: "refresh" | "rerun" | "recalibrate" = "refresh") {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      if (mode === "rerun") {
        await api.rerunPipeline();
        setMessage("Batch analysis reran successfully.");
      } else if (mode === "recalibrate") {
        await api.recalibrate();
        setMessage("Monthly recalibration completed.");
      }
      const payload = await queryClient.fetchQuery({ queryKey: ["workspace"], queryFn: api.getWorkspace });
      queryClient.setQueryData(["workspace"], payload);
      setReportSnapshot(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["issue"] }),
        queryClient.invalidateQueries({ queryKey: ["call"] }),
      ]);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh workspace");
    } finally {
      setSyncing(false);
    }
  }

  async function handleCreateStrategy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formState.issue_slug || !formState.title.trim() || !formState.hypothesis.trim()) {
      setMessage("Issue, title, and hypothesis are required.");
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      await api.createStrategy(formState);
      const board = await api.getStrategies();
      queryClient.setQueryData<WorkspacePayload | undefined>(["workspace"], (current) => current ? { ...current, strategy_board: board } : current);
      setMessage("Strategy created.");
      setFormState((current) => ({ ...current, title: "", hypothesis: "", notes: "", due_date: "" }));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create strategy");
    } finally {
      setSyncing(false);
    }
  }

  function openStrategyEditor(strategy: StrategyRecord) {
    setEditingStrategy(strategy);
    setStrategyEditForm({
      title: strategy.title,
      owner: strategy.owner,
      hypothesis: strategy.hypothesis,
      notes: strategy.notes,
      kpi_focus: [...strategy.kpi_focus],
      evidence_call_ids: [...strategy.evidence_call_ids],
    });
    setError(null);
    setMessage(null);
  }

  function closeStrategyEditor() {
    if (syncing) return;
    setEditingStrategy(null);
    setStrategyEditForm(null);
  }

  async function saveStrategyEdits(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStrategy || !strategyEditForm || syncing) return;

    const title = strategyEditForm.title.trim();
    const owner = strategyEditForm.owner.trim();
    const hypothesis = strategyEditForm.hypothesis.trim();
    if (!title || !owner || !hypothesis) {
      setError("Title, owner, and hypothesis are required.");
      return;
    }

    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.updateStrategy(editingStrategy.strategy_id, {
        title,
        owner,
        hypothesis,
        notes: strategyEditForm.notes.trim(),
        kpi_focus: strategyEditForm.kpi_focus,
        evidence_call_ids: strategyEditForm.evidence_call_ids,
      });
      queryClient.setQueryData<WorkspacePayload | undefined>(["workspace"], (current) => current ? {
        ...current,
        strategy_board: {
          ...current.strategy_board,
          strategies: current.strategy_board.strategies.map((item) => item.strategy_id === updated.strategy_id ? updated : item),
        },
      } : current);
      setEditingStrategy(null);
      setStrategyEditForm(null);
      setMessage(`${updated.title} updated.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update strategy");
    } finally {
      setSyncing(false);
    }
  }

  async function moveStrategy(strategy: StrategyRecord, direction: -1 | 1) {
    const currentIndex = STAGE_ORDER.indexOf(strategy.status);
    const nextStatus = STAGE_ORDER[currentIndex + direction];
    if (nextStatus) await moveStrategyToStage(strategy, nextStatus);
  }

  async function updateStrategyDeadline(strategy: StrategyRecord, dueDate: string) {
    if (syncing) return;
    setError(null);
    setMessage(null);
    setSyncing(true);
    try {
      const updated = await api.updateStrategy(strategy.strategy_id, { due_date: dueDate || null });
      queryClient.setQueryData<WorkspacePayload | undefined>(["workspace"], (current) => current ? {
        ...current,
        strategy_board: {
          ...current.strategy_board,
          strategies: current.strategy_board.strategies.map((item) => item.strategy_id === updated.strategy_id ? updated : item),
        },
      } : current);
      setMessage(dueDate ? `${strategy.title} deadline updated.` : `${strategy.title} deadline removed.`);
    } catch (deadlineError) {
      setError(deadlineError instanceof Error ? deadlineError.message : "Unable to update deadline");
    } finally {
      setSyncing(false);
    }
  }

  async function moveStrategyToStage(strategy: StrategyRecord, nextStatus: string) {
    if (syncing || strategy.status === nextStatus || !STAGE_ORDER.includes(nextStatus)) return;
    setError(null);
    setMessage(null);
    setSyncing(true);
    try {
      const updated = await api.updateStrategy(strategy.strategy_id, { status: nextStatus });
      queryClient.setQueryData<WorkspacePayload | undefined>(["workspace"], (current) => {
        if (!current) {
          return current;
        }
        const strategies = current.strategy_board.strategies.map((item) => item.strategy_id === updated.strategy_id ? updated : item);
        return {
          ...current,
          strategy_board: {
            stages: STAGE_ORDER.map((name) => ({ name, count: strategies.filter((item) => item.status === name).length })),
            strategies,
          },
        };
      });
      setMessage(`${strategy.title} moved to ${nextStatus}.`);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Unable to move strategy");
    } finally {
      setSyncing(false);
    }
  }

  async function deleteStrategy(strategy: StrategyRecord) {
    if (!window.confirm(`Delete strategy "${strategy.title}"? This cannot be undone.`)) {
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      await api.deleteStrategy(strategy.strategy_id);
      queryClient.setQueryData<WorkspacePayload | undefined>(["workspace"], (current) => {
        if (!current) {
          return current;
        }
        const strategies = current.strategy_board.strategies.filter((item) => item.strategy_id !== strategy.strategy_id);
        return {
          ...current,
          strategy_board: {
            stages: STAGE_ORDER.map((name) => ({ name, count: strategies.filter((item) => item.status === name).length })),
            strategies,
          },
        };
      });
      setMessage(`${strategy.title} deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete strategy");
    } finally {
      setSyncing(false);
    }
  }

  async function handleExport() {
    setSyncing(true);
    setError(null);
    try {
      const payload = await api.exportReport();
      await api.downloadReportPdf();
      setReportSnapshot(payload.report);
      setMessage("PDF report exported.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export report");
    } finally {
      setSyncing(false);
    }
  }

  if (workspaceQuery.isLoading) {
    return <div className="loading-screen">Loading Call Insights workspace...</div>;
  }

  if ((workspaceQuery.error || error) && !workspace) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <h1>Call Insights</h1>
          <p>{workspaceQuery.error instanceof Error ? workspaceQuery.error.message : error}</p>
          <p>Start the API with `uvicorn app.main:app --reload` from `apps/api`.</p>
        </div>
      </div>
    );
  }

  if (!workspace || !dashboard) {
    return null;
  }

  if (page === "field") {
    return (
      <FieldModePage
        workspace={workspace}
        onNavigate={navigate}
        onOpenIssue={(issueSlug) => {
          setSelectedIssueSlug(issueSlug);
          navigate("issues");
        }}
        onOpenCall={(callId) => {
          setSelectedCallId(callId);
          navigate("calls");
        }}
      />
    );
  }

  const pageMeta = PAGE_META[page];
  const openActionPlans = workspace.strategy_board.strategies.filter((item) => item.status !== "Closed").length;
  const topIssue = dashboard.issues[0] ?? null;
  const dailyBrief = dashboard.overview.daily_brief.slice(0, 3);
  const generatedAt = workspace.governance.generated_at || workspace.reports.generated_at;

  return (
    <div className="dashboard-shell">
      <div className="dashboard-glow dashboard-glow-one" />
      <div className="dashboard-glow dashboard-glow-two" />
      <aside className="dashboard-sidebar">
        <div className="brand-block">
          <p className="brand-kicker">Call Insights</p>
          <h1>Servicing performance, clearly organized.</h1>
          <p>Track call drivers, resolution quality, customer friction, and action plans in one management dashboard.</p>
        </div>
        <nav className="dashboard-nav">
          {NAV_ITEMS.map(([key, label, description]) => (
            <button key={key} type="button" className={`nav-card ${page === key ? "active" : ""}`} onClick={() => navigate(key as PageKey)}>
              <strong>{label}</strong>
              <span>{description}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-summary">
          <div className="sidebar-summary-row">
            <span>Top issue</span>
            <strong>{topIssue?.issue ?? "n/a"}</strong>
          </div>
          <div className="sidebar-summary-row">
            <span>Open action plans</span>
            <strong>{openActionPlans}</strong>
          </div>
          <div className="sidebar-summary-row">
            <span>Last refresh</span>
            <strong>{generatedAt}</strong>
          </div>
        </div>
        <div className="sidebar-controls">
          <button type="button" className="ghost-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Switch to light" : "Switch to dark"}</button>
        </div>
      </aside>
      <main className="dashboard-main">
        <section className="workspace-header">
          <div className="workspace-heading">
            <p className="section-kicker">{pageMeta.kicker}</p>
            <h2>{pageMeta.title}</h2>
            <p>{pageMeta.description}</p>
          </div>
          <div className="workspace-actions">
            <button type="button" className="ghost-button" disabled={syncing} onClick={() => void refreshWorkspace("refresh")}><RefreshCw size={16} /> Refresh view</button>
            <button type="button" className="ghost-button" disabled={syncing} onClick={() => void refreshWorkspace("rerun")}><Sparkles size={16} /> Update analysis</button>
            <button type="button" className="ghost-button" disabled={syncing} onClick={() => void refreshWorkspace("recalibrate")}><GitBranchPlus size={16} /> Refresh trends</button>
            <button type="button" className="primary-button" disabled={syncing} onClick={() => void handleExport()}><FileDown size={16} /> Export summary</button>
          </div>
        </section>
        {page === "overview" ? (
          <section className="hero-panel overview-hero">
            <div className="hero-copy">
              <p className="section-kicker">Executive Overview</p>
              <h2>See what customers are calling about, which responses are working, and where teams need support.</h2>
              <p>This dashboard brings together call drivers, resolution results, sentiment movement, and active action plans for servicing leadership.</p>
              <div className="hero-briefs">
                {dailyBrief.map((item) => (
                  <div className="brief-pill" key={item}><ArrowRight size={14} /><span>{item}</span></div>
                ))}
              </div>
            </div>
            <div className="hero-side">
              <div className="hero-metrics">
                {dashboard.overview.metrics.map((metric) => (
                  <article className="metric-card" key={metric.label}>
                    <span>{metric.label}</span>
                    <strong style={{ color: TONE_COLORS[metric.tone] ?? undefined }}>{formatMetricValue(metric.value)}</strong>
                  </article>
                ))}
              </div>
              <div className="hero-focus-card">
                <p className="section-kicker">Management Focus</p>
                <h3>{topIssue?.issue ?? "No dominant issue loaded"}</h3>
                <p>{topIssue?.summary ?? "Refresh the workspace to load issue detail."}</p>
                <div className="focus-meta">
                  <span>{topIssue?.count ?? 0} calls</span>
                  <span>{openActionPlans} open action plans</span>
                </div>
              </div>
            </div>
          </section>
        ) : null}
        {message ? <div className="flash-banner success">{message}</div> : null}
        {error ? <div className="flash-banner error">{error}</div> : null}
        {page === "overview" ? (
          <section className="grid-page overview-page">
            <div className="panel-card span-two">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Issue Volume</p>
                  <h3>Top call drivers</h3>
                </div>
                <Target size={18} />
              </div>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={issueVolumeData}>
                    <CartesianGrid vertical={false} stroke="rgba(122,148,190,0.14)" />
                    <XAxis dataKey="issue" tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={64} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                      {issueVolumeData.map((entry, index) => (
                        <Cell key={`${entry.issue}-${index}`} fill={index % 2 === 0 ? "#62d3ff" : "#8ff0a7"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel-card">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Outcome Mix</p>
                  <h3>Resolution distribution</h3>
                </div>
                <Activity size={18} />
              </div>
              <div className="chart-box compact">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={outcomeData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={96} paddingAngle={3}>
                      {outcomeData.map((entry, index) => (
                        <Cell key={entry.name} fill={OUTCOME_COLORS[index % OUTCOME_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="legend-stack">
                {outcomeData.map((entry, index) => (
                  <div className="legend-row" key={entry.name}>
                    <span className="legend-dot" style={{ background: OUTCOME_COLORS[index % OUTCOME_COLORS.length] }} />
                    <strong>{entry.name}</strong>
                    <span>{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-card">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Sentiment Lens</p>
                  <h3>Opening to close</h3>
                </div>
                <div
                  className={`sentiment-shift ${dashboard.overview.sentiment_summary.average_shift > 0 ? "positive" : dashboard.overview.sentiment_summary.average_shift < 0 ? "negative" : "neutral"}`}
                  title="Average closing sentiment minus average opening sentiment"
                >
                  <span>Avg shift</span>
                  <strong>
                    {dashboard.overview.sentiment_summary.average_shift > 0 ? "+" : ""}
                    {dashboard.overview.sentiment_summary.average_shift.toFixed(2)}
                  </strong>
                </div>
              </div>
              <div className="chart-box compact">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={sentimentData}>
                    <CartesianGrid vertical={false} stroke="rgba(122,148,190,0.14)" />
                    <XAxis dataKey="stage" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="value" stroke="#86efac" fill="url(#sentimentFill)" strokeWidth={3} />
                    <defs>
                      <linearGradient id="sentimentFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#86efac" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#86efac" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel-card span-two">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Response Patterns</p>
                  <h3>Responses linked to stronger outcomes</h3>
                </div>
                <BrainCircuit size={18} />
              </div>
              <div className="pattern-grid">
                {dashboard.overview.top_patterns.slice(0, 6).map((pattern) => (
                  <button
                    type="button"
                    className="pattern-card"
                    key={`${pattern.issue}-${pattern.behavior}-${pattern.outcome}`}
                    onClick={() => {
                      const nextSlug = dashboard.issues.find((issue) => issue.issue === pattern.issue)?.slug ?? selectedIssueSlug;
                      setSelectedIssueSlug(nextSlug);
                      navigate("issues");
                    }}
                  >
                    <span className="pattern-chip">{pattern.outcome}</span>
                    <strong>{pattern.issue}</strong>
                    <p>{pattern.behavior}</p>
                    <div className="pattern-meta">
                      <span>{pattern.count} calls</span>
                      <span>Lift {pattern.lift.toFixed(2)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {page === "issues" ? (
          <section className="grid-page intelligence-page">
            <div className="panel-card">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Issue Explorer</p>
                  <h3>Recurring customer issues</h3>
                </div>
                <BrainCircuit size={18} />
              </div>
              <input className="dashboard-input" placeholder="Filter issues" value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)} />
              <div className="issue-list">
                {issueCards.map((issue) => (
                  <button key={issue.slug} type="button" className={`issue-list-card ${issue.slug === selectedIssueSlug ? "active" : ""}`} onClick={() => setSelectedIssueSlug(issue.slug)}>
                    <div>
                      <strong>{issue.issue}</strong>
                      <p>{issue.summary}</p>
                    </div>
                    <span>{issue.count}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="panel-card span-two">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Evidence Pack</p>
                  <h3>{issueDetailQuery.data?.issue ?? "Select an issue"}</h3>
                </div>
                <ShieldCheck size={18} />
              </div>
              {issueDetailQuery.data ? (
                <div className="issue-detail-layout">
                  <div className="detail-callout">
                    <p>{issueDetailQuery.data.summary}</p>
                    <div className="detail-tags">
                      {Object.entries(issueDetailQuery.data.outcome_breakdown).map(([name, value]) => (
                        <span className="data-tag" key={name}>{name}: {value}</span>
                      ))}
                    </div>
                  </div>
                  <div className="detail-stack-grid">
                    <div className="subpanel">
                      <h4>Top behaviors</h4>
                      {issueDetailQuery.data.top_behaviors.map((item, index) => (
                        <div className="line-row" key={`${item.behavior ?? item.label ?? index}`}>
                          <span>{item.behavior ?? item.label ?? "Signal"}</span>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="subpanel">
                      <h4>Representative calls</h4>
                      {issueDetailQuery.data.evidence_calls.map((call) => (
                        <button type="button" className="evidence-row" key={call.call_id} onClick={() => { setSelectedCallId(call.call_id); navigate("calls"); }}>
                          <strong>{call.call_id}</strong>
                          <span>{call.summary}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="empty-state">Select an issue to load supporting detail.</p>
              )}
            </div>
          </section>
        ) : null}
        {page === "calls" ? (
          <section className="grid-page calls-page">
            <div className="panel-card">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Call Index</p>
                  <h3>Transcript set</h3>
                </div>
                <Activity size={18} />
              </div>
              <div className="call-list-controls">
                  <input
                    className="dashboard-input"
                    placeholder="Search calls by issue"
                    aria-label="Search calls by issue"
                    value={callIssueFilter}
                    onChange={(event) => {
                      setCallIssueFilter(event.target.value);
                      setCallPage(1);
                    }}
                  />
                  <select
                    className="dashboard-input"
                    aria-label="Sort calls by issue"
                    value={callIssueSort}
                    onChange={(event) => {
                      setCallIssueSort(event.target.value as "issue-asc" | "issue-desc" | "recent" | "oldest");
                      setCallPage(1);
                    }}
                  >
                    <option value="issue-asc">Issue A-Z</option>
                    <option value="issue-desc">Issue Z-A</option>
                    <option value="recent">Most recent</option>
                    <option value="oldest">Least recent</option>
                  </select>
                  <select
                    className="dashboard-input"
                    aria-label="Select calls page"
                    title={callPageCount === 1 ? "Only one page available" : undefined}
                    value={callPage}
                    onChange={(event) => setCallPage(Number(event.target.value))}
                    disabled={callPageCount === 1}
                  >
                    {Array.from({ length: callPageCount }, (_, index) => (
                      <option value={index + 1} key={index + 1}>Page {index + 1} of {callPageCount}{callPageCount === 1 ? " (only page)" : ""}</option>
                    ))}
                  </select>
                  <button type="button" className="ghost-button small" aria-label="Previous page" title={callPageCount === 1 ? "Only one page available" : undefined} onClick={() => setCallPage((current) => current - 1)} disabled={callPage <= 1}>
                    Previous page
                  </button>
                  <button type="button" className="ghost-button small" aria-label="Next page" title={callPageCount === 1 ? "Only one page available" : undefined} onClick={() => setCallPage((current) => current + 1)} disabled={callPage >= callPageCount}>
                    Next page
                  </button>
              </div>
              <div className="call-list">
                {visibleCalls.length ? visibleCalls.map((call: CallCard) => (
                  <button type="button" key={call.call_id} className={`call-list-card ${call.call_id === selectedCallId ? "active" : ""}`} onClick={() => setSelectedCallId(call.call_id)}>
                    <strong>{call.call_id}</strong>
                    <span>{(call.issues ?? [call.issue]).join(" · ")}</span>
                    <p>{call.summary}</p>
                  </button>
                )) : <p className="empty-state">No calls match this issue search.</p>}
              </div>
            </div>
            <div className="panel-card span-two">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Call Review</p>
                  <h3>{callDetailQuery.data?.call_id ?? "Select a call"}</h3>
                </div>
                <Target size={18} />
              </div>
              {callDetailQuery.data ? (
                <div className="call-review-layout">
                  <div className="call-review-meta">
                    <div className="detail-tags">
                      <span className="data-tag">{callDetailQuery.data.issue}</span>
                      <span className="data-tag">{callDetailQuery.data.outcome}</span>
                      {callDetailQuery.data.behaviors.map((behavior) => (
                        <span className="data-tag muted" key={behavior}>{behavior}</span>
                      ))}
                    </div>
                    <p>{callDetailQuery.data.summary}</p>
                    <div className="segment-strip">
                      {callDetailQuery.data.segments.map((segment) => (
                        <div className="segment-pill" key={segment.segment_id}>
                          <strong>{segment.issue}</strong>
                          <span>{segment.turn_count} turns</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="transcript-stream">
                    {callDetailQuery.data.turns.map((turn, index) => (
                      <article className={`transcript-turn ${turn.speaker.toLowerCase()}`} key={`${turn.speaker}-${index}`}>
                        <span>{turn.speaker}</span>
                        <p>{turn.text}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="empty-state">Select a call to review transcript evidence.</p>
              )}
            </div>
          </section>
        ) : null}

        {page === "strategies" ? (
          <section className="grid-page strategy-page">
            <div className="panel-card span-two">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Strategy Workflow</p>
                  <h3>Action plan board</h3>
                </div>
                <Target size={18} />
              </div>
              <p className="kanban-help">Drag a card to another column, or use Back and Forward.</p>
              <div className="kanban-board" aria-busy={syncing}>
                {workspace.strategy_board.stages.map((stage) => (
                  <div
                    className={`kanban-column${dropStage === stage.name ? " is-drop-target" : ""}`}
                    key={stage.name}
                    onDragOver={(event) => {
                      const strategy = workspace.strategy_board.strategies.find((item) => item.strategy_id === draggedStrategyRef.current);
                      if (syncing || !strategy || strategy.status === stage.name) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropStage(stage.name);
                    }}
                    onDragLeave={(event) => {
                      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                        setDropStage((current) => current === stage.name ? null : current);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const strategy = workspace.strategy_board.strategies.find((item) => item.strategy_id === draggedStrategyRef.current);
                      draggedStrategyRef.current = null;
                      setDraggedStrategyId(null);
                      setDropStage(null);
                      if (strategy) void moveStrategyToStage(strategy, stage.name);
                    }}
                  >
                    <div className="kanban-column-head">
                      <strong>{stage.name}</strong>
                      <span>{stage.count}</span>
                    </div>
                    {workspace.strategy_board.strategies.filter((strategy) => strategy.status === stage.name).map((strategy) => {
                      const deadline = deadlineState(strategy);
                      return (
                      <article
                        className={`strategy-card${draggedStrategyId === strategy.strategy_id ? " is-dragging" : ""}`}
                        key={strategy.strategy_id}
                        draggable={!syncing}
                        onDragStart={(event) => {
                          if (syncing || (event.target instanceof Element && event.target.closest("button, input"))) {
                            event.preventDefault();
                            return;
                          }
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", strategy.strategy_id);
                          draggedStrategyRef.current = strategy.strategy_id;
                          setDraggedStrategyId(strategy.strategy_id);
                        }}
                        onDragEnd={() => {
                          draggedStrategyRef.current = null;
                          setDraggedStrategyId(null);
                          setDropStage(null);
                        }}
                      >
                        <p className="strategy-issue">{strategy.issue}</p>
                        <h4>{strategy.title}</h4>
                        <p>{strategy.hypothesis}</p>
                        <dl className="strategy-dates">
                          <div>
                            <dt>Initiated</dt>
                            <dd>{formatStrategyDate(strategy.created_at)}</dd>
                          </div>
                          <div>
                            <dt>Deadline</dt>
                            <dd><span className={`deadline-badge ${deadline.tone}`}>{deadline.label}</span></dd>
                          </div>
                        </dl>
                        <StrategyDeadlineEditor strategy={strategy} disabled={syncing} onSave={updateStrategyDeadline} />
                        <div className="detail-tags">
                          {strategy.kpi_focus.map((kpi) => (
                            <span className="data-tag muted" key={kpi}>{kpi}</span>
                          ))}
                        </div>
                        <div className="strategy-actions">
                          <button
                            type="button"
                            className="ghost-button small strategy-edit-button"
                            disabled={syncing}
                            onClick={() => openStrategyEditor(strategy)}
                            aria-label={`Edit ${strategy.title}`}
                          >
                            <Pencil size={13} />
                            Edit
                          </button>
                          <button type="button" className="ghost-button small" disabled={syncing || strategy.status === STAGE_ORDER[0]} onClick={() => void moveStrategy(strategy, -1)}>Back</button>
                          <button type="button" className="ghost-button small" disabled={syncing || strategy.status === STAGE_ORDER[STAGE_ORDER.length - 1]} onClick={() => void moveStrategy(strategy, 1)}>Forward</button>
                          <button
                            type="button"
                            className="ghost-button small strategy-delete-button"
                            onClick={() => void deleteStrategy(strategy)}
                            disabled={syncing}
                            aria-label={`Delete ${strategy.title}`}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-card">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Create Action Plan</p>
                  <h3>Assign a new improvement plan</h3>
                </div>
                <GitBranchPlus size={18} />
              </div>
              <form className="strategy-form" onSubmit={(event) => void handleCreateStrategy(event)}>
                <select className="dashboard-input" value={formState.issue_slug} onChange={(event) => setFormState((current) => ({ ...current, issue_slug: event.target.value }))}>
                  {dashboard.issues.map((issue) => (
                    <option value={issue.slug} key={issue.slug}>{issue.issue}</option>
                  ))}
                </select>
                <input className="dashboard-input" placeholder="Strategy title" value={formState.title} onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))} />
                <input className="dashboard-input" placeholder="Owner" value={formState.owner} onChange={(event) => setFormState((current) => ({ ...current, owner: event.target.value }))} />
                <textarea className="dashboard-input dashboard-textarea" placeholder="Hypothesis" value={formState.hypothesis} onChange={(event) => setFormState((current) => ({ ...current, hypothesis: event.target.value }))} />
                <textarea className="dashboard-input dashboard-textarea" placeholder="Notes" value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} />
                <label className="strategy-form-field">
                  <span>Deadline <small>Optional</small></span>
                  <input type="date" className="dashboard-input" min="1900-01-01" value={formState.due_date} onChange={(event) => setFormState((current) => ({ ...current, due_date: event.target.value }))} />
                </label>
                <div className="kpi-grid">
                  {KPI_OPTIONS.map((kpi) => {
                    const active = formState.kpi_focus.includes(kpi);
                    return (
                      <button
                        type="button"
                        className={`kpi-toggle ${active ? "active" : ""}`}
                        key={kpi}
                        onClick={() => setFormState((current) => ({ ...current, kpi_focus: active ? current.kpi_focus.filter((item) => item !== kpi) : [...current.kpi_focus, kpi] }))}
                      >
                        {kpi}
                      </button>
                    );
                  })}
                </div>
                <button type="submit" className="primary-button">Create strategy</button>
              </form>
            </div>
          </section>
        ) : null}
        {page === "learning" ? (
          <section className="grid-page learning-page">
            <div className="panel-card span-two">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Monitoring</p>
                  <h3>Trend refresh, controls, and system monitoring</h3>
                </div>
                <BrainCircuit size={18} />
              </div>
              <div className="learning-grid">
                <div className="subpanel">
                  <h4>Trend refresh status</h4>
                  <div className="line-row"><span>Completed</span><strong>{workspace.recalibration.completed_at}</strong></div>
                  <div className="line-row"><span>Top issue</span><strong>{workspace.recalibration.top_issue ?? "n/a"}</strong></div>
                  <div className="line-row"><span>New clusters</span><strong>{workspace.recalibration.new_clusters_detected}</strong></div>
                  <div className="line-row"><span>Retired clusters</span><strong>{workspace.recalibration.retired_clusters}</strong></div>
                </div>
                <div className="subpanel">
                  <h4>Control checks</h4>
                  {workspace.governance.monitors.map((monitor) => (
                    <div className="monitor-row" key={monitor.label}>
                      <span>{monitor.label}</span>
                      <strong>{monitor.status}</strong>
                    </div>
                  ))}
                </div>
                <div className="subpanel">
                  <h4>Ask CI</h4>
                  {workspace.ask_ci.map((item) => (
                    <div className="qa-card" key={item.question}>
                      <strong>{item.question}</strong>
                      <p>{item.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="panel-card">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Controls</p>
                  <h3>Review rules and safeguards</h3>
                </div>
                <ShieldCheck size={18} />
              </div>
              <div className="policy-list">
                {workspace.governance.evidence_policy.map((policy) => (
                  <div className="policy-item" key={policy}>
                    <ArrowRight size={14} />
                    <span>{policy}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {page === "ask-ci" ? (
          <AskCiPage
            workspace={workspace}
            currentPage={page}
            onNavigate={navigate}
            onOpenIssue={(issueSlug) => {
              setSelectedIssueSlug(issueSlug);
              navigate("issues");
            }}
            onOpenCall={(callId) => {
              setSelectedCallId(callId);
              navigate("calls");
            }}
          />
        ) : null}

        {page === "live-command" ? (
          <LiveIncidentCommandPage
            workspace={workspace}
            onNavigate={navigate}
            onOpenIssue={(issueSlug) => {
              setSelectedIssueSlug(issueSlug);
              navigate("issues");
            }}
            onOpenCall={(callId) => {
              setSelectedCallId(callId);
              navigate("calls");
            }}
          />
        ) : null}

        {page === "governance" ? <AdminAiGovernancePage workspace={workspace} /> : null}

        {page === "model-approaches" ? <ModelApproachesPage /> : null}

        {page === "visual-lab" ? (
          <UiDesignLabPage
            workspace={workspace}
            onOpenIssue={(issue) => {
              setSelectedIssueSlug(issue.slug);
              navigate("issues");
            }}
            onOpenCall={(callId) => {
              setSelectedCallId(callId);
              navigate("calls");
            }}
          />
        ) : null}

        {page === "reports" ? (
          <section className="grid-page reports-page">
            <div className="panel-card span-two">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Leadership Report</p>
                  <h3>{(reportSnapshot ?? workspace.reports).title}</h3>
                </div>
                <FileDown size={18} />
              </div>
              <div className="report-grid">
                {Object.entries((reportSnapshot ?? workspace.reports).totals).map(([label, value]) => (
                  <div className="metric-card report" key={label}>
                    <span>{label.replaceAll("_", " ")}</span>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-card">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Highlights</p>
                  <h3>Export narrative</h3>
                </div>
                <Sparkles size={18} />
              </div>
              <div className="policy-list">
                {(reportSnapshot ?? workspace.reports).highlights.map((highlight) => (
                  <div className="policy-item" key={highlight}>
                    <ArrowRight size={14} />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-card span-two">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Issue Table</p>
                  <h3>Export package detail</h3>
                </div>
                <Target size={18} />
              </div>
              <div className="table-list">
                {(reportSnapshot ?? workspace.reports).issue_table.map((row) => (
                  <div className="table-row-dashboard" key={row.issue}>
                    <strong>{row.issue}</strong>
                    <span>{row.count} calls</span>
                    <span>{row.top_outcome}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
      {editingStrategy && strategyEditForm ? (
        <div
          className="strategy-edit-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeStrategyEditor();
          }}
        >
          <section className="strategy-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="strategy-edit-title">
            <div className="strategy-edit-header">
              <div>
                <p className="section-kicker">Edit Action Plan</p>
                <h3 id="strategy-edit-title">Update strategy details</h3>
              </div>
              <button type="button" className="icon-button" onClick={closeStrategyEditor} disabled={syncing} aria-label="Close strategy editor">
                <X size={18} />
              </button>
            </div>

            <div className="strategy-edit-context">
              <div><span>Issue</span><strong>{editingStrategy.issue}</strong></div>
              <div><span>Status</span><strong>{editingStrategy.status}</strong></div>
              <div><span>Initiated</span><strong>{formatStrategyDate(editingStrategy.created_at)}</strong></div>
            </div>

            <form className="strategy-edit-form" onSubmit={(event) => void saveStrategyEdits(event)}>
              <label>
                <span>Strategy title</span>
                <input
                  className="dashboard-input"
                  value={strategyEditForm.title}
                  onChange={(event) => setStrategyEditForm((current) => current ? { ...current, title: event.target.value } : current)}
                  autoFocus
                  required
                />
              </label>
              <label>
                <span>Owner</span>
                <input
                  className="dashboard-input"
                  value={strategyEditForm.owner}
                  onChange={(event) => setStrategyEditForm((current) => current ? { ...current, owner: event.target.value } : current)}
                  required
                />
              </label>
              <label className="strategy-edit-wide">
                <span>Hypothesis</span>
                <textarea
                  className="dashboard-input dashboard-textarea"
                  value={strategyEditForm.hypothesis}
                  onChange={(event) => setStrategyEditForm((current) => current ? { ...current, hypothesis: event.target.value } : current)}
                  required
                />
              </label>
              <label className="strategy-edit-wide">
                <span>Notes <small>Optional</small></span>
                <textarea
                  className="dashboard-input dashboard-textarea"
                  value={strategyEditForm.notes}
                  onChange={(event) => setStrategyEditForm((current) => current ? { ...current, notes: event.target.value } : current)}
                />
              </label>
              <fieldset className="strategy-edit-wide strategy-edit-kpis">
                <legend>KPI focus</legend>
                <div className="kpi-grid">
                  {KPI_OPTIONS.map((kpi) => {
                    const active = strategyEditForm.kpi_focus.includes(kpi);
                    return (
                      <button
                        type="button"
                        className={`kpi-toggle ${active ? "active" : ""}`}
                        key={kpi}
                        aria-pressed={active}
                        onClick={() => setStrategyEditForm((current) => current ? {
                          ...current,
                          kpi_focus: active ? current.kpi_focus.filter((item) => item !== kpi) : [...current.kpi_focus, kpi],
                        } : current)}
                      >
                        {kpi}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <details className="strategy-edit-wide strategy-edit-evidence">
                <summary>
                  Evidence calls
                  <span>{strategyEditForm.evidence_call_ids.length} selected</span>
                </summary>
                <div className="strategy-evidence-options">
                  {dashboard.calls.map((call) => {
                    const selected = strategyEditForm.evidence_call_ids.includes(call.call_id);
                    return (
                      <label key={call.call_id}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => setStrategyEditForm((current) => current ? {
                            ...current,
                            evidence_call_ids: selected
                              ? current.evidence_call_ids.filter((callId) => callId !== call.call_id)
                              : [...current.evidence_call_ids, call.call_id],
                          } : current)}
                        />
                        <span>
                          <strong>{call.call_id}</strong>
                          <small>{call.issue} · {call.outcome}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </details>
              {error ? <p className="strategy-edit-error strategy-edit-wide" role="alert">{error}</p> : null}
              <div className="strategy-edit-footer strategy-edit-wide">
                <p>Issue, status, initiated date, and deadline are managed outside this editor.</p>
                <div>
                  <button type="button" className="ghost-button" onClick={closeStrategyEditor} disabled={syncing}>Cancel</button>
                  <button type="submit" className="primary-button" disabled={syncing}>{syncing ? "Saving…" : "Save changes"}</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function compactLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}…` : value;
}

function formatMetricValue(value: string | number) {
  return typeof value === "number" ? (Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3)) : value;
}

const tooltipStyle = {
  background: "var(--tooltip-bg)",
  border: "1px solid var(--tooltip-border)",
  borderRadius: "16px",
  color: "var(--tooltip-text)",
};

export default App;
