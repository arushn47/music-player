import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogTrack } from "../adapters/native";
import type { Track } from "../domain/types";

// Exercise the hook's action handlers with synchronous state; lifecycle I/O is outside these tests.
const state = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: () => {},
  useCallback: (callback: unknown) => callback,
  useRef: (initial: unknown) => {
    const slot = state.cursor++;
    if (!(slot in state.slots)) state.slots[slot] = { current: initial };
    return state.slots[slot];
  },
  useState: (initial: unknown) => {
    const slot = state.cursor++;
    if (!(slot in state.slots)) state.slots[slot] = typeof initial === "function" ? initial() : initial;
    return [state.slots[slot], (value: unknown) => {
      state.slots[slot] = typeof value === "function" ? value(state.slots[slot]) : value;
    }];
  },
}));
const bridge = vi.hoisted(() => ({
  resolve: vi.fn(), saveOnline: vi.fn(),
  player: { state: { trackId: "current", status: "playing", time: 60 }, load: vi.fn(), pause: vi.fn(), stop: vi.fn(), beginLoading: vi.fn() },
}));
vi.mock("../adapters/native", () => ({ library: { saveOnline: bridge.saveOnline }, desktop: false, mobile: false }));
vi.mock("../player/service", () => ({
  player: bridge.player, playbackTracks: new Map(), offlineTracks: new Set(), resolvedMusic: new Map(), musicResolved: new EventTarget(), prepareCatalogCandidate: vi.fn(),
}));
vi.mock("../domain/catalog-track", async importOriginal => ({
  ...await importOriginal<typeof import("../domain/catalog-track")>(), resolveCatalogSource: bridge.resolve,
}));
import { useLibraryManager } from "./useLibraryManager";
import { playCollection, playbackQueue } from "../domain/queue";
const catalog: CatalogTrack = { id: "itunes:42", title: "Pal Pal", artist: "Afusic, Talwiinder", artists: [], album: "Pal Pal", duration: 208 };
const current: Track = { id: "current", title: "Current", artist: "Artist", album: "Album", duration: 200, format: "WAV", fileName: "Current.wav", missing: false };
const candidate = { id: "abcdefghijk", title: catalog.title, channel: catalog.artist, duration: 208, thumbnail: null };
const render = () => { state.cursor = 0; return useLibraryManager(); };
const settle = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
beforeEach(() => {
  state.slots = []; state.cursor = 0; vi.clearAllMocks();
  vi.stubGlobal("window", { setTimeout: vi.fn(() => 1), clearTimeout: vi.fn() });
  const manager = render();
  manager.setSession(playCollection(manager.session, [current], 0));
});
afterEach(() => vi.unstubAllGlobals());

describe("instant catalog queue actions", () => {
  it("inserts next/queue requests before verification finishes, preserves click order and never locks or changes playback", async () => {
    let resolve!: (value: typeof candidate) => void;
    bridge.resolve.mockImplementation(() => new Promise(done => { resolve = done; }));
    const onPlay = vi.fn();
    await render().saveDiscovery(catalog, "queue", onPlay);
    const second = { ...catalog, id: "itunes:43", title: "Wishes" };
    await render().saveDiscovery(second, "next", onPlay);
    let manager = render();
    expect(manager.busy).toBe(false);
    expect(playbackQueue(manager.session).map(entry => entry.trackId)).toEqual([current.id, second.id, catalog.id]);
    expect(manager.message).toContain("Added to play next");
    // Complete the second request first: asynchronous results cannot reorder the queue.
    resolve(candidate);
    await settle(); manager = render();
    expect(playbackQueue(manager.session).map(entry => entry.trackId)).toEqual([current.id, "youtube:abcdefghijk", catalog.id]);
    expect(manager.session.currentId).toBe(manager.session.queue[0].id);
    expect(onPlay).not.toHaveBeenCalled();
    expect(bridge.player.load).not.toHaveBeenCalled();
    expect(bridge.player.pause).not.toHaveBeenCalled();
    expect(bridge.player.stop).not.toHaveBeenCalled();
    expect(bridge.player.beginLoading).not.toHaveBeenCalled();
    expect(bridge.saveOnline).not.toHaveBeenCalled();
  });

  it("keeps failed entries retryable without disabling the page or leaving an unhandled rejection", async () => {
    let reject!: (reason: Error) => void;
    bridge.resolve.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    await render().saveDiscovery(catalog, "queue", vi.fn());
    render(); reject(Error("Provider timed out"));
    await settle(); const manager = render();
    expect(manager.busy).toBe(false);
    expect(manager.session.queue.at(-1)?.trackId).toBe(catalog.id);
    expect(manager.message).toContain("Playback will retry");
    expect(manager.error).toBe("");
  });

  it("queues a downloaded copy without making source verification requests", async () => {
    const offline = { ...current, id: "youtube:abcdefghijk", metadataSourceId: catalog.id, offline: true };
    render().setTracks([offline]);
    await render().saveDiscovery(catalog, "next", vi.fn());
    expect(render().session.queue[1].trackId).toBe(offline.id);
    expect(bridge.resolve).not.toHaveBeenCalled();
  });

  it("ignores a late verification response after the queued song is removed", async () => {
    let resolve!: (value: typeof candidate) => void;
    bridge.resolve.mockImplementation(() => new Promise(done => { resolve = done; }));
    await render().saveDiscovery(catalog, "queue", vi.fn());
    render().update(session => ({ ...session, queue: session.queue.slice(0, 1) }));
    render(); resolve(candidate); await settle();
    expect(render().session.queue.map(entry => entry.trackId)).toEqual([current.id]);
  });
});
