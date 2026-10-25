import { beforeEach, describe, expect, it, vi } from "vitest";
const bridge = vi.hoisted(() => ({ resolve: null as null | ((id: string, retry?: boolean) => Promise<string>), library: { media: vi.fn(), resolveCommons: vi.fn(), lookupCatalog: vi.fn(), ytdlpGetStream: vi.fn(), ytdlpSearch: vi.fn() } }));
vi.mock("../adapters/native", () => ({ library: bridge.library, mobile: false }));
vi.mock("./controller", () => ({ PlaybackController: class { constructor(resolve: (id: string, retry?: boolean) => Promise<string>) { bridge.resolve = resolve; } } }));
const song = { id: "itunes:42", title: "Evening Sky", artist: "Artist", artists: [], album: "Album", duration: 210 };
const candidate = { id: "abcdefghijk", title: "Artist - Evening Sky", duration: 210, channel: "Artist", thumbnail: null };
const stream = { streamUrl: "https://rr1.googlevideo.com/audio?expiring=secret", duration: 210, track: "Evening Sky", artist: "Artist" };
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

describe("audio provider dispatch and source recovery", () => {
  it("keeps local, offline and Commons sources on their own resolvers", async () => {
    const { offlineTracks } = await import("./service");
    bridge.library.media.mockResolvedValue("asset:local");
    bridge.library.resolveCommons.mockResolvedValue({ url: "https://upload.wikimedia.org/audio.ogg" });
    expect(await bridge.resolve!("local-id")).toBe("asset:local");
    expect(await bridge.resolve!("wikimedia-commons:42")).toContain("wikimedia.org");
    expect(bridge.library.resolveCommons).toHaveBeenCalledWith("42");
    offlineTracks.add("youtube:abcdefghijk");
    expect(await bridge.resolve!("youtube:abcdefghijk")).toBe("asset:local");
    expect(bridge.library.ytdlpGetStream).not.toHaveBeenCalled();
  });
  it("uses a short-lived preflight stream without persisting the URL or resolving twice", async () => {
    const { prepareCatalogCandidate } = await import("./service");
    bridge.library.ytdlpGetStream.mockResolvedValue(stream);
    await prepareCatalogCandidate(candidate);
    expect(await bridge.resolve!("youtube:abcdefghijk")).toBe(stream.streamUrl);
    expect(bridge.library.ytdlpGetStream).toHaveBeenCalledTimes(1);
  });
  it("falls through failed candidates and excludes previously used sources on engine retry", async () => {
    const { playbackTracks } = await import("./service");
    playbackTracks.set("youtube:abcdefghijk", { id: "youtube:abcdefghijk", title: song.title, artist: song.artist, album: song.album, duration: 210, fileName: "Song", format: "YouTube", missing: false, metadataSourceId: song.id });
    bridge.library.lookupCatalog.mockResolvedValue(song);
    const second = { ...candidate, id: "lmnopqrstuv" }, third = { ...candidate, id: "01234567890" };
    bridge.library.ytdlpSearch.mockResolvedValue([candidate, second, third]);
    bridge.library.ytdlpGetStream.mockImplementation(async (id: string) => { if (id === candidate.id) throw Error("Private"); return { ...stream, streamUrl: `https://rr1.googlevideo.com/${id}` }; });
    expect(await bridge.resolve!("youtube:abcdefghijk")).toContain(second.id);
    expect(await bridge.resolve!("youtube:abcdefghijk", true)).toContain(third.id);
    expect(bridge.library.lookupCatalog).toHaveBeenCalledWith("itunes:42");
    expect(bridge.library.ytdlpGetStream.mock.calls.map(([id]) => id)).toEqual([candidate.id, second.id, third.id]);
  });
});


it("shares concurrent source preparation and reuses a recent stream on replay", async () => {
  const { prepareCatalogCandidate } = await import("./service");
  bridge.library.ytdlpGetStream.mockResolvedValue(stream);
  await Promise.all([prepareCatalogCandidate(candidate), prepareCatalogCandidate(candidate)]);
  await bridge.resolve!("youtube:abcdefghijk");
  await bridge.resolve!("youtube:abcdefghijk");
  expect(bridge.library.ytdlpGetStream).toHaveBeenCalledTimes(1);
});
