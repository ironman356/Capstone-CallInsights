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
  getWorkspace: () => request<WorkspacePayload>("/workspace"),
  askCiChat: (payload: { question: string; current_page?: string; history?: Array<{ role: string; text: string }> }) =>
    request<AskCiChatResponse>("/ask-ci/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
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
