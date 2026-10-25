import React, { useEffect, useRef } from "react";
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  sampleAudioFrequencies,
  suspendAudioAnalysis,
} from "../../player/audio-analyser";

export interface AudioWaveformProps {
  isPlaying: boolean;
  className?: string;
  bars?: number;
}

export function AudioWaveform({
  isPlaying,
  className = "",
  bars = 24,
}: AudioWaveformProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    let disposed = false;
    let intersecting = true;
    let windowVisible = true;
    let stop = () => {};
    const levels = new Float32Array(bars);
    const paint = (samples: ArrayLike<number>, divisor = 1) => {
      if (disposed) return;
      let path = "";
      for (let index = 0; index < bars; index++) {
        const value =
          (samples[
            Math.min(
              samples.length - 1,
              Math.floor((index * samples.length) / bars),
            )
          ] || 0) / divisor;
        levels[index] = Math.max(Math.min(1, value), levels[index] * 0.72);
        const half = 1 + levels[index] * 10;
        path += `M${index * 10 + 5} ${(12 - half).toFixed(2)}V${(12 + half).toFixed(2)} `;
      }
      pathRef.current?.setAttribute("d", path);
    };
    const sync = () => {
      stop();
      levels.fill(0);
      paint([]);
      if (!isPlaying || document.hidden || !intersecting || !windowVisible) {
        if (rootRef.current) rootRef.current.dataset.mode = "suspended";
        suspendAudioAnalysis();
        return;
      }
      let active = true;
      if (isTauri() && /Windows/i.test(navigator.userAgent)) {
        const channel = new Channel<number[]>();
        channel.onmessage = (samples) => {
          if (!active || disposed) return;
          if (
            !Array.isArray(samples) ||
            samples.length !== 24 ||
            !samples.every(Number.isFinite)
          )
            return;
          if (rootRef.current) rootRef.current.dataset.mode = "native";
          paint(samples);
        };
        // Read-only native process loopback; no microphone, media URL, playback or volume changes.
        void invoke("start_audio_analysis", { onFrame: channel }).catch(
          (error) => {
            if (active) {
              if (rootRef.current) rootRef.current.dataset.mode = "unavailable";
              console.warn("Audio waveform unavailable:", error);
            }
          },
        );
        stop = () => {
          active = false;
          void invoke("stop_audio_analysis").catch(() => {});
        };
        return;
      }

      const frequencies = new Uint8Array(32);
      let last = 0;
      const tick = (time: number) => {
        if (!active) return;
        if (time - last >= 1000 / 30) {
          last = time;
          const state = sampleAudioFrequencies(frequencies);
          if (rootRef.current)
            rootRef.current.dataset.mode =
              state === "unavailable" ? "unavailable" : "audio";
          paint(state === "signal" ? frequencies : [], 255);
        }
        frame = requestAnimationFrame(tick);
      };
      let frame = requestAnimationFrame(tick);
      stop = () => {
        active = false;
        cancelAnimationFrame(frame);
        suspendAudioAnalysis();
      };
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            const visible = entries[0]?.isIntersecting ?? false;
            if (visible !== intersecting) {
              intersecting = visible;
              sync();
            }
          });
    if (rootRef.current) observer?.observe(rootRef.current);
    document.addEventListener("visibilitychange", sync);
    let unsubscribe = Promise.resolve<(() => void)[]>([]);
    if (isTauri() && /Windows/i.test(navigator.userAgent)) {
      const window = getCurrentWindow();
      const check = () => {
        void Promise.all([window.isMinimized(), window.isVisible()])
          .then(([minimized, visible]) => {
            if (disposed) return;
            const next = visible && !minimized;
            if (next !== windowVisible) {
              windowVisible = next;
              sync();
            }
          })
          .catch(() => {});
      };
      unsubscribe = Promise.all([
        window.onFocusChanged(check),
        window.onResized(check),
      ]);
      check();
    }
    sync();
    return () => {
      disposed = true;
      stop();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      void unsubscribe
        .then((listeners) => listeners.forEach((unlisten) => unlisten()))
        .catch(() => {});
    };
  }, [isPlaying, bars]);

  return (
    <div
      ref={rootRef}
      className={`audio-waveform ${isPlaying ? "is-playing" : "is-paused"} ${className}`}
      data-mode="audio"
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${bars * 10} 24`}
        preserveAspectRatio="none"
        focusable="false"
      >
        <path
          ref={pathRef}
          className="waveform-path"
          d={Array.from(
            { length: bars },
            (_, index) => `M${index * 10 + 5} 11V13`,
          ).join(" ")}
        />
      </svg>
    </div>
  );
}
