import React, { useLayoutEffect, useRef } from "react";
import {
  ExternalLink,
  Globe,
  Loader2,
  Play,
  Search,
  X,
} from "lucide-react";
import { library, type YtdlpSearchResult } from "../../adapters/native";
import { youtubeTrack } from "../../domain/online-track";
import type { Track } from "../../domain/types";
import { Artwork, IconButton } from "../common";
import {
  CommonsDiscovery,
  type CommonsDiscoveryState,
} from "./CommonsDiscovery";

export interface DiscoveryViewState {
  query: string;
  results: YtdlpSearchResult[];
  searching: boolean;
  error: string;
  scrollTop: number;
  commons: CommonsDiscoveryState;
}

export const initialDiscoveryViewState = (): DiscoveryViewState => ({
  query: "",
  results: [],
  searching: false,
  error: "",
  scrollTop: 0,
  commons: { query: "", results: [], loading: false, error: "" },
});

export interface DiscoveryViewProps {
  state: DiscoveryViewState;
  onStateChange: (
    update: (current: DiscoveryViewState) => DiscoveryViewState,
  ) => void;
  ytdlpAvailable: boolean;
  mobile: boolean;
  busy: boolean;
  downloads: Record<string, string>;
  onSaveDiscovery: (
    result: YtdlpSearchResult,
    mode: "play" | "save" | "next" | "queue",
  ) => void;
  onChoosePlaylist: (track: Track) => void;
  onDownloadTrack: (track: Track) => void;
  onSaveCommons: (track: Track, play: boolean) => void;
  onQueueRemote: (track: Track, next: boolean) => void;
}

const clock = (s: number) =>
  `${Math.floor((Number.isFinite(s) ? s : 0) / 60)}:${String(Math.floor((Number.isFinite(s) ? s : 0) % 60)).padStart(2, "0")}`;

export function DiscoveryView({
  state,
  onStateChange,
  ytdlpAvailable,
  mobile,
  busy,
  downloads,
  onSaveDiscovery,
  onChoosePlaylist,
  onDownloadTrack,
  onSaveCommons,
  onQueueRemote,
}: DiscoveryViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { query, results, searching, error } = state;

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

  const handleSearch = () => {
    const trimmed = query.trim();
    if (!trimmed || !ytdlpAvailable || searching) return;
    onStateChange((current) => ({
      ...current,
      searching: true,
      results: [],
      error: "",
    }));
    library
      .ytdlpSearch(trimmed, 20)
      .then((res) => {
        onStateChange((current) => ({
          ...current,
          results: res,
          searching: false,
          error: res.length === 0
            ? "No results found. Try different keywords."
            : "",
        }));
      })
      .catch((err) => {
        onStateChange((current) => ({
          ...current,
          error: err instanceof Error ? err.message : String(err),
          searching: false,
        }));
      });
  };

  return (
    <div
      ref={rootRef}
      className="discovery-view-state"
    >
      <section className="discover-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">SEARCH YOUTUBE FOR MUSIC</p>
            <h1>
              Discover new music<span className="heading-dot">.</span>
            </h1>
            <p className="subtitle">
              {ytdlpAvailable
                ? "Search YouTube and stream audio using yt-dlp. For personal, non-commercial use."
                : mobile
                  ? "Online playback is unavailable in this Android build. Local playback still works."
                  : "yt-dlp is required. Install yt-dlp and restart the app."}
            </p>
          </div>
        </div>

        {!ytdlpAvailable && (
          <div className="banner error" role="alert">
            <span>
              {mobile ? (
                "Online streaming could not start. Try restarting Lumaire; your local music remains available."
              ) : (
                <>
                  yt-dlp not found. Please install yt-dlp (https://github.com/yt-dlp/yt-dlp) and place yt-dlp.exe in the same folder as Lumaire, or ensure it's available in your system PATH.
                </>
              )}
            </span>
          </div>
        )}

        <section className="library-tools">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Search YouTube"
              placeholder="Search for music, artist, or song"
              value={query}
              disabled={!ytdlpAvailable || searching}
              onChange={(e) =>
                onStateChange((current) => ({
                  ...current,
                  query: e.target.value,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
            {query && (
              <button
                aria-label="Clear search"
                onClick={() => {
                  onStateChange((current) => ({
                    ...current,
                    query: "",
                    results: [],
                    error: "",
                  }));
                }}
              >
                <X size={16} />
              </button>
            )}
          </label>
          <button
            className="primary"
            disabled={searching || !query.trim() || !ytdlpAvailable}
            onClick={handleSearch}
          >
            {searching ? (
              <>
                <Loader2 size={16} className="spin" />
                Searching…
              </>
            ) : (
              <>
                <Search size={16} />
                Search
              </>
            )}
          </button>
        </section>

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

        {!results.length && !searching && !error && ytdlpAvailable && (
          <div className="empty">
            <Globe size={36} />
            <h2>Search YouTube</h2>
            <p>
              Find and stream music from YouTube.
              <br />
              Stream URLs expire after a few hours. For personal,
              non-commercial use only.
            </p>
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
              <span>TRACK / CHANNEL</span>
              <span>SOURCE</span>
              <span>TIME</span>
              <span />
            </div>
            <div className="track-list">
              {results.map((t, index) => (
                <div className="track-row" key={t.id}>
                  <button
                    className="track-play"
                    aria-label={`Play ${t.title}`}
                    disabled={busy}
                    onClick={() => onSaveDiscovery(t, "play")}
                  >
                    <span className="track-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Play className="row-play" size={15} />
                  </button>
                  <button
                    className="track-meta"
                    aria-label={`Listen to ${t.title}`}
                    disabled={busy}
                    onClick={() => onSaveDiscovery(t, "play")}
                  >
                    <Artwork
                      url={t.thumbnail}
                      className={`color-${index % 5}`}
                    />
                    <span>
                      <strong dir="auto">{t.title}</strong>
                      <small dir="auto">
                        {t.channel || "Unknown Channel"}
                      </small>
                    </span>
                  </button>
                  <span className="album ellipsis" title="YouTube">
                    YouTube
                  </span>
                  <span className="duration">
                    {t.duration ? clock(t.duration) : "—"}
                  </span>
                  <div className="track-actions">
                    <IconButton
                      label={`View ${t.title} on YouTube`}
                      onClick={() =>
                        window.open(
                          `https://www.youtube.com/watch?v=${t.id}`,
                          "_blank",
                        )
                      }
                    >
                      <ExternalLink size={17} />
                    </IconButton>
                    <details className="track-menu">
                      <summary aria-label={`Actions for ${t.title}`}>
                        •••
                      </summary>
                      <div className="menu-popover">
                        <button
                          disabled={busy}
                          onClick={() => onSaveDiscovery(t, "save")}
                        >
                          Save to library
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => onSaveDiscovery(t, "next")}
                        >
                          Play next
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => onSaveDiscovery(t, "queue")}
                        >
                          Add to queue
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => onChoosePlaylist(youtubeTrack(t))}
                        >
                          Save to playlist
                        </button>
                        <button
                          disabled={
                            downloads[`youtube:${t.id}`] === "downloading"
                          }
                          onClick={() =>
                            onDownloadTrack(youtubeTrack(t))
                          }
                        >
                          {downloads[`youtube:${t.id}`] === "downloading"
                            ? "Downloading…"
                            : "Download for offline"}
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>
            <p className="library-footer">
              <span className="small-dot" /> Results from YouTube ·{" "}
              {results.length} tracks · URLs expire after a few hours
            </p>
          </>
        )}
      </section>

      <CommonsDiscovery
        save={onSaveCommons}
        download={onDownloadTrack}
        queue={onQueueRemote}
        playlist={onChoosePlaylist}
        pending={downloads}
        state={state.commons}
        onStateChange={(update) =>
          onStateChange((current) => ({
            ...current,
            commons: update(current.commons),
          }))
        }
      />
    </div>
  );
}
