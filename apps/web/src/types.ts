export type Tone = "neutral" | "info" | "risk" | "stable" | "warning";

export interface OverviewMetric {
  label: string;
  value: number | string;
  tone: Tone;
}

export interface TopPattern {
  key: [string, string, string];
  issue: string;
  behavior: string;
  outcome: string;
  count: number;
  lift: number;
  evidence: string[];
  call_ids: string[];
}

export interface RepresentativeCall {
  call_id: string;
  source_file: string;
  summary: string;
  sentiments: Record<string, number>;
  outcome?: string;
}

export interface DashboardIssue {
  slug: string;
  issue: string;
  count: number;
  summary: string;
  top_behaviors: Array<{ behavior?: string; label?: string; count: number }>;
  outcome_breakdown: Record<string, number>;
  average_shift: number;
  representative_calls: RepresentativeCall[];
}

export interface CallCard {
  call_id: string;
  source_file: string;
  issue: string;
  outcome: string;
  behaviors: string[];
  summary: string;
  sentiments: Record<string, number>;
}

export interface DashboardPayload {
  overview: {
    metrics: OverviewMetric[];
    issue_counts: Record<string, number>;
    outcome_counts: Record<string, number>;
    sentiment_summary: Record<string, number>;
    top_patterns: TopPattern[];
    daily_brief: string[];
  };
  issues: DashboardIssue[];
  calls: CallCard[];
}

export interface IssueDetail {
  issue: string;
  count: number;
  summary: string;
  top_behaviors: Array<{ behavior?: string; label?: string; count: number }>;
  outcome_breakdown: Record<string, number>;
  evidence_calls: RepresentativeCall[];
}

export interface CallDetail {
  call_id: string;
  source_file: string;
  issue: string;
  outcome: string;
  behaviors: string[];
  sentiments: Record<string, number>;
  summary: string;
  transcript_text: string;
  turns: Array<{ speaker: string; text: string }>;
  segments: Array<{ segment_id: string; order: number; issue: string; text: string; turn_count: number }>;
}

export interface StrategyRecord {
  strategy_id: string;
  title: string;
  issue_slug: string;
  issue: string;
  status: string;
  owner: string;
  hypothesis: string;
  kpi_focus: string[];
  evidence_call_ids: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface StrategyBoard {
  stages: Array<{ name: string; count: number }>;
  strategies: StrategyRecord[];
}

export interface PulseInsight {
  insight_id: string;
  title: string;
  issue: string;
  behavior: string;
  outcome: string;
  trend: string;
  evidence_count: number;
  summary: string;
  call_ids: string[];
  lift: number;
}

export interface ReportSummary {
  title: string;
  generated_at: string;
  totals: Record<string, number | string>;
  highlights: string[];
  issue_table: Array<{ issue: string; count: number; top_outcome: string }>;
}

export interface GovernanceSummary {
  generated_at: string;
  evidence_policy: string[];
  audit_summary: Record<string, number>;
  monitors: Array<{ label: string; status: string }>;
}

export interface AskCiChatAction {
  type: "page" | "issue" | "call";
  label: string;
  target: string;
}

export interface AskCiChatResponse {
  answer: string;
  sources: string[];
  actions: AskCiChatAction[];
  generated_at: string;
  mode: string;
}

export interface WorkspacePayload {
  dashboard: DashboardPayload;
  pulse_insights: PulseInsight[];
  recalibration: {
    completed_at: string;
    baseline_window: string;
    new_clusters_detected: number;
    retired_clusters: number;
    top_issue: string | null;
    focus_summary: string;
    taxonomy_notes: string[];
  };
  strategy_board: StrategyBoard;
  ask_ci: Array<{ question: string; answer: string; evidence_call_ids: string[] }>;
  reports: ReportSummary;
  governance: GovernanceSummary;
}

export interface StrategyCreateInput {
  issue_slug: string;
  title: string;
  owner: string;
  hypothesis: string;
  notes: string;
  kpi_focus: string[];
  evidence_call_ids: string[];
}

export interface StrategyUpdateInput {
  status?: string;
  owner?: string;
  hypothesis?: string;
  notes?: string;
  kpi_focus?: string[];
  evidence_call_ids?: string[];
}
