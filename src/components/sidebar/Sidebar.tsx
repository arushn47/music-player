import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ChevronUp,
  ChevronDown,
  FileText,
  Globe,
  Heart,
  Headphones,
  Library,
  ListMusic,
  Plus,
  Settings,
  Settings2,
} from "lucide-react";
import { Artwork } from "../common/Artwork";
import type { Collection } from "../../domain/collections";
import { IconButton } from "../common/IconButton";
import type { Session } from "../../domain/types";

export interface SidebarProps {
  view: string;
  setView: (view: string) => void;
  onHome: () => void;
  collectionsCount: number;
  playlists: Session["playlists"];
  collections: Collection[];
  hasLyricsDoc: boolean;
  onCreatePlaylist: () => void;
  queueOpen?: boolean;
  onToggleQueue?: () => void;
}

export function Sidebar({
  view,
  setView,
  onHome,
  collectionsCount,
  playlists,
  collections,
  hasLyricsDoc,
  onCreatePlaylist,
  queueOpen,
  onToggleQueue,
}: SidebarProps) {
  const playlistNav = useRef<HTMLElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ above: false, below: false });
  useEffect(() => {
    const nav = playlistNav.current;
    if (!nav) return;
    const measure = () => {
      const above = nav.scrollTop > 1;
      const below = nav.scrollHeight - nav.clientHeight - nav.scrollTop > 1;
      setScrollEdges(previous => previous.above === above && previous.below === below ? previous : { above, below });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    nav.addEventListener('scroll', measure, { passive: true });
    return () => { observer.disconnect(); nav.removeEventListener('scroll', measure); };
  }, [playlists.length]);
  return (
    <>
      <aside className="sidebar desktop-sidebar">
        <a
          className="brand"
        href="#"
        title="Lumaire · Home"
        onClick={(e) => {
          e.preventDefault();
          onHome();
        }}
      >
        <span className="brand-icon">
          <svg
            viewBox="0 0 128 128"
            width="30"
            height="30"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect width="128" height="128" rx="28" fill="currentColor" opacity="0.14" />
            <path
              d="M31 74V61a33 33 0 0 1 66 0v13"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <rect x="27" y="64" width="18" height="31" rx="8" fill="currentColor" />
            <rect x="83" y="64" width="18" height="31" rx="8" fill="currentColor" />
            <circle cx="64" cy="91" r="5" fill="currentColor" />
          </svg>
        </span>
        <span className="brand-text">
          Lumaire<span className="brand-dot">.</span>
        </span>
      </a>

      <div className="sidebar-caption">YOUR SPACE</div>
      <nav aria-label="Main navigation">
        <button className={view === "discover" ? "selected" : ""} onClick={() => setView("discover")} title="Discover">
          <Globe size={19} /><span className="nav-label">Discover</span>
        </button>
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
      </nav>

      <div className="sidebar-caption playlist-label">
        PLAYLISTS{" "}
        <IconButton label="Create playlist" onClick={onCreatePlaylist}>
          <Plus size={17} />
        </IconButton>
      </div>

      <div className="playlist-scroll-region" data-scroll-above={scrollEdges.above} data-scroll-below={scrollEdges.below}>
      <nav ref={playlistNav} aria-label="Playlists" className="playlists-nav">
        {playlists.map((p) => {
          const covers = [...new Set(collections.find(collection => collection.id === p.id)?.tracks
            .map(track => track.artworkUrl).filter((url): url is string => !!url?.trim()) || [])].slice(0, 4);
          const artwork = covers.length >= 4 ? covers : covers.slice(0, 1);
          return (
          <button
            key={p.id}
            className={view === p.id ? "selected" : ""}
            onClick={() => setView(p.id)}
            title={p.name}
          >
            <span className={`sidebar-playlist-cover${artwork.length === 4 ? " is-mosaic" : ""}`} aria-hidden="true">
              {artwork.length ? artwork.map(url => <Artwork key={url} url={url} />) : <ListMusic size={18} />}
            </span>
            <span className="ellipsis nav-label">{p.name}</span>
            <span className="nav-count">{p.items.length}</span>
          </button>
        );})}
        {!playlists.length && (
          <p className="sidebar-note">
            A little order for
            <br />
            everything you love.
          </p>
        )}
      </nav>
      {scrollEdges.above && <button className="playlist-scroll-cue scroll-up" aria-label="Scroll playlists up" title="More playlists above" onClick={() => playlistNav.current?.scrollBy({ top: -144 })}><ChevronUp size={13} /></button>}
      {scrollEdges.below && <button className="playlist-scroll-cue scroll-down" aria-label="Scroll playlists down" title="More playlists below" onClick={() => playlistNav.current?.scrollBy({ top: 144 })}><ChevronDown size={13} /></button>}
      </div>

      <div className="sidebar-bottom">
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
    <header className="mobile-header">
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
            <svg
              viewBox="0 0 128 128"
              width="26"
              height="26"
              fill="currentColor"
              aria-hidden="true"
            >
              <rect width="128" height="128" rx="28" fill="currentColor" opacity="0.14" />
              <path
                d="M31 74V61a33 33 0 0 1 66 0v13"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <rect x="27" y="64" width="18" height="31" rx="8" fill="currentColor" />
              <rect x="83" y="64" width="18" height="31" rx="8" fill="currentColor" />
              <circle cx="64" cy="91" r="5" fill="currentColor" />
            </svg>
          </span>
          <span className="brand-text">
            Lumaire<span className="brand-dot">.</span>
          </span>
        </a>

        <div className="mobile-header-actions">
          {onToggleQueue && (
            <button
              type="button"
              className={`mobile-header-btn ${queueOpen ? "selected" : ""}`}
              onClick={onToggleQueue}
              aria-label={queueOpen ? "Hide queue" : "Show queue"}
              title={queueOpen ? "Hide queue" : "Show queue"}
            >
              <ListMusic size={20} />
            </button>
          )}
          <button
            type="button"
            className={`mobile-header-btn ${view === "settings" ? "selected" : ""}`}
            onClick={() => setView("settings")}
            aria-label="App settings"
            title="App settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>
    </>
  );
}
