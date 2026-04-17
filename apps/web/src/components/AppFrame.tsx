import type { ReactNode } from "react";
import type { PageKey } from "../navigation";
import type { WorkspacePayload } from "../types";

interface AppFrameProps {
  page: PageKey;
  theme: "light" | "dark";
  syncing: boolean;
  message: string | null;
  error: string | null;
  workspace: WorkspacePayload;
  onNavigate: (page: PageKey) => void;
  onToggleTheme: () => void;
  onRefresh: () => void;
  onRerun: () => void;
  onRecalibrate: () => void;
  onExport: () => void;
  children: ReactNode;
}

export function AppFrame({ children }: AppFrameProps) {
  return <>{children}</>;
}
