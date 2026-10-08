export type PageKey = "results" | "approach-matrix" | "approach-portfolio" | "overview" | "issues" | "calls" | "strategies" | "learning" | "model-approaches" | "ask-ci" | "live-command" | "field" | "governance" | "visual-lab" | "reports";

const PAGE_PATHS: Record<PageKey, string> = {
  results: "/results",
  "approach-matrix": "/approach-matrix",
  "approach-portfolio": "/approach-portfolio",
  overview: "/",
  issues: "/issues",
  calls: "/calls",
  strategies: "/strategies",
  learning: "/learning",
  "model-approaches": "/model-approaches",
  "ask-ci": "/ask-ci",
  "live-command": "/live-command",
  field: "/field",
  governance: "/governance",
  "visual-lab": "/visual-lab",
  reports: "/reports",
};

export function pageFromPath(pathname: string): PageKey {
  const match = Object.entries(PAGE_PATHS).find(([, path]) => path === pathname);
  return (match?.[0] as PageKey | undefined) ?? "overview";
}

export function pathFromPage(page: PageKey): string {
  return PAGE_PATHS[page] ?? "/";
}
