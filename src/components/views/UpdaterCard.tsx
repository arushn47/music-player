import { useState, useSyncExternalStore } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Download, LoaderCircle, RefreshCw } from "lucide-react";
import { checkForUpdates, downloadUpdate, restartAndUpdate, getUpdateState, subscribeToUpdates, supportsWindowsUpdates, supportsAndroidUpdates } from "../../adapters/updater";

function ReleaseNotes({ text }: { text: string }) {
  const inline = (value: string) => value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) =>
    part.startsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part.startsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : part);
  return <div className="updater-notes">{text.slice(0, 20000).trim().split(/\r?\n\s*\r?\n/).map((block, index) => {
    const heading = block.match(/^#{1,6}\s+([^\n]+)$/);
    if (heading) return <h5 key={index}>{inline(heading[1])}</h5>;
    const lines = block.split(/\r?\n/);
    if (lines.every(line => /^[-*]\s+/.test(line))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^[-*]\s+/, ''))}</li>)}</ul>;
    return <p key={index}>{inline(lines.join(' '))}</p>;
  })}</div>;
}

export function UpdaterCard() {
  const state = useSyncExternalStore(subscribeToUpdates, getUpdateState, getUpdateState);
  const [linkError, setLinkError] = useState("");
  if (supportsAndroidUpdates()) return <section className="settings-section updater-section">
    <h3 className="section-label">Software updates</h3>
    <div className="settings-card-group"><div className="settings-row"><div className="row-text"><strong>Android updates</strong><small>Installed v{state.currentVersion}</small></div>
      <button className="subtle" onClick={() => void openUrl("https://github.com/arushn47/music-player/releases/latest").catch(() => setLinkError("Couldn't open releases. Visit github.com/arushn47/music-player/releases in your browser."))}>Releases & APK downloads</button></div>
      <p className="updater-details">Read the release notes, then download and open the newer APK. Android installs it over Lumaire and keeps your data when it uses the same package and signing certificate. Do not uninstall first. Android asks you to confirm installation; this is not a silent in-app updater.</p>
      {linkError && <p className="updater-details" role="alert">{linkError}</p>}
      {state.installedRelease && <div className="updater-details"><h4>What's new in v{state.installedRelease.version}</h4><ReleaseNotes text={state.installedRelease.notes} /></div>}
    </div></section>;
  if (!supportsWindowsUpdates()) return null;
  const busy = ["checking", "downloading", "restarting"].includes(state.stage);
  const status = state.stage === "development" ? "Development build" : state.stage === "unconfigured" ? "Updates aren't configured"
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
      {state.stage === 'development' && <p className="updater-details">Update checks are disabled in development builds. Signed installed releases can download and install updates without uninstalling Lumaire.</p>}
      {state.stage === 'unconfigured' && <p className="updater-details">No signed update feed is available yet. Updates appear here after a newer Windows release and its update manifest are published.</p>}
      {state.version && <div className="updater-details">
        {state.stage === "downloading" && <div role="status">
          <p>Downloading update{state.progress === undefined ? "…" : ` · ${state.progress}%`}</p>
          <progress aria-label="Update download progress" max={100} value={state.progress} />
        </div>}
        {(["available", "error"].includes(state.stage)) && <button className="primary updater-action" onClick={() => void downloadUpdate()}><Download size={18} /> Download update v{state.version}</button>}
        {["ready", "restarting"].includes(state.stage) && <>
          <p>Restarting will interrupt playback and close Lumaire while the update installs.</p>
          <button className="primary updater-action" disabled={busy} onClick={() => void restartAndUpdate()}><RefreshCw size={18} /> {state.stage === "restarting" ? "Restarting…" : "Restart & Update"}</button>
        </>}
        {state.date && <small>Released {new Date(state.date).toLocaleDateString()}</small>}
        <h4>Release notes</h4><ReleaseNotes text={state.notes || "No release notes were supplied for this update."} />
      </div>}
      {!state.version && state.installedRelease && <div className="updater-details"><h4>What's new in v{state.installedRelease.version}</h4><ReleaseNotes text={state.installedRelease.notes} /></div>}
      {state.error && <p className="updater-details" role="alert">{state.error}</p>}
    </div>
  </div>;
}
