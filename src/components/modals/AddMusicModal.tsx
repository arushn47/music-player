import { useState, useRef, useEffect } from "react";
import { Check, FolderOpen, Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { library, type CatalogTrack } from "../../adapters/native";
import { catalogQueueTrack } from "../../domain/catalog-track";
import type { Playlist, Session, Track } from "../../domain/types";
import { Artwork } from "../common/Artwork";

export interface AddMusicModalProps {
  playlist: Playlist;
  tracks: Track[];
  session: Session;
  busy: boolean;
  onClose: () => void;
  onAddTrack: (track: Track, playlistId: string) => Promise<void> | void;
  onImportLocal: () => void;
}

const SUGGESTED_CHIPS = ["Top Hits", "Indie Pop", "Bollywood", "Hip Hop", "Synthwave", "Lofi Beats", "Acoustic", "Chill"];

const clock = (s: number) =>
  `${Math.floor((Number.isFinite(s) ? s : 0) / 60)}:${String(Math.floor((Number.isFinite(s) ? s : 0) % 60)).padStart(2, "0")}`;

export function AddMusicModal({
  playlist,
  tracks,
  session,
  busy,
  onClose,
  onAddTrack,
  onImportLocal,
}: AddMusicModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set());
  const generation = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFavorites = playlist.id === "favorites";

  // Set of already added items in the playlist or favorites
  const existingSourceIds = new Set(
    isFavorites
      ? session.favorites.map((favId) => {
          const t = tracks.find((entry) => entry.id === favId) || session.queueTracks[favId];
          return t?.metadataSourceId || t?.id || favId;
        })
      : playlist.items.map((item) => {
          const t = tracks.find((entry) => entry.id === item.trackId) || session.queueTracks[item.trackId];
          return t?.metadataSourceId || t?.id || item.trackId;
        })
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    const token = ++generation.current;
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const items = await library.searchCatalog(trimmed, 20);
        if (generation.current === token) {
          setResults(items);
        }
      } catch {
        if (generation.current === token) {
          setResults([]);
        }
      } finally {
        if (generation.current === token) {
          setSearching(false);
        }
      }
    }, 280);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleAdd = async (candidate: CatalogTrack) => {
    if (addingId || busy) return;
    setAddingId(candidate.id);
    try {
      const t = catalogQueueTrack(candidate);
      await onAddTrack(t, playlist.id);
      setAddedIds((prev) => new Set(prev).add(candidate.id));
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="add-music-modal-content">
      <div className="save-playlist-header">
        <div>
          <h2 className="save-playlist-title">{isFavorites ? "Add to Favorites" : "Add to playlist"}</h2>
          <p className="save-playlist-subtitle ellipsis">
            {isFavorites
              ? "Search online music to save in Your favorites"
              : `Adding online music to “${playlist.name}”`}
          </p>
        </div>
        <button
          type="button"
          className="icon-button save-playlist-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="add-music-search-container">
        <Search size={16} className="add-music-search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="add-music-search-input"
          placeholder="Search songs, artists, albums online…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="add-music-search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="add-music-results-container">
        {searching && results.length === 0 ? (
          <div className="add-music-status-box">
            <Loader2 size={24} className="spin" />
            <span>Searching online catalog…</span>
          </div>
        ) : query.trim() && results.length === 0 && !searching ? (
          <div className="add-music-status-box">
            <p>No results found for &ldquo;{query}&rdquo;</p>
            <small>Try searching for a different song title or artist name.</small>
          </div>
        ) : !query.trim() ? (
          <div className="add-music-idle-box">
            <div className="add-music-idle-icon">
              <Sparkles size={24} />
            </div>
            <h3>Discover music online</h3>
            <p>
              Find songs across streaming sources and add them straight to{" "}
              {isFavorites ? "Your favorites" : `“${playlist.name}”`}.
            </p>
            <div className="add-music-chips">
              {SUGGESTED_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="add-music-chip"
                  onClick={() => setQuery(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="add-music-track-list">
            {results.map((candidate) => {
              const isAdded =
                existingSourceIds.has(candidate.id) ||
                addedIds.has(candidate.id);
              const isAdding = addingId === candidate.id;

              return (
                <div key={candidate.id} className="add-music-row">
                  <div className="add-music-row-art">
                    <Artwork url={candidate.artworkUrl} />
                  </div>
                  <div className="add-music-row-meta">
                    <span className="add-music-row-title ellipsis" title={candidate.title}>
                      {candidate.title}
                    </span>
                    <span className="add-music-row-artist ellipsis" title={candidate.artist}>
                      {candidate.artist}
                      {candidate.album ? ` · ${candidate.album}` : ""}
                    </span>
                  </div>
                  <span className="add-music-row-duration">
                    {clock(candidate.duration)}
                  </span>
                  <div className="add-music-row-action">
                    {isAdded ? (
                      <span className="add-music-added-badge" title="Added to playlist">
                        <Check size={14} />
                        <span>Added</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="subtle add-music-btn"
                        disabled={isAdding || busy}
                        onClick={() => handleAdd(candidate)}
                        aria-label={`Add ${candidate.title} to playlist`}
                      >
                        {isAdding ? (
                          <Loader2 size={13} className="spin" />
                        ) : (
                          <Plus size={14} />
                        )}
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="add-music-modal-footer">
        <span className="add-music-footer-hint">Have local audio files?</span>
        <button
          type="button"
          className="subtle add-music-local-btn"
          onClick={() => {
            onClose();
            onImportLocal();
          }}
        >
          <FolderOpen size={14} />
          Import local files
        </button>
      </div>
    </div>
  );
}
