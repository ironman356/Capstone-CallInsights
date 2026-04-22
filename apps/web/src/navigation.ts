export type PageKey = "overview" | "issues" | "calls" | "strategies" | "learning" | "ask-ci" | "live-command" | "field" | "governance" | "visual-lab" | "reports";

const PAGE_PATHS: Record<PageKey, string> = {
  overview: "/",
  issues: "/issues",
  calls: "/calls",
  strategies: "/strategies",
  learning: "/learning",
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
