import { useEffect, useRef, useState } from "react";
import { flushListening } from "../player/listening-service";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  library,
  desktop,
  mobile,
  type YtdlpSearchResult,
} from "../adapters/native";
import { withoutTrack } from "../domain/collections";
import {
  metadataQueries,
  needsMetadata,
  repairYoutubeTrack,
  youtubeTrack,
} from "../domain/online-track";
import { enqueue } from "../domain/queue";
import { restoreSession } from "../domain/session";
import { defaults, item, type Session, type Track } from "../domain/types";
import {
  player,
  offlineTracks,
  resolvedMusic,
  musicResolved,
} from "../player/service";

const formatError = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

export function useLibraryManager() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [session, setSession] = useState<Session>(defaults);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [downloads, setDownloads] = useState<Record<string, string>>({});
  const [ytdlpAvailable, setYtdlpAvailable] = useState(false);

  const messageTimeoutRef = useRef<number | null>(null);
  const metadataInFlight = useRef(new Set<string>());
  const sessionRef = useRef(session);
  const tracksRef = useRef(tracks);
  const readyRef = useRef(false);
  const saveChain = useRef(Promise.resolve());
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suspendPersistence = useRef(false);

  sessionRef.current = session;
  tracksRef.current = tracks;

  offlineTracks.clear();
  tracks
    .filter((track) => track.offline)
    .forEach((track) => offlineTracks.add(track.id));

  const update = (fn: (s: Session) => Session) => setSession((s) => fn(s));

  const setting = <K extends keyof Session["settings"]>(
    key: K,
    value: Session["settings"][K],
  ) => update((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));

  const notify = (text: string) => {
    setMessage(text);
    setError("");
    if (messageTimeoutRef.current) {
      window.clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = window.setTimeout(() => {
      setMessage("");
      messageTimeoutRef.current = null;
    }, 3800);
  };

  const persist = () => {
    if (!readyRef.current || suspendPersistence.current) return;
    const s = restoreSession(
      { ...sessionRef.current, position: player.state.time },
      tracksRef.current,
    );
    saveChain.current = saveChain.current
      .then(() => library.save(s))
      .catch((e) =>
        setError(`Your latest changes could not be saved. ${formatError(e)}`),
      );
  };

  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  // Desktop window close requested handler
  useEffect(() => {
    if (!desktop || mobile) return;
    const unsubscribe = getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      if (!readyRef.current) {
        await getCurrentWindow().destroy();
        return;
      }
      player.pause();
      const latest = restoreSession(
        { ...sessionRef.current, position: player.state.time },
        tracksRef.current,
      );
      try {
        await flushListening();
        await saveChain.current;
        await library.save(latest);
        await getCurrentWindow().destroy();
      } catch (e) {
        setError(
          `Lumaire stayed open because your library could not be saved. ${formatError(e)}`,
        );
      }
    });
    return () => {
      void unsubscribe.then((fn) => fn());
    };
  }, []);

  // Mobile visibility persistence
  useEffect(() => {
    if (!mobile) return;
    const persistMobile = () => {
      if (!readyRef.current) return;
      void library.save(
        restoreSession(
          { ...sessionRef.current, position: player.state.time },
          tracksRef.current,
        ),
      );
    };
    const hidden = () => {
      if (document.hidden) persistMobile();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);

  // Initial load and periodic persistence
  useEffect(() => {
    const onMusicResolved = (event: Event) => {
      const selected = [
        ...tracksRef.current,
        ...Object.values(sessionRef.current.queueTracks),
      ].find((track) => track.id === (event as CustomEvent<string>).detail);
      const credits = selected && resolvedMusic.get(selected.id);
      if (
        selected &&
        credits &&
        (selected.title !== credits.title ||
          selected.artist !== credits.artist ||
          (credits.album && selected.album !== credits.album))
      )
        void enrichOnline(selected);
    };
    musicResolved.addEventListener("resolved", onMusicResolved);

    library
      .load()
      .then(async (snapshot) => {
        snapshot.tracks = await Promise.all(
          snapshot.tracks.map(async (original) => {
            const repaired = repairYoutubeTrack(original);
            if (repaired === original) return original;
            return library.saveOnline(repaired, true).catch((err) => {
              console.warn("Saved track metadata repair failed:", err);
              return original;
            });
          }),
        );
        const restored = restoreSession(snapshot.session, snapshot.tracks);
        setTracks(snapshot.tracks);
        snapshot.tracks
          .filter((track) => track.offline)
          .forEach((track) => offlineTracks.add(track.id));
        setSession(restored);
        sessionRef.current = restored;
        readyRef.current = true;
        setReady(true);
        const selected = restored.queue.find(
          (i) => i.id === restored.currentId,
        );
        if (selected)
          void player.load(selected.trackId, false, restored.position);
      })
      .catch((e) =>
        setError(`The library could not be opened. ${formatError(e)}`),
      );

    library
      .ytdlpCheckAvailable()
      .then(setYtdlpAvailable)
      .catch(() => setYtdlpAvailable(false));

    const timer = setInterval(persist, 2000);
    const onHidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      musicResolved.removeEventListener("resolved", onMusicResolved);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);

  // Restore enrichment on selection/startup after the App.tsx extraction.
  // Queued sources remain transient; enrichOnline only updates saved rows.
  useEffect(() => {
    if (!ready) return;
    const entry = session.queue.find((item) => item.id === session.currentId);
    const selected = entry && (tracks.find((track) => track.id === entry.trackId)
      || session.queueTracks[entry.trackId]);
    if (selected && needsMetadata(selected)) void enrichOnline(selected);
  }, [ready, session.currentId]);

  // Debounced persistence on session change
  useEffect(() => {
    if (ready) {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(persist, 200);
    }
  }, [session, ready]);

  async function enrichOnline(base: Track, explicit = false) {
    if (metadataInFlight.current.has(base.id)) return;
    metadataInFlight.current.add(base.id);
    try {
      const sourceAtStart = resolvedMusic.get(base.id);
      let metadata = null;
      for (const query of metadataQueries(sourceAtStart ? {
        ...base, title: sourceAtStart.title, artist: sourceAtStart.artist,
      } : base)) {
        try {
          metadata = await library.lookupMetadata(
            query.title,
            query.artist,
            base.duration,
          );
          if (metadata) break;
        } catch (e) {
          console.warn("Catalog metadata unavailable:", e);
          break;
        }
      }
      // Stream credits can arrive while the first catalogue request is pending.
      const source = resolvedMusic.get(base.id);
      if (source && source !== sourceAtStart) {
        try {
          metadata = await library.lookupMetadata(source.title, source.artist, base.duration);
        } catch (e) {
          metadata = null;
          console.warn("Catalog metadata unavailable:", e);
        }
      }
      if (!source && !metadata) {
        if (explicit)
          notify(
            "No verified metadata is available right now. The saved source information is still available.",
          );
        return;
      }
      let enriched: Track = {
        ...base,
        title: source?.title || metadata?.title || base.title,
        artist: source?.artist || metadata?.artist || base.artist,
        album: source?.album || metadata?.album || base.album,
        artworkUrl: metadata?.artworkUrl || base.artworkUrl,
      };
      if (tracksRef.current.some((t) => t.id === base.id)) {
        enriched = await library.saveOnline(enriched, true);
        setTracks((all) =>
          all.map((t) => (t.id === enriched.id ? enriched : t)),
        );
      } else {
        update((s) =>
          s.queue.some((entry) => entry.trackId === base.id)
            ? { ...s, queueTracks: { ...s.queueTracks, [base.id]: enriched } }
            : s,
        );
      }
      if (explicit) notify(`Metadata updated for ${enriched.title}`);
    } catch (e) {
      if (explicit) throw e;
      console.warn("Optional metadata enrichment failed:", e);
    } finally {
      metadataInFlight.current.delete(base.id);
    }
  }

  async function importMusic(folder: boolean, onAfterImport?: () => void) {
    await action(async () => {
      const result = await library.importAudio(folder);
      if (!result.tracks.length) return;
      const before = new Set(tracks.map((t) => t.id));
      setTracks((all) => [
        ...all.filter((t) => !result.tracks.some((n) => n.id === t.id)),
        ...result.tracks,
      ]);
      const added = result.tracks.filter((t) => !before.has(t.id));
      if (onAfterImport) onAfterImport();
      notify(
        `${added.length} ${added.length === 1 ? "track" : "tracks"} added${result.tracks.length > added.length ? ` · ${result.tracks.length - added.length} already in your library` : ""}${result.warnings.length ? ` · ${result.warnings.join(" ")}` : ""}`,
      );
    });
  }

  const favorite = (id: string) =>
    void action(async () => {
      if (!tracksRef.current.some((t) => t.id === id)) return;
      update((s) => ({
        ...s,
        favorites: s.favorites.includes(id)
          ? s.favorites.filter((f) => f !== id)
          : [...s.favorites, id],
      }));
    });

  async function saveOnline(t: Track) {
    const saved = await library.saveOnline(t);
    tracksRef.current = [
      ...tracksRef.current.filter((track) => track.id !== saved.id),
      saved,
    ];
    setTracks(tracksRef.current);
    return saved;
  }

  async function saveCommons(t: Track, play = false, onPlay?: (t: Track) => void) {
    await action(async () => {
      if (play && onPlay) {
        onPlay(tracksRef.current.find((saved) => saved.id === t.id) || t);
      } else {
        await saveOnline(t);
      }
      notify(`${play ? "Playing" : "Saved"} ${t.title}`);
    });
  }

  async function downloadTrack(t: Track) {
    setDownloads((prev) => ({ ...prev, [t.id]: "downloading" }));
    try {
      if (!tracksRef.current.some((track) => track.id === t.id))
        await saveOnline(t);
      const saved = await library.download(t.id);
      tracksRef.current = [
        ...tracksRef.current.filter((track) => track.id !== saved.id),
        saved,
      ];
      setTracks(tracksRef.current);
      setDownloads((prev) => ({ ...prev, [t.id]: "complete" }));
      notify(`${saved.title} is available offline`);
    } catch (err) {
      setDownloads((prev) => ({ ...prev, [t.id]: String(err) }));
      setError(String(err));
    }
  }

  function deleteOffline(
    t: Track,
    currentTrackId: string | undefined,
    askConfirm: (
      title: string,
      label: string,
      val: string,
      submit: (v: string) => void,
    ) => void,
  ) {
    askConfirm(
      "Delete offline copy",
      "Type DELETE to remove the app-owned audio copy. The saved online source stays in your library.",
      "",
      (value) => {
        if (value !== "DELETE") return;
        void action(async () => {
          if (currentTrackId === t.id) player.stop();
          const saved = await library.deleteDownload(t.id);
          offlineTracks.delete(t.id);
          setTracks((currentTracks) =>
            currentTracks.map((track) => (track.id === saved.id ? saved : track)),
          );
          if (
            sessionRef.current.queue.find(
              (entry) => entry.id === sessionRef.current.currentId,
            )?.trackId === t.id
          )
            void player.load(saved.id, false);
          notify("Offline copy deleted. The online source is still saved.");
        });
      },
    );
  }

  async function relink(t: Track, currentTrackId: string | undefined, playbackTime: number) {
    await action(async () => {
      const replacement = await library.relink(t.id);
      if (replacement) {
        setTracks((ts) => ts.map((x) => (x.id === t.id ? replacement : x)));
        if (currentTrackId === t.id) void player.load(t.id, false, playbackTime);
        notify("File relinked. Playback stays paused.");
      }
    });
  }

  async function removeTrack(t: Track, onResetUndo: () => void) {
    await action(async () => {
      suspendPersistence.current = true;
      if (persistTimer.current) clearTimeout(persistTimer.current);
      try {
        await saveChain.current;
        const previous = sessionRef.current.currentId;
        const snapshot = await library.remove(
          t.id,
          withoutTrack(
            {
              ...sessionRef.current,
              position: player.state.time,
            },
            t.id,
          ),
        );
        const restored = restoreSession(snapshot.session, snapshot.tracks);
        sessionRef.current = restored;
        tracksRef.current = snapshot.tracks;
        setTracks(snapshot.tracks);
        setSession(restored);
        onResetUndo();
        if (previous !== restored.currentId) {
          player.stop();
          const next = restored.queue.find(
            (entry) => entry.id === restored.currentId,
          );
          if (next) void player.load(next.trackId, false);
        }
        notify(
          `Removed ${t.title} from the library. Original files stay on disk.`,
        );
      } finally {
        suspendPersistence.current = false;
      }
    });
  }

  async function addOnlineToPlaylist(
    t: Track,
    playlistId: string,
    newName?: string,
  ) {
    await action(async () => {
      if (
        !newName &&
        !sessionRef.current.playlists.some((p) => p.id === playlistId)
      )
        return;
      const saved =
        tracksRef.current.find((entry) => entry.id === t.id) ||
        (await saveOnline(sessionRef.current.queueTracks[t.id] || t));
      update((s) => ({
        ...s,
        playlists: newName
          ? [
              ...s.playlists,
              { id: playlistId, name: newName, items: [item(saved.id)] },
            ]
          : s.playlists.map((playlist) =>
              playlist.id === playlistId
                ? { ...playlist, items: [...playlist.items, item(saved.id)] }
                : playlist,
            ),
      }));
      notify(`Added ${saved.title} to playlist`);
    });
  }

  async function saveDiscovery(
    result: YtdlpSearchResult,
    mode: "play" | "save" | "next" | "queue",
    onPlayTrack: (t: Track) => void,
  ) {
    await action(async () => {
      const base = youtubeTrack(result);
      const existing = tracksRef.current.find((t) => t.id === base.id);
      const selected =
        existing || sessionRef.current.queueTracks[base.id] || base;
      if (mode === "save") await saveOnline(selected);
      else if (mode === "play") onPlayTrack(selected);
      else {
        update((s) =>
          enqueue(
            {
              ...s,
              queueTracks: existing
                ? s.queueTracks
                : { ...s.queueTracks, [selected.id]: selected },
            },
            selected.id,
            mode === "next",
          ),
        );
      }
      notify(
        `${mode === "play" ? "Playing" : mode === "save" ? "Saved" : mode === "next" ? "Playing next:" : "Queued"} ${selected.title} - online connection required`,
      );
      if (mode === "save" && (!existing || !selected.album))
        void enrichOnline(selected);
    });
  }

  return {
    tracks,
    setTracks,
    session,
    setSession,
    ready,
    busy,
    message,
    setMessage,
    error,
    setError,
    downloads,
    ytdlpAvailable,
    sessionRef,
    tracksRef,
    readyRef,
    saveChain,
    persistTimer,
    suspendPersistence,
    update,
    setting,
    notify,
    persist,
    action,
    importMusic,
    favorite,
    saveOnline,
    saveCommons,
    downloadTrack,
    deleteOffline,
    relink,
    removeTrack,
    addOnlineToPlaylist,
    enrichOnline,
    saveDiscovery,
  };
}
