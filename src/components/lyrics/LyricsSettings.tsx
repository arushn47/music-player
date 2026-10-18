import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Upload, X } from "lucide-react";
import type { LyricDocument, Preferences, Track } from "../../domain/types";
import { mobile } from "../../adapters/native";

export function LyricsSettings({
  settings,
  setting,
  doc,
  track,
  lyricSynced,
  onUpdateOffset,
  attach,
  onClose,
  applyTranslation,
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
  attach?: (kind: "original" | "romanisation" | "translation") => Promise<void> | void;
  onClose?: () => void;
  applyTranslation: (id: string, values: Record<string, string>) => void;
  regenerate: () => void;
  clearCache: () => void;
  cachedCount: number;
}) {
  const [saved, setSaved] = useState(false),
    [loading, setLoading] = useState(true);
  const [key, setKey] = useState(""),
    [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [status, setStatus] = useState("");
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
      setStatus("Key saved privately on this device.");
    } catch {
      setError(
        "Could not save the key privately. The previous key is unchanged.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function translate() {
    if (!doc || pending || !saved || key.trim()) return;
    const original = doc;
    setPending(true);
    setError("");
    setStatus("Translating this song…");
    try {
      const values = await invoke<Record<string, string>>("translate_lyrics", {
        lines: original.lines.map(({ id, text }) => ({ id, text })),
        model: settings.geminiModel,
      });
      applyTranslation(original.id, values);
      setStatus("Requested translation saved for that song.");
    } catch (error) {
      setError(String(error));
      setStatus("");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <header className="lyric-settings-header">
        <div className="lyric-settings-title-wrap">
          <strong>Lyrics settings</strong>
          <span role="status" className={`key-pill ${saved ? "key-saved" : ""}`}>
            {loading ? "Checking key…" : saved ? "Key saved" : "No key saved"}
          </span>
        </div>
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
            onClick={() =>
              setting("lyricSize", Math.max(18, settings.lyricSize - 2))
            }
          >
            A−
          </button>
          <output aria-label="Lyric text size">
            {Math.round((settings.lyricSize / 28) * 100)}%
          </output>
          <button
            aria-label="Increase lyric text size"
            disabled={settings.lyricSize >= 46}
            onClick={() =>
              setting("lyricSize", Math.min(46, settings.lyricSize + 2))
            }
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
              <label htmlFor="gemini-private-key" className="card-section-title">
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
            Encrypted on this device using OS keychain. Used only for your
            direct lyric requests to Gemini.
          </small>
        </form>
      )}
      <details className="lyric-model">
        <summary>Translation model</summary>
        <label>
          Gemini model
          <input
            aria-label="Gemini model"
            value={settings.geminiModel}
            maxLength={100}
            onChange={(event) => setting("geminiModel", event.target.value)}
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
          onClick={() => void translate()}
        >
          {pending
            ? "Translating…"
            : doc && Object.keys(doc.translation).length
              ? "Translate again"
              : "Translate this song"}
        </button>
        <small>
          Translation sends this song’s lyrics to Gemini only when requested.
          Saved results are reused.
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
      {error && (
        <p className="lyric-settings-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
