import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Camera, Compass, Filter, Play, Save, SlidersHorizontal, Target } from "lucide-react";
import type { CallCard, DashboardIssue, RepresentativeCall, WorkspacePayload } from "../types";
import type { PageKey } from "../navigation";
import { titleCase } from "../utils";

type PriorityZone = "watch" | "act-now" | "resolved";
type RiskBand = "low" | "medium" | "high";

interface FieldModePageProps {
  workspace: WorkspacePayload;
  onNavigate: (page: PageKey) => void;
  onOpenIssue: (issueSlug: string) => void;
  onOpenCall: (callId: string) => void;
}

interface FieldNode {
  slug: string;
  x: number;
  y: number;
  size: number;
  zone: PriorityZone;
}

interface FieldSnapshot {
  id: string;
  created_at: string;
  name: string;
  filters: FieldFilters;
  nodes: FieldNode[];
  preview_data_url: string | null;
}

interface FieldFilters {
  issueSlug: string;
  team: string;
  outcome: string;
  risk: string;
}

interface PlaybackFrame {
  label: string;
  value: number;
  width: number;
}

const FIELD_STORAGE_KEY = "ci-field-layout-snapshots";
const ZONES: Array<{ key: PriorityZone; label: string; hint: string }> = [
  { key: "watch", label: "Watch", hint: "Monitor but do not escalate yet" },
  { key: "act-now", label: "Act Now", hint: "Needs immediate operational response" },
  { key: "resolved", label: "Resolved", hint: "Stabilized enough to close" },
];
const DEFAULT_FILTERS: FieldFilters = { issueSlug: "all", team: "all", outcome: "all", risk: "all" };

export default function FieldModePage({ workspace, onNavigate, onOpenIssue, onOpenCall }: FieldModePageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<{ slug: string; pointerId: number; startX: number; startY: number; dragging: boolean } | null>(null);
  const pinchRef = useRef<{ distance: number; size: number } | null>(null);
  const zoneRefs = useRef<Record<PriorityZone, HTMLDivElement | null>>({
    watch: null,
    "act-now": null,
    resolved: null,
  });
  const playbackTimerRef = useRef<number | null>(null);
  const [isHandheld, setIsHandheld] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FieldFilters>(DEFAULT_FILTERS);
  const [nodes, setNodes] = useState<FieldNode[]>(() => buildInitialNodes(workspace.dashboard.issues));
  const [selectedIssueSlug, setSelectedIssueSlug] = useState(workspace.dashboard.issues[0]?.slug ?? "");
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [snapshots, setSnapshots] = useState<FieldSnapshot[]>(() => readSnapshots());
  const [compareSnapshotId, setCompareSnapshotId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const issues = workspace.dashboard.issues.slice(0, 6);
  const teamOptions = useMemo(() => ["all", ...new Set(issues.map((issue) => inferTeam(issue)))], [issues]);
  const outcomeOptions = useMemo(() => ["all", ...new Set(issues.map((issue) => dominantOutcome(issue)))], [issues]);
  const riskOptions = ["all", "high", "medium", "low"];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const update = () => setIsHandheld(mediaQuery.matches || window.innerWidth <= 900);
    update();
    mediaQuery.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mediaQuery.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    setNodes((current) => syncNodesWithIssues(current, workspace.dashboard.issues));
    if (!selectedIssueSlug && workspace.dashboard.issues[0]?.slug) {
      setSelectedIssueSlug(workspace.dashboard.issues[0].slug);
    }
  }, [selectedIssueSlug, workspace.dashboard.issues]);

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
        setCameraError("Camera access is blocked or unavailable on this device.");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
    };
  }, [cameraEnabled]);

  useEffect(() => () => stopCamera(streamRef), []);

  const filteredIssues = useMemo(
    () =>
      issues.filter((issue) => {
        const team = inferTeam(issue);
        const outcome = dominantOutcome(issue);
        const risk = riskBand(issue);
        return (
          (filters.issueSlug === "all" || filters.issueSlug === issue.slug) &&
          (filters.team === "all" || filters.team === team) &&
          (filters.outcome === "all" || filters.outcome === outcome) &&
          (filters.risk === "all" || filters.risk === risk)
        );
      }),
    [filters, issues],
  );

  const visibleNodes = useMemo(
    () => nodes.filter((node) => filteredIssues.some((issue) => issue.slug === node.slug)),
    [filteredIssues, nodes],
  );
  const selectedIssue =
    filteredIssues.find((issue) => issue.slug === selectedIssueSlug) ??
    issues.find((issue) => issue.slug === selectedIssueSlug) ??
    filteredIssues[0] ??
    issues[0] ??
    null;
  const selectedNode = selectedIssue ? nodes.find((node) => node.slug === selectedIssue.slug) ?? null : null;
  const selectedCall = selectedIssue ? findCallById(workspace.dashboard.calls, selectedIssue.representative_calls[0]?.call_id) : null;
  const frames = useMemo(() => buildPlaybackFrames(selectedCall ?? selectedIssue?.representative_calls[0] ?? null), [selectedCall, selectedIssue]);
  const compareSnapshot = snapshots.find((snapshot) => snapshot.id === compareSnapshotId) ?? null;
  const compareSummary = useMemo(
    () => (selectedIssue && compareSnapshot ? compareLayouts(selectedIssue.slug, nodes, compareSnapshot.nodes) : null),
    [compareSnapshot, nodes, selectedIssue],
  );

  useEffect(() => {
    if (!selectedIssue) {
      return;
    }
    setTimelineIndex(0);
    if (playbackTimerRef.current) {
      window.clearInterval(playbackTimerRef.current);
    }
    playbackTimerRef.current = window.setInterval(() => {
      setTimelineIndex((current) => (current + 1) % 3);
    }, 1600);
    return () => {
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
      }
    };
  }, [selectedIssue]);

  function handleEnableCamera() {
    setCameraEnabled(true);
  }

  function handlePointerDown(slug: string, event: React.PointerEvent<HTMLButtonElement>) {
    if (!cameraEnabled) {
      return;
    }
    dragRef.current = {
      slug,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedIssueSlug(slug);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId || !stageRef.current) {
      return;
    }
    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;
    const distance = Math.hypot(deltaX, deltaY);
    if (!dragRef.current.dragging && distance < 12) {
      return;
    }
    dragRef.current = { ...dragRef.current, dragging: true };
    const rect = stageRef.current.getBoundingClientRect();
    const nextX = clamp(((event.clientX - rect.left) / rect.width) * 100, 10, 90);
    const nextY = clamp(((event.clientY - rect.top) / rect.height) * 100, 14, 82);
    setNodes((current) => current.map((node) => (node.slug === dragRef.current!.slug ? { ...node, x: nextX, y: nextY } : node)));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }
    if (dragRef.current.dragging) {
      const zone = findDropZone(event.clientX, event.clientY, zoneRefs.current);
      if (zone) {
        setNodes((current) => current.map((node) => (node.slug === dragRef.current!.slug ? { ...node, zone } : node)));
      }
    }
    dragRef.current = null;
  }

  function handlePointerCancel() {
    dragRef.current = null;
  }

  function handleNodeTap(slug: string) {
    if (dragRef.current?.slug === slug && dragRef.current.dragging) {
      return;
    }
    setSelectedIssueSlug(slug);
    setTimelineIndex(0);
  }

  function handlePinchStart(event: React.TouchEvent<HTMLButtonElement>, slug: string) {
    if (event.touches.length !== 2) {
      pinchRef.current = null;
      return;
    }
    const node = nodes.find((item) => item.slug === slug);
    if (!node) {
      return;
    }
    pinchRef.current = { distance: touchDistance(event.touches), size: node.size };
  }

  function handlePinchMove(event: React.TouchEvent<HTMLButtonElement>, slug: string) {
    if (!pinchRef.current || event.touches.length !== 2) {
      return;
    }
    const nextDistance = touchDistance(event.touches);
    const delta = nextDistance - pinchRef.current.distance;
    const nextSize = clamp(pinchRef.current.size + delta * 0.22, 88, 196);
    setNodes((current) => current.map((node) => (node.slug === slug ? { ...node, size: nextSize } : node)));
  }

  function handleSaveSnapshot() {
    const name = `Review ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const previewDataUrl = captureStagePreview({
      stageElement: stageRef.current,
      videoElement: videoRef.current,
      nodes: visibleNodes,
      issues,
      selectedIssueSlug,
    });
    const nextSnapshot: FieldSnapshot = {
      id: `${Date.now()}`,
      created_at: new Date().toISOString(),
      name,
      filters,
      nodes,
      preview_data_url: previewDataUrl,
    };
    const nextSnapshots = [nextSnapshot, ...snapshots].slice(0, 8);
    setSnapshots(nextSnapshots);
    window.localStorage.setItem(FIELD_STORAGE_KEY, JSON.stringify(nextSnapshots));
    setCompareSnapshotId(nextSnapshot.id);
    setSaveMessage(`Saved ${name} into comparison history.`);
  }

  return (
    <div className="field-shell">
      <div className="field-topbar">
        <button type="button" className="ghost-button small" onClick={() => onNavigate("live-command")}>
          <ArrowLeft size={14} />
          Back to command room
        </button>
        <div className="field-topbar-actions">
          <button type="button" className="ghost-button small" onClick={() => setShowFilters((current) => !current)}>
            <Filter size={14} />
            Filters
          </button>
          <button type="button" className="ghost-button small" onClick={handleSaveSnapshot} disabled={!cameraEnabled}>
            <Save size={14} />
            Save snapshot
          </button>
        </div>
      </div>
      {saveMessage ? <div className="flash-banner success">{saveMessage}</div> : null}

      {!isHandheld ? (
        <div className="field-empty-state">
          <strong>Open this page on a phone or tablet.</strong>
          <p>This route is designed to be a focused handheld field mode, not the full desktop dashboard.</p>
        </div>
      ) : null}

      {!cameraEnabled ? (
        <div className="field-launchpad">
          <div className="field-launchpad-copy">
            <span className="section-kicker">Field Mode</span>
            <h1>Turn on the camera to open the issue field.</h1>
            <p>No balls, timeline, or AR controls render until camera access is explicitly enabled.</p>
          </div>
          <div className="field-launchpad-actions">
            <button type="button" className="primary-button" onClick={handleEnableCamera}>
              <Camera size={16} />
              Enable camera
            </button>
            <button type="button" className="ghost-button" onClick={() => onNavigate("live-command")}>
              <Compass size={16} />
              Open command room instead
            </button>
          </div>
          {cameraError ? <div className="flash-banner error">{cameraError}</div> : null}
        </div>
      ) : (
        <div className="field-stage-layout">
          <div className="field-stage-wrap">
            <div className="field-stage" ref={stageRef}>
              <video ref={videoRef} className="field-video" muted playsInline />
              <div className="field-overlay" />
              <div className="field-guidance">
                <strong>Drag issue balls into Watch, Act Now, or Resolved.</strong>
                <span>Tap a ball to play the call timeline. Pinch the selected ball to resize its importance.</span>
              </div>
              <AnimatePresence>
                {visibleNodes.map((node) => {
                  const issue = issues.find((item) => item.slug === node.slug);
                  if (!issue) {
                    return null;
                  }
                  return (
                    <motion.button
                      key={node.slug}
                      type="button"
                      className={`field-node tone-${riskBand(issue)} ${selectedIssueSlug === node.slug ? "active" : ""}`}
                      style={{ left: `${node.x}%`, top: `${node.y}%`, width: `${node.size}px`, height: `${node.size}px` }}
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                      onPointerDown={(event) => handlePointerDown(node.slug, event)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerCancel}
                      onTouchStart={(event) => handlePinchStart(event, node.slug)}
                      onTouchMove={(event) => handlePinchMove(event, node.slug)}
                      onClick={() => handleNodeTap(node.slug)}
                    >
                      <strong>{compactIssueTitle(issue.issue)}</strong>
                      <span>{issue.count}</span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="field-zone-row">
              {ZONES.map((zone) => (
                <div key={zone.key} className={`field-zone field-zone-${zone.key}`} ref={(element) => { zoneRefs.current[zone.key] = element; }}>
                  <strong>{zone.label}</strong>
                  <span>{zone.hint}</span>
                  <em>{visibleNodes.filter((node) => node.zone === zone.key).length} balls</em>
                </div>
              ))}
            </div>
          </div>

          <div className="field-panel">
            <div className="field-card">
              <div className="field-card-head">
                <span className="section-kicker">Selection</span>
                <Target size={16} />
              </div>
              <strong>{selectedIssue ? titleCase(selectedIssue.issue) : "No issue selected"}</strong>
              <p>{selectedIssue?.summary ?? "Pick a filtered issue ball to inspect its journey."}</p>
              <div className="detail-tags">
                <span className="data-tag">{selectedIssue?.count ?? 0} calls</span>
                <span className="data-tag muted">{selectedNode ? zoneLabel(selectedNode.zone) : "No zone"}</span>
                <span className="data-tag muted">{selectedNode ? `Size ${Math.round(selectedNode.size)}` : "No size"}</span>
              </div>
              <div className="field-card-actions">
                <button type="button" className="ghost-button small" onClick={() => selectedIssue && onOpenIssue(selectedIssue.slug)} disabled={!selectedIssue}>
                  Open issue
                </button>
                <button type="button" className="ghost-button small" onClick={() => selectedCall && onOpenCall(selectedCall.call_id)} disabled={!selectedCall}>
                  Open call
                </button>
              </div>
            </div>

            <div className="field-card">
              <div className="field-card-head">
                <span className="section-kicker">Timeline Replay</span>
                <Play size={16} />
              </div>
              <strong>{selectedCall?.call_id ?? selectedIssue?.representative_calls[0]?.call_id ?? "No representative call"}</strong>
              <p>{selectedCall?.summary ?? selectedIssue?.representative_calls[0]?.summary ?? "Select an issue with a representative call to play the timeline."}</p>
              <div className="field-timeline">
                {frames.map((frame, index) => (
                  <button
                    key={frame.label}
                    type="button"
                    className={`field-timeline-step ${timelineIndex === index ? "active" : ""}`}
                    onClick={() => setTimelineIndex(index)}
                  >
                    <div className="field-timeline-label">
                      <span>{frame.label}</span>
                      <strong>{frame.value.toFixed(2)}</strong>
                    </div>
                    <div className="field-timeline-track">
                      <div className="field-timeline-fill" style={{ width: `${frame.width}%` }} />
                    </div>
                  </button>
                ))}
              </div>
              <div className="field-timeline-copy">
                <strong>{frames[timelineIndex]?.label ?? "Opening"} stage</strong>
                <span>{timelineNarrative(frames[timelineIndex]?.value ?? 0)}</span>
              </div>
            </div>

            <div className="field-card">
              <div className="field-card-head">
                <span className="section-kicker">Filters</span>
                <SlidersHorizontal size={16} />
              </div>
              <div className={`field-filter-grid ${showFilters ? "expanded" : ""}`}>
                <label>
                  <span>Issue</span>
                  <select value={filters.issueSlug} onChange={(event) => setFilters((current) => ({ ...current, issueSlug: event.target.value }))}>
                    <option value="all">All issues</option>
                    {issues.map((issue) => (
                      <option value={issue.slug} key={issue.slug}>{titleCase(issue.issue)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Team</span>
                  <select value={filters.team} onChange={(event) => setFilters((current) => ({ ...current, team: event.target.value }))}>
                    {teamOptions.map((team) => (
                      <option value={team} key={team}>{team === "all" ? "All teams" : team}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Outcome</span>
                  <select value={filters.outcome} onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value }))}>
                    {outcomeOptions.map((outcome) => (
                      <option value={outcome} key={outcome}>{outcome === "all" ? "All outcomes" : titleCase(outcome)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Risk</span>
                  <select value={filters.risk} onChange={(event) => setFilters((current) => ({ ...current, risk: event.target.value }))}>
                    {riskOptions.map((risk) => (
                      <option value={risk} key={risk}>{risk === "all" ? "All risk bands" : titleCase(risk)}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="field-card">
              <div className="field-card-head">
                <span className="section-kicker">Snapshot Compare</span>
                <Save size={16} />
              </div>
              <label className="field-compare-select">
                <span>Compare against saved layout</span>
                <select value={compareSnapshotId} onChange={(event) => setCompareSnapshotId(event.target.value)}>
                  <option value="">No comparison</option>
                  {snapshots.map((snapshot) => (
                    <option value={snapshot.id} key={snapshot.id}>{snapshot.name}</option>
                  ))}
                </select>
              </label>
              {compareSummary ? (
                <div className="field-compare-summary">
                  {compareSnapshot?.preview_data_url ? (
                    <img
                      className="field-compare-preview"
                      src={compareSnapshot.preview_data_url}
                      alt={`${compareSnapshot.name} preview`}
                    />
                  ) : null}
                  <div className="line-row"><span>Zone shift</span><strong>{compareSummary.zoneChange}</strong></div>
                  <div className="line-row"><span>Size delta</span><strong>{compareSummary.sizeDelta}</strong></div>
                  <div className="line-row"><span>Position delta</span><strong>{compareSummary.positionDelta}</strong></div>
                  <p>{compareSummary.interpretation}</p>
                </div>
              ) : (
                <p className="field-muted-copy">Save a layout, then compare the current arrangement before and after an intervention.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildInitialNodes(issues: DashboardIssue[]): FieldNode[] {
  const positions = [
    { x: 18, y: 20, zone: "watch" as const },
    { x: 44, y: 14, zone: "act-now" as const },
    { x: 76, y: 22, zone: "act-now" as const },
    { x: 24, y: 54, zone: "watch" as const },
    { x: 56, y: 48, zone: "resolved" as const },
    { x: 80, y: 58, zone: "watch" as const },
  ];
  return issues.slice(0, 6).map((issue, index) => {
    const base = positions[index] ?? positions[positions.length - 1];
    return {
      slug: issue.slug,
      x: base.x,
      y: base.y,
      zone: base.zone,
      size: 92 + Math.min(issue.count * 4, 74),
    };
  });
}

function syncNodesWithIssues(nodes: FieldNode[], issues: DashboardIssue[]) {
  const seeded = buildInitialNodes(issues);
  return seeded.map((seededNode) => nodes.find((node) => node.slug === seededNode.slug) ?? seededNode);
}

function inferTeam(issue: DashboardIssue) {
  const label = `${issue.issue} ${issue.top_behaviors.map((item) => item.behavior ?? item.label ?? "").join(" ")}`.toLowerCase();
  if (label.includes("insurance") || label.includes("escrow")) {
    return "Escrow Ops";
  }
  if (label.includes("loss mitigation") || label.includes("hardship")) {
    return "Retention";
  }
  if (label.includes("payoff") || label.includes("payment")) {
    return "Payments";
  }
  return "Servicing";
}

function dominantOutcome(issue: DashboardIssue) {
  return Object.entries(issue.outcome_breakdown).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "unknown";
}

function riskBand(issue: DashboardIssue): RiskBand {
  if (issue.average_shift < -0.08 || dominantOutcome(issue).toLowerCase().includes("escalat")) {
    return "high";
  }
  if (issue.average_shift < 0.05) {
    return "medium";
  }
  return "low";
}

function findCallById(calls: CallCard[], callId: string | undefined) {
  if (!callId) {
    return null;
  }
  return calls.find((call) => call.call_id === callId) ?? null;
}

function buildPlaybackFrames(call: CallCard | RepresentativeCall | null): PlaybackFrame[] {
  const opening = call?.sentiments.opening ?? 0;
  const mid = call?.sentiments.mid ?? opening;
  const closing = call?.sentiments.closing ?? mid;
  return [
    { label: "Opening", value: opening, width: normalizeSentiment(opening) },
    { label: "Mid Call", value: mid, width: normalizeSentiment(mid) },
    { label: "Closing", value: closing, width: normalizeSentiment(closing) },
  ];
}

function normalizeSentiment(value: number) {
  return Math.max(8, Math.min(100, ((value + 1) / 2) * 100));
}

function timelineNarrative(value: number) {
  if (value < -0.2) {
    return "Customer sentiment is under pressure and trending toward escalation.";
  }
  if (value < 0.2) {
    return "The interaction is neutral and still at risk of sliding.";
  }
  return "The call is stabilizing and the agent appears to be recovering the experience.";
}

function compactIssueTitle(issue: string) {
  return issue.length > 18 ? `${titleCase(issue).slice(0, 18)}...` : titleCase(issue);
}

function zoneLabel(zone: PriorityZone) {
  return zone === "act-now" ? "Act Now" : titleCase(zone);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stopCamera(streamRef: React.MutableRefObject<MediaStream | null>) {
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}

function touchDistance(touches: React.TouchList) {
  const [first, second] = [touches[0], touches[1]];
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function findDropZone(clientX: number, clientY: number, refs: Record<PriorityZone, HTMLDivElement | null>) {
  return ZONES.find((zone) => {
    const rect = refs[zone.key]?.getBoundingClientRect();
    return rect ? clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom : false;
  })?.key;
}

function readSnapshots(): FieldSnapshot[] {
  try {
    const raw = window.localStorage.getItem(FIELD_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FieldSnapshot[]) : [];
  } catch {
    return [];
  }
}

function captureStagePreview({
  stageElement,
  videoElement,
  nodes,
  issues,
  selectedIssueSlug,
}: {
  stageElement: HTMLDivElement | null;
  videoElement: HTMLVideoElement | null;
  nodes: FieldNode[];
  issues: DashboardIssue[];
  selectedIssueSlug: string;
}) {
  if (!stageElement) {
    return null;
  }

  const rect = stageElement.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.fillStyle = "#08111f";
  context.fillRect(0, 0, width, height);

  if (videoElement && videoElement.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
    drawCoverImage(context, videoElement, width, height);
  }

  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "rgba(5, 9, 18, 0.08)");
  sky.addColorStop(1, "rgba(5, 9, 18, 0.62)");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(153, 196, 255, 0.08)";
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 64) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 64) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  for (const node of nodes) {
    const issue = issues.find((item) => item.slug === node.slug);
    if (!issue) {
      continue;
    }
    const centerX = (node.x / 100) * width;
    const centerY = (node.y / 100) * height;
    const radius = node.size / 2;
    const risk = riskBand(issue);
    const ringColor = risk === "high" ? "#ff886e" : risk === "medium" ? "#ffca76" : "#85e18c";

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    const bubble = context.createRadialGradient(centerX, centerY - radius * 0.55, radius * 0.2, centerX, centerY, radius);
    bubble.addColorStop(0, node.slug === selectedIssueSlug ? "rgba(47, 93, 152, 0.96)" : "rgba(20, 37, 58, 0.96)");
    bubble.addColorStop(1, "rgba(8, 15, 29, 0.98)");
    context.fillStyle = bubble;
    context.shadowColor = "rgba(0, 0, 0, 0.36)";
    context.shadowBlur = 28;
    context.fill();
    context.shadowBlur = 0;
    context.lineWidth = 2;
    context.strokeStyle = ringColor;
    context.stroke();

    context.fillStyle = "#eef5ff";
    context.font = "600 13px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    wrapCanvasText(context, compactIssueTitle(issue.issue), centerX, centerY - 8, node.size - 28, 14);

    context.fillStyle = "#d7e8ff";
    context.font = "700 14px sans-serif";
    context.fillText(String(issue.count), centerX, centerY + radius * 0.32);
    context.restore();
  }

  const bannerHeight = 64;
  context.fillStyle = "rgba(7, 16, 30, 0.76)";
  roundRect(context, 14, height - bannerHeight - 14, width - 28, bannerHeight, 18);
  context.fill();
  context.fillStyle = "#eef5ff";
  context.font = "700 14px sans-serif";
  context.textAlign = "left";
  context.fillText("Drag issue balls into Watch, Act Now, or Resolved.", 28, height - 52);
  context.fillStyle = "#c4d4ea";
  context.font = "500 12px sans-serif";
  context.fillText("Tap a ball to play the call timeline. Pinch the selected ball to resize its importance.", 28, height - 30);

  return canvas.toDataURL("image/png");
}

function drawCoverImage(context: CanvasRenderingContext2D, image: CanvasImageSource, width: number, height: number) {
  const source = image as HTMLVideoElement;
  const sourceWidth = source.videoWidth;
  const sourceHeight = source.videoHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    lines.push(line);
  }

  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.slice(0, 2).forEach((item, index) => {
    context.fillText(item, centerX, startY + index * lineHeight);
  });
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function compareLayouts(slug: string, currentNodes: FieldNode[], previousNodes: FieldNode[]) {
  const current = currentNodes.find((node) => node.slug === slug);
  const previous = previousNodes.find((node) => node.slug === slug);
  if (!current || !previous) {
    return null;
  }
  const distance = Math.round(Math.hypot(current.x - previous.x, current.y - previous.y));
  const sizeDelta = Math.round(current.size - previous.size);
  return {
    zoneChange: current.zone === previous.zone ? `Stayed in ${zoneLabel(current.zone)}` : `${zoneLabel(previous.zone)} -> ${zoneLabel(current.zone)}`,
    sizeDelta: sizeDelta === 0 ? "No change" : `${sizeDelta > 0 ? "+" : ""}${sizeDelta}px`,
    positionDelta: `${distance}pt movement`,
    interpretation:
      current.zone === "resolved"
        ? "This issue is being treated as stabilized versus the saved review state."
        : current.zone === "act-now"
          ? "This issue is now prioritized for immediate action compared with the saved layout."
          : "This issue remains under watch and has not yet been promoted into immediate action.",
  };
}
