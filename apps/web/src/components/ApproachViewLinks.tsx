import { ArrowRight } from "lucide-react";
import { pathFromPage, type PageKey } from "../navigation";

const VIEWS: { page: PageKey; title: string; description: string }[] = [
  { page: "model-approaches", title: "Model Approaches", description: "Compare AI methods on the frozen benchmark." },
  { page: "results", title: "Issue Deep Dive", description: "Explore issues, agent behaviors, and supporting transcripts." },
  { page: "compare-approaches", title: "Compare Approaches", description: "Compare outcomes for up to four agent behaviors." },
  { page: "approach-matrix", title: "Effectiveness Matrix", description: "See how agent behaviors perform across issues." },
  { page: "approach-portfolio", title: "Approach Portfolio", description: "Explore behavior adoption, consistency, and impact." },
];

export default function ApproachViewLinks({ currentPage, onNavigate }: {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
}) {
  if (!VIEWS.some((view) => view.page === currentPage)) return null;

  return (
    <details className="panel-card approach-view-links">
      <summary>Explore related views</summary>
      <p>Model Approaches evaluates AI methods. The other views explore agent behaviors found in calls.</p>
      <nav className="approach-view-links-grid" aria-label="Related modelling and analysis views">
        {VIEWS.map((view) => (
          <a
            key={view.page}
            href={pathFromPage(view.page)}
            aria-current={view.page === currentPage ? "page" : undefined}
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              if (view.page !== currentPage) onNavigate(view.page);
            }}
          >
            <strong>{view.title}<ArrowRight size={15} aria-hidden="true" /></strong>
            <span>{view.description}</span>
            {view.page === currentPage ? <small>Current page</small> : null}
          </a>
        ))}
      </nav>
    </details>
  );
}
