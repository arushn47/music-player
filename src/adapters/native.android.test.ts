import { afterEach, describe, expect, it, vi } from "vitest";
const bridge = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true, convertFileSrc: (s: string) => s, invoke: bridge.invoke }));
afterEach(() => { vi.resetModules(); vi.unstubAllGlobals(); bridge.invoke.mockReset(); });
describe("platform-specific online resolution", () => {
  it("shares successful artist identities and allows retry after failure", async () => {
    vi.stubGlobal("navigator", { userAgent: "Windows" });
    const { library } = await import("./native");
    bridge.invoke.mockResolvedValue({ info: { id: "itunes:42", name: "Artist" } });
    await Promise.all([library.lookupArtist("itunes:42"), library.lookupArtist("itunes:42")]);
    expect(bridge.invoke).toHaveBeenCalledTimes(1);
    bridge.invoke.mockRejectedValueOnce(Error("Offline"));
    await expect(library.lookupArtist("itunes:99")).rejects.toThrow("Offline");
    await library.lookupArtist("itunes:99");
    expect(bridge.invoke).toHaveBeenCalledTimes(3);
  });
  it("shares successful catalogue lookups and retries transport failures", async () => {
    vi.stubGlobal("navigator", { userAgent: "Windows" });
    const { library } = await import("./native");
    bridge.invoke.mockResolvedValue({ title: "Song", artist: "Artist", album: "Album" });
    await Promise.all([library.lookupMetadata("Song", "Artist", 180), library.lookupMetadata("Song", "Artist", 180)]);
    expect(bridge.invoke).toHaveBeenCalledTimes(1);
    bridge.invoke.mockRejectedValueOnce(Error("Offline"));
    await expect(library.lookupMetadata("Other", "Artist", 180)).rejects.toThrow("Offline");
    await library.lookupMetadata("Other", "Artist", 180);
    expect(bridge.invoke).toHaveBeenCalledTimes(3);
  });
  it("routes Android discovery to the bundled resolver", async () => {
    vi.stubGlobal("navigator", { userAgent: "Android" });
    bridge.invoke.mockResolvedValueOnce({ available: true }).mockResolvedValueOnce({ results: [{ id: "aqz-KE-bpKQ" }] });
    const { library } = await import("./native");
    expect(await library.ytdlpCheckAvailable()).toBe(true);
    expect(await library.ytdlpSearch("Blender", 10)).toEqual([{ id: "aqz-KE-bpKQ" }]);
    expect(bridge.invoke).toHaveBeenLastCalledWith("android_source", { operation: "search", query: "Blender", maxResults: 10 });
  });
  it("preserves the existing Windows commands", async () => {
    vi.stubGlobal("navigator", { userAgent: "Windows" });
    bridge.invoke.mockResolvedValue([]);
    const { library } = await import("./native");
    await library.ytdlpCheckAvailable(); await library.ytdlpSearch("test", 10); await library.ytdlpGetStream("aqz-KE-bpKQ");
    expect(bridge.invoke.mock.calls.map(c => c[0])).toEqual(["ytdlp_check_available", "ytdlp_search", "ytdlp_get_stream"]);
  });
  it("installs components only through the Windows native boundary", async () => {
    vi.stubGlobal("navigator", { userAgent: "Windows" });
    bridge.invoke.mockResolvedValue(undefined);
    const { library } = await import("./native");
    await library.ytdlpInstallEngine();
    expect(bridge.invoke).toHaveBeenCalledWith("install_youtube_engine");
  });
  it("never downloads Windows components on Android", async () => {
    vi.stubGlobal("navigator", { userAgent: "Android" });
    const { library } = await import("./native");
    await expect(library.ytdlpInstallEngine()).rejects.toThrow("already includes");
    expect(bridge.invoke).not.toHaveBeenCalled();
  });
});
