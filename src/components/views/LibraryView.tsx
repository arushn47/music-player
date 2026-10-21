import React from "react";
import {
  FolderOpen,
  Heart,
  Link2,
  Music2,
  Play,
  Plus,
  Search,
  Shuffle,
  X,
} from "lucide-react";
import type { Collection } from "../../domain/collections";
import type { Playlist, Session, Track } from "../../domain/types";
import type { Playback } from "../../player/controller";
import { Artwork, DownloadedBadge, IconButton } from "../common";
import { Collections } from "./Collections";
import { ArtistLinks } from "../common/ArtistLinks";
import { AlbumLink } from "../common/AlbumLink";

export interface LibraryViewProps {
  onNavigateArtist?: (id: string) => void;
  onNavigateAlbum?: (id: string) => void;
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
  onShufflePlay?: () => void;
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
  onOpenAddMusic?: (playlist: Playlist) => void;
}

const clock = (s: number) =>
  `${Math.floor((Number.isFinite(s) ? s : 0) / 60)}:${String(Math.floor((Number.isFinite(s) ? s : 0) % 60)).padStart(2, "0")}`;

export function LibraryView({
  onNavigateArtist, onNavigateAlbum,
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
  onShufflePlay,
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
  onOpenAddMusic,
}: LibraryViewProps) {
  const isPlaylistOrFavorites = Boolean(playlist) || view === "favorites";
  const totalSeconds = rows.reduce((acc, { t }) => acc + (t.duration || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = Math.floor(totalSeconds % 60);
  const durationFormatted =
    totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)} hr ${totalMinutes % 60} min`
      : `${totalMinutes} min ${remainingSeconds} sec`;

  const coverArtworks = Array.from(
    new Set(
      rows
        .map(({ t }) => t.artworkUrl)
        .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    )
  ).slice(0, 4);

  return (
    <>
      {isPlaylistOrFavorites ? (
        <div className="page-heading catalog-hero collection-header">
          <div className="collection-cover album-cover">
            {coverArtworks.length >= 4 ? (
              <div className="playlist-mosaic-grid">
                {coverArtworks.map((url, i) => (
                  <Artwork key={i} url={url} />
                ))}
              </div>
            ) : coverArtworks.length >= 1 ? (
              <Artwork url={coverArtworks[0]} className="playlist-cover-single" />
            ) : (
              <div className="playlist-cover-empty">
                <Music2 size={48} />
              </div>
            )}
          </div>

          <div className="album-info">
            <p className="eyebrow">
              {view === "favorites" ? "COLLECTION" : "PLAYLIST"}
            </p>
            <h1>
              {heading}
            </h1>
            <div className="subtitle album-meta">
              <span>{rows.length} {rows.length === 1 ? "track" : "tracks"}</span>
              {totalSeconds > 0 && <span>{durationFormatted}</span>}
            </div>

            <div className="album-actions">
              {rows.length > 0 && (
                <button className="primary" onClick={onPlayAll}>
                  <Play size={16} fill="currentColor" />
                  Play
                </button>
              )}
              {rows.length > 0 && onShufflePlay && (
                <button
                  className="subtle icon-only"
                  onClick={onShufflePlay}
                  aria-label="Shuffle"
                  title="Shuffle"
                >
                  <Shuffle size={17} />
                </button>
              )}
              <button
                className="subtle"
                disabled={busy}
                onClick={() => {
                  if (playlist && onOpenAddMusic) {
                    onOpenAddMusic(playlist);
                  } else if (view === "favorites" && onOpenAddMusic) {
                    onOpenAddMusic({
                      id: "favorites",
                      name: "Your favorites",
                      items: rows.map((r) => ({ id: r.entryId, trackId: r.t.id })),
                    });
                  } else {
                    onImportMusic(false);
                  }
                }}
              >
                <Plus size={16} />
                Add music
              </button>
              {(playlist || view === "favorites") && (
                <details className="track-menu collection-menu">
                  <summary aria-label="Collection options">•••</summary>
                  <div className="menu-popover">
                    <button type="button" onClick={() => onImportMusic(false)}>
                      <FolderOpen size={14} /> Import local files
                    </button>
                    {playlist && onRenamePlaylist && (
                      <button type="button" onClick={() => onRenamePlaylist(playlist)}>
                        Rename playlist
                      </button>
                    )}
                    {playlist && onDeletePlaylist && (
                      <button type="button" onClick={() => onDeletePlaylist(playlist)}>
                        Delete playlist
                      </button>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="page-heading">
          <div>
            <p className="eyebrow">MUSIC, AT YOUR OWN PACE</p>
            <h1>
              {heading}
              <span className="heading-dot">.</span>
            </h1>
            <p className="subtitle">
              Your music. Your words. A little closer.
            </p>
          </div>
          <div className="heading-actions">
            {view !== "library" && rows.length > 0 && (
              <button className="subtle" onClick={onPlayAll}>
                <Play size={16} />
                Play collection
              </button>
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
      )}

      <section className="library-tools">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search local library"
            placeholder={playlist ? `Find in ${heading}…` : "Find a song, artist, or album"}
            value={query}
            onChange={(e) => onSetQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="search-clear-button"
              aria-label="Clear search"
              onClick={() => onSetQuery("")}
            >
              <X size={15} />
            </button>
          )}
        </label>
        <span className="muted">
          {visible.length} {visible.length === 1 ? "track" : "tracks"}
        </span>
        {!mobile && !isPlaylistOrFavorites && (
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

      {view === "favorites" && session.favoriteAlbums.length > 0 && <section aria-label="Favorite albums" className="favorite-albums">
        <h2>Favorite albums</h2>
        <div className="catalog-card-grid">
          {session.favoriteAlbums.map(album => <button className="album-card" key={album.id} aria-label={`Open album ${album.title}`} onClick={() => onNavigateAlbum?.(album.id)}>
            <Artwork url={album.artworkUrl} className="album-card-cover" />
            <div className="album-card-info">
              <span className="album-title">{album.title}</span>
              <span className="album-year">{album.artist}</span>
            </div>
          </button>)}
        </div>
      </section>}
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
        <div className={`empty ${isPlaylistOrFavorites ? "playlist-empty-card" : ""}`}>
          <Search size={30} />
          <h2>
            {query
              ? "No matching music"
              : view === "favorites"
                ? "Your favorites start here"
                : "An empty playlist"}
          </h2>
          <p>
            {query
              ? "Try a different title, artist, or album."
              : view === "favorites"
                ? "Tap a heart beside a track to save it here."
                : "Add tracks from Discover or your library to build this playlist."}
          </p>
          {!query && isPlaylistOrFavorites && (
            <div className="playlist-empty-actions">
              <button
                className="primary"
                onClick={() => {
                  if (playlist && onOpenAddMusic) {
                    onOpenAddMusic(playlist);
                  } else if (view === "favorites" && onOpenAddMusic) {
                    onOpenAddMusic({
                      id: "favorites",
                      name: "Your favorites",
                      items: [],
                    });
                  } else {
                    onSelectView("discover");
                  }
                }}
              >
                <Plus size={16} />
                Add online music
              </button>
              <button
                className="subtle"
                disabled={busy}
                onClick={() => onImportMusic(false)}
              >
                <FolderOpen size={15} />
                Import local files
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {view === "favorites" && <h2 className="favorite-songs-title">Favorite songs</h2>}
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
                <div className="track-meta">
                  <Artwork
                    url={t.artworkUrl}
                    className={`color-${index % 5}`}
                  />
                  <span>
                    <button className="track-title-button" aria-label={`Listen to ${t.title}`} onClick={() => onPlayTrackInList(t, index)}><strong dir="auto">{t.title}</strong></button>
                    <small dir="auto">
                      <DownloadedBadge track={t} />
                      <ArtistLinks artistString={t.artist} onNavigateArtist={onNavigateArtist} />
                      {` · ${t.offline ? "Offline" : t.format === "catalog" ? "Imported · resolves when played" : t.source ? "Online" : "Local file"}${t.format === "catalog" ? "" : ` · ${t.format}`}`}
                      {t.missing ? " · File missing" : ""}
                    </small>
                  </span>
                </div>
                <span
                  className="album ellipsis"
                  title={t.album?.trim() || "Unknown"}
                >
                  <AlbumLink title={t.album} artist={t.artist} onNavigateAlbum={onNavigateAlbum} />
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
                      {(t.source || t.format === "catalog") && !t.offline && (
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
                          Remove from this playlist
                        </button>
                      )}
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
          {isPlaylistOrFavorites ? (
            <p className="library-footer playlist-footer">
              <span className="small-dot" /> {rows.length} {rows.length === 1 ? "track" : "tracks"}
              {totalSeconds > 0 && ` · ${durationFormatted}`}
            </p>
          ) : (
            <p className="library-footer">
              <span className="small-dot" /> Your saved sources and
              files, organized here.
            </p>
          )}
        </>
      )}
    </>
  );
}
