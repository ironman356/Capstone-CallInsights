import { useEffect, useState } from 'react';
import '@xyflow/react/dist/style.css';
import AppHeader from './components/AppHeader';
import PlaceholderPage from './pages/PlaceholderPage';
import AdminAiGovernancePage from './pages/AdminAiGovernancePage';
import { defaultPageId, isPageId, pages, type PageId } from './navigation';

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

  useEffect(() => {
    document.title = `${activePage.label} | CallInsights`;
  }, [activePage.label]);

  const renderPage = () => {
    if (activePageId === 'admin-ai-governance') {
      return <AdminAiGovernancePage />;
    }

    return <PlaceholderPage title={activePage.label} />;
  };

  return (
    <div className="app-shell">
      <AppHeader pages={pages} activePageId={activePageId} />
      <main className="app-main">{renderPage()}</main>
    </div>
  );
}

export default App;
