import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { LyricDocument, Preferences } from "../domain/types";
import { mobile } from "../adapters/native";

export function LyricsSettings({
  settings,
  setting,
  doc,
  applyTranslation,
  regenerate,
  clearCache,
  cachedCount,
}: {
  settings: Preferences;
  setting: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  doc?: LyricDocument;
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
        <strong>Lyrics settings</strong>
        <span role="status" className={saved ? "key-saved" : ""}>
          {loading ? "Checking key…" : saved ? "Key saved" : "No key saved"}
        </span>
      </header>
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
          <div>
            <label htmlFor="gemini-private-key">Gemini API key</label>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
            >
              Get API key ↗
            </a>
          </div>
          <input
            id="gemini-private-key"
            type="password"
            disabled={saving}
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={
              saved ? "Key saved · enter a replacement" : "Paste your API key"
            }
          />
          <small>
            Encrypted on this device. Used only for your lyric requests to
            Gemini. Never included in library backups.
          </small>
          <div className="private-key-actions">
            <button className="subtle" disabled={!key.trim() || saving}>
              {saving ? "Saving…" : saved ? "Replace key" : "Save key"}
            </button>
            {saved && (
              <button
                type="button"
                className="subtle"
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
            )}
          </div>
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
