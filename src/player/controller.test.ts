import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackController } from "./controller";
class FakeAudio extends EventTarget {
  src = "";
  preload = "";
  currentTime = 0;
  duration = 36;
  volume = 1;
  paused = true;
  ended = false;
  error: null | { code: number } = null;
  onloadedmetadata: (() => void) | null = null;
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  play() {
    this.paused = false;
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  }
  removeAttribute() {
    this.src = "";
  }
  load() {}
  loaded() {
    this.onloadedmetadata?.();
  }
}
beforeEach(() => vi.stubGlobal("Audio", FakeAudio));
afterEach(() => vi.unstubAllGlobals());
describe("single-owner playback lifecycle", () => {
  it("discards a late native resolution after a rapid track switch", async () => {
    let resolveFirst!: (s: string) => void;
    const controller = new PlaybackController((id) =>
      id === "first"
        ? new Promise((r) => {
            resolveFirst = r;
          })
        : Promise.resolve("asset:second"),
    );
    const first = controller.load("first", true),
      second = controller.load("second", false, 8);
    await second;
    const audio = controller.audio as unknown as FakeAudio;
    audio.loaded();
    expect(audio.src).toBe("asset:second");
    expect(audio.currentTime).toBe(8);
    expect(audio.paused).toBe(true);
    resolveFirst("asset:first");
    await first;
    expect(audio.src).toBe("asset:second");
    expect(controller.state.status).toBe("paused");
  });
  it("handles ended once and permits it again after an explicit seek", async () => {
    const controller = new PlaybackController(async () => "asset:one");
    await controller.load("one");
    const audio = controller.audio as unknown as FakeAudio;
    audio.loaded();
    const ended = vi.fn();
    controller.onEnded = ended;
    audio.dispatchEvent(new Event("ended"));
    audio.dispatchEvent(new Event("ended"));
    expect(ended).toHaveBeenCalledTimes(1);
    controller.seek(0);
    audio.dispatchEvent(new Event("ended"));
    expect(ended).toHaveBeenCalledTimes(2);
  });
  it("exposes missing-file errors without another source and cancels in-flight resolution on stop", async () => {
    const controller = new PlaybackController(async () => {
      throw Error("File missing");
    });
    await controller.load("missing");
    expect(controller.state.status).toBe("error");
    expect(controller.state.error).toContain("File missing");
    controller.stop();
    expect(controller.state.status).toBe("idle");
    expect(controller.audio.src).toBe("");
  });
});
