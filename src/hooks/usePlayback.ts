import { useEffect, useRef, useState } from "react";
import { mobile } from "../adapters/native";
import { advance, enqueue, playSelection } from "../domain/queue";
import { item, type Session, type Track } from "../domain/types";
import type { Playback } from "../player/controller";
import { player } from "../player/service";

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
}: UsePlaybackOptions) {
  const [playback, setPlayback] = useState<Playback>(player.state);
  const [undo, setUndo] = useState<Session["queue"] | null>(null);
  const autoOpenedLyrics = useRef<string | null>(null);

  // Subscribe to playback changes
  useEffect(() => {
    return player.subscribe(setPlayback);
  }, []);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target instanceof HTMLElement &&
          (e.target.matches("input,textarea,select,button") ||
            e.target.isContentEditable)) ||
        dialogOpen
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.altKey && e.code === "ArrowRight") {
        e.preventDefault();
        skip(1);
      }
      if (e.altKey && e.code === "ArrowLeft") {
        e.preventDefault();
        skip(-1);
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
    const valid = collectionTracks.filter((t) => !t.missing);
    const startTrack = collectionTracks[startIndex];
    if (!startTrack || startTrack.missing) return;
    const startIndexInValid = valid.findIndex((t) => t.id === startTrack.id);
    const queue = valid.map((t) => item(t.id));
    const currentItem = queue[startIndexInValid >= 0 ? startIndexInValid : 0];
    update((s) => ({
      ...s,
      queue,
      currentId: currentItem.id,
      position: 0,
      queueTracks: {
        ...s.queueTracks,
        ...Object.fromEntries(valid.map((t) => [t.id, t])),
      },
    }));
    void player.load(currentItem.trackId, true);
    if (onSetFollow) onSetFollow(true);
  }

  function togglePlay() {
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
    const queue = s.queue.filter((i) => i.id !== id);
    if (id === s.currentId) {
      const index = s.queue.findIndex((i) => i.id === id);
      const next = queue[Math.min(index, queue.length - 1)];
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
