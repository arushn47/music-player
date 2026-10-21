import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  check: vi.fn(), getVersion: vi.fn().mockResolvedValue("1.0.4"),
  config: { version: "1.0.4", plugins: { updater: { pubkey: "test-key", endpoints: ["https://example.com/latest.json"] } } },
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: mocks.getVersion }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));
vi.mock("../../src-tauri/tauri.conf.json", () => ({ default: mocks.config }));

describe("manual Windows updater", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("DEV", false);
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0" });
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
    mocks.getVersion.mockResolvedValue("1.0.4");
    mocks.config.plugins.updater.pubkey = "test-key";
    mocks.config.plugins.updater.endpoints = ["https://example.com/latest.json"];
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("never checks automatically and guards missing configuration and development", async () => {
    const api = await import("./updater");
    expect(mocks.check).not.toHaveBeenCalled();
    mocks.config.plugins.updater.pubkey = "";
    await api.checkForUpdates();
    expect(api.getUpdateState().stage).toBe("unconfigured");
    expect(mocks.check).not.toHaveBeenCalled();
    mocks.config.plugins.updater.pubkey = "test-key";
    vi.stubEnv("DEV", true);
    await api.checkForUpdates();
    expect(api.getUpdateState().stage).toBe("development");
  });
  it("only reports current after a successful configured check", async () => {
    mocks.check.mockResolvedValue(null);
    const api = await import("./updater");
    await api.checkForUpdates();
    expect(api.getUpdateState()).toMatchObject({ stage: "current", currentVersion: "1.0.4" });
  });
  it("guards an empty endpoint and never runs on Android", async () => {
    const api = await import("./updater");
    mocks.config.plugins.updater.endpoints = [];
    await api.checkForUpdates();
    expect(api.getUpdateState().stage).toBe("unconfigured");
    mocks.config.plugins.updater.endpoints = ["https://example.com/latest.json"];
    vi.stubGlobal("navigator", { userAgent: "Android" });
    expect(api.supportsWindowsUpdates()).toBe(false);
    await api.checkForUpdates();
    expect(mocks.check).not.toHaveBeenCalled();
  });
  it.each(["HTTP 404 Not Found", "Could not fetch a valid release JSON from remote"])("handles unpublished releases: %s", async (error) => {
    mocks.check.mockRejectedValue(error);
    const api = await import("./updater");
    await api.checkForUpdates();
    expect(api.getUpdateState().stage).toBe("unconfigured");
  });
  it("makes offline checks recoverable without claiming up to date", async () => {
    mocks.check.mockRejectedValueOnce("network timeout").mockResolvedValueOnce(null);
    const api = await import("./updater");
    await api.checkForUpdates();
    expect(api.getUpdateState().stage).toBe("error");
    await api.checkForUpdates();
    expect(api.getUpdateState().stage).toBe("current");
  });
  it("separates chunk progress, verified download and installation; deduplicates clicks", async () => {
    const install = vi.fn().mockRejectedValueOnce("installer unavailable").mockResolvedValueOnce(undefined);
    const download = vi.fn(async (onEvent) => {
      onEvent({ event: "Started", data: { contentLength: 100 } });
      onEvent({ event: "Progress", data: { chunkLength: 40 } });
      expect(api.getUpdateState().progress).toBe(40);
      onEvent({ event: "Finished" });
      expect(api.getUpdateState().stage).toBe("downloading");
    });
    mocks.check.mockResolvedValue({ version: "1.0.5", body: "Release notes", date: "2026-10-20T00:00:00Z", download, install });
    const api = await import("./updater");
    await api.restartAndUpdate();
    expect(install).not.toHaveBeenCalled();
    await api.checkForUpdates();
    expect(api.getUpdateState()).toMatchObject({ stage: "available", version: "1.0.5", notes: "Release notes" });
    await Promise.all([api.downloadUpdate(), api.downloadUpdate()]);
    expect(download).toHaveBeenCalledTimes(1);
    expect(install).not.toHaveBeenCalled();
    expect(api.getUpdateState()).toMatchObject({ stage: "ready", progress: 100 });
    await api.restartAndUpdate();
    expect(api.getUpdateState().stage).toBe("ready");
    expect(api.getUpdateState().error).toContain("retry");
    await api.restartAndUpdate();
    expect(install).toHaveBeenLastCalledWith({ restartAfterInstall: true });
  });
  it("does not offer restart after signature/download failure", async () => {
    const install = vi.fn();
    mocks.check.mockResolvedValue({ version: "1.0.5", download: vi.fn().mockRejectedValue("signature verification failed"), install });
    const api = await import("./updater");
    await api.checkForUpdates();
    await api.downloadUpdate();
    await api.restartAndUpdate();
    expect(api.getUpdateState().stage).toBe("error");
    expect(install).not.toHaveBeenCalled();
  });
});

it("retains notes for the target version and shows them only after that version actually starts", async () => {
  vi.resetModules();vi.stubGlobal("navigator", { userAgent: "Windows" });vi.stubEnv("DEV", false);
  const values = new Map<string, string>([["lumaire:last-installed-version", "1.0.4"]]);
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  mocks.getVersion.mockResolvedValue("1.0.4");
  mocks.check.mockResolvedValue({ version: "1.0.5", body: "New lyrics and autoplay", download: vi.fn().mockResolvedValue(undefined), install: vi.fn().mockResolvedValue(undefined) });
  let api = await import("./updater");await api.initializeUpdates();
  expect(api.getUpdateState().unreadNotes).toBe(false);
  await api.checkForUpdates();await api.downloadUpdate();await api.restartAndUpdate();
  expect(JSON.parse(values.get("lumaire:pending-release-notes")!).notes).toBe("New lyrics and autoplay");
  vi.resetModules();api=await import("./updater");await api.initializeUpdates();
  expect(api.getUpdateState().unreadNotes).toBe(false);
  expect(values.has("lumaire:pending-release-notes")).toBe(true);
  mocks.getVersion.mockResolvedValue("1.0.5");vi.resetModules();api=await import("./updater");await api.initializeUpdates();
  expect(api.getUpdateState()).toMatchObject({ unreadNotes: true, installedRelease: { version: "1.0.5", notes: "New lyrics and autoplay" } });
  expect(values.has("lumaire:pending-release-notes")).toBe(false);
  api.dismissReleaseNotes();expect(api.getUpdateState().unreadNotes).toBe(false);
  vi.resetModules();api=await import("./updater");await api.initializeUpdates();
  expect(api.getUpdateState()).toMatchObject({ unreadNotes:false, installedRelease:{version:"1.0.5"} });
  vi.unstubAllGlobals();vi.unstubAllEnvs();
});
it("shows bundled notes after a manual APK upgrade and rejects malformed saved notes", async () => {
  vi.resetModules();vi.stubGlobal("navigator", { userAgent: "Android" });vi.stubEnv("DEV", false);
  const values = new Map<string,string>([["lumaire:last-installed-version","1.0.3"],["lumaire:pending-release-notes",JSON.stringify({ version:"1.0.4", notes: { html: "invalid" } })]]);
  vi.stubGlobal("localStorage",{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});
  mocks.getVersion.mockResolvedValue("1.0.4");const api=await import("./updater");await api.initializeUpdates();
  expect(api.getUpdateState()).toMatchObject({unreadNotes:true,installedRelease:{version:"1.0.4"}});
  expect(typeof api.getUpdateState().installedRelease?.notes).toBe("string");
  expect(api.supportsAndroidUpdates()).toBe(true);expect(api.supportsWindowsUpdates()).toBe(false);
  vi.unstubAllGlobals();vi.unstubAllEnvs();
});
