import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { mobile } from "../../adapters/native";
import { GEMINI_KEY_CHANGED } from "../../adapters/lyric-processing";

export function GeminiKeySettings({
  disabled = false,
  onStatusChange,
}: {
  disabled?: boolean;
  onStatusChange?: (saved: boolean) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    if (mobile) {
      setLoading(false);
      return;
    }
    let active = true;
    const refresh = () => {
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
    };
    refresh();
    window.addEventListener(GEMINI_KEY_CHANGED, refresh);
    return () => {
      window.removeEventListener(GEMINI_KEY_CHANGED, refresh);
      active = false;
    };
  }, []);

  async function saveKey() {
    if (!key.trim() || saving) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await invoke("save_gemini_key", { key: key.trim() });
      setKey("");
      setSaved(true);
      setShowKeyInput(false);
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

  useEffect(() => {
    onStatusChange?.(saved);
  }, [saved, onStatusChange]);
  return (
    <section aria-label="Gemini key management">
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
              disabled={saving || disabled}
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
            aria-label="Gemini API key"
            type="password"
            disabled={saving}
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={
              saved ? "Paste replacement key…" : "Paste Google AI key (AIza…)"
            }
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
              onClick={() => { setKey(""); setShowKeyInput(false); }}
            >
              Cancel
            </button>
          )}
        </form>
      )}

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
    </section>
  );
}
