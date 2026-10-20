import React, { useState, useEffect } from "react";
import {
  FileText,
  Loader2,
  Music2,
  Plus,
  RefreshCw,
  Settings2,
  Type,
  Upload,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import type { LookupState } from "../../adapters/lrclib";
import { lyricLayers, isFetchedLyrics } from "../../domain/lyric-display";
import { lyricLanguageNames } from "../../domain/lyric-languages";
import type {
  LyricDocument,
  Preferences,
  Session,
  Track,
} from "../../domain/types";
import { LyricsSettings } from "./LyricsSettings";
import { ArtistLinks } from "../common/ArtistLinks";
import {
  GEMINI_PROCESS_RETRY,
  type LyricProcessingState,
} from "../../adapters/lyric-processing";

export interface LyricsViewProps {
  onNavigateArtist?: (id: string) => void;
  track?: Track | null;
  doc?: LyricDocument;
  lyricSynced: boolean;
  lyricLookup: LookupState;
  follow: boolean;
  setFollow: (follow: boolean) => void;
  followTarget: string | null;
  active: string | null;
  activeRef: React.RefObject<HTMLButtonElement | null>;
  busy: boolean;
  session: Session;
  setting: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  onUpdateOffset: (offset: number) => void;
  attach: (
    kind: "original" | "romanisation" | "translation",
  ) => Promise<void> | void;
  clearCache: () => void;
  regenerate: () => void;
  processingState: LyricProcessingState;
  onRetryLookup: () => void;
  onMarkInstrumental: () => void;
  onSeek: (seconds: number) => void;
}

const clock = (s: number) =>
  `${Math.floor((Number.isFinite(s) ? s : 0) / 60)}:${String(Math.floor((Number.isFinite(s) ? s : 0) % 60)).padStart(2, "0")}`;

export function LyricsView({
  onNavigateArtist,
  track,
  doc,
  lyricSynced,
  lyricLookup,
  follow,
  setFollow,
  followTarget,
  active,
  activeRef,
  busy,
  session,
  setting,
  onUpdateOffset,
  attach,
  clearCache,
  regenerate,
  processingState,
  onRetryLookup,
  onMarkInstrumental,
  onSeek,
}: LyricsViewProps) {
  const [lyricsMenuOpen, setLyricsMenuOpen] = useState(false);

  useEffect(() => {
    if (!lyricsMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLyricsMenuOpen(false);
      }
    };
    const handlePointerDown = (e: MouseEvent) => {
      const menu = document.getElementById("lyrics-settings-menu");
      const trigger = document.querySelector(".lyric-settings-trigger");
      if (
        menu &&
        !menu.contains(e.target as Node) &&
        trigger &&
        !trigger.contains(e.target as Node)
      ) {
        setLyricsMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [lyricsMenuOpen]);

  return (
    <section className="lyric-room">
      <div className="lyric-settings-fixed-anchor">
        <div className="lyric-settings">
          <button
            className="icon-button lyric-settings-trigger"
            aria-label="Lyrics settings"
            title="Lyrics settings"
            aria-haspopup="true"
            aria-expanded={lyricsMenuOpen}
            aria-controls="lyrics-settings-menu"
            onClick={() => setLyricsMenuOpen((x) => !x)}
          >
            <Type size={17} />
          </button>
          {lyricsMenuOpen && (
            <>
              <div
                className="lyric-settings-backdrop"
                aria-hidden="true"
                onClick={() => setLyricsMenuOpen(false)}
              />
              <div
                id="lyrics-settings-menu"
                className="lyric-settings-menu"
                role="dialog"
                aria-label="Lyrics settings"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setLyricsMenuOpen(false);
                    e.currentTarget.parentElement
                      ?.querySelector("button")
                      ?.focus();
                  }
                }}
              >
                <LyricsSettings
                  settings={session.settings}
                  setting={setting}
                  doc={doc}
                  track={track || undefined}
                  lyricSynced={lyricSynced}
                  onUpdateOffset={onUpdateOffset}
                  attach={attach}
                  onClose={() => setLyricsMenuOpen(false)}
                  cachedCount={
                    Object.values(session.lyrics).filter(isFetchedLyrics).length
                  }
                  clearCache={clearCache}
                  regenerate={regenerate}
                  processingState={processingState}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="page-heading lyric-room-heading">
        <div>
          <p className="eyebrow">BETWEEN THE LINES</p>
          <h1>
            Listen a little closer<span className="heading-dot">.</span>
          </h1>
          <p className="subtitle">
            {track
              ? <>{track.title} · <ArtistLinks artistString={track.artist} onNavigateArtist={onNavigateArtist} /></>
              : "Choose a song to open its words."}
            {doc && (
              <span className="lyric-status-pill">
                {" · "}
                <span className="lyric-timing-status" role="status">
                  {lyricSynced
                    ? "Synced lyrics"
                    : session.settings.estimatedScroll
                      ? "Not synced · Estimated autoscroll"
                      : "Not synced · Manual scrolling"}
                </span>
                {doc.source?.provider === "lrclib" &&
                  Number.isSafeInteger(doc.source.recordId) && (
                    <>
                      {" · "}
                      <a
                        className="lyric-provenance-link"
                        href={`https://lrclib.net/tracks/${doc.source.recordId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        LRCLIB ↗
                      </a>
                    </>
                  )}
              </span>
            )}
          </p>
          {doc && !doc.instrumental && <p className="subtitle" aria-label="Song languages">
            Languages: {lyricLanguageNames(doc).join(", ") || (doc.languageSource ? "Not identified" : "Detecting…")}
          </p>}
        </div>
        {!doc && (
          <div className="lyric-header-actions">
            <button
              className="subtle"
              disabled={!track || busy}
              onClick={() => void attach("original")}
            >
              <Upload size={15} />
              Attach lyrics
            </button>
          </div>
        )}
      </div>

      {doc &&
        (processingState.status === "processing" ||
          processingState.status === "error") && (
          <div className="listening-notice" role="status">
            {processingState.status === "processing"
              ? "Generating pronunciation and English meaning…"
              : processingState.message}
            {processingState.status === "error" && (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new Event(GEMINI_PROCESS_RETRY))
                }
              >
                Retry Gemini
              </button>
            )}
          </div>
        )}
      {!doc ? (
        <div className="empty lyric-empty">
          {lyricLookup.status === "loading" ? (
            <>
              <Loader2 size={36} className="spin" />
              <h2>Looking up lyrics…</h2>
              <p>Searching LRCLIB for {track?.title}.</p>
            </>
          ) : lyricLookup.status === "error" ? (
            <>
              <WifiOff size={36} />
              <h2>Lookup failed</h2>
              <p>{lyricLookup.message}</p>
              <button
                className="primary"
                disabled={!track}
                onClick={onRetryLookup}
              >
                <RefreshCw size={16} />
                Retry
              </button>
              <button
                className="subtle"
                disabled={!track || busy}
                onClick={() => void attach("original")}
              >
                <Upload size={16} />
                Attach lyrics manually instead
              </button>
            </>
          ) : lyricLookup.status === "not_found" ? (
            <>
              <Wifi size={36} />
              <h2>No lyrics found</h2>
              <p>
                No lyrics are available for this track yet.
                <br />
                Attach an LRC or text file manually.
              </p>
              <button
                className="subtle"
                disabled={!track}
                onClick={onRetryLookup}
              >
                <RefreshCw size={16} />
                Retry lookup
              </button>
              <button
                className="primary"
                disabled={!track || busy}
                onClick={() => void attach("original")}
              >
                <Upload size={16} />
                Attach lyrics manually
              </button>
              <button
                className="subtle"
                disabled={!track}
                onClick={onMarkInstrumental}
              >
                Mark as instrumental
              </button>
            </>
          ) : (
            <>
              <FileText size={36} />
              <h2>The music has words. Bring them here.</h2>
              <p>
                Lyrics are looked up automatically when you play a track.
                <br />
                Or attach an LRC or text file manually.
              </p>
              <button
                className="primary"
                disabled={!track || busy}
                onClick={() => void attach("original")}
              >
                <Plus size={17} />
                Attach original lyrics
              </button>
              <button
                className="subtle"
                disabled={!track}
                onClick={onMarkInstrumental}
              >
                Mark as instrumental
              </button>
            </>
          )}
        </div>
      ) : doc.instrumental ? (
        <div className="empty">
          <Music2 size={36} />
          <h2>Let the music speak.</h2>
          <p>You marked this recording as instrumental.</p>
          <button className="subtle" onClick={() => void attach("original")}>
            Attach lyrics instead
          </button>
        </div>
      ) : (
        <>
          {doc.warnings
            .filter((w) => !w.startsWith("The selected lyric recording is "))
            .map((w, i) => (
              <p className="parser-warning" key={i}>
                {w}
              </p>
            ))}
          <div
            className={`lyric-lines ${lyricSynced ? "" : "unsynced"}`}
            style={
              {
                "--lyric-size": `${session.settings.lyricSize}px`,
              } as React.CSSProperties
            }
            onWheel={() => setFollow(false)}
            onTouchMove={() => setFollow(false)}
          >
            {doc.lines.map((line) => (
              <button
                key={line.id}
                ref={line.id === followTarget ? activeRef : undefined}
                className={`lyric-line ${active === line.id ? "is-active" : ""}`}
                disabled={!lyricSynced || line.time === null}
                onClick={() =>
                  onSeek(
                    Math.max(
                      0,
                      (line.time! + doc.fileOffset + doc.userOffset) / 1000,
                    ),
                  )
                }
                aria-label={
                  lyricSynced && line.time !== null
                    ? `Seek to ${clock((line.time + doc.fileOffset + doc.userOffset) / 1000)}: ${line.text}`
                    : line.text
                }
              >
                {lyricLayers(doc, line, session.settings).map(
                  (layer, index) => (
                    <span
                      key={layer.kind}
                      className={`lyric-${layer.kind} ${index === 0 ? "lyric-primary" : ""}`}
                      lang={
                        layer.kind === "translation"
                          ? "en"
                          : layer.kind === "roman"
                            ? "und-Latn"
                            : /[\u0b80-\u0bff]/.test(line.text)
                              ? "ta"
                              : /[\u0900-\u097f]/.test(line.text)
                                ? "und-Deva"
                                : undefined
                      }
                      dir="auto"
                    >
                      {layer.text}
                    </span>
                  ),
                )}
              </button>
            ))}
          </div>
          {!follow && (lyricSynced || session.settings.estimatedScroll) && (
            <button
              className="lyric-back-to-sync"
              onClick={() => setFollow(true)}
              aria-label="Back to sync"
            >
              <RefreshCw size={13} />
              Back to sync
            </button>
          )}
        </>
      )}
    </section>
  );
}
