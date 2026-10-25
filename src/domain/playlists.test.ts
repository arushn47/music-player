import { expect, it } from "vitest";
import { stampPlaylistUpdates } from "./playlists";
import { restoreSession } from "./session";
import { defaults, type Playlist } from "./types";

const playlist: Playlist = { id: "one", name: "Mix", updatedAt: 10, items: [{ id: "entry", trackId: "song" }] };
it("timestamps creation, rename and membership/order edits without mutating inputs", () => {
  for (const next of [
    { ...playlist, id: "new" },
    { ...playlist, name: "Renamed" },
    { ...playlist, items: [] },
    { ...playlist, items: [...playlist.items, { id: "two", trackId: "another" }] },
    { ...playlist, items: [{ id: "entry", trackId: "another" }] },
  ]) expect(stampPlaylistUpdates([playlist], [next], 20)[0].updatedAt).toBe(20);
  const two = { ...playlist, items: [...playlist.items, { id: "two", trackId: "another" }] };
  expect(stampPlaylistUpdates([two], [{ ...two, items: [...two.items].reverse() }], 30)[0].updatedAt).toBe(30);
  expect(playlist.updatedAt).toBe(10);
});
it("keeps timestamps for no-op imports, sync metadata and unchanged playback playlists", () => {
  for (const next of [playlist, { ...playlist, items: [{ id: "rebuilt", trackId: "song" }], syncFingerprint: "new" }]) {
    expect(stampPlaylistUpdates([playlist], [next], 20)[0].updatedAt).toBe(10);
  }
});
it("restores timestamps while rejecting invalid backup values and supporting legacy playlists", () => {
  for (const value of [10, undefined, "recent", -1, Infinity, NaN]) {
    const restored = restoreSession({ ...defaults(), playlists: [{ ...playlist, items: [], updatedAt: value }] }, []);
    expect(restored.playlists[0].updatedAt).toBe(value === 10 ? 10 : undefined);
  }
});
