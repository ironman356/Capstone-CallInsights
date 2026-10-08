import { useMemo, useState } from "react";
import { ArrowRight, Bot, BrainCircuit, Compass, MessageSquareText, Search, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../api";
import type { PageKey } from "../navigation";
import type { AskCiChatAction, WorkspacePayload } from "../types";

interface AskCiPageProps {
  workspace: WorkspacePayload;
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  onOpenIssue: (issueSlug: string) => void;
  onOpenCall: (callId: string) => void;
}

type ChatRole = "assistant" | "user";

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  sources?: string[];
  actions?: AskCiChatAction[];
}

interface IntentRoute {
  title: string;
  description: string;
  prompt: string;
  tone: "teal" | "blue" | "amber" | "rose";
}

const PAGE_GUIDES: Record<PageKey, { title: string; summary: string; highlights: string[] }> = {
  results: {
    title: "Story Dashboard 1",
    summary: "Shows issues, their observed agent approaches, and statistics.",
    highlights: ["Issue list", "Approaches", "Statistics"],
  },
  "approach-matrix": {
    title: "Story Dashboard 2",
    summary: "Compares each observed agent approach across customer issues.",
    highlights: ["Approach × issue matrix", "FCR impact", "Call evidence"],
  },
  "approach-portfolio": {
    title: "Story Dashboard 3",
    summary: "Positions approaches by adoption, reliability, and modeled outcome impact.",
    highlights: ["Portfolio map", "Quadrant decisions", "Approach evidence"],
  },
  overview: {
    title: "Overview",
    summary: "Tracks KPIs, call drivers, outcomes, and service trends.",
    highlights: ["KPI hero", "Issue volume chart", "Outcome mix", "Sentiment lens"],
  },
  issues: {
    title: "Issues",
    summary: "Explores recurring customer problems and their supporting evidence.",
    highlights: ["Cluster list", "Evidence pack", "Outcome breakdown", "Representative calls"],
  },
  calls: {
    title: "Calls",
    summary: "Shows transcript drilldown, call structure, and resolution signals.",
    highlights: ["Call index", "Transcript stream", "Segments", "Behavior tags"],
  },
  strategies: {
    title: "Action Plans",
    summary: "Tracks improvement plans from proposal through closure.",
    highlights: ["Kanban board", "KPI focus", "Evidence-linked strategy cards"],
  },
  learning: {
    title: "Monitoring",
    summary: "Shows refresh status, controls, and operating checks.",
    highlights: ["Trend refresh", "Control checks", "Policy rules"],
  },
  "model-approaches": {
    title: "Model Approaches",
    summary: "Compares the methods used to identify issue topics and agent approaches.",
    highlights: ["Benchmark results", "Method comparison", "Evaluation notes"],
  },
  "ask-ci": {
    title: "Ask CI",
    summary: "Answers questions about the dashboard, the workflow, and the current workspace.",
    highlights: ["Guided prompts", "Evidence-backed answers", "Drilldown actions"],
  },
  "live-command": {
    title: "Live Incident Command",
    summary: "Combines executive briefing, change detection, evidence routing, guided Ask CI cards, and tablet AR field mode.",
    highlights: ["Meeting brief", "What changed", "Evidence-to-action", "AR issue constellation"],
  },
  field: {
    title: "Field Mode",
    summary: "Provides a phone-first issue field with camera-gated AR controls.",
    highlights: ["Issue field", "Priority zones", "Call timeline", "Snapshot comparison"],
  },
  governance: {
    title: "Governance",
    summary: "Maps the architecture and governed controls with the React Flow diagram.",
    highlights: ["React Flow architecture", "Controls", "Audit surfaces", "Policy context"],
  },
  "visual-lab": {
    title: "Visual Lab",
    summary: "Shows advanced dashboard treatments and visual concepts tied to the same data.",
    highlights: ["Concept boards", "Alternative narratives", "Design experiments"],
  },
  reports: {
    title: "Reports",
    summary: "Packages leadership highlights, totals, and issue-level export details.",
    highlights: ["Report totals", "Highlights", "Issue table", "Export package"],
  },
};

const STARTER_QUESTIONS = [
  "What is changing most in servicing performance right now?",
  "Where do I review issue evidence?",
  "Which issue is driving the most calls?",
  "How are action plans tracked?",
  "Show me where to inspect a representative call.",
  "What is shown in Governance?",
];

const INTENT_ROUTES: IntentRoute[] = [
  {
    title: "Find the right page",
    description: "Route managers to the correct workspace quickly.",
    prompt: "Which page should I use to review issue evidence?",
    tone: "teal",
  },
  {
    title: "Check system logic",
    description: "Explain how the system updates, refreshes, and stays controlled.",
    prompt: "How does the system update when new transcripts arrive?",
    tone: "blue",
  },
  {
    title: "Inspect live signals",
    description: "Summarize the top issue, outcomes, or current service trend.",
    prompt: "Which issue is driving the most calls right now?",
    tone: "amber",
  },
  {
    title: "Open a drilldown",
    description: "Jump directly into evidence, calls, governance, or reports.",
    prompt: "Show me where to inspect a representative call.",
    tone: "rose",
  },
];

export default function AskCiPage({ workspace, currentPage, onNavigate, onOpenIssue, onOpenCall }: AskCiPageProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => buildInitialMessages(workspace, currentPage));
  const [isSending, setIsSending] = useState(false);

  const topIssue = useMemo(() => workspace.dashboard.issues[0] ?? null, [workspace.dashboard.issues]);
  const topCall = useMemo(() => workspace.dashboard.calls[0] ?? null, [workspace.dashboard.calls]);
  const resolvedCount = workspace.dashboard.overview.outcome_counts.resolved ?? 0;
  const openStrategies = workspace.strategy_board.strategies.filter((item) => item.status !== "Closed").length;
  const activeAnswer = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant") ?? null,
    [messages],
  );

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: "user", text: trimmed };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsSending(true);
    try {
      const history = messages.slice(-6).map((message) => ({ role: message.role, text: message.text }));
      const response = await api.askCiChat({
        question: trimmed,
        current_page: currentPage,
        history,
      });
      const answer: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: response.answer,
        sources: response.sources,
        actions: response.actions,
      };
      setMessages((current) => [...current, answer]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: "Ask CI could not reach the copilot service right now. Refresh the workspace and try again.",
          sources: ["Service status"],
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="ask-ci-dashboard">
      <div className="ask-ci-topline">
        <div className="panel-card ask-ci-hero">
          <div className="ask-ci-hero-copy">
            <p className="section-kicker">Ask CI Assistant</p>
            <h3>Get answers about the dashboard, the workflow, and the latest service signals.</h3>
            <p>
              Use Ask CI to find the right page, understand a metric, review a call driver, or explain what the current workspace is showing.
            </p>
          </div>
          <div className="ask-ci-hero-badge">
            <Bot size={18} />
            <span>Guided answers with direct drilldowns</span>
          </div>
        </div>

        <div className="ask-ci-top-metrics">
          <article className="metric-card ask-ci-metric">
            <span>Current page</span>
            <strong>{PAGE_GUIDES[currentPage].title}</strong>
          </article>
          <article className="metric-card ask-ci-metric">
            <span>Top issue</span>
            <strong>{topIssue?.issue ?? "n/a"}</strong>
          </article>
          <article className="metric-card ask-ci-metric">
            <span>Resolved calls</span>
            <strong>{resolvedCount}</strong>
          </article>
          <article className="metric-card ask-ci-metric">
            <span>Open strategies</span>
            <strong>{openStrategies}</strong>
          </article>
        </div>
      </div>

      <div className="panel-card ask-ci-router">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Question Router</p>
            <h3>Start from the kind of answer you need</h3>
          </div>
          <Compass size={18} />
        </div>
        <div className="ask-ci-route-grid">
          {INTENT_ROUTES.map((route) => (
            <button key={route.title} type="button" className={`ask-ci-route-card tone-${route.tone}`} onClick={() => submitQuestion(route.prompt)}>
              <strong>{route.title}</strong>
              <p>{route.description}</p>
              <span>{route.prompt}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ask-ci-layout">
        <div className="panel-card ask-ci-main">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Conversation</p>
              <h3>Ask about pages, evidence, performance, or workflow</h3>
            </div>
            <BrainCircuit size={18} />
          </div>

          <div className="ask-ci-suggestions">
            {STARTER_QUESTIONS.map((question) => (
              <button key={question} type="button" className="prompt-chip" onClick={() => void submitQuestion(question)} disabled={isSending}>
                <Sparkles size={14} />
                <span>{question}</span>
              </button>
            ))}
          </div>

          <div className="chat-stream">
            {messages.map((message) => (
              <article key={message.id} className={`chat-bubble ${message.role}`}>
                <div className="chat-bubble-head">
                  <span>{message.role === "assistant" ? "Ask CI" : "You"}</span>
                </div>
                <p>{message.text}</p>
                {message.sources?.length ? (
                  <div className="chat-sources">
                    {message.sources.map((source) => (
                      <span className="data-tag muted" key={source}>{source}</span>
                    ))}
                  </div>
                ) : null}
                {message.actions?.length ? (
                  <div className="chat-actions">
                    {message.actions.map((action) => {
                      if (action.type === "page") {
                        return (
                          <button key={`${message.id}-${action.label}`} type="button" className="ghost-button small" onClick={() => onNavigate(action.target as PageKey)}>
                            <Compass size={14} />
                            {action.label}
                          </button>
                        );
                      }
                      if (action.type === "issue") {
                        return (
                          <button key={`${message.id}-${action.label}`} type="button" className="ghost-button small" onClick={() => onOpenIssue(action.target)}>
                            <Search size={14} />
                            {action.label}
                          </button>
                        );
                      }
                      return (
                        <button key={`${message.id}-${action.label}`} type="button" className="ghost-button small" onClick={() => onOpenCall(action.target)}>
                          <MessageSquareText size={14} />
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <form
            className="ask-ci-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void submitQuestion(draft);
            }}
          >
            <textarea
              className="dashboard-input ask-ci-input"
              placeholder="Ask what a page means, where to find supporting detail, or what the current signals show."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="primary-button" disabled={isSending}>{isSending ? "Thinking..." : "Ask CI"}</button>
          </form>
        </div>

        <div className="ask-ci-rail">
          <div className="panel-card ask-ci-sidecard">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Answer Brief</p>
                <h3>What Ask CI is saying now</h3>
              </div>
              <BrainCircuit size={18} />
            </div>
            <p>{activeAnswer?.text ?? "Ask a question to generate the current answer brief."}</p>
            {activeAnswer?.sources?.length ? (
              <div className="detail-tags">
                {activeAnswer.sources.map((source) => (
                  <span className="data-tag muted" key={source}>{source}</span>
                ))}
              </div>
            ) : null}
            {activeAnswer?.actions?.length ? (
              <div className="ask-ci-brief-actions">
                {activeAnswer.actions.map((action) => {
                  if (action.type === "page") {
                    return (
                      <button key={action.label} type="button" className="evidence-row" onClick={() => onNavigate(action.target as PageKey)}>
                        <strong>{action.label}</strong>
                        <span>Open destination page</span>
                      </button>
                    );
                  }
                  if (action.type === "issue") {
                    return (
                      <button key={action.label} type="button" className="evidence-row" onClick={() => onOpenIssue(action.target)}>
                        <strong>{action.label}</strong>
                        <span>Open issue evidence</span>
                      </button>
                    );
                  }
                  return (
                    <button key={action.label} type="button" className="evidence-row" onClick={() => onOpenCall(action.target)}>
                      <strong>{action.label}</strong>
                      <span>Open call drilldown</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="panel-card ask-ci-sidecard">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Current Page</p>
                <h3>{PAGE_GUIDES[currentPage].title}</h3>
              </div>
              <Compass size={18} />
            </div>
            <p>{PAGE_GUIDES[currentPage].summary}</p>
            <div className="policy-list">
              {PAGE_GUIDES[currentPage].highlights.map((item) => (
                <div className="policy-item" key={item}>
                  <ArrowRight size={14} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-card ask-ci-sidecard">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Evidence Lane</p>
                <h3>Best next drilldowns</h3>
              </div>
              <ShieldCheck size={18} />
            </div>
            {topIssue ? (
              <button type="button" className="evidence-row" onClick={() => onOpenIssue(topIssue.slug)}>
                <strong>Inspect top issue</strong>
                <span>{topIssue.issue}</span>
              </button>
            ) : null}
            {topCall ? (
              <button type="button" className="evidence-row" onClick={() => onOpenCall(topCall.call_id)}>
                <strong>Open representative call</strong>
                <span>{topCall.call_id}</span>
              </button>
            ) : null}
            <button type="button" className="evidence-row" onClick={() => onNavigate("governance")}>
              <strong>Review governance architecture</strong>
              <span>React Flow system map</span>
            </button>
            <button type="button" className="evidence-row" onClick={() => onNavigate("reports")}>
              <strong>Open management report</strong>
              <span>Totals, highlights, and export view</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildInitialMessages(workspace: WorkspacePayload, currentPage: PageKey): ChatMessage[] {
  const topIssue = workspace.dashboard.issues[0];
  const focus = PAGE_GUIDES[currentPage].title;
  return [
    {
      id: "assistant-intro",
      role: "assistant",
      text: `Ask CI is ready. You are currently on ${focus}, and I can answer questions about any page, governance, action plans, and the live workspace.`,
      sources: ["Page map", "Workspace state"],
      actions: [{ type: "page", label: "Open Governance", target: "governance" }],
    },
    topIssue
      ? {
          id: "assistant-focus",
          role: "assistant",
          text: `The highest-volume issue right now is ${topIssue.issue} with ${topIssue.count} calls. If you want the detail behind it, start in Issues and then drill into representative calls.`,
          sources: ["Issues"],
          actions: [{ type: "issue", label: "Open top issue evidence", target: topIssue.slug }],
        }
      : {
          id: "assistant-focus",
          role: "assistant",
          text: "The workspace is loaded. Ask about where to find something, what the current data is saying, or which page to use next.",
          sources: ["Workspace state"],
        },
  ];
}
