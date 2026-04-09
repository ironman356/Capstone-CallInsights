import { startTransition, useDeferredValue, useEffect, useEffectEvent, useMemo, useState } from "react";
import { api } from "./api";
import { AppFrame } from "./components/AppFrame";
import { pageFromPath, pathFromPage, type PageKey } from "./navigation";
import { DrilldownPage } from "./pages/DrilldownPage";
import { ExplorerPage } from "./pages/ExplorerPage";
import AdminAiGovernancePage from "./pages/AdminAiGovernancePage";
import { MonthlyPage } from "./pages/MonthlyPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PulsePage } from "./pages/PulsePage";
import { ReportsPage } from "./pages/ReportsPage";
import { StrategiesPage } from "./pages/StrategiesPage";
import type {
  CallDetail,
  DashboardIssue,
  IssueDetail,
  StrategyCreateInput,
  StrategyRecord,
  WorkspacePayload,
} from "./types";

type ThemeMode = "light" | "dark";

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem("ci-theme");
    return stored === "light" || stored === "dark" ? stored : "dark";
  });
  const [page, setPage] = useState<PageKey>(() => pageFromPath(window.location.pathname));
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [issueDetail, setIssueDetail] = useState<IssueDetail | null>(null);
  const [callDetail, setCallDetail] = useState<CallDetail | null>(null);
  const [selectedIssueSlug, setSelectedIssueSlug] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [issueQuery, setIssueQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [exportPayload, setExportPayload] = useState<WorkspacePayload["reports"] | null>(null);
  const [formState, setFormState] = useState<StrategyCreateInput>({
    issue_slug: "",
    title: "",
    owner: "Operations",
    hypothesis: "",
    notes: "",
    kpi_focus: ["AHT", "Escalation Rate"],
    evidence_call_ids: [],
  });

  const deferredQuery = useDeferredValue(issueQuery);
  const dashboard = workspace?.dashboard;

  const applyTheme = useEffectEvent((nextTheme: ThemeMode) => {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("ci-theme", nextTheme);
  });

  useEffect(() => {
    applyTheme(theme);
  }, [applyTheme, theme]);

  useEffect(() => {
    const onPopState = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const payload = await api.getWorkspace();
        if (cancelled) {
          return;
        }
        setWorkspace(payload);
        const firstIssue = payload.dashboard.issues[0]?.slug ?? null;
        const firstCall = payload.dashboard.calls[0]?.call_id ?? null;
        setSelectedIssueSlug((current) => current ?? firstIssue);
        setSelectedCallId((current) => current ?? firstCall);
        setFormState((current) => ({
          ...current,
          issue_slug: current.issue_slug || firstIssue || "",
        }));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load workspace");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedIssueSlug) {
      return;
    }
    void api.getIssue(selectedIssueSlug).then(setIssueDetail).catch(() => undefined);
  }, [selectedIssueSlug]);

  useEffect(() => {
    if (!selectedCallId) {
      return;
    }
    void api.getCall(selectedCallId).then(setCallDetail).catch(() => undefined);
  }, [selectedCallId]);

  const filteredIssues = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    const query = deferredQuery.toLowerCase().trim();
    return dashboard.issues.filter((issue) => {
      const matchesQuery =
        query.length === 0 ||
        issue.issue.toLowerCase().includes(query) ||
        issue.summary.toLowerCase().includes(query);
      const matchesOutcome =
        outcomeFilter === "all" || Object.keys(issue.outcome_breakdown).includes(outcomeFilter);
      return matchesQuery && matchesOutcome;
    });
  }, [dashboard, deferredQuery, outcomeFilter]);

  const selectedIssueCard = useMemo(() => {
    return dashboard?.issues.find((issue) => issue.slug === selectedIssueSlug) ?? null;
  }, [dashboard, selectedIssueSlug]);

  const selectedStrategyIssue = useMemo(() => {
    return dashboard?.issues.find((issue) => issue.slug === formState.issue_slug) ?? null;
  }, [dashboard, formState.issue_slug]);

  function navigate(nextPage: PageKey) {
    startTransition(() => {
      setPage(nextPage);
      window.history.pushState({}, "", pathFromPage(nextPage));
    });
  }

  async function refreshWorkspace(mode: "refresh" | "recalibrate" | "rerun" = "refresh") {
    setSyncing(true);
    setActionMessage(null);
    try {
      if (mode === "recalibrate") {
        const payload = await api.recalibrate();
        setWorkspace(payload);
        setActionMessage("Monthly recalibration completed and the workspace has been refreshed.");
      } else if (mode === "rerun") {
        await api.rerunPipeline();
        const payload = await api.getWorkspace();
        setWorkspace(payload);
        setActionMessage("The batch pipeline re-ran successfully and the UI is now showing fresh data.");
      } else {
        const payload = await api.getWorkspace();
        setWorkspace(payload);
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh workspace");
    } finally {
      setSyncing(false);
    }
  }

  function openIssue(issue: DashboardIssue) {
    startTransition(() => {
      setSelectedIssueSlug(issue.slug);
      setSelectedCallId(issue.representative_calls[0]?.call_id ?? selectedCallId);
      setFormState((current) => ({ ...current, issue_slug: issue.slug }));
      navigate("explorer");
    });
  }

  function openCall(callId: string) {
    startTransition(() => {
      setSelectedCallId(callId);
      navigate("drilldown");
    });
  }

  async function handleCreateStrategy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formState.issue_slug || !formState.title.trim() || !formState.hypothesis.trim()) {
      setActionMessage("A strategy needs an issue, title, and hypothesis before it can be created.");
      return;
    }

    setSyncing(true);
    setActionMessage(null);
    try {
      await api.createStrategy(formState);
      const board = await api.getStrategies();
      setWorkspace((current) => (current ? { ...current, strategy_board: board } : current));
      setActionMessage("Strategy created and added to the workflow board.");
      setFormState({
        issue_slug: formState.issue_slug,
        title: "",
        owner: formState.owner,
        hypothesis: "",
        notes: "",
        kpi_focus: formState.kpi_focus,
        evidence_call_ids: selectedStrategyIssue?.representative_calls.map((call) => call.call_id).slice(0, 2) ?? [],
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create strategy");
    } finally {
      setSyncing(false);
    }
  }

  async function moveStrategy(strategy: StrategyRecord, direction: -1 | 1) {
    const stages = ["Proposed", "Accepted", "In Progress", "Evaluating", "Closed"];
    const currentIndex = stages.indexOf(strategy.status);
    const nextStatus = stages[currentIndex + direction];
    if (!nextStatus) {
      return;
    }

    setSyncing(true);
    try {
      const updated = await api.updateStrategy(strategy.strategy_id, { status: nextStatus });
      setWorkspace((current) => {
        if (!current) {
          return current;
        }
        const strategies = current.strategy_board.strategies.map((item) =>
          item.strategy_id === updated.strategy_id ? updated : item,
        );
        return {
          ...current,
          strategy_board: {
            stages: stages.map((name) => ({
              name,
              count: strategies.filter((item) => item.status === name).length,
            })),
            strategies,
          },
        };
      });
      setActionMessage(`${strategy.title} moved to ${nextStatus}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update strategy");
    } finally {
      setSyncing(false);
    }
  }

  async function handleExportReport() {
    setSyncing(true);
    try {
      const payload = await api.exportReport();
      setExportPayload(payload.report);
      setActionMessage(`Export package generated at ${new Date(payload.generated_at).toLocaleString()}.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export report");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return <div className="status-screen">Loading the Call Insights workspace...</div>;
  }

  if (error && !workspace) {
    return (
      <div className="status-screen">
        <div className="status-card">
          <h1>Call Insights</h1>
          <p>The workspace could not be loaded.</p>
          <p>{error}</p>
          <p>Start the API from `apps/api` with `uvicorn app.main:app --reload`.</p>
        </div>
      </div>
    );
  }

  if (!workspace || !dashboard) {
    return null;
  }

  let pageNode = (
    <OverviewPage workspace={workspace} onOpenIssue={openIssue} onOpenCall={openCall} />
  );

  if (page === "pulse") {
    pageNode = (
      <PulsePage
        workspace={workspace}
        onOpenCall={openCall}
        onSeedStrategy={(updater) => setFormState((current) => updater(current))}
        onGoToStrategies={() => navigate("strategies")}
      />
    );
  } else if (page === "monthly") {
    pageNode = <MonthlyPage workspace={workspace} onOpenCall={openCall} />;
  } else if (page === "explorer") {
    pageNode = (
      <ExplorerPage
        issues={filteredIssues}
        selectedIssueSlug={selectedIssueSlug}
        selectedIssueCard={selectedIssueCard}
        issueDetail={issueDetail}
        issueQuery={issueQuery}
        outcomeFilter={outcomeFilter}
        onIssueQueryChange={setIssueQuery}
        onOutcomeFilterChange={setOutcomeFilter}
        onOpenIssue={openIssue}
        onOpenCall={openCall}
      />
    );
  } else if (page === "drilldown") {
    pageNode = (
      <DrilldownPage
        callDetail={callDetail}
        calls={workspace.dashboard.calls}
        selectedCallId={selectedCallId}
        onSelectCall={setSelectedCallId}
      />
    );
  } else if (page === "strategies") {
    pageNode = (
      <StrategiesPage
        workspace={workspace}
        formState={formState}
        syncing={syncing}
        onFormStateChange={(updater) => setFormState((current) => updater(current))}
        onSubmit={handleCreateStrategy}
        onMoveStrategy={(strategy, direction) => void moveStrategy(strategy, direction)}
        onOpenCall={openCall}
      />
    );
  } else if (page === "reports") {
    pageNode = (
      <ReportsPage
        workspace={workspace}
        exportPayload={exportPayload}
        syncing={syncing}
        onExport={() => void handleExportReport()}
      />
    );
  } else if (page === "governance") {
    pageNode = <AdminAiGovernancePage workspace={workspace} />;
  }

  return (
    <AppFrame
      page={page}
      theme={theme}
      syncing={syncing}
      message={actionMessage}
      error={error}
      workspace={workspace}
      onNavigate={navigate}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      onRefresh={() => void refreshWorkspace("refresh")}
      onRerun={() => void refreshWorkspace("rerun")}
      onRecalibrate={() => void refreshWorkspace("recalibrate")}
      onExport={() => void handleExportReport()}
    >
      {pageNode}
    </AppFrame>
  );
}

export default App;
