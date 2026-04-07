export type PageId =
  | 'executive-overview'
  | 'daily-insights-pulse'
  | 'monthly-recalibration'
  | 'issue-explorer'
  | 'call-drilldown'
  | 'strategy-management'
  | 'strategy-effectiveness'
  | 'reports-export'
  | 'sentiment-journey-map'
  | 'transcript-input'
  | 'natural-language-query'
  | 'admin-ai-governance';

export interface PageDefinition {
  id: PageId;
  label: string;
}

export const pages: PageDefinition[] = [
  { id: 'executive-overview', label: 'Executive Overview' },
  { id: 'daily-insights-pulse', label: 'Daily Insights Pulse' },
  { id: 'monthly-recalibration', label: 'Monthly Recalibration' },
  { id: 'issue-explorer', label: 'Issue Explorer' },
  { id: 'call-drilldown', label: 'Call Drilldown' },
  { id: 'strategy-management', label: 'Strategy Management' },
  { id: 'strategy-effectiveness', label: 'Strategy Effectiveness' },
  { id: 'reports-export', label: 'Reports & Export' },
  { id: 'sentiment-journey-map', label: 'Sentiment Journey Map' },
  { id: 'transcript-input', label: 'Transcript Input' },
  { id: 'natural-language-query', label: 'Natural Language Query (Ask CI)' },
  { id: 'admin-ai-governance', label: 'Admin & AI Governance' },
];

export const defaultPageId: PageId = 'executive-overview';

export function isPageId(value: string | undefined): value is PageId {
  return pages.some((page) => page.id === value);
}

