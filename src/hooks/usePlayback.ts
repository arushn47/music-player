import { useEffect, useRef, useState } from "react";
import { mobile } from "../adapters/native";
import {
  advance,
  advanceAfterFailure,
  enqueue,
  playCollection,
  playbackQueue,
  playSelection,
} from "../domain/queue";
import { type Session, type Track } from "../domain/types";
import type { Playback } from "../player/controller";
import { player, playbackTracks } from "../player/service";
import { playbackEvent } from "../player/diagnostics";

export interface UsePlaybackOptions {
  session: Session;
  update: (fn: (s: Session) => Session) => void;
  sessionRef: React.MutableRefObject<Session>;
  tracksRef: React.MutableRefObject<Track[]>;
  tracks: Track[];
  currentTrack?: Track | null;
  view: string;
  setView: (v: string) => void;
  notify: (msg: string) => void;
  persist: () => void;
  dialogOpen: boolean;
  onSetFollow?: (follow: boolean) => void;
  onToggleQueue?: () => void;
  queueOpen?: boolean;
}

export function usePlayback({
  session,
  update,
  sessionRef,
  tracksRef,
  tracks,
  currentTrack,
  view,
  setView,
  notify,
  persist,
  dialogOpen,
  onSetFollow,
  onToggleQueue,
  queueOpen,
}: UsePlaybackOptions) {
  const [playback, setPlayback] = useState<Playback>(player.state);
  const [undo, setUndo] = useState<Session["queue"] | null>(null);
  const autoOpenedLyrics = useRef<string | null>(null);
  const failedQueueItems = useRef(new Set<string>());
  const lastVolumeRef = useRef<number>(session.settings.volume || 0.7);

  // Subscribe to playback changes
  useEffect(() => {
    return player.subscribe(setPlayback);
  }, []);

  useEffect(() => {
    if (playback.status === "playing") failedQueueItems.current.clear();
    if (playback.status !== "error" || !playback.autoplay) return;
    const current = sessionRef.current.queue.find(entry => entry.id === sessionRef.current.currentId);
    if (!current || current.trackId !== playback.trackId || failedQueueItems.current.has(current.id)) return;
    failedQueueItems.current.add(current.id);
    const next = advanceAfterFailure(sessionRef.current, failedQueueItems.current);
    if (next) {
      playbackEvent({ trackId: current.trackId, stage: "queue-skip", reason: "unavailable" });
      notify(`Skipped unavailable track. ${playback.error || "Retry it later."}`);
      selectQueue(next, true);
    }
  }, [playback.status, playback.trackId, playback.error]);

  // Update volume (on mobile, keep at 1.0; on desktop, follow settings)
  useEffect(() => {
    if (mobile) {
      player.volume(1);
    } else {
      player.volume(session.settings.volume);
    }
  }, [mobile, session.settings.volume]);

  // Adjust precision for lyrics room
  useEffect(() => {
    player.precise(view === "lyrics");
    return () => player.precise(false);
  }, [view]);

  // On ended callback
  useEffect(() => {
    player.onEnded = () => {
      const s = sessionRef.current;
      const next = advance(s, 1, true);
      if (next) {
        selectQueue(next, true);
      } else {
        persist();
      }
    };
  });

  // Keyboard shortcuts (Nuclear & desktop media controls)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = Boolean(
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable),
      );

      // In text inputs, allow Escape to blur the input without triggering playback shortcuts
      if (isInput) {
        if (e.key === "Escape") {
          target?.blur();
        }
        return;
      }

      if (dialogOpen) {
        return;
      }

      // Space: Toggle Play / Pause (blur any focused button so it doesn't trigger synthetic button clicks)
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (target && target.tagName === "BUTTON") {
          target.blur();
        }
        togglePlay();
        return;
      }

      // Next track: Ctrl+Right or Alt+Right
      if (
        (e.ctrlKey || e.altKey) &&
        (e.key === "ArrowRight" || e.code === "ArrowRight")
      ) {
        e.preventDefault();
        skip(1);
        return;
      }

      // Previous track: Ctrl+Left or Alt+Left
      if (
        (e.ctrlKey || e.altKey) &&
        (e.key === "ArrowLeft" || e.code === "ArrowLeft")
      ) {
        e.preventDefault();
        skip(-1);
        return;
      }

      // Seek forward (+5s): Right arrow (without Ctrl/Alt)
      if (
        !e.ctrlKey &&
        !e.altKey &&
        (e.key === "ArrowRight" || e.code === "ArrowRight")
      ) {
        e.preventDefault();
        const duration = playback.duration || 0;
        const newTime = Math.min(duration, (playback.time || 0) + 5);
        seek(newTime);
        return;
      }

      // Seek backward (-5s): Left arrow (without Ctrl/Alt)
      if (
        !e.ctrlKey &&
        !e.altKey &&
        (e.key === "ArrowLeft" || e.code === "ArrowLeft")
      ) {
        e.preventDefault();
        const newTime = Math.max(0, (playback.time || 0) - 5);
        seek(newTime);
        return;
      }

      // Volume up (+5%): Ctrl+Up or Up arrow
      if (
        (e.ctrlKey && (e.key === "ArrowUp" || e.code === "ArrowUp")) ||
        (!e.altKey &&
          !e.ctrlKey &&
          (e.key === "ArrowUp" || e.code === "ArrowUp"))
      ) {
        e.preventDefault();
        const currentVol = sessionRef.current.settings.volume;
        const nextVol = Math.min(
          1,
          Math.round((currentVol + 0.05) * 100) / 100,
        );
        update((s) => ({ ...s, settings: { ...s.settings, volume: nextVol } }));
        player.volume(nextVol);
        notify(`Volume: ${Math.round(nextVol * 100)}%`);
        return;
      }

      // Volume down (-5%): Ctrl+Down or Down arrow
      if (
        (e.ctrlKey && (e.key === "ArrowDown" || e.code === "ArrowDown")) ||
        (!e.altKey &&
          !e.ctrlKey &&
          (e.key === "ArrowDown" || e.code === "ArrowDown"))
      ) {
        e.preventDefault();
        const currentVol = sessionRef.current.settings.volume;
        const nextVol = Math.max(
          0,
          Math.round((currentVol - 0.05) * 100) / 100,
        );
        update((s) => ({ ...s, settings: { ...s.settings, volume: nextVol } }));
        player.volume(nextVol);
        notify(`Volume: ${Math.round(nextVol * 100)}%`);
        return;
      }

      // Mute / Unmute: Ctrl+M or M
      if (
        (e.ctrlKey && (e.key === "m" || e.key === "M")) ||
        (!e.ctrlKey && !e.altKey && (e.key === "m" || e.key === "M"))
      ) {
        e.preventDefault();
        const currentVol = sessionRef.current.settings.volume;
        if (currentVol > 0) {
          lastVolumeRef.current = currentVol;
          update((s) => ({ ...s, settings: { ...s.settings, volume: 0 } }));
          player.volume(0);
          notify("Muted");
        } else {
          const restore =
            lastVolumeRef.current > 0 ? lastVolumeRef.current : 0.7;
          update((s) => ({
            ...s,
            settings: { ...s.settings, volume: restore },
          }));
          player.volume(restore);
          notify(`Unmuted (${Math.round(restore * 100)}%)`);
        }
        return;
      }

      // Open / toggle Settings: Ctrl + Comma
      if ((e.ctrlKey || e.metaKey) && (e.key === "," || e.code === "Comma")) {
        e.preventDefault();
        setView(view === "settings" ? "library" : "settings");
        return;
      }

      // Toggle Queue: Ctrl + Q
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "q" || e.key === "Q" || e.code === "KeyQ")
      ) {
        e.preventDefault();
        onToggleQueue?.();
        return;
      }

      // Escape: close queue if open
      if (e.key === "Escape" && queueOpen) {
        e.preventDefault();
        onToggleQueue?.();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // Auto-open lyrics when playback starts
  useEffect(() => {
    const current = session.queue.find((i) => i.id === session.currentId);
    if (
      playback.status === "playing" &&
      current &&
      session.settings.autoOpenLyrics &&
      autoOpenedLyrics.current !== current.id
    ) {
      autoOpenedLyrics.current = current.id;
      setView("lyrics");
      if (onSetFollow) onSetFollow(true);
    }
  }, [playback.status, session.currentId, session.settings.autoOpenLyrics]);

  function selectQueue(id: string, autoplay: boolean) {
    const selected = sessionRef.current.queue.find((i) => i.id === id);
    if (!selected) return;
    update((s) => ({
      ...s,
      currentId: id,
      position: 0,
      queue: s.queue.map((entry) =>
        entry.id === id ? { ...entry, requested: false } : entry,
      ),
    }));
    void player.load(selected.trackId, autoplay);
    if (onSetFollow) onSetFollow(true);
  }

  function playTrack(t: Track) {
    if (player.state.trackId === t.id && player.state.status === "loading") return;
    playbackTracks.set(t.id, t);
    setUndo(null);
    update((s) =>
      playSelection(
        s,
        t,
        tracksRef.current.some((saved) => saved.id === t.id),
      ),
    );
    void player.load(t.id, true);
    if (onSetFollow) onSetFollow(true);
  }

  function playCollectionTrack(collectionTracks: Track[], startIndex: number) {
    setUndo(null);
    const next = playCollection(
      sessionRef.current,
      collectionTracks,
      startIndex,
    );
    if (next === sessionRef.current) return;
    update(() => next);
    void player.load(collectionTracks[startIndex].id, true);
    if (onSetFollow) onSetFollow(true);
  }

  function togglePlay() {
    if (player.state.status === "loading") return;
    if (!currentTrack) {
      const queued = sessionRef.current.queue[0];
      if (queued) {
        selectQueue(queued.id, true);
        return;
      }
      const first = tracks[0];
      if (first) playTrack(first);
      return;
    }
    if (playback.status === "playing" || playback.status === "buffering") {
      player.pause();
    } else if (playback.status === "error") {
      void player.load(currentTrack.id, true, playback.time);
    } else {
      void player.play();
    }
  }

  function skip(direction: 1 | -1) {
    if (direction === -1 && playback.time > 3) {
      player.seek(0);
      return;
    }
    const id = advance(sessionRef.current, direction);
    if (id) selectQueue(id, true);
    else if (direction === -1) player.seek(0);
  }

  function queueTrack(id: string, next = false) {
    update((s) => enqueue(s, id, next));
    notify(next ? "Added to play next" : "Added to queue");
  }

  function queueRemote(t: Track, next = false) {
    const saved = tracksRef.current.some((track) => track.id === t.id);
    update((s) =>
      enqueue(
        {
          ...s,
          queueTracks: saved ? s.queueTracks : { ...s.queueTracks, [t.id]: t },
        },
        t.id,
        next,
      ),
    );
    notify(next ? "Added to play next" : "Added to queue");
  }

  function removeQueue(id: string) {
    const s = sessionRef.current;
    setUndo(s.queue);
    const order = playbackQueue(s);
    const queue = s.queue.filter((i) => i.id !== id);
    if (id === s.currentId) {
      const index = order.findIndex((i) => i.id === id);
      const remaining = order.filter((entry) => entry.id !== id);
      const next = remaining[Math.min(index, remaining.length - 1)];
      update((x) => ({
        ...x,
        queue,
        currentId: next?.id ?? null,
        position: 0,
      }));
      if (next) void player.load(next.trackId, false);
      else player.stop();
    } else {
      update((x) => ({ ...x, queue }));
    }
  }

  function clearQueue() {
    setUndo(session.queue);
    update((s) => ({
      ...s,
      queue: s.queue.filter((entry) => entry.id === s.currentId),
    }));
  }

  function undoRemoval() {
    if (undo) {
      update((s) => ({ ...s, queue: undo }));
      setUndo(null);
    }
  }

  function seek(seconds: number) {
    player.seek(seconds);
    persist();
  }

  return {
    player,
    playback,
    undo,
    setUndo,
    selectQueue,
    playTrack,
    playCollectionTrack,
    togglePlay,
    skip,
    queueTrack,
    queueRemote,
    removeQueue,
    clearQueue,
    undoRemoval,
    seek,
  };
}
