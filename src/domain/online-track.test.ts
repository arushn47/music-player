import { describe, expect, it } from "vitest";
import {
  needsMetadata,
  repairYoutubeTrack,
  youtubeTrack,
  metadataQueries,
} from "./online-track";

describe("online source metadata", () => {
  const result = {
    id: "abcdefghijk",
    title: "Sia - Snowman (Official Video)",
    channel: "Sia",
    duration: 173,
    thumbnail: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
  };
  it("keeps source duration, stable identity and artwork without inventing an album", () => {
    const track = youtubeTrack(result);
    expect(track.title).toBe("Snowman");
    expect(track.artist).toBe("Sia");
    expect(track.album).toBe("");
    expect(track.duration).toBe(173);
    expect(track.id).toBe("youtube:abcdefghijk");
    expect(track.artworkUrl).toBe(result.thumbnail);
    expect(JSON.stringify(track)).not.toContain("streamUrl");
  });
  it("removes Topic suffixes when title has no artist prefix", () => {
    expect(
      youtubeTrack({ ...result, title: "Snowman", channel: "Sia - Topic" })
        .artist,
    ).toBe("Sia");
  });
  it("never promotes an arbitrary uploader into a performer", () => {
    expect(
      youtubeTrack({ ...result, title: "Radhimaa", channel: "Nova" }).artist,
    ).toBe("Unknown artist");
    expect(
      youtubeTrack({
        ...result,
        title: "Radhimaa",
        artist: "Sai Abhyankkar",
        track: null,
        channel: "Nova",
      }).artist,
    ).toBe("Sai Abhyankkar");
  });
  it("cleans unbracketed presentation labels and pipe-separated movie/cast credits", () => {
    const track = youtubeTrack({
      ...result,
      title: "God Mode Lyric Video | Karuppu | Suriya | Sai Abhyankkar",
      channel: "Think Music India",
    });
    expect(track.title).toBe("God Mode");
    expect(track.artist).toBe("Unknown artist");
    expect(
      youtubeTrack({ ...result, title: "Radio Video", channel: "Band - Topic" })
        .title,
    ).toBe("Radio Video");
  });
  it("verifies both possible dash orders instead of requiring manual metadata correction", () => {
    const track = youtubeTrack({
      ...result,
      title: "Radhimaa – Sai Abhyankkar",
      channel: "Nova lyrics",
    });
    expect(metadataQueries(track)).toContainEqual({
      title: "Radhimaa",
      artist: "Sai Abhyankkar",
    });
    expect(metadataQueries(track)).toHaveLength(2);
  });
  it("uses structured music credits instead of the label channel and keeps video duration", () => {
    const track = youtubeTrack({
      ...result,
      title: "Karuppa Kooda Va - Lyric Video | Karuppu",
      channel: "Think Music India",
      track: "Karuppa Kooda Va",
      artist: "Sai Abhyankkar",
      album: "Karuppu",
      duration: 258,
    });
    expect(track.artist).toBe("Sai Abhyankkar");
    expect(track.album).toBe("Karuppu");
    expect(track.duration).toBe(258);
    expect(needsMetadata(track)).toBe(false);
    expect(needsMetadata({ ...track, artist: "Unknown artist" })).toBe(true);
  });
  it("does not swap a Tamil song title with a presentation label", () => {
    const track = youtubeTrack({
      ...result,
      title: "Karuppa Kooda Va - Lyric Video | Karuppu | Sai Abhyankkar",
      channel: "Think Music India",
    });
    expect(track.title).toBe("Karuppa Kooda Va");
    expect(track.artist).toBe("Unknown artist");
  });
  it("preserves a film song title instead of treating it as an artist", () => {
    expect(
      youtubeTrack({
        ...result,
        title: 'Karuppa Kooda Va - From "Karuppu"',
        channel: "Sai Abhyankkar - Topic",
      }).title,
    ).toBe("Karuppa Kooda Va");
  });
  it("repairs previously saved label inversions while preserving identity and metadata", () => {
    const old = {
      ...youtubeTrack(result),
      title: "Lyric Video",
      artist: "Karuppa Kooda Va",
      album: "Existing album",
      fileName: "Karuppa Kooda Va - Lyric Video | Karuppu",
    };
    const repaired = repairYoutubeTrack(old);
    expect(repaired.title).toBe("Karuppa Kooda Va");
    expect(repaired.id).toBe(old.id);
    expect(repaired.album).toBe(old.album);
    expect(repaired.source).toEqual(old.source);
    expect(repairYoutubeTrack(youtubeTrack(result))).toEqual(
      youtubeTrack(result),
    );
  });
});
