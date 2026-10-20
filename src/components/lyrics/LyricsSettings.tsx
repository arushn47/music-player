import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Upload, X } from "lucide-react";
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
  attach,
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
  attach?: (
    kind: "original" | "romanisation" | "translation",
  ) => Promise<void> | void;
  onClose?: () => void;
  processingState: LyricProcessingState;
  regenerate: () => void;
  clearCache: () => void;
  cachedCount: number;
}) {
  const [saved, setSaved] = useState(false),
    [loading, setLoading] = useState(true);
  const [key, setKey] = useState(""),
    [saving, setSaving] = useState(false);
  const pending = processingState.status === "processing";
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [modelDraft, setModelDraft] = useState(settings.geminiModel);
  useEffect(() => setModelDraft(settings.geminiModel), [settings.geminiModel]);
  function commitModel() {
    const value = modelDraft.trim();
    if (/^[A-Za-z0-9._-]{1,100}$/.test(value)) {
      setting("geminiModel", value);
    } else {
      setError("Enter a valid Gemini model name.");
    }
  }
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
          setError(
            "Could not read private key settings. You can save a replacement.",
          );
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
    id:
      | "romanisation"
      | "originalScript"
      | "originalFirst"
      | "translation"
      | "autoOpenLyrics"
      | "estimatedScroll",

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
      setError(
        "Could not save the key privately. The previous key is unchanged.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <header className="lyric-settings-header">
        <div className="lyric-settings-title-wrap">
          <strong>Lyrics settings</strong>
          <span
            role="status"
            className={`key-pill ${saved ? "key-saved" : ""}`}
          >
            {loading ? "Checking key…" : saved ? "Key saved" : "No key saved"}
          </span>
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
      {doc && (
        <div className="lyric-settings-card timing-card">
          <div className="card-top-row">
            <span className="card-section-title">TIMING & SYNC</span>
            <span className="sync-pill">
              {lyricSynced
                ? "Synchronized playback"
                : settings.estimatedScroll
                  ? "Estimated autoscroll"
                  : "Manual scroll mode"}
            </span>
          </div>
          {lyricSynced && onUpdateOffset && (
            <div className="timing-offset-control">
              <label>
                <span>Timing adjustment</span>
                <div className="timing-input-group">
                  <input
                    aria-label="Lyric timing offset in milliseconds"
                    type="number"
                    step={50}
                    min={-60000}
                    max={60000}
                    value={doc.userOffset}
                    onChange={(e) => {
                      const offset = Math.min(
                        60000,
                        Math.max(-60000, Number(e.target.value)),
                      );
                      onUpdateOffset(offset);
                    }}
                  />
                  <span className="timing-unit">ms</span>
                </div>
              </label>
              <span className="timing-hint">
                Positive = later · File offset {doc.fileOffset} ms
              </span>
            </div>
          )}
        </div>
      )}

      {doc && (
        <div className="lyric-settings-card sources-card">
          <div className="card-top-row">
            <span className="card-section-title">LYRIC FILES & SOURCES</span>
            {doc.source?.provider === "lrclib" &&
              Number.isSafeInteger(doc.source.recordId) && (
                <a
                  className="source-provider-pill"
                  href={`https://lrclib.net/tracks/${doc.source.recordId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  LRCLIB ↗
                </a>
              )}
          </div>
          <div className="source-meta-row">
            <span className="source-label">Current:</span>
            <span className="source-name" title={doc.fileName}>
              {doc.fileName}
            </span>
          </div>
          {attach && (
            <div className="source-button-row">
              <button
                type="button"
                className="subtle"
                disabled={!track}
                onClick={() => void attach("original")}
              >
                <Upload size={13} />
                {doc ? "Replace original" : "Attach lyrics"}
              </button>
              <button
                type="button"
                className="subtle"
                disabled={!track}
                onClick={() => void attach("romanisation")}
              >
                {Object.keys(doc.romanisation).length ? "Replace" : "Attach"}{" "}
                supplied Latin
              </button>
              <button
                type="button"
                className="subtle"
                disabled={!track}
                onClick={() => void attach("translation")}
              >
                {Object.keys(doc.translation).length ? "Replace" : "Attach"}{" "}
                supplied English
              </button>
            </div>
          )}
        </div>
      )}
      <p className="settings-section-label">DISPLAY SETTINGS</p>
      <div className="lyric-toggle-grid">
        {toggle("Romanization", "Roman script", "romanisation")}
        {toggle("Original script", "Native lyrics", "originalScript")}
        {toggle(
          "Original first",
          "Above Roman",
          "originalFirst",
          !settings.originalScript || !settings.romanisation,
        )}
        {toggle("Translation", "English meaning", "translation")}
        {toggle("Auto-open lyrics", "On song start", "autoOpenLyrics")}
        {toggle("Estimated scroll", "Untimed lyrics", "estimatedScroll")}
      </div>
      <div className="lyric-font-row">
        <strong>Lyrics text size</strong>
        <div>
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
            onClick={() => setting("lyricSize", 28)}
          >
            {Math.round((settings.lyricSize / 28) * 100)}%
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
      {mobile ? (
        <p className="private-key-card">
          Local romanization works on Android. Gemini key storage and
          translation are not enabled in this prototype yet.
        </p>
      ) : (
        <form
          className="private-key-card"
          onSubmit={(event) => {
            event.preventDefault();
            void saveKey();
          }}
        >
          <div className="card-top-row">
            <div className="key-title-group">
              <label
                htmlFor="gemini-private-key"
                className="card-section-title"
              >
                Gemini API key
              </label>
              <span className="key-optional-tag">Optional</span>
            </div>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="get-api-key-link"
            >
              Get API key ↗
            </a>
          </div>

          {saved && (
            <div className="saved-key-status-box">
              <div className="saved-key-status-left">
                <div className="saved-key-indicator">
                  <span className="saved-key-dot" />
                  <span className="saved-key-status-text">
                    Active key stored & ready
                  </span>
                </div>
                <span className="saved-key-dots">•••• •••• •••• ••••</span>
              </div>
              <button
                type="button"
                className="subtle remove-key-btn"
                disabled={saving || pending}
                onClick={() => {
                  setSaving(true);
                  setError("");
                  void invoke("delete_gemini_key")
                    .then(() => {
                      setSaved(false);
                      window.dispatchEvent(new Event(GEMINI_KEY_CHANGED));
                      setKey("");
                      setStatus("Saved key removed from this device.");
                    })
                    .catch(() => setError("Could not remove the saved key."))
                    .finally(() => setSaving(false));
                }}
              >
                Remove key
              </button>
            </div>
          )}

          <div className="key-input-section">
            {saved && (
              <span className="key-input-subprompt">
                To replace with a different key, enter it below:
              </span>
            )}
            <div className="key-input-row">
              <input
                id="gemini-private-key"
                aria-label="Gemini API key"
                type="password"
                disabled={saving}
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder={
                  saved
                    ? "Paste replacement key here…"
                    : "Paste your API key (starts with AIza…)"
                }
              />
              <button
                type="submit"
                className="subtle key-save-btn"
                disabled={!key.trim() || saving}
              >
                {saving ? "Saving…" : saved ? "Replace key" : "Save key"}
              </button>
            </div>
          </div>

          <small className="key-security-note">
            Encrypted on this device using OS keychain. Used only for your lyric
            requests to Gemini. When automatic processing is enabled, each
            selected song’s lyrics are sent for pronunciation and English
            meaning.
          </small>
        </form>
      )}
      <details className="lyric-model">
        <summary>Gemini processing</summary>
        <label className="switch-row">
          Automatically process each song
          <input
            type="checkbox"
            aria-label="Automatically process each song"
            checked={settings.autoGemini}
            onChange={(event) => setting("autoGemini", event.target.checked)}
          />
        </label>
        <label>
          Gemini model
          <input
            aria-label="Gemini model"
            value={modelDraft}
            maxLength={100}
            onChange={(event) => setModelDraft(event.target.value)}
            onBlur={commitModel}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
        </label>
      </details>
      <div className="lyric-settings-actions">
        <button
          className="primary"
          disabled={!doc?.lines.length || pending}
          onClick={regenerate}
        >
          ↻ Re-transliterate this song
        </button>
        <button
          className="subtle"
          disabled={
            !doc?.lines.length || !saved || !!key.trim() || saving || pending
          }
          onClick={() => {
            setting("autoGemini", true);
            window.dispatchEvent(new Event(GEMINI_PROCESS_RETRY));
          }}
        >
          {pending
            ? "Processing pronunciation & meaning…"
            : "Refresh pronunciation & translation"}
        </button>
        <small>
          With a saved key, each song is processed automatically. Completed
          results are reused; refresh sends another request. Provider quotas
          still apply.
        </small>
        <button
          className="text-button"
          disabled={!cachedCount || pending}
          onClick={clearCache}
        >
          Clear cached lyrics ({cachedCount})
        </button>
        <small>
          Imported lyrics stay on your device. Romanization works locally
          without a key.
        </small>
      </div>
      {status && (
        <p className="lyric-settings-status" role="status">
          {status}
        </p>
      )}
      {processingState.status !== "idle" && (
        <p
          className={
            processingState.status === "error"
              ? "lyric-settings-error"
              : "lyric-settings-status"
          }
          role="status"
        >
          {pending
            ? "Generating pronunciation and English meaning…"
            : processingState.status === "error"
              ? processingState.message
              : "Pronunciation and translation saved for this song."}
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
