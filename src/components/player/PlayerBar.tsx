import React, { useRef, useState } from "react";
import {
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Repeat1,
  FileText,
  Volume2,
  VolumeX,
  Heart,
  ListMusic,
} from "lucide-react";
import { Artwork } from "../common/Artwork";
import { IconButton } from "../common/IconButton";
import type { Track, Session, Preferences } from "../../domain/types";
import type { Playback } from "../../player/controller";

export interface PlayerBarProps {
  track?: Track | null;
  tracks: Track[];
  playback: Playback;
  session: Session;
  downloads: Record<string, string>;
  busy: boolean;
  view: string;
  setView: (view: any) => void;
  mobile?: boolean;
  queueOpen?: boolean;
  onToggleQueue?: () => void;
  onSeek: (seconds: number) => void;
  onTogglePlay: () => void;
  onSkip: (direction: 1 | -1) => void;
  onFavorite: (trackId: string) => void;
  onChoosePlaylist: (track: Track) => void;
  onDownloadTrack: (track: Track) => void;
  onDeleteOffline: (track: Track) => void;
  onSaveOnline: (track: Track) => void;
  onCancelDownload: (trackId: string) => void;
  onSetting: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
}

const clock = (s: number) =>
  `${Math.floor((Number.isFinite(s) ? s : 0) / 60)}:${String(Math.floor((Number.isFinite(s) ? s : 0) % 60)).padStart(2, "0")}`;

export function PlayerBar({
  track,
  tracks,
  playback,
  session,
  downloads,
  busy,
  view,
  setView,
  mobile = false,
  queueOpen = false,
  onToggleQueue,
  onSeek,
  onTogglePlay,
  onSkip,
  onFavorite,
  onChoosePlaylist,
  onDownloadTrack,
  onDeleteOffline,
  onSaveOnline,
  onCancelDownload,
  onSetting,
}: PlayerBarProps) {
  const [seekHover, setSeekHover] = useState<{ time: number; x: number } | null>(null);
  const lastVolume = useRef<number>(
    session.settings.volume > 0 ? session.settings.volume : 0.72,
  );

  const titleLimit = mobile ? 22 : 28;
  const rawTitle = track?.title ?? "Room for a little music";
  const isTitleLong = rawTitle.length > titleLimit;
  const displayTitle = isTitleLong
    ? `${rawTitle.slice(0, titleLimit).trimEnd()}...`
    : rawTitle;

  const rawArtist = track?.artist ?? "Choose a track to begin";
  const isArtistLong = rawArtist.length > 25;
  const displayArtist = isArtistLong
    ? `${rawArtist.slice(0, 25).trimEnd()}...`
    : rawArtist;

  return (
    <footer className="transport" aria-label="Playback controls">
      <div
        className="seek-bar-top"
        onMouseMove={(e) => {
          if (!playback.duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
          const ratio = rect.width > 0 ? x / rect.width : 0;
          const hoverTime = ratio * playback.duration;
          setSeekHover({ time: hoverTime, x });
        }}
        onMouseLeave={() => setSeekHover(null)}
      >
        {seekHover && playback.duration > 0 && (
          <div
            className="seek-hover-tooltip"
            style={{ left: `${seekHover.x}px` }}
          >
            {clock(seekHover.time)}
          </div>
        )}
        <input
          aria-label="Seek playback"
          type="range"
          min={0}
          max={playback.duration || 1}
          step={0.1}
          disabled={!playback.duration}
          value={Math.min(playback.time, playback.duration || 1)}
          style={
            {
              "--seek-percent": `${Math.min(100, Math.max(0, (playback.time / (playback.duration || 1)) * 100))}%`,
            } as React.CSSProperties
          }
          onChange={(e) => onSeek(Number(e.target.value))}
        />
      </div>

      <div className="now-playing">
        <Artwork url={track?.artworkUrl} className="transport-cover" />
        <div className="track-meta now-playing-meta">
          <span className="now-playing-title-wrap">
            <strong dir="auto">
              {displayTitle}
            </strong>
            {Boolean(track?.title) && (
              <span className="title-hover-tooltip" role="tooltip">
                {rawTitle}
              </span>
            )}
          </span>
          <div className="track-subtitle-row">
            <span className="now-playing-artist-wrap">
              <small dir="auto" className="now-playing-artist">
                {displayArtist}
              </small>
              {Boolean(track?.artist) && (
                <span className="artist-hover-tooltip" role="tooltip">
                  {rawArtist}
                </span>
              )}
            </span>
          </div>
        </div>

        <span className="now-playing-separator" aria-hidden="true" />

        <div className="track-time-inline">
          <span data-testid="elapsed">{clock(playback.time)}</span>
          <span className="time-sep">/</span>
          <span>{clock(playback.duration)}</span>
        </div>

        {track && tracks.some((saved) => saved.id === track.id) && (
          <IconButton
            label="Favorite current track"
            active={session.favorites.includes(track.id)}
            onClick={() => onFavorite(track.id)}
          >
            <Heart
              size={17}
              fill={session.favorites.includes(track.id) ? "currentColor" : "none"}
            />
          </IconButton>
        )}

        {track && (
          <details className="track-menu current-track-menu">
            <summary aria-label="Current song actions">•••</summary>
            <div className="menu-popover">
              {!tracks.some((saved) => saved.id === track.id) && (
                <button
                  disabled={busy}
                  aria-label="Save"
                  onClick={() => onSaveOnline(track)}
                >
                  Save to library
                </button>
              )}
              <button disabled={busy} onClick={() => onChoosePlaylist(track)}>
                Save to playlist
              </button>
              <button onClick={() => onFavorite(track.id)}>
                {session.favorites.includes(track.id)
                  ? "Remove from favorites"
                  : "Add to favorites"}
              </button>
              {track.source &&
                !track.offline &&
                (downloads[track.id] === "downloading" ? (
                  <button onClick={() => onCancelDownload(track.id)}>
                    Cancel download
                  </button>
                ) : (
                  <button
                    aria-label="Download current track for offline"
                    onClick={() => onDownloadTrack(track)}
                  >
                    Download for offline
                  </button>
                ))}
              {track.offline && (
                <button onClick={() => onDeleteOffline(track)}>
                  Delete offline copy
                </button>
              )}
            </div>
          </details>
        )}
      </div>

      <div className="player-center">
        <div className="player-buttons">
          <IconButton
            label="Shuffle"
            active={session.settings.shuffle}
            onClick={() => onSetting("shuffle", !session.settings.shuffle)}
          >
            <Shuffle size={17} />
          </IconButton>
          <IconButton
            label="Previous track"
            disabled={!track}
            onClick={() => onSkip(-1)}
          >
            <SkipBack size={19} fill="currentColor" />
          </IconButton>
          <button
            className="play-button"
            aria-label={
              playback.status === "playing" || playback.status === "buffering"
                ? "Pause"
                : "Play"
            }
            disabled={(!track && !tracks.length) || playback.status === "loading"}
            onClick={onTogglePlay}
          >
            {playback.status === "playing" || playback.status === "buffering" ? (
              <Pause size={21} fill="currentColor" />
            ) : (
              <Play size={21} fill="currentColor" />
            )}
          </button>
          <IconButton
            label="Next track"
            disabled={!track}
            onClick={() => onSkip(1)}
          >
            <SkipForward size={19} fill="currentColor" />
          </IconButton>
          <IconButton
            label={`Repeat: ${session.settings.repeat}`}
            active={session.settings.repeat !== "off"}
            onClick={() =>
              onSetting(
                "repeat",
                session.settings.repeat === "off"
                  ? "all"
                  : session.settings.repeat === "all"
                    ? "one"
                    : "off",
              )
            }
          >
            {session.settings.repeat === "one" ? (
              <Repeat1 size={17} />
            ) : (
              <Repeat size={17} />
            )}
          </IconButton>
        </div>
      </div>

      <div className="player-right">
        <span className="playback-state" data-testid="playback-state">
          {playback.status === "idle" ? "Ready" : playback.status}
        </span>
        <IconButton
          label="Open lyrics"
          className="player-btn-lyrics"
          active={view === "lyrics"}
          onClick={() => setView("lyrics")}
        >
          <FileText size={18} />
        </IconButton>
        {onToggleQueue && (
          <IconButton
            label={queueOpen ? "Hide queue" : "Show queue"}
            className="player-btn-queue"
            active={queueOpen}
            onClick={onToggleQueue}
          >
            <ListMusic size={18} />
          </IconButton>
        )}
        {!mobile && (
          <div className="player-volume-container">
            <IconButton
              label={session.settings.volume === 0 ? "Unmute" : "Mute"}
              className="volume-icon-btn"
              onClick={() => {
                if (session.settings.volume > 0) {
                  lastVolume.current = session.settings.volume;
                  onSetting("volume", 0);
                } else {
                  onSetting("volume", lastVolume.current || 0.72);
                }
              }}
            >
              {session.settings.volume === 0 ? (
                <VolumeX size={18} />
              ) : (
                <Volume2 size={18} />
              )}
            </IconButton>
            <input
              aria-label="Volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={session.settings.volume}
              style={
                {
                  "--volume-percent": `${Math.min(100, Math.max(0, session.settings.volume * 100))}%`,
                } as React.CSSProperties
              }
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > 0) lastVolume.current = val;
                onSetting("volume", val);
              }}
            />
          </div>
        )}
      </div>
    </footer>
  );
}
