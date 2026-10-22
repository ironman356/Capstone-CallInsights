export interface SolutionEvidence { call_id: string; outcome: string; quotes: Array<{ turn: number; text: string }> }
export interface DiscoverySignal {
  id: string; label: string; kind: string; support: number; comparison_count: number;
  resolved: number; other: number; rate: number; without_rate: number | null; delta: number | null;
  interval: [number, number] | null; p: number; q: number; status: string;
  examples: SolutionEvidence[]; counterexamples: SolutionEvidence[]; comparison_call_ids: string[];
}
export interface SolutionCluster {
  slug: string; issue: string; count: number; baseline: number; resolved: number;
  signals: DiscoverySignal[]; outcomes: Record<string, number>;
}
export interface DiscoveryReport {
  version: string; call_count: number; clusters: SolutionCluster[]; notes: string[]; semantic_status: string;
  sources: Array<{ title: string; url: string; use: string }>;
  conversations: {
    clusters: ConversationCluster[]; retrieval_method: string; causal_note: string;
    adjusted: Array<{ behavior: string; n: number; treated?: number; estimate: number | null; overlap: number | null; status: string }>;
  };
  benchmark: { status: string; groups: number; folds: number; note: string;
    models: Array<{ name: string; brier: number; macro_f1: number; balanced_accuracy: number; auc: number; improvement: number }>;
  };
}

export interface ExactLine {
  text: string; support: number; resolved: number; rate: number; without_count: number;
  without_resolved: number; without_rate: number | null; lower_bound: number; finding: string;
  call_ids: string[]; resolved_ids: string[]; reactions: Record<string, number>;
}
export interface DialogueTurn {
  turn: number; speaker: string; text: string; stage: string; eligible: boolean;
  signals: Array<{ kind: string; label: string; status: string; delta: number | null }>;
  stats: ExactLine | null;
  next_customer: { turn: number; speaker: string; text: string; stage: string } | null;
  alternatives: Array<{ text: string; call_id: string; turn: number; similarity: number; stats: ExactLine }>;
}
export interface ConversationPath { call_id: string; outcome: string; turns: DialogueTurn[]; score: number }
export interface ConversationCluster {
  slug: string; issue: string; calls: ConversationPath[]; exact_lines: ExactLine[];
  guide: { title: string; source_call_id: string | null; status: string; turns: DialogueTurn[]; reason: string };
}
export interface ScriptAssignment {
  id: string; unit_id: string; arm: string; assigned_at: string; script: string;
  outcome: { resolved: boolean; repeat_contact_7d: boolean; delivered: boolean; source_reference: string; recorded_at: string } | null;
}
export interface ScriptExperiment {
  id: string; issue_slug: string; issue: string; status: string; variant_a: string; variant_b: string;
  source_call_id: string; source_turn: number; hypothesis: string; primary_outcome: string;
  randomization: string; planning_n_per_arm: number; planning_assumptions: string; required_fields: string[];
  assignments: ScriptAssignment[]; results: Record<string, { assigned: number; observed: number; success: number }>;
  difference: number | null; result_status: string;
}
