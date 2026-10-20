import { describe, expect, it } from "vitest";
import { defaults, type Track } from "./types";
import {
  advance,
  advanceAfterFailure,
  enqueue,
  playCollection,
  playbackQueue,
  setShuffle,
} from "./queue";
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
