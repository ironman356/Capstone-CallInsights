export type PageKey =
  | "overview"
  | "design-lab"
  | "pulse"
  | "monthly"
  | "explorer"
  | "drilldown"
  | "strategies"
  | "reports"
  | "governance";

export interface PageDefinition {
  key: PageKey;
  label: string;
  path: string;
  description: string;
}

export const PAGES: PageDefinition[] = [
  {
    key: "overview",
    label: "Executive Overview",
    path: "/",
    description: "High-level operating picture and issue landscape.",
  },
  {
    key: "design-lab",
    label: "UI Design Lab",
    path: "/ui-design-lab",
    description: "Three richer dashboard concepts with heavier visual storytelling.",
  },
  {
    key: "pulse",
    label: "Daily Pulse",
    path: "/daily-pulse",
    description: "Fresh insights, spikes, and evidence-backed movement.",
  },
  {
    key: "monthly",
    label: "Monthly Recalibration",
    path: "/monthly-recalibration",
    description: "What changed, what works, and what should be reviewed next.",
  },
  {
    key: "explorer",
    label: "Issue Explorer",
    path: "/issue-explorer",
    description: "Recurring issue clusters, filters, and evidence packs.",
  },
  {
    key: "drilldown",
    label: "Call Drilldown",
    path: "/call-drilldown",
    description: "Transcript review with structured extraction and sentiment flow.",
  },
  {
    key: "strategies",
    label: "Strategy Workflow",
    path: "/strategy-workflow",
    description: "Decision tracking from proposed intervention to closure.",
  },
  {
    key: "reports",
    label: "Reports & Export",
    path: "/reports",
    description: "Leadership summaries and reproducible export packages.",
  },
  {
    key: "governance",
    label: "AI Governance",
    path: "/governance",
    description: "Evidence policy, audits, and system monitoring.",
  },
];

export function pageFromPath(pathname: string): PageKey {
  const match = PAGES.find((page) => page.path === pathname);
  return match?.key ?? "overview";
}

export function pathFromPage(page: PageKey): string {
  return PAGES.find((item) => item.key === page)?.path ?? "/";
}
