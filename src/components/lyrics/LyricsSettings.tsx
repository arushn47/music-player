import { useState } from "react";
import { X } from "lucide-react";
import { GeminiKeySettings } from "./GeminiKeySettings";
import type { LyricDocument, Preferences, Track } from "../../domain/types";
import { mobile } from "../../adapters/native";
import {
  GEMINI_PROCESS_RETRY,
  type LyricProcessingState,
} from "../../adapters/lyric-processing";

export function LyricsSettings({
  settings,
  setting,
  doc,
  track,
  lyricSynced,
  onUpdateOffset,
  onClose,
  processingState,
  regenerate,
  clearCache,
  cachedCount,
}: {
  settings: Preferences;
  setting: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  doc?: LyricDocument;
  track?: Track;
  lyricSynced?: boolean;
  onUpdateOffset?: (offset: number) => void;
  onClose?: () => void;
  processingState: LyricProcessingState;
  regenerate: () => void;
  clearCache: () => void;
  cachedCount: number;
}) {
  const [saved, setSaved] = useState(false);
  const pending = processingState.status === "processing";

  const toggle = (
    name: string,
    detail: string,
    id:
      | "romanisation"
      | "translation"
      | "originalScript"
      | "originalFirst"
      | "autoOpenLyrics"
      | "estimatedScroll"
      | "autoGemini",
    disabled = false,
  ) => (
    <label className={`lyric-setting-toggle ${disabled ? "is-disabled" : ""}`}>
      <span>
        <strong>{name}</strong>
        <small>{detail}</small>
      </span>
      <input
        type="checkbox"
        aria-label={name}
        checked={settings[id]}
        disabled={disabled}
        onChange={(event) => setting(id, event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );

  return (
    <>
      <header className="lyric-settings-header">
        <div className="lyric-settings-title-wrap">
          <strong>Lyrics settings</strong>
        </div>
        {onClose && (
          <button
            type="button"
            className="icon-button lyric-settings-close-btn"
            onClick={onClose}
            aria-label="Close lyrics settings"
            title="Close"
          >
            <X size={15} />
          </button>
        )}
      </header>

      {/* Human Timing Adjustment */}
      {doc && lyricSynced && onUpdateOffset && (
        <div className="lyric-settings-card timing-card">
          <div className="card-top-row">
            <span className="card-section-title">SYNC ADJUSTMENT</span>
            <span className="sync-pill">Synchronized</span>
          </div>
          <div className="timing-human-row">
            <button
              type="button"
              className="subtle timing-step-btn"
              title="Lyrics appear 0.5s earlier"
              onClick={() => onUpdateOffset(doc.userOffset - 500)}
            >
              Earlier (−0.5s)
            </button>
            <span className="timing-display-pill">
              {doc.userOffset === 0
                ? "In sync"
                : `${doc.userOffset > 0 ? "+" : ""}${(doc.userOffset / 1000).toFixed(1)}s`}
            </span>
            <button
              type="button"
              className="subtle timing-step-btn"
              title="Lyrics appear 0.5s later"
              onClick={() => onUpdateOffset(doc.userOffset + 500)}
            >
              Later (+0.5s)
            </button>
            {doc.userOffset !== 0 && (
              <button
                type="button"
                className="link-button timing-reset-btn"
                title="Reset timing offset to zero"
                onClick={() => onUpdateOffset(0)}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Text Size Control */}
      <div className="lyric-font-row">
        <strong>Text size</strong>
        <div className="lyric-font-stepper">
          <button
            aria-label="Decrease lyric text size"
            disabled={settings.lyricSize <= 18}
            onClick={() => {
              const FONT_STEPS = [
                18, 20, 22, 24, 26, 28, 30, 32, 34, 38, 42, 46,
              ];
              const prev = [...FONT_STEPS]
                .reverse()
                .find((s) => s < settings.lyricSize);
              setting(
                "lyricSize",
                prev ?? Math.max(18, settings.lyricSize - 2),
              );
            }}
          >
            A−
          </button>
          <button
            type="button"
            className="lyric-font-output-btn"
            title="Click to reset to 100%"
            onClick={() => setting("lyricSize", 32)}
          >
            {Math.round((settings.lyricSize / 32) * 100)}%
          </button>
          <button
            aria-label="Increase lyric text size"
            disabled={settings.lyricSize >= 46}
            onClick={() => {
              const FONT_STEPS = [
                18, 20, 22, 24, 26, 28, 30, 32, 34, 38, 42, 46,
              ];
              const next = FONT_STEPS.find((s) => s > settings.lyricSize);
              setting(
                "lyricSize",
                next ?? Math.min(46, settings.lyricSize + 2),
              );
            }}
          >
            A+
          </button>
        </div>
      </div>

      {/* Display Settings */}
      <p className="settings-section-label">DISPLAY</p>
      <div className="lyric-toggle-grid">
        {toggle(
          "Romanization",
          "Pronounce in English alphabet",
          "romanisation",
        )}
        {toggle("Translation", "English meaning beneath lyrics", "translation")}
        {toggle(
          "Original script",
          "Native lyrics characters",
          "originalScript",
        )}
        {toggle(
          "Original first",
          "Above romanization",
          "originalFirst",
          !settings.originalScript || !settings.romanisation,
        )}
        {toggle("Auto-open lyrics", "On song start", "autoOpenLyrics")}
        {toggle("Estimated scroll", "Follow untimed lyrics", "estimatedScroll")}
      </div>

      {/* AI & Translation - Short, Friendly & Non-Tech */}
      <details className="lyric-advanced-details">
        <summary>{mobile ? "Lyrics cache" : "AI translation & cache"}</summary>
        <div className="lyric-advanced-body">
          {!mobile && (
            <>
              <GeminiKeySettings disabled={pending} onStatusChange={setSaved} />
              {toggle(
                "Auto-translate",
                "Automatically translate foreign lyrics",
                "autoGemini",
                !saved,
              )}
            </>
          )}

          <div className="lyric-settings-actions" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="apple-refresh-lyrics-btn"
              disabled={!doc?.lines.length || doc.instrumental || pending}
              onClick={() => {
                if (saved) {
                  window.dispatchEvent(new Event(GEMINI_PROCESS_RETRY));
                }
                regenerate();
              }}
            >
              ↻ Refresh lyrics & translation
            </button>

            {cachedCount > 0 && (
              <button
                type="button"
                className="text-button"
                disabled={pending}
                onClick={clearCache}
              >
                Clear cached lyrics ({cachedCount})
              </button>
            )}
          </div>
        </div>
      </details>
    </>
  );
}
