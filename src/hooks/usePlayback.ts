import { useEffect, useRef, useState } from "react";
import { library, mobile } from "../adapters/native";
import { autoplayCandidates, resolveAutoplayCandidate, autoplayTitle } from '../domain/autoplay';
import {
  advance,
  advanceAfterFailure,
  enqueue,
  playCollection,
  playbackQueue,
  playSelection,
  isQueuedCatalog,
  resolveQueueEntry,
} from "../domain/queue";
import { type QueueItem, type Session, type Track } from "../domain/types";
import type { Playback } from "../player/controller";
import { player, playbackTracks } from "../player/service";
import { playbackEvent } from "../player/diagnostics";

export interface UsePlaybackOptions {
  resolveQueuedTrack: (track: Track) => Promise<Track>;
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
  resolveQueuedTrack,
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
  const [autoplayLoading, setAutoplayLoading] = useState(false);
  const autoplayRequest = useRef(0);
  const autoplayPending = useRef(false);
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
    } else if (sessionRef.current.settings.autoplay) {
      void continueAutoplay();
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

  useEffect(() => {
    autoplayRequest.current++;
    autoplayPending.current = false;
    setAutoplayLoading(false);
    return () => { autoplayRequest.current++; autoplayPending.current = false; };
  }, [session.settings.autoplay, session.currentId]);

  useEffect(() => {
    if (session.settings.autoplay && playback.status === 'ended' && !advance(sessionRef.current, 1, true)) void continueAutoplay();
  }, [session.settings.autoplay, playback.status, session.currentId]);

  async function continueAutoplay() {
    if (autoplayPending.current || !sessionRef.current.settings.autoplay) return;
    const initial = sessionRef.current;
    const current = initial.queue.find(entry => entry.id === initial.currentId);
    const seed = current && (tracksRef.current.find(track => track.id === current.trackId) || initial.queueTracks[current.trackId]);
    if (!current || !seed?.artist || /unknown artist/i.test(seed.artist)) return;
    const request = ++autoplayRequest.current;
    const playbackId = player.state.playbackId;
    const active = () => request === autoplayRequest.current && sessionRef.current.settings.autoplay
      && sessionRef.current.currentId === current.id && player.state.playbackId === playbackId
      && !advance(sessionRef.current, 1);
    autoplayPending.current = true;
    setAutoplayLoading(true);
    player.pause();
    try {
      let seedId = seed.metadataSourceId || seed.id;
      if (!/^(?:saavn:|itunes:)/.test(seedId)) {
        const matches = await library.searchCatalog(seed.title.slice(0, 200), 10);
        if (!active()) return;
        const match = matches.find(track => autoplayTitle(track.title).toLocaleLowerCase() === autoplayTitle(seed.title).toLocaleLowerCase()
          && track.artist.split(/,| & /).some(artist => seed.artist.toLocaleLowerCase().includes(artist.trim().toLocaleLowerCase())));
        if (!match) { notify('Autoplay could not identify this song. Choose another song to continue.'); return; }
        seedId = match.id;
      }
      const candidates = await library.recommendCatalog(seedId);
      if (!active()) return;
      const live = sessionRef.current;
      const known = live.queue.map(entry => tracksRef.current.find(track => track.id === entry.trackId) || live.queueTracks[entry.trackId]).filter((track): track is Track => !!track);
      const track = await resolveAutoplayCandidate(autoplayCandidates(candidates, seed, known), resolveQueuedTrack, active);
      if (!active()) return;
      if (!track) { notify('No playable songs found in this radio. Try Next again.'); return; }
      playbackTracks.set(track.id, track);
      const next = enqueue({ ...sessionRef.current, queueTracks: { ...sessionRef.current.queueTracks, [track.id]: track } }, track.id);
      const selected = next.queue.find(entry => entry.id === advance(next, 1));
      if (selected) {
        update(() => ({ ...next, currentId: selected.id, position: 0, queue: next.queue.map(entry => entry.id === selected.id ? { ...entry, requested: false } : entry) }));
        void player.load(track.id, true);
      }
    } catch { if (active()) notify('Autoplay could not reach the catalog. Try Next again to retry.'); }
    finally {
      if (request === autoplayRequest.current) {
        autoplayPending.current = false;
        setAutoplayLoading(false);
      }
    }
  }

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
    autoplayRequest.current++;
    setAutoplayLoading(false);
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
    void loadQueuedTrack(selected, autoplay);
    if (onSetFollow) onSetFollow(true);
  }

  async function loadQueuedTrack(entry: QueueItem, autoplay: boolean, selected?: Track) {
    const track = selected || tracksRef.current.find(t => t.id === entry.trackId) || sessionRef.current.queueTracks[entry.trackId];
    if (!track || !isQueuedCatalog(track)) { void player.load(entry.trackId, autoplay); return; }
    const token = player.beginLoading(track.id, autoplay);
    try {
      const resolved = await resolveQueuedTrack(track);
      if (player.state.playbackId !== token) return;
      if (isQueuedCatalog(resolved)) throw Error("The catalog entry did not resolve to playable audio. Retry later.");
      playbackTracks.set(resolved.id, resolved);
      update(s => resolveQueueEntry(s, entry.id, track.id, resolved));
      void player.load(resolved.id, autoplay);
    } catch (error) {
      player.failLoading(token, error instanceof Error ? error.message : String(error), autoplay);
    }
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

  function playCollectionTrack(collectionTracks: Track[], startIndex: number, shuffle = sessionRef.current.settings.shuffle) {
    if (player.state.status === "loading" && player.state.autoplay && player.state.trackId === collectionTracks[startIndex]?.id && sessionRef.current.settings.shuffle === shuffle) return;
    setUndo(null);
    const next = playCollection(
      { ...sessionRef.current, settings: { ...sessionRef.current.settings, shuffle } },
      collectionTracks,
      startIndex,
    );
    if (!next.currentId || !collectionTracks[startIndex] || collectionTracks[startIndex].missing) return;
    update(() => next);
    collectionTracks.forEach(track => playbackTracks.set(track.id, track));
    void loadQueuedTrack(next.queue.find(entry => entry.id === next.currentId)!, true, collectionTracks[startIndex]);
    if (onSetFollow) onSetFollow(true);
  }

  function togglePlay() {
    if (autoplayPending.current || player.state.status === "loading") return;
    if (currentTrack && isQueuedCatalog(currentTrack) && sessionRef.current.currentId) { selectQueue(sessionRef.current.currentId, true); return; }
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
    else if (sessionRef.current.settings.autoplay) void continueAutoplay();
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
    autoplayLoading,
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
