import React from "react";
import {
  FolderOpen,
  Heart,
  Link2,
  Music2,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Collection } from "../../domain/collections";
import type { Playlist, Session, Track } from "../../domain/types";
import type { Playback } from "../../player/controller";
import { Artwork, IconButton } from "../common";
import { Collections } from "./Collections";

export interface LibraryViewProps {
  view: string;
  heading: string;
  playlist?: Playlist;
  tracks: Track[];
  visible: Track[];
  rows: { t: Track; entryId: string }[];
  currentTrack?: Track | null;
  playbackStatus: Playback["status"];
  session: Session;
  downloads: Record<string, string>;
  collections: Collection[];
  query: string;
  busy: boolean;
  mobile: boolean;
  desktop: boolean;
  onSetQuery: (q: string) => void;
  onSelectView: (view: string) => void;
  onPlayAll: () => void;
  onPlayTrackInList: (track: Track, index: number) => void;
  onImportMusic: (folder: boolean) => void;
  onRenamePlaylist?: (playlist: Playlist) => void;
  onDeletePlaylist?: (playlist: Playlist) => void;
  onFavorite: (trackId: string) => void;
  onRemoveTrack: (track: Track) => void;
  onDownloadTrack: (track: Track) => void;
  onDeleteOffline: (track: Track) => void;
  onQueueTrack: (trackId: string, next?: boolean) => void;
  onEnrichOnline?: (track: Track) => void;
  onRelinkTrack: (track: Track) => void;
  onChoosePlaylist: (track: Track) => void;
  onRemoveFromPlaylist?: (playlistId: string, entryId: string) => void;
}

const clock = (s: number) =>
  `${Math.floor((Number.isFinite(s) ? s : 0) / 60)}:${String(Math.floor((Number.isFinite(s) ? s : 0) % 60)).padStart(2, "0")}`;

export function LibraryView({
  view,
  heading,
  playlist,
  tracks,
  visible,
  rows,
  currentTrack,
  playbackStatus,
  session,
  downloads,
  collections,
  query,
  busy,
  mobile,
  desktop,
  onSetQuery,
  onSelectView,
  onPlayAll,
  onPlayTrackInList,
  onImportMusic,
  onRenamePlaylist,
  onDeletePlaylist,
  onFavorite,
  onRemoveTrack,
  onDownloadTrack,
  onDeleteOffline,
  onQueueTrack,
  onEnrichOnline,
  onRelinkTrack,
  onChoosePlaylist,
  onRemoveFromPlaylist,
}: LibraryViewProps) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MUSIC, AT YOUR OWN PACE</p>
          <h1>
            {heading}
            <span className="heading-dot">.</span>
          </h1>
          <p className="subtitle">
            {playlist
              ? `${playlist.items.length} saved entries · your own little world`
              : view === "favorites"
                ? "The songs you always come back to."
                : "Your music. Your words. A little closer."}
          </p>
        </div>
        <div className="heading-actions">
          {view !== "library" && rows.length > 0 && (
            <button className="subtle" onClick={onPlayAll}>
              <Play size={16} />
              Play collection
            </button>
          )}
          {playlist && onRenamePlaylist && (
            <button
              className="subtle"
              onClick={() => onRenamePlaylist(playlist)}
            >
              Rename
            </button>
          )}
          {playlist && onDeletePlaylist && (
            <IconButton
              label="Delete playlist"
              onClick={() => onDeletePlaylist(playlist)}
            >
              <Trash2 size={17} />
            </IconButton>
          )}
          <button
            className="primary"
            disabled={busy}
            onClick={() => onImportMusic(false)}
          >
            <Plus size={17} />
            {busy ? "Working…" : "Add music"}
          </button>
        </div>
      </div>

      <section className="library-tools">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search local library"
            placeholder="Find a song, artist, or album"
            value={query}
            onChange={(e) => onSetQuery(e.target.value)}
          />
          {query && (
            <button
              aria-label="Clear search"
              onClick={() => onSetQuery("")}
            >
              <X size={16} />
            </button>
          )}
        </label>
        <span className="muted">
          {visible.length} {visible.length === 1 ? "track" : "tracks"}
        </span>
        {!mobile && (
          <button
            className="subtle"
            disabled={busy}
            onClick={() => onImportMusic(true)}
          >
            <FolderOpen size={16} />
            Add folder
          </button>
        )}
      </section>

      {view === "library" ? (
        <Collections
          collections={collections}
          query={query}
          open={(id) => {
            onSelectView(id);
            onSetQuery("");
          }}
        />
      ) : !tracks.length ? (
        <section className="welcome">
          <div className="record-art">
            <div className="record">
              <div className="record-center">
                <Music2 size={30} />
              </div>
            </div>
            <span className="art-spark">✦</span>
          </div>
          <p className="eyebrow">A SPACE FOR YOUR SOUND</p>
          <h2>Make yourself at home.</h2>
          <p>
            Bring your music into Lumaire.
            <br />
            Listen, collect, and find the meaning between the lines.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => onImportMusic(false)}
          >
            <Plus size={18} />
            Choose your music
          </button>
          <span className="welcome-note">
            Local files · No account · No subscription
          </span>
          {!desktop && (
            <p className="desktop-note">
              Desktop library access requires <code>npm run desktop</code>.
            </p>
          )}
        </section>
      ) : !visible.length ? (
        <div className="empty">
          <Search size={30} />
          <h2>
            {query
              ? "No matching music"
              : view === "favorites"
                ? "Your favorites start here"
                : "An empty collection"}
          </h2>
          <p>
            {query
              ? "Try a different title, artist, or album."
              : view === "favorites"
                ? "Tap a heart beside a track to save it here."
                : "Add tracks using the collection menu in your library."}
          </p>
        </div>
      ) : (
        <>
          <div className="track-header">
            <span>#</span>
            <span>TRACK / ARTIST</span>
            <span>ALBUM</span>
            <span>TIME</span>
            <span />
          </div>
          <div className="track-list">
            {rows.map(({ t, entryId }, index) => (
              <div
                className={`track-row ${currentTrack?.id === t.id ? "current" : ""}`}
                key={entryId}
              >
                <button
                  className="track-play"
                  aria-label={`Play ${t.title}`}
                  onClick={() => onPlayTrackInList(t, index)}
                >
                  {currentTrack?.id === t.id &&
                  playbackStatus === "playing" ? (
                    <span className="equalizer">▥</span>
                  ) : (
                    <>
                      <span className="track-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Play className="row-play" size={15} />
                    </>
                  )}
                </button>
                <button
                  className="track-meta"
                  onClick={() => onPlayTrackInList(t, index)}
                >
                  <Artwork
                    url={t.artworkUrl}
                    className={`color-${index % 5}`}
                  />
                  <span>
                    <strong dir="auto">{t.title}</strong>
                    <small dir="auto">
                      {t.artist}
                      {` · ${t.offline ? "Downloaded · Offline" : t.source ? "Saved online" : "Local file"} · ${t.format}`}
                      {t.missing ? " · File missing" : ""}
                    </small>
                  </span>
                </button>
                <span
                  className="album ellipsis"
                  title={t.album?.trim() || "Unknown"}
                >
                  {t.album?.trim() || "Unknown"}
                </span>
                <span className="duration">
                  {t.duration ? clock(t.duration) : "—"}
                </span>
                <div className="track-actions">
                  <IconButton
                    label={`${session.favorites.includes(t.id) ? "Unfavorite" : "Favorite"} ${t.title}`}
                    active={session.favorites.includes(t.id)}
                    onClick={() => onFavorite(t.id)}
                  >
                    <Heart
                      size={17}
                      fill={
                        session.favorites.includes(t.id)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </IconButton>
                  <details className="track-menu">
                    <summary aria-label={`Actions for ${t.title}`}>
                      •••
                    </summary>
                    <div className="menu-popover">
                      <button
                        disabled={
                          busy ||
                          t.offline ||
                          downloads[t.id] === "downloading"
                        }
                        onClick={() => onRemoveTrack(t)}
                      >
                        Remove from library
                      </button>
                      {t.source && !t.offline && (
                        <button
                          disabled={downloads[t.id] === "downloading"}
                          onClick={() => onDownloadTrack(t)}
                        >
                          Download for offline
                        </button>
                      )}
                      {t.offline && (
                        <button onClick={() => onDeleteOffline(t)}>
                          Delete offline copy
                        </button>
                      )}
                      <button onClick={() => onQueueTrack(t.id, true)}>
                        Play next
                      </button>
                      <button onClick={() => onQueueTrack(t.id)}>
                        Add to queue
                      </button>
                      {t.source?.providerId === "youtube" && onEnrichOnline && (
                        <button
                          disabled={busy}
                          onClick={() => onEnrichOnline(t)}
                        >
                          Refresh metadata
                        </button>
                      )}
                      {!t.source && (
                        <button
                          disabled={mobile}
                          title={
                            mobile
                              ? "Re-import this file with Add music in the Android prototype."
                              : undefined
                          }
                          onClick={() => onRelinkTrack(t)}
                        >
                          <Link2 size={14} />
                          Relink file
                        </button>
                      )}
                      {t.source?.providerId === "wikimedia-commons" && (
                        <a
                          className="source-credits"
                          href={t.source.pageUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t.source.attribution} · {t.source.license}
                        </a>
                      )}
                      <button onClick={() => onChoosePlaylist(t)}>
                        Save to playlist
                      </button>
                      {playlist && onRemoveFromPlaylist && (
                        <button
                          onClick={() => onRemoveFromPlaylist(playlist.id, entryId)}
                        >
                          Remove one from collection
                        </button>
                      )}
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
          <p className="library-footer">
            <span className="small-dot" /> Your saved sources and
            files, organized here.
          </p>
        </>
      )}
    </>
  );
}
