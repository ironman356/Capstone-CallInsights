import type { PageDefinition, PageId } from '../navigation';

interface AppHeaderProps {
  pages: PageDefinition[];
  activePageId: PageId;
}

export default function AppHeader({ pages, activePageId }: AppHeaderProps) {
  return (
    <header className="app-header">
      <a className="app-header__logoLink" href={`#${pages[0]?.id ?? ''}`} aria-label="SPS home">
        <img
          className="app-header__logo"
          src="https://www.spservicing.com/Images/SPSLogoWhite.png"
          alt="SPS"
        />
      </a>

      <nav className="app-nav" aria-label="Primary">
        {pages.map((page) => {
          const isActive = page.id === activePageId;

          return (
            <a
              key={page.id}
              href={`#${page.id}`}
              className={isActive ? 'app-nav-link is-active' : 'app-nav-link'}
              aria-current={isActive ? 'page' : undefined}
            >
              {page.label}
            </a>
          );
        })}
      </nav>

      <div className="brand-wordmark" aria-label="CallInsights">
        CallInsights
      </div>
    </header>
  );
}
