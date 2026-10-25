import { expect, it } from "vitest";
import { ListeningTracker, type ListeningRecord } from "./listening";
import type { Playback } from "../player/controller";

const track = { id: "local-song", title: "Song", artist: "Artist", album: "Album", duration: 300, fileName: "song.mp3", format: "MP3", missing: false };
const state = (time: number, nativeListenedMs: number): Playback => ({ playbackId: "native-session", trackId: track.id, status: "playing", time, nativeListenedMs, duration: 300, error: null });

it("counts native service progress once across faster UI polls, background pauses and seeks", () => {
  const records: ListeningRecord[] = [];
  const tracker = new ListeningTracker(record => records.push(record));
  const sample = (time: number, played: number, mono: number) => tracker.sample(state(time, played), track, true, mono, 1700000000000 + mono);
  sample(0, 0, 0);
  sample(.5, 0, 500);
  sample(1, 1000, 1000);
  tracker.flush();
  expect(records.at(-1)?.listenedMs).toBe(1000);
  sample(140, 41000, 61000);
  tracker.flush();
  expect(records.at(-1)?.listenedMs).toBe(41000);
  sample(200, 41000, 62000);
  tracker.flush();
  expect(records.at(-1)?.listenedMs).toBe(41000);
  sample(200, 0, 63000);
  sample(201, 1000, 64000);
  tracker.flush();
  expect(records.at(-1)?.listenedMs).toBe(42000);
});

it("rejects invalid native counters instead of crediting a wall-clock or seek jump", () => {
  const tracker = new ListeningTracker(() => {});
  tracker.sample(state(0, 0), track, true, 0, 1700000000000);
  tracker.sample(state(180, 180000), track, true, 1000, 1700000001000);
  expect(tracker.record?.listenedMs).toBe(0);
});
