import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Clock,
  Loader2,
  Play,
  Search,
  X,
} from "lucide-react";
import { library, type CatalogTrack, type CatalogArtist, type CatalogAlbum } from "../../adapters/native";
import type { Track } from "../../domain/types";
import type { ListeningRecord } from "../../domain/listening";
import { clearDiscoverySearches, discoveryPreferences, rememberDiscoverySearch } from "../../adapters/discovery-home";
import { DiscoveryHome } from "./DiscoveryHome";
import { Artwork, IconButton } from "../common";
import { EngineSetupCard, type EngineSetupProps } from "../common/EngineSetupCard";
import { CatalogTrackActions, type CatalogActionHandlers } from "../common/CatalogTrackActions";
import type { CommonsDiscoveryState } from "./CommonsDiscovery";

export interface DiscoveryViewState {
  query: string;
  results: CatalogTrack[];
  artists: CatalogArtist[];
  albums: CatalogAlbum[];
  searchedQuery: string;
  entityError: string;
  searching: boolean;
  error: string;
  scrollTop: number;
  commons: CommonsDiscoveryState;
}

export const initialDiscoveryViewState = (): DiscoveryViewState => ({
  query: "",
  results: [],
  artists: [],
  albums: [],
  searchedQuery: "",
  entityError: "",
  searching: false,
  error: "",
  scrollTop: 0,
  commons: { query: "", results: [], loading: false, error: "" },
});

export interface DiscoveryViewProps extends CatalogActionHandlers, EngineSetupProps {
  onPlayAlbum: (id: string) => Promise<void>;
  state: DiscoveryViewState;
  onStateChange: (
    update: (current: DiscoveryViewState) => DiscoveryViewState,
  ) => void;
  ytdlpAvailable: boolean;
  mobile: boolean;
  busy: boolean;
  downloads: Record<string, string>;
  onSaveDiscovery: (
    result: CatalogTrack,
    mode: "play" | "save" | "next" | "queue",
  ) => void;
  onChoosePlaylist: (track: Track) => void;
  onDownloadTrack: (track: Track) => void;
  onSaveCommons: (track: Track, play: boolean) => void;
  onQueueRemote: (track: Track, next: boolean) => void;
  onNavigateArtist?: (artistId: string) => void;
  onNavigateAlbum?: (albumId: string) => void;
  recentRecords: ListeningRecord[];
  historyEnabled: boolean;
  onReplay: (record: ListeningRecord) => void;
  onImportMusic: () => void;
  onOpenLibrary: () => void;
}

const clock = (s: number) =>
  `${Math.floor((Number.isFinite(s) ? s : 0) / 60)}:${String(Math.floor((Number.isFinite(s) ? s : 0) % 60)).padStart(2, "0")}`;

export function DiscoveryView({
  savedTracks, favorites, onCatalogAction,
  state,
  onStateChange,
  ytdlpAvailable,
  mobile,
  busy,
  downloads,
  onSaveDiscovery,
  onPlayAlbum,
  onChoosePlaylist,
  onDownloadTrack,
  onSaveCommons,
  onQueueRemote,
  onNavigateArtist,
  onNavigateAlbum,
  recentRecords,
  historyEnabled,
  onReplay,
  onImportMusic,
  onOpenLibrary,
  ...engineSetup
}: DiscoveryViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchGeneration = useRef(0);
  const [recentSearches, setRecentSearches] = useState(() => discoveryPreferences().searches);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!historyEnabled) { clearDiscoverySearches(); setRecentSearches([]); }
  }, [historyEnabled]);
  useEffect(() => () => {
    searchGeneration.current++;
    onStateChange(current => ({ ...current, searching: false }));
  }, []);
  const { query, results, artists, albums, searchedQuery, entityError, searching, error } = state;

  useLayoutEffect(() => {
    const main = rootRef.current?.closest("main");
    if (!main) return;
    main.scrollTop = state.scrollTop;

    return () => {
      onStateChange((current) => ({
        ...current,
        scrollTop: main.scrollTop,
      }));
    };
  }, []);

  const handleSearch = (requested = query) => {
    const trimmed = requested.trim().slice(0, 200);
    if (!trimmed || searching) return;
    if (historyEnabled) setRecentSearches(rememberDiscoverySearch(trimmed));
    rootRef.current?.closest("main")?.scrollTo({ top: 0 });
    const generation = ++searchGeneration.current;
    onStateChange((current) => ({
      ...current,
      searching: true,
      query: trimmed,
      scrollTop: 0,
      results: [],
      artists: [],
      albums: [],
      searchedQuery: trimmed,
      entityError: "",
      error: "",
    }));
    void Promise.allSettled([
      library.searchCatalog(trimmed, 20),
      library.searchCatalogEntities(trimmed),
    ]).then(([songs, entities]) => {
        if (generation !== searchGeneration.current) return;
        onStateChange((current) => ({
          ...current,
          results: songs.status === "fulfilled" ? songs.value : [],
          artists: entities.status === "fulfilled" ? entities.value.artists : [],
          albums: entities.status === "fulfilled" ? entities.value.albums : [],
          entityError: entities.status === "fulfilled" ? entities.value.warning || "" : String(entities.reason),
          searching: false,
          error: songs.status === "rejected" ? String(songs.reason) : "",
        }));
      });
  };

  return (
    <div
      ref={rootRef}
      className="discovery-view-state"
    >
      <section className="discover-page">
        <div className="page-heading discover-page-heading">
          <div>
            <p className="eyebrow">ONLINE & CURATED</p>
            <h1>
              Discover<span className="heading-dot">.</span>
            </h1>
            <p className="subtitle">
              Search songs, artists, albums, or explore curated playlists and trending releases.
            </p>
          </div>
        </div>

        <div className="discover-search-central" ref={searchWrapRef}>
          <label className={`discover-search-bar ${searchFocused ? "is-focused" : ""}`}>
            <Search size={16} className="discover-search-icon" />
            <input
              aria-label="Search music"
              placeholder="Search songs, artists, albums…"
              maxLength={200}
              value={query}
              disabled={searching}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) =>
                onStateChange((current) => ({
                  ...current,
                  query: e.target.value,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setSearchFocused(false);
                  handleSearch();
                } else if (e.key === "Escape") {
                  setSearchFocused(false);
                }
              }}
            />
            {searching ? (
              <Loader2 size={15} className="spin" style={{ color: "var(--accent)" }} />
            ) : query ? (
              <button
                type="button"
                className="search-clear-button"
                aria-label="Clear search"
                onClick={() => {
                  searchGeneration.current++;
                  onStateChange((current) => ({
                    ...current,
                    query: "",
                    searching: false,
                    results: [],
                    artists: [],
                    albums: [],
                    searchedQuery: "",
                    entityError: "",
                    error: "",
                  }));
                }}
              >
                <X size={14} />
              </button>
            ) : null}
          </label>

          {searchFocused && historyEnabled && recentSearches.length > 0 && !query.trim() && (
            <div className="discover-search-popover">
              <div className="discover-popover-header">
                <span>Recent searches</span>
                <button
                  type="button"
                  className="link-button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    clearDiscoverySearches();
                    setRecentSearches([]);
                  }}
                >
                  Clear all
                </button>
              </div>
              <div className="discover-popover-items">
                {recentSearches.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className="discover-popover-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearchFocused(false);
                      handleSearch(item);
                    }}
                  >
                    <Clock size={13} className="discover-popover-icon" />
                    <span className="discover-popover-text ellipsis">{item}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {!ytdlpAvailable && mobile && engineSetup.engineState !== "checking" && <div className="banner error" role="alert">Online streaming could not start. Try restarting Lumaire; your local music remains available.</div>}
        {!mobile && (!ytdlpAvailable || engineSetup.engineState === "installing") && <EngineSetupCard {...engineSetup} />}

        {error && (
          <div className="banner error" role="alert">
            <span>{error}</span>
            <IconButton
              label="Dismiss error"
              onClick={() =>
                onStateChange((current) => ({ ...current, error: "" }))
              }
            >
              <X size={16} />
            </IconButton>
          </div>
        )}

        {!searchedQuery && !searching && !error && (
          <DiscoveryHome
            searches={historyEnabled ? recentSearches : []}
            records={historyEnabled ? recentRecords : []}
            savedTracks={savedTracks}
            busy={busy}
            onlineAvailable={ytdlpAvailable}
            onSearch={handleSearch}
            onClearSearches={() => {
              clearDiscoverySearches();
              setRecentSearches([]);
            }}
            onReplay={onReplay}
            onImportMusic={onImportMusic}
            onOpenLibrary={onOpenLibrary}
            onNavigateAlbum={onNavigateAlbum}
            onNavigateArtist={onNavigateArtist}
            onSaveDiscovery={onSaveDiscovery}
            onPlayAlbum={onPlayAlbum}
            favorites={favorites}
            downloads={downloads}
            onCatalogAction={onCatalogAction}
          />
        )}

        {!searching && searchedQuery && (
          <div className="catalog-search-results">
            {entityError && <p className="subtitle" role="status">{entityError}</p>}
            <section aria-label="Artists" className="catalog-search-section">
              <h2>Artists</h2>
              {artists.length ? <div className="search-artists">
                {artists.map(artist => <button key={artist.id} className="search-artist" onClick={() => onNavigateArtist?.(artist.id)}>
                  <Artwork url={artist.artworkUrl} kind="artist" />
                  <span>{artist.name}</span>
                </button>)}
              </div> : <p className="subtitle">No artist results for this search.</p>}
            </section>
            <section aria-label="Albums" className="catalog-search-section">
              <h2>Albums</h2>
              {albums.length ? <div className="albums-grid">
                {albums.map(album => <button key={album.id} className="album-card" aria-label={`Open album ${album.title}`} onClick={() => onNavigateAlbum?.(album.id)}>
                  <Artwork url={album.artworkUrl} className="album-card-cover" />
                  <div className="album-card-info">
                    <div className="album-title" title={album.title}>{album.title}</div>
                    <div className="album-year" title={`${album.artist}${album.year != null ? ` · ${album.year}` : ""}`}>{album.artist}{album.year != null ? ` · ${album.year}` : ""}</div>
                  </div>
                </button>)}
              </div> : <p className="subtitle">No album results for this search.</p>}
            </section>
            <h2>Songs</h2>
            {!results.length && <p className="subtitle">No song results for this search.</p>}
          </div>
        )}

        {searching && (
          <div className="empty">
            <Loader2 size={36} className="spin" />
            <h2>Searching...</h2>
          </div>
        )}

        {!searching && results.length > 0 && (
          <>
            <div className="track-header">
              <span>#</span>
              <span>TRACK / ARTIST</span>
              <span>ALBUM</span>
              <span>TIME</span>
              <span />
            </div>
            <div className="track-list">
              {results.map((t, index) => {
                const music = t;
                return (
                <div className="track-row" key={t.id}>
                  <button
                    className="track-play"
                    aria-label={`Play ${music.title}`}
                    disabled={busy || !ytdlpAvailable}
                    onClick={() => onSaveDiscovery(t, "play")}
                  >
                    <span className="track-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Play className="row-play" size={15} />
                  </button>
                  <div
                    className="track-meta"
                  >
                    <Artwork
                      url={t.artworkUrl}
                      className={`color-${index % 5}`}
                    />
                    <span>
                      <button className="track-title-button" aria-label={`Listen to ${music.title}`} disabled={busy || !ytdlpAvailable} onClick={() => onSaveDiscovery(t, "play")}>
                        <strong dir="auto" title={t.title}>{music.title}</strong>
                      </button>
                      <small dir="auto">
                        {t.artists && t.artists.length > 0 && onNavigateArtist ? (
                          <>
                            {t.artists.map((artist, idx) => (
                              <span key={idx}>
                                {idx > 0 && ", "}
                                {artist.id ? (
                                  <button
                                    className="link-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNavigateArtist(artist.id!);
                                    }}
                                  >
                                    {artist.name}
                                  </button>
                                ) : (
                                  artist.name
                                )}
                              </span>
                            ))}
                          </>
                        ) : (
                          music.artist
                        )}
                      </small>
                    </span>
                  </div>
                  <span className="album ellipsis" title={music.album}>
                    {t.albumId && onNavigateAlbum && music.album ? (
                      <button
                        className="link-button"
                        onClick={() => onNavigateAlbum(t.albumId!)}
                      >
                        {music.album}
                      </button>
                    ) : (
                      music.album || "—"
                    )}
                  </span>
                  <span className="duration">
                    {t.duration ? clock(t.duration) : "—"}
                  </span>
                  <div className="track-actions">
                    <CatalogTrackActions track={t} savedTracks={savedTracks} favorites={favorites} onCatalogAction={onCatalogAction} disabled={busy || !ytdlpAvailable} />
                  </div>
                </div>
              ); })}
            </div>
            <p className="library-footer">
              <span className="small-dot" /> Music catalogue · {results.length} tracks
            </p>
          </>
        )}
      </section>
    </div>
  );
}
