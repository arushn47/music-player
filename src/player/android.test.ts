import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { AndroidPlaybackController } from "./android";
import type { Playback } from "./controller";
import { ListeningTracker, type ListeningRecord } from "../domain/listening";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const playing: Playback = {
  status: "playing",
  time: 6,
  duration: 40,
  error: null,
};
let page: EventTarget & { hidden: boolean };
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(invoke).mockReset();
  page = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal("document", page);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Android native playback ownership", () => {
  it("retains playback identity across native clock updates so real listening is recorded", async () => {
    const track = { id: "youtube:abcdefghijk", title: "A song", artist: "Artist", album: "Album", duration: 40, fileName: "song", format: "webm", missing: false };
    vi.mocked(invoke).mockResolvedValue({ ...playing, id: track.id, time: 0 });
    const player = new AndroidPlaybackController();
    const rows: ListeningRecord[] = [];
    const tracker = new ListeningTracker(row => rows.push(row));
    const unsubscribe = player.subscribe(state => tracker.sample(state, track, true, state.time * 1000, 1700000000000 + state.time * 1000));
    await player.load(track.id, true);
    const id = player.state.playbackId;
    expect(id).toBeTruthy();
    for (let seconds = 1; seconds <= 12; seconds++) {
      vi.mocked(invoke).mockResolvedValue({ ...playing, id: track.id, time: seconds });
      await vi.advanceTimersByTimeAsync(500);
      expect(player.state.playbackId).toBe(id);
    }
    tracker.flush();
    expect(rows.at(-1)?.listenedMs).toBe(12000);
    player.seek(30);
    await vi.advanceTimersByTimeAsync(0);
    expect(player.state.seekVersion).toBe(1);
    expect(player.state.playbackId).toBe(id);
    await player.load("another", true);
    expect(player.state.playbackId).not.toBe(id);
    unsubscribe();
  });
  it("shows pending catalog identity, stops old audio and keeps unavailable collection entries skippable", async () => {
    vi.mocked(invoke).mockResolvedValue(playing);
    const player = new AndroidPlaybackController();
    const token = player.beginLoading("itunes:42", true);
    expect(player.state).toMatchObject({ trackId: "itunes:42", status: "loading", autoplay: true });
    expect(invoke).toHaveBeenCalledWith("android_playback", { action: "stop" });
    player.failLoading(token, "Unavailable", true);
    expect(player.state).toMatchObject({ status: "error", trackId: "itunes:42", autoplay: true });
    const next = player.beginLoading("itunes:43", true);
    player.failLoading(token, "Old failure", true);
    expect(player.state.playbackId).toBe(next);
    expect(player.state.status).toBe("loading");
  });
  it("forwards canonical display credits only for the selected load", async () => {
    vi.mocked(invoke).mockResolvedValue(playing);
    const metadata = vi.fn((id: string) =>
      id === "youtube:___________"
        ? { title: "Sensitive", artist: "KR$NA, Seedhe Maut" }
        : undefined,
    );
    const player = new AndroidPlaybackController(metadata);
    await player.load("youtube:___________", true, 12);
    expect(metadata).toHaveBeenCalledWith("youtube:___________");
    expect(invoke).toHaveBeenLastCalledWith("android_playback", {
      action: "load",
      id: "youtube:___________",
      autoplay: true,
      position: 12,
      displayMetadata: { title: "Sensitive", artist: "KR$NA, Seedhe Maut" },
    });
    await player.load("another-source", true);
    expect(invoke).toHaveBeenLastCalledWith("android_playback", {
      action: "load", id: "another-source", autoplay: true, position: 0,
    });
  });

  it("keeps the default constructor compatible and displays native validation errors", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("Invalid playback display metadata.");
    const player = new AndroidPlaybackController();
    await player.load("local-one", true);
    expect(invoke).toHaveBeenLastCalledWith("android_playback", {
      action: "load", id: "local-one", autoplay: true, position: 0,
    });
    expect(player.state.status).toBe("error");
    expect(player.state.error).toBe("Invalid playback display metadata.");
  });

  it("keeps a failed online lookup visible while the old native track is still playing", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Source unavailable"));
    const player = new AndroidPlaybackController();
    const unsubscribe = player.subscribe(() => {});
    await player.load("youtube:___________", true);
    vi.mocked(invoke).mockResolvedValue(playing);
    await vi.advanceTimersByTimeAsync(1500);
    expect(player.state.status).toBe("error");
    expect(player.state.error).toContain("Source unavailable");
    await player.load("local-one", true);
    expect(player.state.status).toBe("playing");
    unsubscribe();
  });
  it("restores an already playing service without pausing or reloading its audio", async () => {
    vi.mocked(invoke).mockResolvedValue({
      ...playing,
      id: "local-one",
      time: 17,
    });
    const player = new AndroidPlaybackController();
    await player.load("local-one", false, 2);
    expect(player.state.time).toBe(17);
    expect(player.state.status).toBe("playing");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("android_playback", {
      action: "state",
    });
  });

  it("discards an obsolete native command result after a new selection", async () => {
    let finish!: (value: Playback) => void;
    vi.mocked(invoke)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve as typeof finish;
          }),
      )
      .mockResolvedValue({ ...playing, time: 0 });
    const player = new AndroidPlaybackController();
    const first = player.load("first", true);
    await player.load("second", true);
    finish({ status: "error", time: 99, duration: 0, error: "obsolete" });
    await first;
    expect(player.state.status).toBe("playing");
    expect(player.state.time).toBe(0);
  });

  it("uses native positions after backgrounding and advances once for an ended track", async () => {
    vi.mocked(invoke).mockResolvedValue(playing);
    const player = new AndroidPlaybackController();
    const ended = vi.fn();
    player.onEnded = ended;
    const unsubscribe = player.subscribe(() => {});
    await player.load("local-one", true);
    page.hidden = true;
    page.dispatchEvent(new Event("visibilitychange"));
    const calls = vi.mocked(invoke).mock.calls.length;
    await vi.advanceTimersByTimeAsync(8000);
    expect(invoke).toHaveBeenCalledTimes(calls);
    vi.mocked(invoke).mockResolvedValue({ ...playing, time: 23 });
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(player.state.time).toBe(23);
    vi.mocked(invoke).mockResolvedValue({
      ...playing,
      status: "ended",
      time: 40,
    });
    await vi.advanceTimersByTimeAsync(1500);
    expect(ended).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("handles widget next and previous pending actions from native playback state", async () => {
    vi.mocked(invoke).mockResolvedValue({
      ...playing,
      pendingAction: "next",
    });
    const player = new AndroidPlaybackController();
    const next = vi.fn();
    const prev = vi.fn();
    player.onNext = next;
    player.onPrevious = prev;
    const unsubscribe = player.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(600);
    expect(next).toHaveBeenCalledTimes(1);
    expect(prev).not.toHaveBeenCalled();

    vi.mocked(invoke).mockResolvedValue({
      ...playing,
      pendingAction: "prev",
    });
    await vi.advanceTimersByTimeAsync(600);
    expect(prev).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("forwards artworkUrl and syncs lyrics to native widgets", async () => {
    vi.mocked(invoke).mockResolvedValue(playing);
    const metadata = vi.fn((id: string) =>
      id === "local-art"
        ? { title: "Art Song", artist: "Artist", artworkUrl: "https://example.com/art.jpg" }
        : undefined,
    );
    const player = new AndroidPlaybackController(metadata);
    await player.load("local-art", true);
    expect(invoke).toHaveBeenLastCalledWith("android_playback", {
      action: "load",
      id: "local-art",
      autoplay: true,
      position: 0,
      displayMetadata: {
        title: "Art Song",
        artist: "Artist",
        artwork_url: "https://example.com/art.jpg",
      },
    });

    player.setLyrics("local-art", [
      { time: 1000, text: "Line 1" },
      { time: 5000, text: "Line 2" },
    ]);
    expect(invoke).toHaveBeenLastCalledWith("android_set_lyrics", {
      trackId: "local-art",
      lines: [
        { time: 1000, text: "Line 1" },
        { time: 5000, text: "Line 2" },
      ],
    });
  });
});

