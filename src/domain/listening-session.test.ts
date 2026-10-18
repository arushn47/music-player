import { describe, expect, it } from "vitest";
import { defaults, item, type Track } from "./types";
import { advance, enqueue, playSelection, reorderUpcoming } from "./queue";
import { restoreSession } from "./session";
import { libraryCollections } from "./collections";

const remote: Track = {
  id: "youtube:abcdefghijk",
  title: "Temporary song",
  artist: "Artist",
  album: "",
  duration: 180,
  fileName: "Song",
  format: "YouTube",
  missing: false,
  source: {
    providerId: "youtube",
    sourceId: "abcdefghijk",
    pageUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    license: "",
    licenseUrl: "",
    attribution: "Artist",
  },
};

describe("saved library and listening session stay independent", () => {
  it("plays unsaved music without adding a collection, and restores its stable queue identity", () => {
    const playing = playSelection(defaults(), remote, false);
    const restored = restoreSession(JSON.parse(JSON.stringify(playing)), []);
    expect(restored.queue[0].trackId).toBe(remote.id);
    expect(restored.queueTracks[remote.id].title).toBe(remote.title);
    expect(libraryCollections([], restored.playlists)).toEqual([]);
  });
  it("replaces a directly selected song instead of accumulating listening history in Up next", () => {
    const previous = item("old"),
      requested = { ...item("requested"), requested: true },
      context = item("album");
    const next = playSelection(
      {
        ...defaults(),
        queue: [previous, requested, context],
        currentId: previous.id,
      },
      remote,
      false,
    );
    expect(next.queue.map((entry) => entry.trackId)).toEqual([
      remote.id,
      "requested",
    ]);
  });
  it("keeps intentional queue repeats and honors Play next, including shuffle", () => {
    let s = playSelection(defaults(), remote, false);
    s = enqueue(s, "second");
    s = enqueue(s, "second");
    s = enqueue(s, "immediate", true);
    expect(s.queue.map((entry) => entry.trackId)).toEqual([
      remote.id,
      "immediate",
      "second",
      "second",
    ]);
    s.settings.shuffle = true;
    expect(advance(s, 1, false, () => 0.99)).toBe(s.queue[1].id);
  });
  it("puts explicit requests ahead of collection continuation without changing the collection", () => {
    const current = item("current"),
      continuation = item("album-next");
    const s = enqueue(
      { ...defaults(), queue: [current, continuation], currentId: current.id },
      "request",
    );
    expect(s.queue.map((entry) => entry.trackId)).toEqual([
      "current",
      "request",
      "album-next",
    ]);
    const reordered = reorderUpcoming(s, s.queue[1].id, 1);
    reordered.settings.shuffle = true;
    expect(advance(reordered, 1, false, () => 0.99)).toBe(continuation.id);
    expect(reorderUpcoming(s, s.currentId!, 1)).toBe(s);
  });
  it("discards expired temporary metadata and prevents unsaved playlist/favorite membership", () => {
    const s = playSelection(defaults(), remote, false);
    s.queueTracks.expired = { ...remote, id: "expired" };
    s.favorites = [remote.id];
    s.playlists = [{ id: "p", name: "Playlist", items: [item(remote.id)] }];
    const restored = restoreSession(s, []);
    expect(Object.keys(restored.queueTracks)).toEqual([remote.id]);
    expect(restored.favorites).toEqual([]);
    expect(restored.playlists[0].items).toEqual([]);
  });
  it("promotes an explicitly saved track without duplicate metadata or changing queue order", () => {
    const s = playSelection(defaults(), remote, false);
    const restored = restoreSession(s, [remote]);
    expect(restored.queue).toEqual(s.queue);
    expect(restored.queueTracks).toEqual({});
    expect(libraryCollections([remote], [])[0].name).toBe("Saved online");
  });
  it("rejects transient local paths, invalid identities and offline claims", () => {
    const s = playSelection(defaults(), { ...remote, offline: true }, false);
    s.queueTracks[remote.id] = {
      ...remote,
      source: { ...remote.source!, sourceId: "../../bad" },
    };
    expect(restoreSession(s, []).queue).toEqual([]);
    const clean = restoreSession(
      playSelection(
        defaults(),
        { ...remote, offline: true, fileName: "C:/secret.mp3" },
        false,
      ),
      [],
    );
    expect(clean.queueTracks[remote.id].offline).toBeUndefined();
  });
});
