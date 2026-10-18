import React from "react";
import { Download, FolderOpen, Globe, Upload } from "lucide-react";
import type { Preferences, Session, Track } from "../../domain/types";

export interface SettingsViewProps {
  session: Session;
  tracks: Track[];
  downloads: Record<string, string>;
  busy: boolean;
  mobile: boolean;
  ytdlpAvailable: boolean;
  onExportLibrary: () => void;
  onImportBackup: () => void;
  onSetting: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  onClearHistory: () => void;
  onClearLyricCache: () => void;
  onCancelDownload: (id: string) => void;
  onRetryDownload: (track: Track) => void;
  onDeleteOffline: (track: Track) => void;
}

export function SettingsView({
  session,
  tracks,
  downloads,
  busy,
  mobile,
  ytdlpAvailable,
  onExportLibrary,
  onImportBackup,
  onSetting,
  onClearHistory,
  onClearLyricCache,
  onCancelDownload,
  onRetryDownload,
  onDeleteOffline,
}: SettingsViewProps) {
  return (
    <section className="settings-page">
      <p className="eyebrow">A PLAYER THAT'S YOURS</p>
      <h1>
        Keep it personal<span className="heading-dot">.</span>
      </h1>
      <p className="subtitle">
        Your music stays on your device. You stay in control.
      </p>

      <div className="settings-card">
        <h2>Library & portability</h2>
        <p>
          SQLite stores your library, collections, queue, supplied lyric
          text and preferences locally. Restored playback always starts
          paused.
        </p>
        <div className="button-row">
          <button
            className="subtle"
            disabled={busy || mobile}
            onClick={onExportLibrary}
          >
            <Download size={16} />
            Export library
          </button>
          <button
            className="subtle"
            disabled={busy || mobile}
            onClick={onImportBackup}
          >
            <Upload size={16} />
            Import backup
          </button>
        </div>
        <small>
          {mobile
            ? "Android backup import and export are not enabled in this prototype yet. Your library is stored on this device."
            : "Backups contain metadata and settings. Audio and lyric text are excluded. Files imported on another device require Relink."}
        </small>
      </div>

      <div className="settings-card">
        <h2>Privacy</h2>
        <label className="switch-row">
          <span>
            Record listening history
            <small>Nothing is sent to an external service.</small>
          </span>
          <input
            type="checkbox"
            checked={session.settings.historyEnabled}
            onChange={(e) =>
              onSetting("historyEnabled", e.target.checked)
            }
          />
        </label>
        <div className="button-row">
          <button
            className="subtle"
            onClick={onClearHistory}
          >
            Clear history
          </button>
          <button
            className="subtle"
            onClick={onClearLyricCache}
          >
            Clear lyric cache
          </button>
        </div>
      </div>

      <div className="settings-card">
        <h2>Offline downloads</h2>
        <p>
          Only explicitly downloaded, licensed audio is stored here.
          External local files are never deleted by these controls.
        </p>
        {Object.entries(downloads)
          .filter(([, status]) => status !== "complete")
          .map(([id, status]) => (
            <div className="source-row" key={id}>
              <span>
                {tracks.find((track) => track.id === id)?.title ||
                  "Audio download"}{" "}
                · {status === "downloading" ? "Downloading…" : status}
              </span>
              {status === "downloading" ? (
                <button onClick={() => onCancelDownload(id)}>
                  Cancel download
                </button>
              ) : (
                <button
                  onClick={() => {
                    const track = tracks.find((track) => track.id === id);
                    if (track) onRetryDownload(track);
                  }}
                >
                  Retry download
                </button>
              )}
            </div>
          ))}
        {tracks
          .filter((track) => track.offline)
          .map((track) => (
            <div className="source-row" key={track.id}>
              <span>{track.title} · Available offline</span>
              <button onClick={() => onDeleteOffline(track)}>
                Delete offline copy
              </button>
            </div>
          ))}
      </div>

      <div className="settings-card">
        <h2>Sources</h2>
        <div className="source-row">
          <span className="source-symbol">
            <FolderOpen size={20} />
          </span>
          <div>
            <strong>Local files</strong>
            <p>Selected files only · Offline playback · No account</p>
          </div>
          <span className="source-status">Enabled</span>
        </div>
        <div className="source-row">
          <span className="source-symbol">
            <Globe size={20} />
          </span>
          <div>
            <strong>YouTube (via yt-dlp)</strong>
            <p>
              Search and stream · URLs expire · Personal, non-commercial
              use only
            </p>
          </div>
          <span className="source-status">
            {ytdlpAvailable ? "Enabled" : "Not Available"}
          </span>
        </div>
        <p>
          YouTube streaming requires yt-dlp. Stream URLs expire after a
          few hours. Use is subject to YouTube Terms of Service. For
          personal, non-commercial use only. Local files work
          independently and offline.
        </p>
      </div>

      <div className="settings-card">
        <h2>Keyboard & playback</h2>
        <p>
          <kbd>Space</kbd> Play / pause{" "}
          <span className="shortcut-gap" />
          <kbd>Alt</kbd> + <kbd>→</kbd> Next{" "}
          <span className="shortcut-gap" />
          <kbd>Alt</kbd> + <kbd>←</kbd> Previous
        </p>
        <p>
          Use Tab and Enter for all controls. Shortcuts leave text
          inputs alone. Lyrics follow the actual audio clock; scroll
          away to read at your own pace.
        </p>
        <small>
          Format compatibility depends on your Windows codecs. Playback
          errors keep the queue intact. No gapless or bit-perfect claim.
        </small>
      </div>

      <p className="about">
        Lumaire 0.1.0 · Original local-first application
        <br />
        Built with React, TypeScript, Vite, Tauri 2, Rust and SQLite.
        Software notices are included in the project.
      </p>
    </section>
  );
}
