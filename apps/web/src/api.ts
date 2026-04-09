import type {
  CallDetail,
  IssueDetail,
  StrategyBoard,
  StrategyCreateInput,
  StrategyRecord,
  StrategyUpdateInput,
  WorkspacePayload,
} from "./types";

const API_ROOT = import.meta.env.VITE_API_ROOT ?? "http://127.0.0.1:8000/api/rank1";

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
  getWorkspace: () => request<WorkspacePayload>("/workspace"),
  getIssue: (issueSlug: string) => request<IssueDetail>(`/issues/${issueSlug}`),
  getCall: (callId: string) => request<CallDetail>(`/calls/${callId}`),
  getStrategies: () => request<StrategyBoard>("/strategies"),
  createStrategy: (payload: StrategyCreateInput) =>
    request<StrategyRecord>("/strategies", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateStrategy: (strategyId: string, payload: StrategyUpdateInput) =>
    request<StrategyRecord>(`/strategies/${strategyId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  rerunPipeline: () =>
    request<{ status: string; call_count: number; segment_count: number; output_files: Record<string, string> }>(
      "/run",
      { method: "POST" },
    ),
  recalibrate: () => request<WorkspacePayload>("/recalibrate", { method: "POST" }),
  exportReport: () => request<ExportReportResponse>("/reports/export", { method: "POST" }),
};
