import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import type { LyricDocument, Preferences, Track } from "../../domain/types";
import { mobile } from "../../adapters/native";
import {
  GEMINI_KEY_CHANGED,
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
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = processingState.status === "processing";
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    if (mobile) {
      setLoading(false);
      return;
    }
    let active = true;
    void invoke<boolean>("gemini_key_status")
      .then((value) => {
        if (active) setSaved(value);
      })
      .catch(() => {
        if (active)
          setError("Could not read private key settings. You can save a replacement.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggle = (
    name: string,
    detail: string,
    id: "romanisation" | "translation" | "originalScript" | "originalFirst" | "autoOpenLyrics" | "estimatedScroll" | "autoGemini",
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

  async function saveKey() {
    if (!key.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await invoke("save_gemini_key", { key: key.trim() });
      setKey("");
      setSaved(true);
      window.dispatchEvent(new Event(GEMINI_KEY_CHANGED));
      setStatus("Key saved privately on this device.");
    } catch {
      setError("Could not save the key privately. The previous key is unchanged.");
    } finally {
      setSaving(false);
    }
  }

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
              const FONT_STEPS = [18, 20, 22, 24, 26, 28, 30, 32, 34, 38, 42, 46];
              const prev = [...FONT_STEPS].reverse().find((s) => s < settings.lyricSize);
              setting("lyricSize", prev ?? Math.max(18, settings.lyricSize - 2));
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
              const FONT_STEPS = [18, 20, 22, 24, 26, 28, 30, 32, 34, 38, 42, 46];
              const next = FONT_STEPS.find((s) => s > settings.lyricSize);
              setting("lyricSize", next ?? Math.min(46, settings.lyricSize + 2));
            }}
          >
            A+
          </button>
        </div>
      </div>

      {/* Display Settings */}
      <p className="settings-section-label">DISPLAY</p>
      <div className="lyric-toggle-grid">
        {toggle("Romanization", "Pronounce in English alphabet", "romanisation")}
        {toggle("Translation", "English meaning beneath lyrics", "translation")}
        {toggle("Original script", "Native lyrics characters", "originalScript")}
        {toggle("Original first", "Above romanization", "originalFirst", !settings.originalScript || !settings.romanisation)}
        {toggle("Auto-open lyrics", "On song start", "autoOpenLyrics")}
        {toggle("Estimated scroll", "Follow untimed lyrics", "estimatedScroll")}
      </div>

      {/* AI & Translation - Short, Friendly & Non-Tech */}
      <details className="lyric-advanced-details">
        <summary>{mobile ? "Lyrics cache" : "AI translation & cache"}</summary>
        <div className="lyric-advanced-body">
          {!mobile && (
            <>
              <div className="card-top-row" style={{ marginTop: 8 }}>
                <span className="card-section-title">AI TRANSLATION KEY</span>
                <span role="status" className={`key-pill ${saved ? "key-saved" : ""}`}>
                  {loading ? "Checking…" : saved ? "Key active" : "Optional"}
                </span>
              </div>

              {saved && !showKeyInput ? (
                <div className="key-saved-row">
                  <span className="key-saved-label">Google AI Key active</span>
                  <div className="key-saved-actions">
                    <button
                      type="button"
                      className="key-action-pill"
                      onClick={() => setShowKeyInput(true)}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      className="key-action-pill key-remove-pill"
                      disabled={saving || pending}
                      onClick={() => {
                        setSaving(true);
                        setError("");
                        void invoke("delete_gemini_key")
                          .then(() => {
                            setSaved(false);
                            window.dispatchEvent(new Event(GEMINI_KEY_CHANGED));
                            setKey("");
                            setStatus("Key removed.");
                          })
                          .catch(() => setError("Could not remove the saved key."))
                          .finally(() => setSaving(false));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  className="key-input-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveKey();
                  }}
                >
                  <input
                    id="gemini-private-key"
                    aria-label="Gemini API key"
                    type="password"
                    disabled={saving}
                    autoComplete="off"
                    spellCheck={false}
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    placeholder={saved ? "Paste replacement key…" : "Paste Google AI key (AIza…)"}
                  />
                  <button
                    type="submit"
                    className="subtle key-save-btn"
                    disabled={!key.trim() || saving}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  {saved && (
                    <button
                      type="button"
                      className="key-action-pill"
                      onClick={() => setShowKeyInput(false)}
                    >
                      Cancel
                    </button>
                  )}
                </form>
              )}

              {toggle("Auto-translate", "Automatically translate foreign lyrics", "autoGemini", !saved)}
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

      {status && (
        <p className="lyric-settings-status" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="lyric-settings-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
