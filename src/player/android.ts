import { invoke } from "@tauri-apps/api/core";
import type { Playback } from "./controller";

/** Poll the service's real media clock; never estimate elapsed playback time. */
export class AndroidPlaybackController {
  state: Playback = { status: "idle", time: 0, duration: 0, error: null };
  onEnded: () => void = () => {};
  private listeners = new Set<(state: Playback) => void>();
  private generation = 0;
  private ended = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private preciseClock = false;
  private failedLoad = false;

  constructor() {
    document.addEventListener("visibilitychange", () => {
      this.schedule();
      if (!document.hidden) void this.poll();
    });
  }
  private update(state: Playback) {
    const wasEnded = this.ended;
    this.state = state;
    this.ended = state.status === "ended";
    this.listeners.forEach((fn) => fn(state));
    if (this.ended && !wasEnded) this.onEnded();
  }
  private schedule() {
    if (this.timer) clearInterval(this.timer);
    this.timer =
      !document.hidden && this.listeners.size
        ? setInterval(() => void this.poll(), this.preciseClock ? 100 : 500)
        : null;
  }
  private async poll() {
    if (this.polling || this.state.status === "loading" || this.failedLoad) return;
    this.polling = true;
    const generation = this.generation;
    try {
      const state = await invoke<Playback>("android_playback", {
        action: "state",
      });
      if (generation === this.generation) this.update(state);
    } catch {
      /* A transient service reconnect must not erase the queue. */
    } finally {
      this.polling = false;
    }
  }
  private async command(action: string, args: Record<string, unknown> = {}) {
    const generation = this.generation;
    try {
      const state = await invoke<Playback>("android_playback", {
        action,
        ...args,
      });
      if (generation === this.generation) this.update(state);
    } catch (error) {
      if (generation === this.generation) {
        if (action === "load") this.failedLoad = true;
        this.update({ ...this.state, status: "error", error: String(error) });
      }
    }
  }
  subscribe(fn: (state: Playback) => void) {
    this.listeners.add(fn);
    fn(this.state);
    this.schedule();
    return () => {
      this.listeners.delete(fn);
      this.schedule();
    };
  }
  precise(enabled: boolean) {
    this.preciseClock = enabled;
    this.schedule();
  }
  async load(id: string, autoplay = false, position = 0) {
    const generation = ++this.generation;
    this.failedLoad = false;
    this.ended = false;
    this.update({
      status: "loading",
      time: position,
      duration: 0,
      error: null,
    });
    if (!autoplay) {
      try {
        const active = await invoke<Playback & { id?: string }>(
          "android_playback",
          { action: "state" },
        );
        if (generation !== this.generation) return;
        if (active.id === id && active.status === "playing") {
          this.update(active);
          return;
        }
      } catch {
        /* First launch creates the service when loading below. */
      }
    }
    if (generation !== this.generation) return;
    await this.command("load", { id, autoplay, position });
  }
  play() {
    return this.command("play");
  }
  pause() {
    void this.command("pause");
  }
  seek(value: number) {
    if (Number.isFinite(value)) {
      this.ended = false;
      void this.command("seek", { value: Math.max(0, value) });
    }
  }
  volume(value: number) {
    if (Number.isFinite(value))
      void this.command("volume", { value: Math.max(0, Math.min(1, value)) });
  }
  stop() {
    ++this.generation;
    this.failedLoad = false;
    void this.command("stop");
  }
}
