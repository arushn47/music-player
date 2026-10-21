import React from "react";
import { Activity, FileText, Globe, Heart, Library } from "lucide-react";

export interface MobileTabBarProps {
  view: string;
  setView: (view: string) => void;
  hasLyricsDoc: boolean;
}

export function MobileTabBar({
  view,
  setView,
  hasLyricsDoc,
}: MobileTabBarProps) {
  const isLibraryActive =
    view === "library" ||
    view.startsWith("collection:") ||
    (view !== "discover" &&
      view !== "favorites" &&
      view !== "lyrics" &&
      view !== "history" &&
      view !== "settings");

  return (
    <nav className="mobile-tab-bar" aria-label="Mobile navigation">
      <button type="button" className={`mobile-tab ${view === "discover" ? "active" : ""}`} onClick={() => setView("discover")} aria-label="Discover">
        <Globe size={20} strokeWidth={view === "discover" ? 2.2 : 1.8} /><span>Discover</span>
      </button>
      <button
        type="button"
        className={`mobile-tab ${isLibraryActive ? "active" : ""}`}
        onClick={() => setView("library")}
        aria-label="Library"
      >
        <Library size={20} strokeWidth={isLibraryActive ? 2.2 : 1.8} />
        <span>Library</span>
      </button>

      <button
        type="button"
        className={`mobile-tab ${view === "favorites" ? "active" : ""}`}
        onClick={() => setView("favorites")}
        aria-label="Favorites"
      >
        <Heart
          size={20}
          strokeWidth={view === "favorites" ? 2.2 : 1.8}
          fill={view === "favorites" ? "currentColor" : "none"}
        />
        <span>Favorites</span>
      </button>

      <button
        type="button"
        className={`mobile-tab ${view === "lyrics" ? "active" : ""}`}
        onClick={() => setView("lyrics")}
        aria-label="Lyrics"
      >
        <span className="tab-icon-wrap">
          <FileText size={20} strokeWidth={view === "lyrics" ? 2.2 : 1.8} />
          {hasLyricsDoc && <span className="tab-dot" />}
        </span>
        <span>Lyrics</span>
      </button>

      <button
        type="button"
        className={`mobile-tab ${view === "history" ? "active" : ""}`}
        onClick={() => setView("history")}
        aria-label="Tracker"
      >
        <Activity size={20} strokeWidth={view === "history" ? 2.2 : 1.8} />
        <span>Tracker</span>
      </button>
    </nav>
  );
}
