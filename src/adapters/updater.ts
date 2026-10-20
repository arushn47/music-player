import { isTauri } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import config from "../../src-tauri/tauri.conf.json";

export type UpdateStage = "idle" | "checking" | "unconfigured" | "current" | "available" | "downloading" | "ready" | "restarting" | "error";
export interface UpdateState {
  stage: UpdateStage;
  currentVersion: string;
  version?: string;
  date?: string;
  notes?: string;
  progress?: number;
  error?: string;
}

export const supportsWindowsUpdates = (): boolean => isTauri() && /Windows/i.test(navigator.userAgent);
const settings = config.plugins.updater;
const configured = (): boolean => Boolean(settings.pubkey.trim()) && settings.endpoints.length > 0 && settings.endpoints.every((endpoint) => Boolean(endpoint.trim()));
let update: Update | null = null;
let state: UpdateState = { stage: configured() ? "idle" : "unconfigured", currentVersion: config.version };
const listeners = new Set<() => void>();
export const getUpdateState = (): UpdateState => state;
export function subscribeToUpdates(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function publish(next: Partial<UpdateState>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}
function failed(error: unknown): void {
  const message = String(error);
  const missing = /404|not found|pubkey|public key|could not fetch a valid release json/i.test(message);
  publish({ stage: missing ? "unconfigured" : "error", error: missing ? undefined : `Unable to update. Check your connection and try again. ${message}` });
}
export async function checkForUpdates(): Promise<void> {
  if (["checking", "downloading", "ready", "restarting"].includes(state.stage)) return;
  publish({ stage: "checking", error: undefined, version: undefined, notes: undefined, date: undefined, progress: undefined });
  try {
    if (!supportsWindowsUpdates() || import.meta.env.DEV || !configured()) {
      publish({ stage: "unconfigured" });
      return;
    }
    publish({ currentVersion: await getVersion() });
    if (update) await update.close();
    update = null;
    update = await check({ timeout: 15000 });
    publish(update ? { stage: "available", version: update.version, date: update.date, notes: update.body } : { stage: "current" });
  } catch (error) { failed(error); }
}
export async function downloadUpdate(): Promise<void> {
  if (!update || !["available", "error"].includes(state.stage)) return;
  publish({ stage: "downloading", progress: undefined, error: undefined });
  let received = 0;
  let total: number | undefined;
  try {
    await update.download((event) => {
      if (event.event === "Started") { total = event.data.contentLength; received = 0; }
      if (event.event === "Progress") received += event.data.chunkLength;
      // Keep 100% for a successful, signature-verified download promise.
      publish({ progress: total ? Math.min(99, Math.floor(received / total * 100)) : undefined });
    }, { timeout: 120000 });
    publish({ stage: "ready", progress: 100 });
  } catch (error) { failed(error); }
}
export async function restartAndUpdate(): Promise<void> {
  if (!update || state.stage !== "ready") return;
  publish({ stage: "restarting", error: undefined });
  try {
    await update.install({ restartAfterInstall: true });
  } catch (error) {
    publish({ stage: "ready", error: `Installation failed. You can retry. ${String(error)}` });
  }
}
