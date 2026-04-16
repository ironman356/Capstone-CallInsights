import type { ReactNode } from "react";
import { PAGES, type PageKey } from "../navigation";
import { formatValue } from "../utils";
import type { WorkspacePayload } from "../types";

interface AppFrameProps {
  page: PageKey;
  theme: "light" | "dark";
  syncing: boolean;
  message: string | null;
  error: string | null;
  workspace: WorkspacePayload;
  onNavigate: (page: PageKey) => void;
  onToggleTheme: () => void;
  onRefresh: () => void;
  onRerun: () => void;
  onRecalibrate: () => void;
  onExport: () => void;
  children: ReactNode;
}

export function AppFrame({
  page,
  theme,
  syncing,
  message,
  error,
  workspace,
  onNavigate,
  onToggleTheme,
  onRefresh,
  onRerun,
  onRecalibrate,
  onExport,
  children,
}: AppFrameProps) {
  const currentPage = PAGES.find((item) => item.key === page) ?? PAGES[0];

  return (
    <div className="app-shell app-shell-pages">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <aside className="side-nav panel">
        <div className="side-nav-top">
          <p className="eyebrow">Call Insights</p>
          <h1 className="side-nav-title">Operational intelligence with evidence at the center.</h1>
          <p className="side-nav-copy">
            Separate workspaces keep leadership review, issue analysis, call evidence, and strategy execution from
            collapsing into a single dense dashboard.
          </p>
        </div>

        <nav className="side-nav-links" aria-label="Primary pages">
          {PAGES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-link ${item.key === page ? "active" : ""}`}
              onClick={() => onNavigate(item.key)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </nav>

        <div className="side-nav-actions">
          <div className="mode-switch">
            <span>Theme</span>
            <button type="button" onClick={onToggleTheme}>
              {theme === "dark" ? "Switch to light" : "Switch to dark"}
            </button>
          </div>
          <button type="button" onClick={onRefresh} disabled={syncing}>
            Refresh workspace
          </button>
          <button type="button" onClick={onRerun} disabled={syncing}>
            Re-run pipeline
          </button>
          <button type="button" onClick={onRecalibrate} disabled={syncing}>
            Run recalibration
          </button>
          <button type="button" onClick={onExport} disabled={syncing}>
            Export report
          </button>
        </div>
      </aside>

      <main className="page-shell">
        <header className="page-hero panel">
          <div className="page-hero-main">
            <p className="eyebrow">{currentPage.label}</p>
            <h2>{currentPage.description}</h2>
            <p className="page-hero-copy">
              The interface is intentionally split into dedicated pages so each task can stay focused, readable,
              and operationally useful.
            </p>
          </div>
          <div className="page-metrics">
            {workspace.dashboard.overview.metrics.map((metric) => (
              <article className={`signal-card tone-${metric.tone}`} key={metric.label}>
                <span>{metric.label}</span>
                <strong>{formatValue(metric.value)}</strong>
              </article>
            ))}
          </div>
        </header>

        {message ? <div className="banner success">{message}</div> : null}
        {error ? <div className="banner error">{error}</div> : null}

        {children}
      </main>
    </div>
  );
}
