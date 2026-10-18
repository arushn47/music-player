import { afterEach, describe, expect, it, vi } from "vitest";
const bridge = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true, convertFileSrc: (s: string) => s, invoke: bridge.invoke }));
afterEach(() => { vi.resetModules(); vi.unstubAllGlobals(); bridge.invoke.mockReset(); });
describe("platform-specific online resolution", () => {
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
});
