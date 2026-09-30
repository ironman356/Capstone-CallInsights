import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Camera,
  Compass,
  Crosshair,
  LoaderCircle,
  Radar,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Workflow,
} from "lucide-react";
import { api } from "../api";
import type { PageKey } from "../navigation";
import type { AskCiChatAction, CallCard, DashboardIssue, RepresentativeCall, StrategyRecord, WorkspacePayload } from "../types";
import { titleCase } from "../utils";

interface LiveIncidentCommandPageProps {
  workspace: WorkspacePayload;
  onNavigate: (page: PageKey) => void;
  onOpenIssue: (issueSlug: string) => void;
  onOpenCall: (callId: string) => void;
}

interface GuidedCard {
  question: string;
  whatHappened: string;
  whyItMatters: string;
  proof: string[];
  nextAction: string;
  actions: AskCiChatAction[];
}

const GUIDED_PROMPTS = [
  "Prepare me for the servicing leadership meeting.",
  "What changed since the last review?",
  "Which issue needs action right now?",
  "Show me the best evidence behind the top issue.",
];

const CONSTELLATION_POSITIONS = [
  { x: 18, y: 22 },
  { x: 50, y: 12 },
  { x: 80, y: 24 },
  { x: 28, y: 62 },
  { x: 66, y: 60 },
];

export default function LiveIncidentCommandPage({
  workspace,
  onNavigate,
  onOpenIssue,
  onOpenCall,
}: LiveIncidentCommandPageProps) {
  const topIssue = workspace.dashboard.issues[0] ?? null;
  const [selectedIssueSlug, setSelectedIssueSlug] = useState(topIssue?.slug ?? "");
  const [briefGeneratedAt, setBriefGeneratedAt] = useState<string | null>(null);
  const [guidedCard, setGuidedCard] = useState<GuidedCard | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [arMode, setArMode] = useState(false);
  const [isHandheldArReady, setIsHandheldArReady] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedArIssueSlug, setSelectedArIssueSlug] = useState(topIssue?.slug ?? "");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const issues = workspace.dashboard.issues.slice(0, 5);
  const selectedIssue = useMemo(
    () => workspace.dashboard.issues.find((issue) => issue.slug === selectedIssueSlug) ?? topIssue,
    [selectedIssueSlug, topIssue, workspace.dashboard.issues],
  );
  const selectedArIssue = useMemo(
    () => workspace.dashboard.issues.find((issue) => issue.slug === selectedArIssueSlug) ?? selectedIssue ?? topIssue,
    [selectedArIssueSlug, selectedIssue, topIssue, workspace.dashboard.issues],
  );

  const executiveBrief = useMemo(() => buildExecutiveBrief(workspace), [workspace]);
  const changeFeed = useMemo(() => buildChangeFeed(workspace), [workspace]);
  const strategyDraft = useMemo(
    () => (selectedIssue ? buildStrategyDraft(workspace.strategy_board.strategies, selectedIssue) : null),
    [selectedIssue, workspace.strategy_board.strategies],
  );
  const selectedEvidenceCall = selectedIssue?.representative_calls[0] ?? workspace.dashboard.calls[0] ?? null;
  const arJourneyCall = useMemo(
    () => findCallById(workspace.dashboard.calls, selectedArIssue?.representative_calls[0]?.call_id) ?? selectedEvidenceCall,
    [selectedArIssue, selectedEvidenceCall, workspace.dashboard.calls],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const updateHandheldMode = () => {
      setIsHandheldArReady(mediaQuery.matches || window.innerWidth <= 1180);
    };

    updateHandheldMode();
    mediaQuery.addEventListener("change", updateHandheldMode);
    window.addEventListener("resize", updateHandheldMode);

    return () => {
      mediaQuery.removeEventListener("change", updateHandheldMode);
      window.removeEventListener("resize", updateHandheldMode);
    };
  }, []);

  useEffect(() => {
    if (!selectedIssueSlug && topIssue?.slug) {
      setSelectedIssueSlug(topIssue.slug);
    }
    if (!selectedArIssueSlug && topIssue?.slug) {
      setSelectedArIssueSlug(topIssue.slug);
    }
  }, [selectedArIssueSlug, selectedIssueSlug, topIssue]);

  useEffect(() => {
    if (!isHandheldArReady && arMode) {
      setArMode(false);
      setCameraEnabled(false);
      stopCamera(streamRef);
    }
  }, [arMode, isHandheldArReady]);

  useEffect(() => {
    if (!cameraEnabled || !videoRef.current) {
      return;
    }
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current!.srcObject = stream;
        await videoRef.current!.play().catch(() => undefined);
        setCameraError(null);
      } catch {
        setCameraEnabled(false);
        setCameraError("Camera access is blocked or unavailable. The AR scene will stay in ambient tabletop mode.");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
    };
  }, [cameraEnabled]);

  useEffect(() => {
    return () => {
      stopCamera(streamRef);
    };
  }, []);

  async function runGuidedPrompt(question: string) {
    setIsAsking(true);
    try {
      const response = await api.askCiChat({
        question,
        current_page: "live-command",
        history: guidedCard ? [{ role: "assistant", text: guidedCard.whatHappened }] : [],
      });
      const linkedIssue =
        findIssueFromActions(response.actions, workspace.dashboard.issues) ??
        findIssueFromQuestion(workspace.dashboard.issues, question) ??
        selectedIssue ??
        topIssue;
      setGuidedCard(buildGuidedCard(question, response.answer, response.actions, linkedIssue));
    } catch {
      const fallbackIssue = selectedIssue ?? topIssue;
      if (!fallbackIssue) {
        return;
      }
      setGuidedCard({
        question,
        whatHappened: `Ask CI is unavailable, so Live Incident Command is falling back to the current workspace state for ${fallbackIssue.issue}.`,
        whyItMatters: `${fallbackIssue.count} calls are attached to this issue, which keeps it material for leadership review and operations follow-up.`,
        proof: [
          `${fallbackIssue.count} calls currently map to ${fallbackIssue.issue}.`,
          `Top behaviors: ${fallbackIssue.top_behaviors.slice(0, 3).map((item) => item.behavior ?? item.label ?? "signal").join(", ")}.`,
        ],
        nextAction: strategyDraft
          ? `Use ${strategyDraft.title} as the operating recommendation and carry it into Action Plans.`
          : "Open the issue evidence and create a strategy from the draft shown below.",
        actions: fallbackIssue.representative_calls[0]
          ? [
              { type: "issue", label: "Open issue evidence", target: fallbackIssue.slug },
              { type: "call", label: "Open representative call", target: fallbackIssue.representative_calls[0].call_id },
            ]
          : [{ type: "issue", label: "Open issue evidence", target: fallbackIssue.slug }],
      });
    } finally {
      setIsAsking(false);
    }
  }

  function handleToggleCamera() {
    if (cameraEnabled) {
      setCameraEnabled(false);
      stopCamera(streamRef);
      return;
    }
    setCameraEnabled(true);
  }

  return (
    <section className="incident-command-page">
      <div className="incident-command-hero panel-card">
        <div className="incident-command-hero-copy">
          <p className="section-kicker">Live Incident Command</p>
          <h3>Run the leadership demo like an operations war room instead of a dashboard tour.</h3>
          <p>
            This page compresses the meeting brief, change detection, evidence-to-action routing, structured Ask CI
            answers, and a tablet AR field mode into one command surface.
          </p>
          <div className="incident-command-pills">
            <span className="brief-pill"><Sparkles size={14} /> 3 risks, 2 trends, 1 action</span>
            <span className="brief-pill"><Workflow size={14} /> Evidence to strategy routing</span>
            <span className="brief-pill"><Radar size={14} /> Tablet AR issue constellation</span>
          </div>
        </div>
        <div className="incident-command-hero-actions">
          <button type="button" className="primary-button" onClick={() => setBriefGeneratedAt(new Date().toISOString())}>
            <Sparkles size={16} />
            Prepare me for the meeting
          </button>
          <button type="button" className="ghost-button" onClick={() => void runGuidedPrompt("Prepare me for the servicing leadership meeting.")}>
            <Bot size={16} />
            Generate guided answer
          </button>
            <button type="button" className="ghost-button" onClick={() => setArMode((current) => !current)}>
              <Crosshair size={16} />
              {isHandheldArReady ? (arMode ? "Hide AR field mode" : "Launch AR field mode") : "AR field mode is mobile only"}
            </button>
            <button type="button" className="ghost-button" onClick={() => onNavigate("field")}>
              <Camera size={16} />
              Open phone field mode
            </button>
          <div className="incident-command-status">
            <span>Brief last generated</span>
            <strong>{briefGeneratedAt ? new Date(briefGeneratedAt).toLocaleTimeString() : "Not yet generated"}</strong>
          </div>
        </div>
      </div>

      <div className="incident-command-grid">
        <article className="panel-card incident-brief-card">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Executive Brief Generator</p>
              <h3>3 risks, 2 trends, 1 action recommendation</h3>
            </div>
            <Sparkles size={18} />
          </div>
          <div className="incident-brief-layout">
            <div className="incident-brief-column">
              <span className="incident-brief-label">Risks</span>
              {executiveBrief.risks.map((item) => (
                <div key={item.title} className={`incident-brief-item tone-${item.tone}`}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="incident-brief-column">
              <span className="incident-brief-label">Trends</span>
              {executiveBrief.trends.map((item) => (
                <div key={item.title} className="incident-brief-item tone-info">
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="incident-brief-column">
              <span className="incident-brief-label">Recommendation</span>
              <div className="incident-brief-recommendation">
                <strong>{executiveBrief.recommendation.title}</strong>
                <p>{executiveBrief.recommendation.detail}</p>
                <div className="detail-tags">
                  {executiveBrief.recommendation.evidence.map((item) => (
                    <span className="data-tag" key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="panel-card incident-change-card">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">What Changed Since Last Review</p>
              <h3>New clusters, worsening sentiment, and stuck work</h3>
            </div>
            <TrendingDown size={18} />
          </div>
          <div className="incident-change-feed">
            {changeFeed.map((item) => (
              <div className={`incident-change-item tone-${item.tone}`} key={item.title}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card incident-evidence-card">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Evidence-to-Action Mode</p>
              <h3>Click an issue and turn evidence into a strategy draft</h3>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="incident-issue-switcher">
            {issues.map((issue) => (
              <button
                key={issue.slug}
                type="button"
                className={`incident-issue-pill ${selectedIssue?.slug === issue.slug ? "active" : ""}`}
                onClick={() => setSelectedIssueSlug(issue.slug)}
              >
                <strong>{titleCase(issue.issue)}</strong>
                <span>{issue.count} calls</span>
              </button>
            ))}
          </div>
          {selectedIssue ? (
            <div className="incident-evidence-layout">
              <div className="incident-evidence-column">
                <div className="incident-evidence-callout">
                  <strong>{titleCase(selectedIssue.issue)}</strong>
                  <p>{selectedIssue.summary}</p>
                </div>
                <div className="incident-evidence-subpanel">
                  <h4>Representative calls</h4>
                  {selectedIssue.representative_calls.slice(0, 3).map((call) => (
                    <button key={call.call_id} type="button" className="evidence-row" onClick={() => onOpenCall(call.call_id)}>
                      <strong>{call.call_id}</strong>
                      <span>{call.summary}</span>
                    </button>
                  ))}
                </div>
                <div className="incident-evidence-subpanel">
                  <h4>Behavior pattern</h4>
                  <div className="detail-tags">
                    {selectedIssue.top_behaviors.slice(0, 5).map((behavior, index) => (
                      <span className="data-tag muted" key={`${behavior.behavior ?? behavior.label ?? index}`}>
                        {behavior.behavior ?? behavior.label ?? "Signal"} x {behavior.count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="incident-evidence-column">
                {strategyDraft ? (
                  <div className="incident-strategy-draft">
                    <span className="incident-brief-label">Recommended strategy draft</span>
                    <strong>{strategyDraft.title}</strong>
                    <p>{strategyDraft.hypothesis}</p>
                    <div className="detail-tags">
                      {strategyDraft.kpi_focus.map((kpi) => (
                        <span className="data-tag" key={kpi}>{kpi}</span>
                      ))}
                    </div>
                    <div className="incident-draft-meta">
                      <div>
                        <span>Owner</span>
                        <strong>{strategyDraft.owner}</strong>
                      </div>
                      <div>
                        <span>Status</span>
                        <strong>{strategyDraft.status}</strong>
                      </div>
                    </div>
                    <button type="button" className="primary-button" onClick={() => onNavigate("strategies")}>
                      <Workflow size={16} />
                      Open action board
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="empty-state">No issue selected.</p>
          )}
        </article>

        <article className="panel-card incident-guided-card">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Ask CI Guided Answers</p>
              <h3>Structured answer cards instead of loose chat text</h3>
            </div>
            <Bot size={18} />
          </div>
          <div className="incident-guided-prompts">
            {GUIDED_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" className="prompt-chip" onClick={() => void runGuidedPrompt(prompt)} disabled={isAsking}>
                <Sparkles size={14} />
                <span>{prompt}</span>
              </button>
            ))}
          </div>
          <div className="incident-guided-shell">
            {isAsking ? (
              <div className="incident-guided-loading">
                <LoaderCircle size={18} className="incident-spin" />
                <span>Ask CI is preparing the command answer.</span>
              </div>
            ) : guidedCard ? (
              <div className="incident-guided-layout">
                <div className="incident-guided-block">
                  <span>What happened</span>
                  <p>{guidedCard.whatHappened}</p>
                </div>
                <div className="incident-guided-block">
                  <span>Why it matters</span>
                  <p>{guidedCard.whyItMatters}</p>
                </div>
                <div className="incident-guided-block">
                  <span>Proof</span>
                  <div className="policy-list">
                    {guidedCard.proof.map((item) => (
                      <div className="policy-item" key={item}>
                        <ArrowRight size={14} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="incident-guided-block">
                  <span>Next action</span>
                  <p>{guidedCard.nextAction}</p>
                  <div className="chat-actions">
                    {guidedCard.actions.map((action) => (
                      <GuidedActionButton
                        key={`${action.type}-${action.label}-${action.target}`}
                        action={action}
                        onNavigate={onNavigate}
                        onOpenIssue={onOpenIssue}
                        onOpenCall={onOpenCall}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="empty-state">Use a guided prompt to generate a structured incident answer.</p>
            )}
          </div>
        </article>
      </div>

      <article className="panel-card incident-ar-panel">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">AR Field Mode</p>
            <h3>Tablet-friendly issue constellation and call journey replay</h3>
          </div>
          <Radar size={18} />
        </div>
        {isHandheldArReady ? (
          <>
            <div className="incident-ar-toolbar">
              <button type="button" className="primary-button" onClick={() => setArMode((current) => !current)}>
                <Crosshair size={16} />
                {arMode ? "Hide field mode" : "Show field mode"}
              </button>
              <button type="button" className="ghost-button" onClick={() => onNavigate("field")}>
                <Camera size={16} />
                Open standalone field mode
              </button>
              <button type="button" className="ghost-button" onClick={handleToggleCamera} disabled={!arMode}>
                <Camera size={16} />
                {cameraEnabled ? "Disable camera" : "Enable rear camera"}
              </button>
              <button type="button" className="ghost-button" onClick={() => onNavigate("governance")}>
                <Compass size={16} />
                Open governance map
              </button>
            </div>
            {cameraError ? <div className="flash-banner error">{cameraError}</div> : null}

            <AnimatePresence initial={false}>
              {arMode ? (
                <motion.div
                  className="incident-ar-stage"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  transition={{ duration: 0.24 }}
                >
                  <div className="incident-ar-canvas">
                    {cameraEnabled ? <video ref={videoRef} className="incident-ar-video" muted playsInline /> : null}
                    <div className="incident-ar-overlay" />
                    <div className="incident-ar-guidance">
                      <strong>Point your tablet or phone at a table or wall.</strong>
                      <span>Tap a floating issue cluster to inspect evidence and the recommended action path.</span>
                    </div>
                    {issues.map((issue, index) => {
                      const position = CONSTELLATION_POSITIONS[index] ?? CONSTELLATION_POSITIONS[CONSTELLATION_POSITIONS.length - 1];
                      const size = 84 + Math.min(issue.count * 3, 96);
                      const toneClass = issue.average_shift < 0 ? "risk" : issue.average_shift > 0.08 ? "stable" : "warning";
                      return (
                        <motion.button
                          key={issue.slug}
                          type="button"
                          className={`incident-ar-node tone-${toneClass} ${selectedArIssue?.slug === issue.slug ? "active" : ""}`}
                          style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${size}px`, height: `${size}px` }}
                          animate={{ y: [0, -10, 0], rotateZ: [0, 1.2, -1.2, 0] }}
                          transition={{ duration: 6 + index, repeat: Infinity, ease: "easeInOut" }}
                          onClick={() => setSelectedArIssueSlug(issue.slug)}
                        >
                          <strong>{compactIssueTitle(issue.issue)}</strong>
                          <span>{issue.count}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="incident-ar-sidepanel">
                    <div className="incident-ar-card">
                      <span className="incident-brief-label">Issue constellation</span>
                      <strong>{selectedArIssue ? titleCase(selectedArIssue.issue) : "No issue selected"}</strong>
                      <p>{selectedArIssue?.summary ?? "Select an issue node to inspect the cluster."}</p>
                      <div className="detail-tags">
                        <span className="data-tag">{selectedArIssue?.count ?? 0} calls</span>
                        <span className="data-tag muted">
                          {selectedArIssue ? `${selectedArIssue.average_shift >= 0 ? "Sentiment improving" : "Sentiment under pressure"} ${selectedArIssue.average_shift.toFixed(2)}` : "No sentiment"}
                        </span>
                      </div>
                      <button type="button" className="ghost-button small" onClick={() => selectedArIssue && onOpenIssue(selectedArIssue.slug)}>
                        Open issue evidence
                      </button>
                    </div>

                    <div className="incident-ar-card">
                      <span className="incident-brief-label">Call journey replay</span>
                      <strong>{arJourneyCall?.call_id ?? "No call selected"}</strong>
                      <p>{arJourneyCall?.summary ?? "Select a cluster to load a representative call journey."}</p>
                      <div className="incident-journey-bars">
                        {buildJourneyBars(arJourneyCall).map((bar) => (
                          <div className="incident-journey-bar" key={bar.label}>
                            <div className="incident-journey-bar-head">
                              <span>{bar.label}</span>
                              <strong>{bar.value.toFixed(2)}</strong>
                            </div>
                            <div className="incident-journey-track">
                              <div className="incident-journey-fill" style={{ width: `${bar.width}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="detail-tags">
                        <span className={`data-tag ${estimateEscalationRisk(arJourneyCall).tone === "risk" ? "" : "muted"}`}>
                          {estimateEscalationRisk(arJourneyCall).label}
                        </span>
                      </div>
                      {arJourneyCall ? (
                        <button type="button" className="ghost-button small" onClick={() => onOpenCall(arJourneyCall.call_id)}>
                          Open call drilldown
                        </button>
                      ) : null}
                    </div>

                    <div className="incident-ar-card">
                      <span className="incident-brief-label">Recommended action</span>
                      <strong>{strategyDraft?.title ?? "No draft available"}</strong>
                      <p>{strategyDraft?.hypothesis ?? "Select an issue to generate a strategy recommendation."}</p>
                      <div className="detail-tags">
                        {strategyDraft?.kpi_focus.map((kpi) => (
                          <span className="data-tag muted" key={kpi}>{kpi}</span>
                        ))}
                      </div>
                      <button type="button" className="primary-button" onClick={() => onNavigate("strategies")}>
                        <Workflow size={16} />
                        Route to action board
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        ) : (
          <div className="incident-ar-desktop-note">
            <strong>AR field mode is reserved for phone and tablet.</strong>
            <p>
              This mode is intended to launch on a handheld device where you point the screen at a table or wall and inspect
              live issue clusters, call journey replay, and the action recommendation.
            </p>
          </div>
        )}
      </article>
    </section>
  );
}

function GuidedActionButton({
  action,
  onNavigate,
  onOpenIssue,
  onOpenCall,
}: {
  action: AskCiChatAction;
  onNavigate: (page: PageKey) => void;
  onOpenIssue: (issueSlug: string) => void;
  onOpenCall: (callId: string) => void;
}) {
  if (action.type === "page") {
    return (
      <button type="button" className="ghost-button small" onClick={() => onNavigate(action.target as PageKey)}>
        <Compass size={14} />
        {action.label}
      </button>
    );
  }
  if (action.type === "issue") {
    return (
      <button type="button" className="ghost-button small" onClick={() => onOpenIssue(action.target)}>
        <ShieldCheck size={14} />
        {action.label}
      </button>
    );
  }
  return (
    <button type="button" className="ghost-button small" onClick={() => onOpenCall(action.target)}>
      <ArrowRight size={14} />
      {action.label}
    </button>
  );
}

function findWorseningIssue(issues: DashboardIssue[]) {
  return issues
    .filter((issue) => issue.average_shift < 0)
    .sort((left, right) => left.average_shift - right.average_shift)[0];
}

function buildExecutiveBrief(workspace: WorkspacePayload) {
  const issues = workspace.dashboard.issues;
  const topIssue = issues[0];
  const worseningIssue = findWorseningIssue(issues);
  const openStrategies = workspace.strategy_board.strategies.filter((item) => item.status !== "Closed");
  const stuckStrategies = openStrategies.filter((item) => item.status === "In Progress");
  const topPattern = workspace.dashboard.overview.top_patterns[0];

  return {
    risks: [
      {
        title: `${titleCase(topIssue?.issue ?? "Top issue")} is carrying the highest volume`,
        detail: topIssue
          ? `${topIssue.count} calls are attached to this issue, making it the primary source of current service pressure.`
          : "No dominant issue loaded.",
        tone: "risk",
      },
      {
        title: worseningIssue ? `${titleCase(worseningIssue.issue)} is moving the wrong way` : "No worsening sentiment detected",
        detail: worseningIssue
          ? `Average sentiment shift is ${worseningIssue.average_shift.toFixed(2)}, which signals worsening customer experience inside this cluster.`
          : "No worsening issue detected.",
        tone: worseningIssue ? "warning" : "stable",
      },
      {
        title: `${stuckStrategies.length} strategies are still in progress`,
        detail:
          stuckStrategies.length > 0
            ? "Interventions are active but not yet closed, which creates execution drag going into the meeting."
            : "No strategies are currently stuck in progress.",
        tone: "info",
      },
    ],
    trends: [
      {
        title: "Adaptive issue memory is still changing",
        detail: `${workspace.recalibration.new_clusters_detected} new clusters were detected in the last refresh window.`,
      },
      {
        title: "One response pattern is outperforming others",
        detail: topPattern
          ? `${titleCase(topPattern.behavior)} is linked to ${titleCase(topPattern.outcome)} across ${topPattern.count} calls with lift ${topPattern.lift.toFixed(2)}.`
          : "No dominant response pattern is loaded.",
      },
    ],
    recommendation: {
      title: strategyRecommendationTitle(topIssue),
      detail: topIssue
        ? `Focus the room on ${topIssue.issue}, use representative calls as evidence, and leave the meeting with an owner-backed plan tied to FCR and repeat-call reduction.`
        : "Refresh the workspace and rebuild the meeting brief.",
      evidence: topIssue
        ? [
            `${topIssue.count} calls`,
            topIssue.representative_calls[0]?.call_id ?? "No sample call",
            `${topIssue.top_behaviors[0]?.behavior ?? topIssue.top_behaviors[0]?.label ?? "Signal"} pattern`,
          ]
        : [],
    },
  };
}

function buildChangeFeed(workspace: WorkspacePayload) {
  const worseningIssue = findWorseningIssue(workspace.dashboard.issues);
  const stuckStrategies = workspace.strategy_board.strategies.filter((item) => item.status === "In Progress");
  const escalations = workspace.dashboard.overview.outcome_counts.escalated ?? workspace.dashboard.overview.outcome_counts.Escalated ?? 0;

  return [
    {
      title: "New issue clusters detected",
      detail: "Adaptive clustering found fresh themes since the last review window.",
      value: String(workspace.recalibration.new_clusters_detected),
      tone: workspace.recalibration.new_clusters_detected > 0 ? "warning" : "stable",
    },
    {
      title: worseningIssue ? "Worsening sentiment cluster" : "No worsening sentiment detected",
      detail: worseningIssue
        ? `${titleCase(worseningIssue.issue)} is showing the lowest average sentiment shift at ${worseningIssue.average_shift.toFixed(2)}.`
        : "No worsening cluster identified.",
      value: worseningIssue ? titleCase(worseningIssue.issue) : "none",
      tone: worseningIssue ? "risk" : "stable",
    },
    {
      title: "Strategies stuck in progress",
      detail: stuckStrategies.length
        ? "These action plans have moved beyond proposal but have not closed, which is ideal demo material for incident command."
        : "No active strategy bottleneck is visible.",
      value: String(stuckStrategies.length),
      tone: stuckStrategies.length ? "warning" : "stable",
    },
    {
      title: "Escalations requiring attention",
      detail: "Escalated outcomes are useful as leadership-ready proof when positioning the urgency of intervention.",
      value: String(escalations),
      tone: escalations > 0 ? "risk" : "stable",
    },
  ];
}

function buildStrategyDraft(strategies: StrategyRecord[], issue: DashboardIssue) {
  const existing = strategies.find((item) => item.issue_slug === issue.slug && item.status !== "Closed");
  if (existing) {
    return existing;
  }
  const leadBehavior = issue.top_behaviors[0]?.behavior ?? issue.top_behaviors[0]?.label ?? "response consistency";
  return {
    strategy_id: `draft-${issue.slug}`,
    title: `Stabilize ${titleCase(issue.issue)}`,
    issue_slug: issue.slug,
    issue: issue.issue,
    status: "Draft recommendation",
    owner: "Servicing Ops",
    hypothesis: `Use call evidence and targeted coaching around ${leadBehavior} to reduce repeat friction in ${issue.issue} and improve first-contact resolution.`,
    kpi_focus: ["FCR", "Repeat Calls", "Sentiment"],
    evidence_call_ids: issue.representative_calls.slice(0, 2).map((call) => call.call_id),
    notes: issue.summary,
    created_at: "",
    updated_at: "",
  };
}

function buildGuidedCard(
  question: string,
  answer: string,
  actions: AskCiChatAction[],
  linkedIssue: DashboardIssue | null,
): GuidedCard {
  const proof = linkedIssue
    ? [
        `${linkedIssue.count} calls currently map to ${linkedIssue.issue}.`,
        `Top behaviors: ${linkedIssue.top_behaviors.slice(0, 3).map((item) => item.behavior ?? item.label ?? "signal").join(", ")}.`,
        `Representative calls: ${linkedIssue.representative_calls.slice(0, 2).map((call) => call.call_id).join(", ") || "none loaded"}.`,
      ]
    : ["Ask CI returned an answer, but no linked issue could be resolved from the current workspace."];

  return {
    question,
    whatHappened: answer,
    whyItMatters: linkedIssue
      ? `${titleCase(linkedIssue.issue)} is one of the highest-pressure customer problems in the workspace, so it belongs in the leadership narrative and the action plan discussion.`
      : "This answer is useful because it routes the demo toward the most actionable workspace evidence.",
    proof,
    nextAction: linkedIssue
      ? `Open ${titleCase(linkedIssue.issue)} evidence, review a representative call, and carry the draft strategy into Action Plans.`
      : "Use the actions below to move from the answer into the supporting workspace detail.",
    actions,
  };
}

function strategyRecommendationTitle(issue: DashboardIssue | null) {
  return issue ? `Route ${titleCase(issue.issue)} into an owner-backed action plan` : "Route the top issue into an action plan";
}

function findIssueFromActions(actions: AskCiChatAction[], issues: DashboardIssue[]) {
  const issueAction = actions.find((action) => action.type === "issue");
  return issueAction ? issues.find((issue) => issue.slug === issueAction.target) ?? null : null;
}

function findIssueFromQuestion(issues: DashboardIssue[], question: string) {
  const normalizedQuestion = question.toLowerCase();
  return (
    issues.find((issue) => {
      const normalizedIssue = issue.issue.toLowerCase();
      return normalizedQuestion.includes(normalizedIssue) || normalizedIssue.split(" ").some((part) => part.length > 4 && normalizedQuestion.includes(part));
    }) ?? null
  );
}

function findCallById(calls: CallCard[], callId: string | undefined) {
  if (!callId) {
    return null;
  }
  return calls.find((call) => call.call_id === callId) ?? null;
}

function buildJourneyBars(call: CallCard | RepresentativeCall | null) {
  const opening = call?.sentiments.opening ?? 0;
  const mid = call?.sentiments.mid ?? opening;
  const closing = call?.sentiments.closing ?? opening;
  return [
    { label: "Opening", value: opening, width: normalizeSentiment(opening) },
    { label: "Mid call", value: mid, width: normalizeSentiment(mid) },
    { label: "Closing", value: closing, width: normalizeSentiment(closing) },
  ];
}

function normalizeSentiment(value: number) {
  return Math.max(8, Math.min(100, ((value + 1) / 2) * 100));
}

function estimateEscalationRisk(call: CallCard | RepresentativeCall | null) {
  if (!call) {
    return { label: "No call selected", tone: "warning" as const };
  }
  if ((call.outcome ?? "").toLowerCase().includes("escalat")) {
    return { label: "Escalation risk high", tone: "risk" as const };
  }
  if ((call.sentiments.closing ?? 0) < 0) {
    return { label: "Escalation risk elevated", tone: "warning" as const };
  }
  return { label: "Escalation risk contained", tone: "stable" as const };
}

function stopCamera(streamRef: React.MutableRefObject<MediaStream | null>) {
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}

function compactIssueTitle(issue: string) {
  return issue.length > 18 ? `${titleCase(issue).slice(0, 18)}...` : titleCase(issue);
}
