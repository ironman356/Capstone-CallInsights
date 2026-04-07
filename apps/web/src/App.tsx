import { useEffect, useState, type ComponentType } from 'react';
import AppHeader from './components/AppHeader';
import { defaultPageId, isPageId, pages, type PageId } from './navigation';
import ExecutiveOverviewPage from './pages/ExecutiveOverviewPage';
import DailyInsightsPulsePage from './pages/DailyInsightsPulsePage';
import MonthlyRecalibrationPage from './pages/MonthlyRecalibrationPage';
import IssueExplorerPage from './pages/IssueExplorerPage';
import CallDrilldownPage from './pages/CallDrilldownPage';
import StrategyManagementPage from './pages/StrategyManagementPage';
import StrategyEffectivenessPage from './pages/StrategyEffectivenessPage';
import ReportsExportPage from './pages/ReportsExportPage';
import SentimentJourneyMapPage from './pages/SentimentJourneyMapPage';
import TranscriptInputPage from './pages/TranscriptInputPage';
import NaturalLanguageQueryPage from './pages/NaturalLanguageQueryPage';
import AdminAiGovernancePage from './pages/AdminAiGovernancePage';

const pageComponents: Record<PageId, ComponentType> = {
  'executive-overview': ExecutiveOverviewPage,
  'daily-insights-pulse': DailyInsightsPulsePage,
  'monthly-recalibration': MonthlyRecalibrationPage,
  'issue-explorer': IssueExplorerPage,
  'call-drilldown': CallDrilldownPage,
  'strategy-management': StrategyManagementPage,
  'strategy-effectiveness': StrategyEffectivenessPage,
  'reports-export': ReportsExportPage,
  'sentiment-journey-map': SentimentJourneyMapPage,
  'transcript-input': TranscriptInputPage,
  'natural-language-query': NaturalLanguageQueryPage,
  'admin-ai-governance': AdminAiGovernancePage,
};

function App() {
  const [activePageId, setActivePageId] = useState<PageId>(defaultPageId);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      setActivePageId(isPageId(hash) ? hash : defaultPageId);
    };

    syncFromHash();

    if (!window.location.hash) {
      window.history.replaceState(null, '', `#${defaultPageId}`);
    }

    window.addEventListener('hashchange', syncFromHash);

    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];
  const ActivePage = pageComponents[activePageId];

  useEffect(() => {
    document.title = `${activePage.label} | CallInsights`;
  }, [activePage.label]);

  return (
    <div className="app-shell">
      <AppHeader pages={pages} activePageId={activePageId} />
      <main className="app-main">
        <ActivePage />
      </main>
    </div>
  );
}

export default App;
