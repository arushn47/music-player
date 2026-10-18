import React from "react";
import {
  Activity,
  FileText,
  Globe,
  Heart,
  Headphones,
  Library,
  ListMusic,
  Plus,
  Settings2,
} from "lucide-react";
import { IconButton } from "../common/IconButton";
import type { Session } from "../../domain/types";

export interface SidebarProps {
  view: string;
  setView: (view: string) => void;
  collectionsCount: number;
  playlists: Session["playlists"];
  hasLyricsDoc: boolean;
  onCreatePlaylist: () => void;
  queueOpen?: boolean;
  onToggleQueue?: () => void;
}

export function Sidebar({
  view,
  setView,
  collectionsCount,
  playlists,
  hasLyricsDoc,
  onCreatePlaylist,
  queueOpen,
  onToggleQueue,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#"
        title="Lumaire · Home"
        onClick={(e) => {
          e.preventDefault();
          setView("library");
        }}
      >
        <span className="brand-icon">
          <img src="/lumaire.svg" alt="" aria-hidden="true" />
        </span>
        <span className="brand-text">
          Lumaire<span className="brand-dot">.</span>
        </span>
      </a>

      <div className="sidebar-caption">YOUR SPACE</div>
      <nav aria-label="Main navigation">
        <button
          className={view === "library" ? "selected" : ""}
          onClick={() => setView("library")}
          title="Library"
        >
          <Library size={19} />
          <span className="nav-label">Library</span>
          <span className="nav-count">{collectionsCount}</span>
        </button>
        <button
          className={view === "discover" ? "selected" : ""}
          onClick={() => setView("discover")}
          title="Discover"
        >
          <Globe size={19} />
          <span className="nav-label">Discover</span>
        </button>
        <button
          className={view === "favorites" ? "selected" : ""}
          onClick={() => setView("favorites")}
          title="Favorites"
        >
          <Heart size={19} />
          <span className="nav-label">Favorites</span>
        </button>
        <button
          className={view === "lyrics" ? "selected" : ""}
          onClick={() => setView("lyrics")}
          title="Lyric room"
        >
          <FileText size={19} />
          <span className="nav-label">
            Lyric room{hasLyricsDoc && <span className="small-dot" />}
          </span>
        </button>
        <button
          className={view === "history" ? "selected" : ""}
          onClick={() => setView("history")}
          title="Tracker"
        >
          <Activity size={19} />
          <span className="nav-label">Tracker</span>
        </button>
        {onToggleQueue && (
          <button
            className={`nav-queue-btn ${queueOpen ? "selected" : ""}`}
            onClick={onToggleQueue}
            title={queueOpen ? "Hide queue" : "Show queue"}
          >
            <ListMusic size={19} />
            <span className="nav-label">Queue</span>
          </button>
        )}
      </nav>

      <div className="sidebar-caption playlist-label">
        PLAYLISTS{" "}
        <IconButton label="Create playlist" onClick={onCreatePlaylist}>
          <Plus size={17} />
        </IconButton>
      </div>

      <nav aria-label="Playlists" className="playlists-nav">
        {playlists.map((p) => (
          <button
            key={p.id}
            className={view === p.id ? "selected" : ""}
            onClick={() => setView(p.id)}
            title={p.name}
          >
            <ListMusic size={18} />
            <span className="ellipsis nav-label">{p.name}</span>
            <span className="nav-count">{p.items.length}</span>
          </button>
        ))}
        {!playlists.length && (
          <p className="sidebar-note">
            A little order for
            <br />
            everything you love.
          </p>
        )}
      </nav>

      <div className="sidebar-bottom">
        <div className="local-note">
          <span className="small-dot" /> On your device{" "}
          <span>Private by default</span>
        </div>
        <button
          className={`nav-settings ${view === "settings" ? "selected" : ""}`}
          onClick={() => setView("settings")}
          title="Settings & sources"
        >
          <Settings2 size={18} />
          <span className="nav-label">Settings & sources</span>
        </button>
      </div>
    </aside>
  );
}
