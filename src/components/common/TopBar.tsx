import { ChevronRight, ListMusic, PanelLeft, PanelLeftClose } from "lucide-react";
import { IconButton } from "./IconButton";

export interface TopBarProps {
  view: string;
  heading: string;
  sidebarCollapsed: boolean;
  queueOpen: boolean;
  onToggleSidebar: () => void;
  onToggleQueue: () => void;
}

export function TopBar({
  view,
  heading,
  sidebarCollapsed,
  queueOpen,
  onToggleSidebar,
  onToggleQueue,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="breadcrumb-wrap">
        <IconButton
          label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          className="sidebar-toggle-btn"
          onClick={onToggleSidebar}
        >
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </IconButton>
        <div className="breadcrumb">
          Your space <ChevronRight size={14} />
          <span>
            {view === "lyrics"
              ? "Lyric room"
              : view === "settings"
                ? "Settings"
                : view === "discover"
                  ? "Discover"
                  : heading}
          </span>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="offline-badge">LOCAL FIRST</span>
        <IconButton
          label={queueOpen ? "Hide queue" : "Show queue"}
          active={queueOpen}
          onClick={onToggleQueue}
        >
          <ListMusic size={20} />
        </IconButton>
      </div>
    </header>
  );
}
