import React, { useEffect, useState } from "react";
import {
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  cachedHomeAlbums,
  DISCOVERY_LANGUAGES,
  discoveryPreferences,
  loadHomeAlbums,
  setDiscoveryLanguage,
  type DiscoveryLanguage,
  type HomeAlbums,
} from "../../adapters/discovery-home";
import { historyArtwork, type ListeningRecord } from "../../domain/listening";
import type { Track } from "../../domain/types";
import { Artwork, DownloadedBadge, Select } from "../common";
import { CatalogTrackActions } from "../common/CatalogTrackActions";
import { library, type CatalogAlbum, type CatalogTrack } from "../../adapters/native";

export interface DiscoveryHomeProps {
  onPlayAlbum: (id: string) => Promise<void>;
  searches: string[];
  records: ListeningRecord[];
  savedTracks: Track[];
  busy: boolean;
  onlineAvailable: boolean;
  onSearch: (query: string) => void;
  onClearSearches: () => void;
  onReplay: (record: ListeningRecord) => void;
  onImportMusic?: () => void;
  onOpenLibrary?: () => void;
  onNavigateAlbum?: (id: string) => void;
  onNavigateArtist?: (id: string) => void;
  onSaveDiscovery?: (track: CatalogTrack, mode: "play" | "save" | "next" | "queue") => void;
  favorites?: string[];
  downloads?: Record<string, string>;
  onCatalogAction?: (track: CatalogTrack, action: any) => void;
}

const label = (language: string) =>
  language.charAt(0).toUpperCase() + language.slice(1);

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  if (hour >= 18 && hour < 22) return "Good evening";
  return "Good night";
}

interface MoodChip {
  id: string;
  label: string;
  query?: string;
}

const MOOD_CHIPS: MoodChip[] = [
  { id: "all", label: "All" },
  { id: "trending", label: "Top Hits", query: "trending top hits" },
  { id: "chill", label: "Chill", query: "chill lofi relaxing" },
  { id: "workout", label: "Workout", query: "workout energy gym" },
  { id: "focus", label: "Focus", query: "focus ambient study instrumental" },
  { id: "party", label: "Party", query: "party dance club hits" },
  { id: "romantic", label: "Romance", query: "romantic love acoustic" },
  { id: "acoustic", label: "Acoustic", query: "indie folk acoustic" },
];

export function DiscoveryHome({
  searches,
  records,
  savedTracks,
  busy,
  onlineAvailable,
  onSearch,
  onClearSearches,
  onReplay,
  onNavigateAlbum,
  onNavigateArtist,
  onSaveDiscovery,
  onPlayAlbum,
  favorites = [],
  downloads = {},
  onCatalogAction,
}: DiscoveryHomeProps) {
  const [language, setLanguage] = useState<DiscoveryLanguage>(
    () => discoveryPreferences().language,
  );
  const [shelf, setShelf] = useState<HomeAlbums | null>(() => cachedHomeAlbums(language));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [playingAlbum, setPlayingAlbum] = useState<string | null>(null);

  // Spotlight album & tracks
  const spotlightAlbum = shelf?.albums[0] ?? null;
  const [spotlightTracks, setSpotlightTracks] = useState<CatalogTrack[]>([]);

  // Mood / Vibe state
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [moodTracks, setMoodTracks] = useState<CatalogTrack[]>([]);
  const [moodLoading, setMoodLoading] = useState(false);

  // Load home albums
  useEffect(() => {
    let active = true;
    setShelf(cachedHomeAlbums(language));
    setLoading(true);
    setError("");
    void loadHomeAlbums(language, revision > 0)
      .then((value) => {
        if (active) setShelf(value);
      })
      .catch(() => {
        if (active)
          setError(
            "Couldn't refresh albums. You can still search, revisit saved albums or play your local music.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [language, revision]);

  // Fetch top tracks for the spotlight album
  useEffect(() => {
    if (!spotlightAlbum) {
      setSpotlightTracks([]);
      return;
    }
    let active = true;
    library
      .lookupAlbum(spotlightAlbum.id)
      .then((data) => {
        if (active && data?.tracks?.length) {
          setSpotlightTracks(data.tracks.slice(0, 6));
        }
      })
      .catch(() => {
        if (active) setSpotlightTracks([]);
      });
    return () => {
      active = false;
    };
  }, [spotlightAlbum?.id]);

  // Fetch mood tracks when a mood filter is active
  useEffect(() => {
    if (selectedMood === "all") {
      setMoodTracks([]);
      return;
    }
    const chip = MOOD_CHIPS.find((m) => m.id === selectedMood);
    if (!chip?.query) return;

    let active = true;
    setMoodLoading(true);
    library
      .searchCatalog(`${chip.query} ${language}`, 8)
      .then((tracks) => {
        if (active) setMoodTracks(tracks);
      })
      .catch(() => {
        if (active) setMoodTracks([]);
      })
      .finally(() => {
        if (active) setMoodLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedMood, language]);

  const seen = new Set<string>();
  const recent = [...records]
    .sort((a, b) => b.startedAt - a.startedAt)
    .filter((record) => !seen.has(record.trackId) && seen.add(record.trackId))
    .slice(0, 9);

  const greeting = getGreeting();

  const handlePlayAlbum = async (album: CatalogAlbum, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (playingAlbum) return;
    setPlayingAlbum(album.id);
    try { await onPlayAlbum(album.id); }
    finally { setPlayingAlbum(null); }
  };

  return (
    <div className="discovery-home">
      {/* Sleek Subbar: Mood Filter Pills on left, Language + Refresh on right */}
      <div className="discover-subbar">
        <div className="discover-mood-bar" role="toolbar" aria-label="Browse by mood and genre">
          {MOOD_CHIPS.map((chip) => (
            <button
              key={chip.id}
              className={`discover-mood-chip ${selectedMood === chip.id ? "is-active" : ""}`}
              onClick={() => setSelectedMood(chip.id)}
              aria-pressed={selectedMood === chip.id}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="discover-shelf-controls">
          <Select
            ariaLabel="Discovery language"
            value={language}
            options={DISCOVERY_LANGUAGES.map((value) => ({
              value,
              label: label(value),
            }))}
            onChange={(value) => {
              setRevision(0);
              setDiscoveryLanguage(value);
              setLanguage(value);
            }}
          />
          <button
            className="subtle icon-only discover-refresh-btn"
            disabled={loading}
            aria-label="Refresh discovery albums"
            title="Refresh albums"
            onClick={() => setRevision((value) => value + 1)}
          >
            {loading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
          </button>
        </div>
      </div>

      {/* Jump Back In / Recently Played (Spotify) */}
      {recent.length > 0 && selectedMood === "all" && (
        <section aria-label="Recently played" className="discover-home-section">
          <div className="discover-section-heading">
            <h2>Jump back in</h2>
          </div>
          <div className="discover-recent-grid">
            {recent.map((record) => {
              const saved = savedTracks.find((track) => track.id === record.trackId);
              const unavailable = saved ? saved.missing : record.providerId !== "youtube";
              const needsSetup =
                !onlineAvailable &&
                !saved?.offline &&
                (saved?.source?.providerId || record.providerId) === "youtube";
              return (
                <div
                  key={record.trackId}
                  className={`discover-recent-card ${unavailable || needsSetup ? "is-disabled" : ""}`}
                  onClick={() => !busy && !unavailable && !needsSetup && onReplay(record)}
                  role="button"
                  tabIndex={0}
                  title={
                    unavailable
                      ? "Add the original file to play again"
                      : needsSetup
                        ? "Enable online playback to listen"
                        : `Play ${record.title}`
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!busy && !unavailable && !needsSetup) onReplay(record);
                    }
                  }}
                >
                  <div className="discover-recent-cover-wrap">
                    <Artwork url={saved?.artworkUrl || historyArtwork(record)} />
                    <div className="discover-recent-play-overlay">
                      <Play size={16} fill="currentColor" />
                    </div>
                  </div>
                  <div className="discover-recent-info">
                    <strong title={record.title}>{record.title}</strong>
                    <small title={record.artist}><DownloadedBadge track={saved} />{record.artist}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Explore Albums (Trending Releases) - Prominently Displayed Directly Below Recent / Subbar */}
      {selectedMood === "all" && (
        <section aria-label="Explore albums" className="discover-home-section">
          <div className="discover-section-heading">
            <div>
              <h2>Explore albums</h2>
              <p className="subtitle">Trending releases · {label(language)}</p>
            </div>
          </div>

          {error && (
            <p className="subtitle" role="status">
              {error}
              {shelf?.albums.length ? " Showing saved catalogue results." : ""}
            </p>
          )}
          {loading && !shelf?.albums.length && (
            <div className="empty" style={{ padding: "40px 0" }}>
              <Loader2 size={32} className="spin" />
              <p>Finding trending albums…</p>
            </div>
          )}
          {!loading && !error && !shelf?.albums.length && (
            <p className="subtitle">
              No albums are available for this language right now. Try another language or search above.
            </p>
          )}

          {!!shelf?.albums.length && (
            <>
              <div className="albums-grid discover-albums">
                {shelf.albums.map((album) => (
                  <div
                    className="album-card discover-album-card"
                    key={album.id}
                    onClick={() => onNavigateAlbum?.(album.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open album ${album.title}`}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onNavigateAlbum?.(album.id);
                      }
                    }}
                  >
                    <div className="album-card-cover-wrap">
                      <Artwork url={album.artworkUrl} className="album-card-cover" />
                      <button
                        className={`album-hover-play ${playingAlbum === album.id ? "is-loading" : ""}`}
                        aria-label={`Play album ${album.title}`}
                        disabled={busy || !onlineAvailable || !!playingAlbum}
                        onClick={(e) => void handlePlayAlbum(album, e)}
                      >
                        {playingAlbum === album.id ? (
                          <Loader2 size={18} className="spin" color="currentColor" />
                        ) : (
                          <Play size={18} fill="currentColor" color="currentColor" />
                        )}
                      </button>
                    </div>
                    <div className="album-card-info">
                      <div className="album-title" title={album.title}>
                        {album.title}
                      </div>
                      <div className="album-year" title={album.artist}>
                        {album.artist}
                        {album.year ? ` · ${album.year}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="discover-cache-note">
                Saved on this device · Updated {new Date(shelf.updatedAt).toLocaleString()}
              </p>
            </>
          )}
        </section>
      )}

      {/* Mood / Vibe Tracks Section (When Mood Filter is Active) */}
      {selectedMood !== "all" && (
        <section aria-label="Vibe Picks" className="discover-home-section">
          <div className="discover-section-heading">
            <div>
              <h2>{MOOD_CHIPS.find((m) => m.id === selectedMood)?.label || "Vibe Picks"}</h2>
              <p className="subtitle">
                Curated vibe tracks in {label(language)} · Direct 1-tap playback
              </p>
            </div>
            <button className="link-button" onClick={() => setSelectedMood("all")}>
              Reset to All
            </button>
          </div>
          {moodLoading && (
            <div className="empty" style={{ padding: "40px 0" }}>
              <Loader2 size={32} className="spin" />
              <p>Curating tracks for this vibe…</p>
            </div>
          )}
          {!moodLoading && moodTracks.length > 0 && (
            <div className="discover-quick-picks-grid">
              {moodTracks.map((t, idx) => (
                <div key={t.id} className="discover-quick-track">
                  <span className="discover-track-rank">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div
                    className="discover-quick-art-wrap"
                    onClick={() => onSaveDiscovery?.(t, "play")}
                    role="button"
                    tabIndex={0}
                    title={`Play ${t.title}`}
                  >
                    <Artwork url={t.artworkUrl} />
                    <div className="discover-quick-play-overlay">
                      <Play size={14} fill="currentColor" />
                    </div>
                  </div>
                  <div className="discover-quick-info">
                    <button
                      className="link-button discover-track-title"
                      onClick={() => onSaveDiscovery?.(t, "play")}
                      title={t.title}
                    >
                      <strong>{t.title}</strong>
                    </button>
                    <small title={t.artist}><DownloadedBadge track={savedTracks.find(saved => saved.id === t.id || saved.metadataSourceId === t.id)} />{t.artist}</small>
                  </div>
                  <span className="discover-quick-duration">
                    {Math.floor(t.duration / 60)}:
                    {String(Math.floor(t.duration % 60)).padStart(2, "0")}
                  </span>
                  {onCatalogAction && (
                    <div className="discover-quick-actions">
                      <CatalogTrackActions
                        track={t}
                        savedTracks={savedTracks}
                        favorites={favorites}
                        onCatalogAction={onCatalogAction}
                        disabled={busy}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!moodLoading && moodTracks.length === 0 && (
            <p className="subtitle">
              No tracks found for this vibe right now. Try another vibe or change your discovery language.
            </p>
          )}
        </section>
      )}

      {/* Featured Spotlight Hero Banner (Apple Music / Nuclear) */}
      {spotlightAlbum && selectedMood === "all" && (
        <section aria-label="Featured spotlight" className="discover-home-section discover-spotlight-section">
          <div className="discover-spotlight-card">
            <div
              className="discover-spotlight-backdrop"
              style={{
                backgroundImage: spotlightAlbum.artworkUrl
                  ? `url(${spotlightAlbum.artworkUrl})`
                  : undefined,
              }}
            />
            <div className="discover-spotlight-overlay" />
            <div className="discover-spotlight-content">
              <div
                className="discover-spotlight-artwork-wrap"
                onClick={() => onNavigateAlbum?.(spotlightAlbum.id)}
                role="button"
                tabIndex={0}
                title={`Explore ${spotlightAlbum.title}`}
              >
                <Artwork
                  url={spotlightAlbum.artworkUrl}
                  className="discover-spotlight-cover"
                />
                <div className="discover-spotlight-art-badge">
                  <Play size={20} fill="currentColor" />
                </div>
              </div>
              <div className="discover-spotlight-details">
                <span className="discover-spotlight-badge">
                  <Sparkles size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
                  FEATURED SPOTLIGHT · {label(language).toUpperCase()}
                </span>
                <h2 className="discover-spotlight-title" title={spotlightAlbum.title}>
                  {spotlightAlbum.title}
                </h2>
                <p className="discover-spotlight-artist">
                  {spotlightAlbum.artist}{" "}
                  {spotlightAlbum.year ? `· ${spotlightAlbum.year}` : ""}
                </p>
                <p className="discover-spotlight-desc">
                  Top trending release on JioSaavn · Featured listen for your library.
                </p>
                <div className="discover-spotlight-actions">
                  <button
                    className="primary discover-spotlight-play-btn"
                    disabled={busy || !onlineAvailable || !!playingAlbum}
                    onClick={() => void handlePlayAlbum(spotlightAlbum)}
                  >
                    {playingAlbum === spotlightAlbum.id ? <Loader2 size={16} className="spin" /> : <Play size={16} fill="currentColor" />}
                    Play Album
                  </button>
                  <button
                    className="subtle discover-spotlight-explore-btn"
                    onClick={() => onNavigateAlbum?.(spotlightAlbum.id)}
                  >
                    Explore Tracklist
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Quick Picks / Top Tracks Row (YT Music + Spotify) */}
      {spotlightTracks.length > 0 && selectedMood === "all" && (
        <section aria-label="Quick picks" className="discover-home-section">
          <div className="discover-section-heading">
            <div>
              <h2>Quick picks</h2>
              <p className="subtitle">
                Trending songs from {spotlightAlbum?.title}
              </p>
            </div>
            {spotlightAlbum && (
              <button
                className="link-button"
                onClick={() => onNavigateAlbum?.(spotlightAlbum.id)}
              >
                See all {spotlightTracks.length} tracks
              </button>
            )}
          </div>
          <div className="discover-quick-picks-grid">
            {spotlightTracks.map((t, idx) => (
              <div key={t.id} className="discover-quick-track">
                <span className="discover-track-rank">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div
                  className="discover-quick-art-wrap"
                  onClick={() => onSaveDiscovery?.(t, "play")}
                  role="button"
                  tabIndex={0}
                  title={`Play ${t.title}`}
                >
                  <Artwork url={t.artworkUrl} />
                  <div className="discover-quick-play-overlay">
                    <Play size={14} fill="currentColor" />
                  </div>
                </div>
                <div className="discover-quick-info">
                  <button
                    className="link-button discover-track-title"
                    onClick={() => onSaveDiscovery?.(t, "play")}
                    title={t.title}
                  >
                    <strong>{t.title}</strong>
                  </button>
                  <small title={t.artist}><DownloadedBadge track={savedTracks.find(saved => saved.id === t.id || saved.metadataSourceId === t.id)} />{t.artist}</small>
                </div>
                <span className="discover-quick-duration">
                  {Math.floor(t.duration / 60)}:
                  {String(Math.floor(t.duration % 60)).padStart(2, "0")}
                </span>
                {onCatalogAction && (
                  <div className="discover-quick-actions">
                    <CatalogTrackActions
                      track={t}
                      savedTracks={savedTracks}
                      favorites={favorites}
                      onCatalogAction={onCatalogAction}
                      disabled={busy}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}


    </div>
  );
}
