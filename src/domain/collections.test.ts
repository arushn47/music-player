import { describe, expect, it } from "vitest";
import { libraryCollections, withoutTrack } from "./collections";
import { defaults, item, type Track } from "./types";
import { parseLyrics } from "./lyrics";
import { romanizeDocument } from "./romanization";

const local: Track = {
  id: "a",
  title: "Local",
  artist: "Artist",
  album: "",
  duration: 36,
  fileName: "audio.wav",
  format: "WAV",
  missing: false,
};
const remote: Track = {
  ...local,
  id: "youtube:abcdefghijk",
  source: {
    providerId: "youtube",
    sourceId: "abcdefghijk",
    pageUrl: "",
    license: "",
    licenseUrl: "",
    attribution: "",
  },
};
describe("persistent collection membership and removal", () => {
  it("shows local and downloaded collections without duplicating saved online playlists", () => {
    const downloaded = { ...remote, id: "wikimedia-commons:42", offline: true };
    const playlist = {
      id: "mine",
      name: "My favorites",
      items: [item(local.id), item(remote.id)],
    };
    const collections = libraryCollections(
      [local, remote, downloaded],
      [playlist],
    );
    expect(collections.map((collection) => collection.name)).toEqual([
      "Local",
      "Downloads",
      "My favorites",
    ]);
    expect(collections[0].tracks).toEqual([local]);
    expect(collections[1].tracks).toEqual([downloaded]);
    expect(collections[2].playlist).toBe(playlist);
    expect(collections[2].tracks).toEqual([local, remote]);
    expect(remote.source).toBeDefined();
  });
  it("removes every reference and advances a removed current item without deleting another song", () => {
    const queue = [item("a"), item("a"), item("b")];
    const session = {
      ...defaults(),
      queue,
      currentId: queue[0].id,
      position: 12,
      favorites: ["a", "b"],
      history: [{ trackId: "a", at: "today" }],
      playlists: [{ id: "mine", name: "Keep this", items: [...queue] }],
      lyrics: { a: parseLyrics("text") },
    };
    const cleaned = withoutTrack(session, "a");
    expect(cleaned.queue).toEqual([queue[2]]);
    expect(cleaned.currentId).toBe(queue[2].id);
    expect(cleaned.position).toBe(0);
    expect(cleaned.favorites).toEqual(["b"]);
    expect(cleaned.playlists[0].items).toEqual([queue[2]]);
    expect(cleaned.lyrics).toEqual({});
    expect(cleaned.history).toEqual([]);
    expect(session.queue).toHaveLength(3);
  });
});
describe("local romanization", () => {
  it("preserves line identity and supplied variants while generating mixed-script text offline", async () => {
    const doc = parseLyrics(
      "[00:01]வணக்கம்\n[00:02]नमस्ते friend\n[00:03]Hello\n[00:04]愛",
    );
    const ids = doc.lines.map((line) => line.id);
    doc.romanisation[ids[0]] = "Supplied Tamil pronunciation";
    const generated = await romanizeDocument(doc);
    expect(generated[ids[0]]).toBeUndefined();
    expect(generated[ids[1]]).toContain("friend");
    expect(generated[ids[1]]).not.toMatch(/[\u0900-\u097f]/);
    expect(generated[ids[2]]).toBeUndefined();
    expect(generated[ids[3]]).toBe("ài");
    expect(doc.lines.map((line) => line.id)).toEqual(ids);
    const tamil = await romanizeDocument(parseLyrics("வணக்கம்"));
    expect(Object.values(tamil)[0]).not.toMatch(/[\u0b80-\u0bff]/);
  });
});
