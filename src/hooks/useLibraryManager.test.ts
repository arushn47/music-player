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
import { catalogQueueTrack } from '../domain/catalog-track';
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
  it('captures all favorite types through the shared update path', () => {
    let manager = render();
    manager.setTracks([catalogQueueTrack(catalog)]);
    manager.setSession({ ...manager.session, replica: { deviceId: 'local', clock: 3, cells: {}, favoritesInitialized: true } });
    render().favorite(catalog.id);
    manager = render();
    expect(manager.session.replica!.cells[JSON.stringify(['fav-track', catalog.id])].value).toMatchObject({ id: catalog.id });
    manager.update(s => ({ ...s, favoriteArtists: [{ id: 'itunes:12', name: 'Artist' }], favoriteAlbums: [{ id: 'itunes:34', title: 'Album', artist: 'Artist' }] }));
    manager = render();
    expect(Object.keys(manager.session.replica!.cells)).toHaveLength(3);
    manager.update(s => ({ ...s, favorites: [], favoriteArtists: [], favoriteAlbums: [], playlists: [{ id: 'mix', name: 'Mix', items: [] }] }));
    manager = render();
    expect(manager.session.replica!.cells[JSON.stringify(['name','mix'])].value).toBe('Mix');
    for (const cell of Object.values(manager.session.replica!.cells).filter(c=>c.key.startsWith('["fav-'))) expect(cell.value).toBe(false);
  });
  it("keeps errors while a notification is shown and expires that notification after four seconds", () => {
    render().setError('An existing error');
    render().notify('Saved to library');
    expect(render().error).toBe('An existing error');
    expect(render().message).toBe('Saved to library');
    const [expire, delay] = vi.mocked(window.setTimeout).mock.calls.at(-1)!;
    expect(delay).toBe(4000);
    (expire as () => void)();
    expect(render().message).toBe('');
  });
  it("favorites a streamed queue song without locking playback, then supports unliking", async () => {
    const streamed: Track = { ...current, id: 'youtube:streamed', title: 'Streamed song', format: 'YouTube', source: { providerId: 'youtube', sourceId: 'streamed', pageUrl: 'https://www.youtube.com/watch?v=streamed', license: '', licenseUrl: '', attribution: 'Artist' } };
    let manager = render();
    manager.setSession({ ...manager.session, queueTracks: { [streamed.id]: streamed } });
    bridge.saveOnline.mockResolvedValue(streamed);
    render().favorite(streamed.id);
    await settle(); manager = render();
    expect(bridge.saveOnline).toHaveBeenCalledWith(streamed);
    expect(manager.session.favorites).toContain(streamed.id);
    expect(manager.busy).toBe(false);
    manager.favorite(streamed.id);
    expect(render().session.favorites).not.toContain(streamed.id);
    expect(bridge.player.pause).not.toHaveBeenCalled();
    expect(bridge.player.load).not.toHaveBeenCalled();
  });
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

  it("supports notification actions with extended expiry and records last playlist in localStorage", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    const onClick = vi.fn();
    const manager = render();
    manager.notify("Added to Telugu", { label: "Change", onClick });
    expect(render().message).toBe("Added to Telugu");
    expect(render().messageAction).toEqual({ label: "Change", onClick });
    const [expire, delay] = vi.mocked(window.setTimeout).mock.calls.at(-1)!;
    expect(delay).toBe(6000);
    (expire as () => void)();
    expect(render().message).toBe("");
    expect(render().messageAction).toBeNull();

    // Adding track to playlist
    render().update(s => ({ ...s, playlists: [{ id: "p1", name: "Telugu", items: [] }] }));
    await render().addOnlineToPlaylist(current, "p1", undefined, { action: { label: "Change", onClick } });
    await settle();
    expect(storage.get("lumaire:last-playlist-id")).toBe("p1");
    expect(render().message).toBe("Added to Telugu");
    expect(render().messageAction?.label).toBe("Change");
  });
});
