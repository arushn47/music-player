export type Playback = {
  status:
    "idle" | "loading" | "playing" | "paused" | "buffering" | "ended" | "error";
  time: number;
  duration: number;
  error: string | null;
};

type Resolver = (id: string) => Promise<string>;

export class PlaybackController {
  readonly audio = new Audio();
  private generation = 0;
  private endedHandled = false;
  private preciseClock = false;
  private frame: number | null = null;
  private listeners = new Set<(state: Playback) => void>();
  state: Playback = { status: "idle", time: 0, duration: 0, error: null };
  onEnded: () => void = () => {};
  constructor(private resolve: Resolver) {
    this.audio.preload = "metadata";
    this.audio.addEventListener("timeupdate", () =>
      this.update({ time: this.audio.currentTime }),
    );
    this.audio.addEventListener("durationchange", () =>
      this.update({
        duration: Number.isFinite(this.audio.duration)
          ? this.audio.duration
          : 0,
      }),
    );
    this.audio.addEventListener("playing", () => {
      this.update({ status: "playing", error: null });
      this.startClock();
    });
    this.audio.addEventListener("waiting", () => {
      if (!this.audio.paused) this.update({ status: "buffering" });
    });
    this.audio.addEventListener("pause", () => {
      this.stopClock();
      if (
        !this.audio.ended &&
        this.state.status !== "loading" &&
        this.state.status !== "error"
      )
        this.update({ status: "paused" });
    });
    this.audio.addEventListener("ended", () => {
      this.stopClock();
      if (this.endedHandled) return;
      this.endedHandled = true;
      this.update({ status: "ended", time: this.audio.duration });
      this.onEnded();
    });
    this.audio.addEventListener("error", () =>
      this.update({
        status: "error",
        error:
          this.audio.error?.code === 4
            ? "This audio format or file could not be played. Try MP3 or PCM WAV, or relink the file."
            : "Playback failed. The queue is saved; retry or choose another track.",
      }),
    );
  }
  // A visible lyric reader samples the actual media clock at <=50 ms intervals.
  // No elapsed-time accumulation; normal transport uses native timeupdate events.
  precise(enabled: boolean) {
    this.preciseClock = enabled;
    this.stopClock();
    if (enabled && !this.audio.paused) this.startClock();
  }
  private startClock() {
    if (
      !this.preciseClock ||
      typeof requestAnimationFrame === "undefined" ||
      this.frame !== null
    )
      return;
    let last = 0;
    const tick = (now: number) => {
      if (this.audio.paused || !this.preciseClock) {
        this.frame = null;
        return;
      }
      if (now - last >= 50) {
        last = now;
        this.update({ time: this.audio.currentTime });
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
  private stopClock() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
  subscribe(fn: (s: Playback) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private update(patch: Partial<Playback>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }
  async load(id: string, autoplay = false, position = 0) {
    const generation = ++this.generation;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.endedHandled = false;
    this.update({
      status: "loading",
      time: position,
      duration: 0,
      error: null,
    });
    try {
      const url = await this.resolve(id);
      if (generation !== this.generation) return;
      this.audio.src = url;
      this.audio.onloadedmetadata = () => {
        if (generation !== this.generation) return;
        this.audio.currentTime = Math.min(
          position,
          Number.isFinite(this.audio.duration) ? this.audio.duration : position,
        );
        this.update({ status: "paused", duration: this.audio.duration });
        if (autoplay) void this.play();
      };
      this.audio.load();
    } catch (e) {
      if (generation === this.generation)
        this.update({ status: "error", error: String(e) });
    }
  }
  async play() {
    const generation = this.generation;
    if (!this.audio.src) return;
    this.endedHandled = false;
    try {
      await this.audio.play();
    } catch (e) {
      if (
        generation === this.generation &&
        !(e instanceof DOMException && e.name === "AbortError")
      )
        this.update({
          status: "error",
          error:
            "Playback could not start. Press Play to retry or relink this file.",
        });
    }
  }
  pause() {
    this.audio.pause();
  }
  seek(time: number) {
    if (Number.isFinite(this.audio.duration)) {
      this.endedHandled = false;
      this.audio.currentTime = Math.min(this.audio.duration, Math.max(0, time));
      this.update({ time: this.audio.currentTime });
    }
  }
  volume(value: number) {
    this.audio.volume = Math.min(1, Math.max(0, value));
  }
  stop() {
    ++this.generation;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.update({ status: "idle", time: 0, duration: 0, error: null });
  }
}
