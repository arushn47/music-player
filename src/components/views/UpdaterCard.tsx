import { useSyncExternalStore } from "react";
import { Download, LoaderCircle, RefreshCw } from "lucide-react";
import { checkForUpdates, downloadUpdate, restartAndUpdate, getUpdateState, subscribeToUpdates, supportsWindowsUpdates } from "../../adapters/updater";

export function UpdaterCard() {
  const state = useSyncExternalStore(subscribeToUpdates, getUpdateState);
  if (!supportsWindowsUpdates()) return null;
  const busy = ["checking", "downloading", "restarting"].includes(state.stage);
  const status = state.stage === "unconfigured" ? "Updates aren't configured"
    : state.stage === "current" ? `Lumaire is up to date (v${state.currentVersion})`
    : state.version ? `Update available (v${state.version})` : "Software updates";
  return <div className="settings-section updater-section">
    <h3 className="section-label">Software updates</h3>
    <div className="settings-card-group">
      <div className="settings-row">
        <div className="row-text" role="status" aria-live="polite">
          <strong>{status}</strong>
          <small>{state.stage === "checking" ? "Checking for updates…" : `Installed v${state.currentVersion} · Checked only when you ask`}</small>
        </div>
        {!["downloading", "ready", "restarting"].includes(state.stage) && <button className="subtle" disabled={busy} onClick={() => void checkForUpdates()}>
          {state.stage === "checking" && <LoaderCircle size={16} className="updater-spinner" aria-hidden="true" />} Check for updates
        </button>}
      </div>
      {state.version && <div className="updater-details">
        {state.date && <small>Released {new Date(state.date).toLocaleDateString()}</small>}
        {state.notes && <p className="updater-notes">{state.notes.slice(0, 2000)}</p>}
        {state.stage === "downloading" && <div role="status">
          <p>Downloading update{state.progress === undefined ? "…" : ` · ${state.progress}%`}</p>
          <progress aria-label="Update download progress" max={100} value={state.progress} />
        </div>}
        {(["available", "error"].includes(state.stage)) && <button onClick={() => void downloadUpdate()}><Download size={16} /> Download update</button>}
        {["ready", "restarting"].includes(state.stage) && <>
          <p>Restarting will interrupt playback and close Lumaire while the update installs.</p>
          <button disabled={busy} onClick={() => void restartAndUpdate()}><RefreshCw size={16} /> {state.stage === "restarting" ? "Restarting…" : "Restart & Update"}</button>
        </>}
      </div>}
      {state.error && <p className="updater-details" role="alert">{state.error}</p>}
    </div>
  </div>;
}
