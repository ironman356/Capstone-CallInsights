import type { FormEvent } from "react";
import type { StrategyCreateInput, StrategyRecord, WorkspacePayload } from "../types";
import { titleCase } from "../utils";

const STRATEGY_STAGES = ["Proposed", "Accepted", "In Progress", "Evaluating", "Closed"];

interface StrategiesPageProps {
  workspace: WorkspacePayload;
  formState: StrategyCreateInput;
  syncing: boolean;
  onFormStateChange: (updater: (current: StrategyCreateInput) => StrategyCreateInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onMoveStrategy: (strategy: StrategyRecord, direction: -1 | 1) => void;
  onOpenCall: (callId: string) => void;
}

export function StrategiesPage({
  workspace,
  formState,
  syncing,
  onFormStateChange,
  onSubmit,
  onMoveStrategy,
  onOpenCall,
}: StrategiesPageProps) {
  return (
    <section className="layout-grid">
      <article className="panel">
        <div className="section-heading">
          <h2>Create strategy</h2>
          <p>New interventions start from issue evidence and move through a governed lifecycle.</p>
        </div>
        <form className="form-grid" onSubmit={onSubmit}>
          <select
            className="input"
            value={formState.issue_slug}
            onChange={(event) => onFormStateChange((current) => ({ ...current, issue_slug: event.target.value }))}
          >
            {workspace.dashboard.issues.map((issue) => (
              <option key={issue.slug} value={issue.slug}>
                {titleCase(issue.issue)}
              </option>
            ))}
          </select>
          <input
            className="input"
            value={formState.title}
            onChange={(event) => onFormStateChange((current) => ({ ...current, title: event.target.value }))}
            placeholder="Strategy title"
          />
          <input
            className="input"
            value={formState.owner}
            onChange={(event) => onFormStateChange((current) => ({ ...current, owner: event.target.value }))}
            placeholder="Owner"
          />
          <textarea
            className="input textarea"
            value={formState.hypothesis}
            onChange={(event) => onFormStateChange((current) => ({ ...current, hypothesis: event.target.value }))}
            placeholder="Hypothesis"
          />
          <textarea
            className="input textarea"
            value={formState.notes}
            onChange={(event) => onFormStateChange((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Operational notes"
          />
          <button className="primary-button full-width" type="submit" disabled={syncing}>
            Create strategy
          </button>
        </form>
      </article>

      <article className="panel span-2">
        <div className="section-heading">
          <h2>Strategy lifecycle</h2>
          <p>The board is intentionally isolated on its own page so execution work stays readable.</p>
        </div>
        <div className="kanban-grid">
          {STRATEGY_STAGES.map((stage) => (
            <div className="kanban-column" key={stage}>
              <div className="kanban-header">
                <h3>{stage}</h3>
                <span>{workspace.strategy_board.strategies.filter((item) => item.status === stage).length}</span>
              </div>
              <div className="kanban-stack">
                {workspace.strategy_board.strategies
                  .filter((strategy) => strategy.status === stage)
                  .map((strategy) => (
                    <article className="kanban-card" key={strategy.strategy_id}>
                      <h4>{strategy.title}</h4>
                      <p>{strategy.hypothesis}</p>
                      <div className="tag-row">
                        <span className="tag">{strategy.owner}</span>
                        {strategy.evidence_call_ids.slice(0, 2).map((callId) => (
                          <button className="tag action-tag" key={callId} type="button" onClick={() => onOpenCall(callId)}>
                            {callId}
                          </button>
                        ))}
                      </div>
                      <div className="action-row">
                        <button type="button" onClick={() => onMoveStrategy(strategy, -1)} disabled={syncing}>
                          Back
                        </button>
                        <button type="button" onClick={() => onMoveStrategy(strategy, 1)} disabled={syncing}>
                          Advance
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
