import { describe, expect, it } from "vitest";
import { parsePlaylist, certainMatch, playlistSource, mergePlaylistImport } from "./playlist-import";
import { defaults, item, type Track } from "./types";
import { restoreSession } from "./session";
import type { CatalogTrack } from "../adapters/native";
describe("playlist import", () => {
  const song = (id: string): Track => ({ id, metadataSourceId: id, title: id, artist: "Artist", album: "Album", duration: 60, format: "catalog", fileName: "", missing: false });
  it("retains source identity after persistence and ignores invalid imported identity fields", () => {
    const session = defaults();
    session.playlists = [{ id: "saved", name: "Local title", importSources: ["youtube:PLabcdefghij"], items: [item("itunes:1")] }];
    const restored = restoreSession(JSON.parse(JSON.stringify(session)), [song("itunes:1")]);
    expect(mergePlaylistImport(restored.playlists, "Remote title", [song("itunes:1")], [song("itunes:1")], { source: "youtube:PLabcdefghij" }).playlists).toHaveLength(1);
    expect(restoreSession({ ...session, playlists: [{ ...session.playlists[0], importSources: "invalid" }] }, [song("itunes:1")]).playlists[0].importSources).toBeUndefined();
  });
  it("recognizes the same source despite tracking, locale, host, or display name differences", () => {
    expect(playlistSource("https://music.youtube.com/playlist?list=PLabcdefghij&si=tracking")).toBe(playlistSource("https://www.youtube.com/watch?v=abcdefghijk&list=PLabcdefghij"));
    expect(playlistSource("https://open.spotify.com/intl-en/playlist/1234567890123456789012?si=tracking")).toBe("spotify:1234567890123456789012");
    expect(playlistSource("https://music.apple.com/in/playlist/old-title/pl.abc-123")).toBe(playlistSource("https://music.apple.com/us/playlist/new-title/pl.abc-123"));
    expect(playlistSource("https://evil.test/playlist?list=PLabcdefghij")).toBeUndefined();
  });
  it("updates the same source without losing local names, items or adding repeated songs", () => {
    const oldItem = item("youtube:abcdefghijk");
    const saved = [{ ...song("youtube:abcdefghijk"), metadataSourceId: "itunes:1" }, song("itunes:2")];
    const old = { id: "mine", name: "My edited name", importSources: ["youtube:PLabcdefghij"], items: [oldItem, item("itunes:2")] };
    const result = mergePlaylistImport([old], "Remote name", [song("itunes:1"), song("itunes:3"), song("itunes:3")], saved, { source: "youtube:PLabcdefghij" });
    expect(result.playlists).toHaveLength(1);
    expect(result.playlist.name).toBe(old.name);
    expect(result.playlist.items[0]).toBe(oldItem);
    expect(result.playlist.items.map(entry => entry.trackId)).toEqual(["youtube:abcdefghijk", "itunes:2", "itunes:3"]);
    expect(result.added).toBe(1);
    expect(mergePlaylistImport(result.playlists, "Remote name", [song("itunes:3")], saved, { source: "youtube:PLabcdefghij" }).added).toBe(0);
  });
  it("requires a choice for same-name playlists and can merge existing duplicates or keep separate", () => {
    const first = { id: "a", name: "Malayalam", items: [item("itunes:1")] };
    const second = { id: "b", name: " malayalam ", items: [item("itunes:1"), item("itunes:2")] };
    expect(() => mergePlaylistImport([first, second], "Malayalam", [song("itunes:1")], [], {})).toThrow("Choose");
    const merged = mergePlaylistImport([first, second], "Malayalam", [song("itunes:3")], [], { source: "spotify:123", duplicate: "merge" });
    expect(merged.playlists).toHaveLength(1);
    expect(merged.playlist.items.map(entry => entry.trackId)).toEqual(["itunes:1", "itunes:2", "itunes:3"]);
    expect(merged.playlist.importSources).toEqual(["spotify:123"]);
    expect(mergePlaylistImport([first, second], "Malayalam", [song("itunes:3")], [], { duplicate: "separate" }).playlists).toHaveLength(3);
  });
  it("reads quoted Spotify-style CSV and Apple TSV without losing order or repeats", () => {
    expect(parsePlaylist('Track Name,Artist Name(s),Album Name,Duration (ms)\r\n"One, two",Artist,Album,120000\r\n"One, two",Artist,Album,120000')).toEqual(Array(2).fill({ title: "One, two", artist: "Artist", album: "Album", duration: 120 }));
    expect(parsePlaylist('Name\tArtist\tAlbum\tTotal Time\nSong\tSinger\tRelease\t150000')[0].duration).toBe(150);
  });
  it("reads EXTINF metadata without trusting local file paths", () => {
    expect(parsePlaylist('#EXTM3U\n#EXTINF:123,Artist - Song\nC:\\secret.mp3')[0]).toEqual({ title: "Song", artist: "Artist", album: "", duration: 123 });
    expect(() => parsePlaylist('title\n"unfinished')).toThrow("quote");
    expect(() => parsePlaylist('x'.repeat(1000001))).toThrow("1 MB");
  });
  it("leaves ambiguous or different-title catalog results for explicit review", () => {
    const row = { title: "என் பாடல்", artist: "Singer", album: "", duration: 120 };
    const candidate: CatalogTrack = { ...row, id: "itunes:1", artists: [] };
    expect(certainMatch(row, [candidate])).toBe(candidate);
    expect(certainMatch(row, [candidate, { ...candidate, id: "itunes:2" }])).toBeNull();
    expect(certainMatch(row, [{ ...candidate, title: "Different song" }])).toBeNull();
    expect(certainMatch({ ...row, artist: "Another Singer" }, [candidate])).toBeNull();
  });
});
