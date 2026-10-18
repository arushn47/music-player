import React from "react";
import { ChevronRight, ListMusic, PanelLeft, PanelLeftClose } from "lucide-react";
import type { Collection } from "../../domain/collections";
import type { Playlist } from "../../domain/types";
import { IconButton } from "./IconButton";

export interface TopBarProps {
  view: string;
  heading: string;
  collections: Collection[];
  playlists: Playlist[];
  sidebarCollapsed: boolean;
  queueOpen: boolean;
  onSelectView: (view: string) => void;
  onToggleSidebar: () => void;
  onToggleQueue: () => void;
}

export function TopBar({
  view,
  heading,
  collections,
  playlists,
  sidebarCollapsed,
  queueOpen,
  onSelectView,
  onToggleSidebar,
  onToggleQueue,
}: TopBarProps) {
  return (
    <header className="topbar">
      <select
        className="compact-navigation"
        aria-label="Navigate your library"
        value={view}
        onChange={(e) => onSelectView(e.target.value)}
      >
        <option value="library">Library</option>
        <option value="discover">Discover</option>
        <option value="favorites">Favorites</option>
        <option value="lyrics">Lyric room</option>
        <option value="history">Tracker</option>
        <option value="settings">Settings & sources</option>
        {collections
          .filter((collection) => !collection.playlist)
          .map((collection) => (
            <option value={collection.id} key={collection.id}>
              {collection.name}
            </option>
          ))}
        {playlists.map((p) => (
          <option value={p.id} key={p.id}>
            {p.name}
          </option>
        ))}
      </select>
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
