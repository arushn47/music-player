import { ArtistLinks } from "../common/ArtistLinks";
import React from "react";
import {
  ArrowDown,
  ArrowUp,
  Heart,
  ListMusic,
  ListPlus,
  PanelRightClose,
  X,
} from "lucide-react";
import { Artwork, DownloadedBadge, IconButton } from "../common";
import { AudioWaveform } from "../common/AudioWaveform";
import type { Session, Track } from "../../domain/types";
import type { Playback } from "../../player/controller";
import { playbackQueue, isQueuedCatalog } from "../../domain/queue";

export interface QueuePanelProps {
  onNavigateArtist?: (id: string) => void;
  session: Session;
  listeningTracks: Track[];
  undo: Session["queue"] | null;
  onClose: () => void;
  onSelectQueue: (entryId: string, play: boolean) => void;
  onReorderUpcoming: (entryId: string, delta: 1 | -1) => void;
  onRemoveQueue: (entryId: string) => void;
  onUndoRemoval: () => void;
  onClearQueue: () => void;
  currentTrack?: Track | null;
  playback?: Playback;
  onTogglePlay?: () => void;
  onFavorite?: (trackId: string) => void;
  isFavorite?: boolean;
  onChoosePlaylist?: (track: Track) => void;
}

const clock = (s: number) =>
  `${Math.floor((Number.isFinite(s) ? s : 0) / 60)}:${String(Math.floor((Number.isFinite(s) ? s : 0) % 60)).padStart(2, "0")}`;

export function QueuePanel({
  onNavigateArtist,
  session,
  listeningTracks,
  undo,
  onClose,
  onSelectQueue,
  onReorderUpcoming,
  onRemoveQueue,
  onUndoRemoval,
  onClearQueue,
  currentTrack,
  playback,
  onTogglePlay,
  onFavorite,
  isFavorite,
  onChoosePlaylist,
}: QueuePanelProps) {
  const queue = playbackQueue(session);
  const currentIndex = queue.findIndex(
    (entry) => entry.id === session.currentId,
  );
  const upNextCount = queue.slice(currentIndex + 1).length;

  return (
    <aside className="queue-pane now-playing-dock">
      <header className="now-playing-header">
        <h2>Now Playing</h2>
        <IconButton label="Collapse panel" onClick={onClose}>
          <PanelRightClose size={18} />
        </IconButton>
      </header>

      {/* Featured Current Track Card & Live Audio Waveform (Sonora Style) */}
      {currentTrack ? (
        <div className="now-playing-hero">
          <div
            className="now-playing-cover-wrap"
            onClick={onTogglePlay}
            role="button"
            tabIndex={0}
            aria-label={playback?.status === "playing" ? "Pause" : "Play"}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTogglePlay?.();
              }
            }}
          >
            <Artwork url={currentTrack.artworkUrl} className="now-playing-art" />
          </div>
          <div className="now-playing-details">
            <div className="now-playing-meta">
              <strong className="now-playing-title" dir="auto" title={currentTrack.title}>
                {currentTrack.title}
              </strong>
              <ArtistLinks
                className="now-playing-artist"
                artistString={currentTrack.artist}
                onNavigateArtist={onNavigateArtist}
                maxArtists={2}
              />
            </div>
            <div className="now-playing-actions">
              {onChoosePlaylist && (
                <button
                  type="button"
                  className="now-playing-action-btn"
                  onClick={() => onChoosePlaylist(currentTrack)}
                  aria-label="Save to playlist"
                  title="Save to playlist"
                >
                  <ListPlus size={18} />
                </button>
              )}
              {onFavorite && (
                <button
                  type="button"
                  className={`now-playing-action-btn now-playing-fav ${isFavorite ? "is-favorite" : ""}`}
                  onClick={() => onFavorite(currentTrack.id)}
                  aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  title={isFavorite ? "Favorited" : "Favorite"}
                >
                  <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
                </button>
              )}
            </div>
          </div>
          <AudioWaveform
            isPlaying={playback?.status === "playing"}
            className="now-playing-waveform"
          />
        </div>
      ) : null}

      <div className="up-next-section">
        <div className="up-next-header">
          <h3>Up next</h3>
          {upNextCount > 0 && <span className="up-next-count">{upNextCount}</span>}
        </div>

        <div className="queue-items">
          {session.queue.length ? (
            queue.map((entry, index) => {
              if (index < currentIndex) return null;
              const t = listeningTracks.find(
                (track) => track.id === entry.trackId,
              );
              if (!t) return null;

              return (
                <div
                  key={entry.id}
                  className={`queue-entry ${entry.id === session.currentId ? "current" : ""}`}
                >
                  <div className="queue-select">
                    <Artwork
                      url={t.artworkUrl}
                      className={`color-${index % 5}`}
                    />
                    <span className="queue-info">
                      <button
                        className="track-title-button"
                        aria-label={`Play queued ${t.title}`}
                        onClick={() => onSelectQueue(entry.id, true)}
                      >
                        <strong dir="auto">{t.title}</strong>
                      </button>
                      <small>
                        <DownloadedBadge track={t} />
                        <ArtistLinks
                          className="queue-artist"
                          artistString={t.artist}
                          onNavigateArtist={onNavigateArtist}
                          maxArtists={2}
                        />
                        {entry.id === session.currentId ? (
                          <span className="queue-now-playing"> · Now playing</span>
                        ) : isQueuedCatalog(t) ? <span> · Audio not verified yet</span> : null}
                      </small>
                    </span>
                  </div>
                  {t.duration ? (
                    <span className="queue-item-duration">{clock(t.duration)}</span>
                  ) : null}
                  <div className="queue-controls">
                    {entry.id !== session.currentId && (
                      <>
                        <IconButton
                          label={`Move ${t.title} up`}
                          disabled={index <= currentIndex + 1}
                          onClick={() => onReorderUpcoming(entry.id, -1)}
                        >
                          <ArrowUp size={13} />
                        </IconButton>
                        <IconButton
                          label={`Move ${t.title} down`}
                          disabled={index === queue.length - 1}
                          onClick={() => onReorderUpcoming(entry.id, 1)}
                        >
                          <ArrowDown size={13} />
                        </IconButton>
                      </>
                    )}
                    <IconButton
                      label={`Remove queued ${t.title}`}
                      onClick={() => onRemoveQueue(entry.id)}
                    >
                      <X size={14} />
                    </IconButton>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="queue-empty">
              <ListMusic size={28} />
              <p>
                A good listening session
                <br />
                starts with one song.
              </p>
            </div>
          )}
        </div>
      </div>

      <footer>
        {undo && (
          <button className="subtle" onClick={onUndoRemoval}>
            Undo removal
          </button>
        )}
        <button
          className="subtle"
          disabled={!upNextCount}
          onClick={onClearQueue}
        >
          Clear queue
        </button>
      </footer>
    </aside>
  );
}
