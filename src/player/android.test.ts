import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { AndroidPlaybackController } from "./android";
import type { Playback } from "./controller";

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
});
