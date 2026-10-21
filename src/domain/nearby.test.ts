import { expect, it } from "vitest";
import { defaults } from "./types";
import { mergeSharedPlaylists, portableTrack, type SharedPlaylist } from "./nearby";
import { catalogQueueTrack } from "./catalog-track";
import { playSelection, resolveQueueEntry } from "./queue";
it("syncs idempotently and preserves local edits as a conflict copy", () => {
  const track = catalogQueueTrack({ id: "itunes:1", title: "Song", artist: "Artist", album: "", duration: 100, artists: [] });
  const shared: SharedPlaylist[] = [{ id: "device:playlist", name: "Mix", tracks: [track, track] }];
  const first = mergeSharedPlaylists(defaults(), shared);
  expect(first.session.playlists[0].items).toHaveLength(2);
  expect(mergeSharedPlaylists(first.session, shared).added).toBe(0);
  first.session.playlists[0].name = "My edit";
  const conflict = mergeSharedPlaylists(first.session, [{ ...shared[0], name: "New host name" }]);
  expect(conflict.conflicts).toBe(1); expect(conflict.session.playlists.map(p => p.name)).toEqual(["My edit", "New host name (device copy)"]);
  const updated = [{ ...shared[0], name: "New host name" }];
  expect(mergeSharedPlaylists(conflict.session, updated).added).toBe(0);
  const refresh = mergeSharedPlaylists(conflict.session, [{ ...updated[0], name: "Latest name" }]);
  expect(refresh.conflicts).toBe(0); expect(refresh.session.playlists).toHaveLength(2);
  expect(portableTrack({ ...track, id: "local", metadataSourceId: null, format: "MP3" })).toBeNull();
  expect(portableTrack({ ...track, fileName: "secret", offline: true })?.fileName).toBe("");
});
it("retains a guest's remote metadata when resolving the same source identity", () => {
  const track = { id: "youtube:fixture0001", title: "Synthetic", artist: "Lumaire", album: "", fileName: "", format: "YouTube", missing: false, duration: 36, source: { providerId: "youtube", sourceId: "fixture0001", pageUrl: "https://www.youtube.com/watch?v=fixture0001", license: "", licenseUrl: "", attribution: "Lumaire" } };
  const selected = playSelection(defaults(), track, false);
  expect(resolveQueueEntry(selected, selected.currentId!, track.id, track).queueTracks[track.id]).toEqual(track);
});
