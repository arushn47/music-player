import { describe, expect, it } from "vitest";
import { defaults, type Track } from "./types";
import {
  advance,
  advanceAfterFailure,
  enqueue,
  playCollection,
  playbackQueue,
  setShuffle,
  isQueuedCatalog,
  resolveQueueEntry,
  resolveUpcomingCatalog,
} from "./queue";
import { catalogQueueTrack } from "./catalog-track";
import { restoreSession } from "./session";

const tracks: Track[] = ["a", "b", "a", "c"].map((id) => ({
  id,
  title: id,
  artist: "Artist",
  album: "Album",
  duration: 100,
  fileName: id,
  missing: false,
  format: "WAV",
}));
describe("collection playback sequence", () => {
  it("resolves upcoming requests without changing playback, shuffle order, or a selected unresolved occurrence", () => {
    const pending = catalogQueueTrack({ id: "itunes:42", title: "Song", artist: "Artist", artists: [], album: "Album", duration: 100 });
    let session = playCollection(defaults(), [pending, pending, tracks[0]], 0);
    session = setShuffle(session, true, () => 0);
    session = enqueue(session, pending.id, true);
    const source = { ...pending, id: "youtube:abcdefghijk", format: "YouTube", source: { providerId: "youtube", sourceId: "abcdefghijk", pageUrl: "https://www.youtube.com/watch?v=abcdefghijk", license: "", licenseUrl: "", attribution: "Artist" } };
    const resolved = resolveUpcomingCatalog(session, pending.id, source);
    expect(resolved.currentId).toBe(session.currentId);
    expect(resolved.position).toBe(session.position);
    expect(resolved.shuffleOrder).toEqual(session.shuffleOrder);
    expect(resolved.queue.map(entry => entry.id)).toEqual(session.queue.map(entry => entry.id));
    expect(resolved.queue.find(entry => entry.id === session.currentId)?.trackId).toBe(pending.id);
    expect(resolved.queue.filter(entry => entry.trackId === source.id)).toHaveLength(2);
    expect(resolved.queueTracks[pending.id]).toEqual(pending);
    expect(restoreSession(resolved, tracks).queue).toEqual(resolved.queue);
    const removed = { ...session, queue: session.queue.filter(entry => entry.trackId !== pending.id) };
    expect(resolveUpcomingCatalog(removed, pending.id, source)).toBe(removed);
    expect(resolveUpcomingCatalog(session, pending.id, { ...source, metadataSourceId: "itunes:999" })).toBe(session);
    expect(resolveUpcomingCatalog(session, pending.id, { ...source, missing: true })).toBe(session);
  });
  it("keeps an entire unresolved album across restore and source resolution without changing occurrence order", () => {
    const album = [1, 2, 3].map(id => catalogQueueTrack({ id: `itunes:${id}`, title: `Song ${id}`, artist: "Artist", artists: [], album: "Album", duration: 100 }));
    const session = playCollection(defaults(), album, 0);
    const restored = restoreSession(session, []);
    expect(restored.queue.map(entry => entry.trackId)).toEqual(album.map(track => track.id));
    expect(Object.keys(restored.queueTracks)).toHaveLength(3);
    const source = { ...album[0], id: "youtube:abcdefghijk", format: "YouTube", source: { providerId: "youtube", sourceId: "abcdefghijk", pageUrl: "https://www.youtube.com/watch?v=abcdefghijk", license: "", licenseUrl: "", attribution: "Artist" } };
    const resolved = resolveQueueEntry(restored, restored.currentId!, album[0].id, source);
    expect(resolved.queue.map(entry => entry.id)).toEqual(restored.queue.map(entry => entry.id));
    expect(resolved.queue.map(entry => entry.trackId)).toEqual([source.id, album[1].id, album[2].id]);
    expect(advance(resolved, 1, true)).toBe(resolved.queue[1].id);
    expect(restoreSession(resolved, []).queue).toEqual(resolved.queue);
    expect(resolveQueueEntry({ ...restored, currentId: restored.queue[1].id }, restored.currentId!, album[0].id, source).queue).toBe(restored.queue);
    expect(isQueuedCatalog({ ...album[0], id: "../../local.wav" })).toBe(false);
  });
  it("restores valid favorite artists and supports older sessions", () => {
    const artist = { id: "saavn:artist:42", name: "Artist", artworkUrl: "https://example.com/artist.jpg" };
    const session = restoreSession({ ...defaults(), favoriteArtists: [artist, artist, { ...artist, id: "https://evil.test" }, { ...artist, id: "itunes:7", artworkUrl: "javascript:alert(1)" }] }, []);
    expect(session.favoriteArtists).toEqual([artist, { id: "itunes:7", name: "Artist", artworkUrl: null }]);
    expect(restoreSession({}, []).favoriteArtists).toEqual([]);
  });
  it("retains multiple favorite artist identities through repeated save/load normalization", () => {
    const artists = [
      { id: "saavn:artist:42", name: "Artist", artworkUrl: null },
      { id: "saavn:artist:name:Darshana%20Rajendran", name: "Darshana Rajendran", artworkUrl: null },
      { id: "itunes:7", name: "Another artist", artworkUrl: null },
    ];
    const saved = restoreSession({ ...defaults(), favoriteArtists: artists }, []);
    expect(restoreSession(JSON.parse(JSON.stringify(saved)), []).favoriteArtists).toEqual(artists);
  });
  it("round-trips favorite album metadata and rejects untrusted IDs without disturbing old sessions", () => {
    const album = { id: "saavn:album:42", title: "Album", artist: "Artist", artworkUrl: "https://c.saavncdn.com/cover.jpg" };
    const restored = restoreSession({ ...defaults(), favoriteAlbums: [album, album, { ...album, id: "https://evil.test" }] }, []);
    expect(restored.favoriteAlbums).toHaveLength(1);
    expect(restored.favoriteAlbums[0].id).toBe(album.id);
    expect(restoreSession({}, []).favoriteAlbums).toEqual([]);
  });
  it("skips failed occurrences without repeat-one loops and stops when every item failed", () => {
    const s = playCollection(defaults(), tracks, 0);
    s.settings.repeat = "one";
    const failed = new Set([s.currentId!, s.queue[1].id]);
    expect(advanceAfterFailure(s, failed)).toBe(s.queue[2].id);
    s.settings.repeat = "all";
    expect(advanceAfterFailure(s, new Set(s.queue.map(entry => entry.id)))).toBeNull();
  });
  it("shuffles every queue occurrence once, retains selected occurrence, stops, and goes back in the same sequence", () => {
    let s = playCollection(
      { ...defaults(), settings: { ...defaults().settings, shuffle: true } },
      tracks,
      2,
      () => 0,
    );
    const sequence = playbackQueue(s);
    expect(sequence[0].trackId).toBe("a");
    expect(sequence[0].id).toBe(s.queue[2].id);
    expect(new Set(sequence.map((entry) => entry.id)).size).toBe(4);
    for (let i = 1; i < sequence.length; i++) {
      expect(advance(s, 1, true)).toBe(sequence[i].id);
      s = { ...s, currentId: sequence[i].id };
      expect(advance(s, -1)).toBe(sequence[i - 1].id);
    }
    expect(advance(s, 1, true)).toBeNull();
    expect(playbackQueue(restoreSession(s, tracks))).toEqual(sequence);
    s.settings.repeat = "all";
    expect(advance(s, 1, true)).toBe(sequence[0].id);
  });
  it("repeats one on natural end while a manual skip advances, including a one-song queue", () => {
    const s = playCollection(defaults(), tracks, 0);
    s.settings.repeat = "one";
    expect(advance(s, 1, true)).toBe(s.currentId);
    expect(advance(s, 1)).toBe(s.queue[1].id);
    const single = playCollection(s, tracks.slice(0, 1), 0);
    expect(advance(single, 1, true)).toBe(single.currentId);
    expect(advance(single, 1)).toBeNull();
  });
  it("preserves Play next and request order, keeps the current song on toggle, and restores collection order", () => {
    let s = setShuffle(playCollection(defaults(), tracks, 0), true, () => 0);
    const current = s.currentId;
    s = enqueue(s, "request");
    s = enqueue(s, "next", true);
    expect(
      playbackQueue(s)
        .slice(0, 3)
        .map((entry) => entry.trackId),
    ).toEqual(["a", "next", "request"]);
    expect(advance(s, 1)).toBe(playbackQueue(s)[1].id);
    const restored = setShuffle(s, false);
    expect(restored.currentId).toBe(current);
    expect(
      restored.queue
        .filter((entry) => !entry.requested)
        .map((entry) => entry.trackId),
    ).toEqual(["a", "b", "a", "c"]);
  });
});
