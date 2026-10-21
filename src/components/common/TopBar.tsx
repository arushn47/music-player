import { ChevronRight, Download, FolderInput, ListMusic, PanelLeft, PanelLeftClose, Wifi } from "lucide-react";
import { IconButton } from "./IconButton";

export interface TopBarProps {
  view: string;
  heading: string;
  sidebarCollapsed: boolean;
  queueOpen: boolean;
  onToggleSidebar: () => void;
  onToggleQueue: () => void;
  onOpenCollectionHub?: () => void;
  onOpenImport?: () => void;
  onOpenUpdates?: () => void;
  updateLabel?: string;
  onOpenConnect?: () => void;
  nearbySharing?: boolean;
  nearbyFollowing?: boolean;
  onStopFollowing?: () => void;
}

export function TopBar({
  view,
  heading,
  sidebarCollapsed,
  queueOpen,
  onToggleSidebar,
  onToggleQueue,
  onOpenCollectionHub,
  onOpenImport,
  onOpenUpdates,
  updateLabel,
  onOpenConnect,
  nearbySharing,
  nearbyFollowing,
  onStopFollowing,
}: TopBarProps) {
  const handleImport = onOpenImport || onOpenCollectionHub;
  const handleConnect = onOpenConnect || onOpenCollectionHub;

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
        {nearbyFollowing && onStopFollowing && (
          <button
            type="button"
            className="topbar-sharing-pill following"
            onClick={onStopFollowing}
            aria-label="Stop listening together"
            title="Listening together (Click to stop)"
          >
            <Wifi size={13} />
            <span>Stop listening</span>
          </button>
        )}
        {nearbySharing && handleConnect && (
          <button
            type="button"
            className="topbar-sharing-pill sharing"
            onClick={handleConnect}
            aria-label="Sharing on your Wi-Fi (Click to manage)"
            title="Sharing on your Wi-Fi (Click to manage)"
          >
            <Wifi size={13} />
            <span>Sharing on Wi-Fi</span>
          </button>
        )}
        {handleImport && (
          <button
            type="button"
            className="topbar-import-btn"
            onClick={handleImport}
            aria-label="Import playlists & connect devices"
            title="Import playlists from Spotify, YouTube, Apple Music or files"
          >
            <FolderInput size={14} />
            <span>Import</span>
          </button>
        )}
        {onOpenUpdates && updateLabel && <button type="button" className="topbar-import-btn topbar-update-btn" aria-label="Software updates and release notes" onClick={onOpenUpdates} title="Update available · View release notes and installation options"><Download size={14} /><span>{updateLabel}</span></button>}
        {handleConnect && !nearbySharing && (
          <button
            type="button"
            className="topbar-connect-btn"
            onClick={handleConnect}
            aria-label="Connect devices & listening together"
            title="Connect nearby devices & share listening over Wi-Fi"
          >
            <Wifi size={14} />
            <span>Connect</span>
          </button>
        )}
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
