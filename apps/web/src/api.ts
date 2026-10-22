import type {
  AskCiChatResponse,
  CallDetail,
  IssueDetail,
  StrategyBoard,
  StrategyCreateInput,
  StrategyRecord,
  StrategyUpdateInput,
  WorkspacePayload,
} from "./types";

const API_ROOT = import.meta.env.VITE_API_ROOT ?? "/api/rank1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export interface ExportReportResponse {
  status: string;
  generated_at: string;
  report: WorkspacePayload["reports"];
}

export const api = {
  getSolutions: () => request<import("./solutionTypes").DiscoveryReport>("/solutions"),
  getScriptExperiments: () => request<{ experiments: import("./solutionTypes").ScriptExperiment[] }>("/script-experiments"),
  createScriptExperiment: (issue_slug: string) => request<import("./solutionTypes").ScriptExperiment>("/script-experiments", { method: "POST", body: JSON.stringify({ issue_slug }) }),
  assignScript: (id: string, unit_id: string) => request<import("./solutionTypes").ScriptAssignment>(`/script-experiments/${id}/assignments`, { method: "POST", body: JSON.stringify({ unit_id }) }),
  recordScriptOutcome: (id: string, assignment: string, payload: { resolved: boolean; repeat_contact_7d: boolean; delivered: boolean; source_reference: string }) => request<import("./solutionTypes").ScriptExperiment>(`/script-experiments/${id}/assignments/${assignment}/outcome`, { method: "POST", body: JSON.stringify(payload) }),
  getWorkspace: () => request<WorkspacePayload>("/workspace"),
  askCiChat: (payload: { question: string; current_page?: string; history?: Array<{ role: string; text: string }> }) =>
    request<AskCiChatResponse>("/ask-ci/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getIssue: (issueSlug: string) => request<IssueDetail>(`/issues/${issueSlug}`),
  getCall: (callId: string) => request<CallDetail>(`/calls/${callId}`),
  getCommonPhrases: (issue: string, approach: string) =>
    request<{ call_count: number; phrases: Array<{ text: string; speaker: string; call_ids: string[] }> }>(
      `/common-phrases?${new URLSearchParams({ issue, approach })}`,
    ),
  getStrategies: () => request<StrategyBoard>("/strategies"),
  createStrategy: (payload: StrategyCreateInput) =>
    request<StrategyRecord>("/strategies", {
      method: "POST",
      body: JSON.stringify({ ...payload, due_date: payload.due_date || null }),
    }),
  updateStrategy: (strategyId: string, payload: StrategyUpdateInput) =>
    request<StrategyRecord>(`/strategies/${strategyId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteStrategy: (strategyId: string) =>
    request<StrategyRecord>(`/strategies/${strategyId}`, {
      method: "DELETE",
    }),
  rerunPipeline: () =>
    request<{ status: string; call_count: number; segment_count: number; output_files: Record<string, string> }>(
      "/run",
      { method: "POST" },
    ),
  recalibrate: () => request<WorkspacePayload>("/recalibrate", { method: "POST" }),
  exportReport: () => request<ExportReportResponse>("/reports/export", { method: "POST" }),
  downloadReportPdf: async () => {
    const url = `${API_ROOT}/reports/export.pdf`;
    const filename = "call-insights-report.pdf";
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed with ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    try {
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      return filename;
    } finally {
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    }
  },
};
