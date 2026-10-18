import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Disc3,
  Download,
  ExternalLink,
  FolderOpen,
  Heart,
  Headphones,
  Library,
  ListMusic,
  Loader2,
  Music2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Repeat1,
  Search,
  Settings2,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  Wifi,
  WifiOff,
  X,
  FileText,
  Link2,
  PanelRightClose,
  Globe,
} from "lucide-react";
import {
  library,
  desktop,
  mobile,
  type YtdlpSearchResult,
} from "./adapters/native";
import { lookupLyrics, type LookupState } from "./adapters/lrclib";
import { Artwork } from "./components/Artwork";
import { Collections } from "./components/Collections";
import { CommonsDiscovery } from "./components/CommonsDiscovery";
import { LyricsSettings } from "./components/LyricsSettings";
import {
  clearFetchedLyrics,
  isFetchedLyrics,
  lyricLayers,
} from "./domain/lyric-display";
import { romanizeDocument } from "./domain/romanization";
import { libraryCollections, withoutTrack } from "./domain/collections";
import {
  needsMetadata,
  metadataQueries,
  repairYoutubeTrack,
  youtubeTrack,
} from "./domain/online-track";
import {
  activeLine,
  alignVariant,
  estimatedFollowLine,
  normalizeCachedLyrics,
  parseLyrics,
  synchronizedLyrics,
} from "./domain/lyrics";
import {
  advance,
  enqueue,
  reorderUpcoming,
  playSelection,
} from "./domain/queue";
import { restoreSession } from "./domain/session";
import {
  defaults,
  item,
  type LyricDocument,
  type Session,
  type Track,
} from "./domain/types";
import { PlaybackController, type Playback } from "./player/controller";
import { AndroidPlaybackController } from "./player/android";
import { getCurrentWindow } from "@tauri-apps/api/window";

// Structured music credits from the existing stream resolution request. Never
// retain its expiring URL, and never turn an uploader name into a performer.
const resolvedMusic = new Map<
  string,
  { title: string; artist: string; album: string }
>();
const musicResolved = new EventTarget();
const offlineTracks = new Set<string>();
const player = mobile
  ? new AndroidPlaybackController()
  : new PlaybackController(async (id) => {
      if (offlineTracks.has(id)) return library.media(id);
      // Check if this is a YouTube track (format: youtube:videoId)
      if (id.startsWith("youtube:")) {
        const videoId = id.slice(id.indexOf(":") + 1);
        const stream = await library.ytdlpGetStream(videoId);
        if (stream.track?.trim() && stream.artist?.trim()) {
          if (resolvedMusic.size >= 128)
            resolvedMusic.delete(resolvedMusic.keys().next().value!);
          resolvedMusic.set(id, {
            title: stream.track.trim(),
            artist: stream.artist.trim(),
            album: stream.album?.trim() || "",
          });
          musicResolved.dispatchEvent(
            new CustomEvent("resolved", { detail: id }),
          );
        }
        return stream.streamUrl;
      }
      // Check if this is a Commons track (format: wikimedia-commons:sourceId)
      if (id.startsWith("wikimedia-commons:")) {
        const sourceId = id.slice(id.indexOf(":") + 1);
        const resolved = await library.resolveCommons(sourceId);
        return resolved.url;
      }
      // Default to local file resolution
      return library.media(id);
    });
const clock = (s: number) =>
  `${Math.floor((Number.isFinite(s) ? s : 0) / 60)}:${String(Math.floor((Number.isFinite(s) ? s : 0) % 60)).padStart(2, "0")}`;
const formatError = (e: unknown) =>
  e instanceof Error ? e.message : String(e);
type View =
  "library" | "favorites" | "lyrics" | "settings" | "discover" | string;
type Dialog = {
  title: string;
  label: string;
  value: string;
  submit: (name: string) => void;
} | null;
function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function App() {
  const [tracks, setTracks] = useState<Track[]>([]),
    [session, setSession] = useState<Session>(defaults),
    [ready, setReady] = useState(false);
  const [playback, setPlayback] = useState<Playback>(player.state),
    [view, setView] = useState<View>("library"),
    [query, setQuery] = useState("");
  const [queueOpen, setQueueOpen] = useState(() => window.innerWidth >= 1000),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null),
    [dialogValue, setDialogValue] = useState(""),
    [follow, setFollow] = useState(true),
    [lyricsMenuOpen, setLyricsMenuOpen] = useState(false);
  const [playlistTarget, setPlaylistTarget] = useState<Track | null>(null);
  const [variant, setVariant] = useState<{
    doc: LyricDocument;
    kind: "romanisation" | "translation";
    trackId: string;
    original: LyricDocument;
  } | null>(null);
  const [undo, setUndo] = useState<Session["queue"] | null>(null);
  const [lyricLookup, setLyricLookup] = useState<LookupState>({
    status: "idle",
  });
  // Explicit retry reruns the guarded lookup effect.
  const [lyricRetry, setLyricRetry] = useState(0);
  // Discovery state
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryResults, setDiscoveryResults] = useState<YtdlpSearchResult[]>(
    [],
  );
  const [discoverySearching, setDiscoverySearching] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [downloads, setDownloads] = useState<Record<string, string>>({});
  const [ytdlpAvailable, setYtdlpAvailable] = useState(false);
  const metadataInFlight = useRef(new Set<string>());
  const autoOpenedLyrics = useRef<string | null>(null);
  const current = session.queue.find((i) => i.id === session.currentId),
    listeningTracks = [
      ...tracks,
      ...Object.values(session.queueTracks).filter(
        (t) => !tracks.some((saved) => saved.id === t.id),
      ),
    ],
    track = listeningTracks.find((t) => t.id === current?.trackId),
    doc = track ? session.lyrics[track.id] : undefined;
  const sessionRef = useRef(session),
    tracksRef = useRef(tracks),
    readyRef = useRef(false),
    saveChain = useRef(Promise.resolve()),
    persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    suspendPersistence = useRef(false);
  const activeRef = useRef<HTMLButtonElement | null>(null),
    dialogRef = useRef<HTMLDialogElement>(null),
    previousFocus = useRef<HTMLElement | null>(null);
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
  };
  function persist() {
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
  }
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
  useEffect(() => {
    if (!mobile) return;
    const persist = () => {
      if (!readyRef.current) return;
      void library.save(
        restoreSession(
          { ...sessionRef.current, position: player.state.time },
          tracksRef.current,
        ),
      );
    };
    const hidden = () => {
      if (document.hidden) persist();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);
  useEffect(() => {
    const unsubscribe = player.subscribe(setPlayback);
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
            return library.saveOnline(repaired, true).catch((error) => {
              console.warn("Saved track metadata repair failed:", error);
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

    // Check if yt-dlp is available
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
      unsubscribe();
      musicResolved.removeEventListener("resolved", onMusicResolved);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);
  useEffect(() => {
    if (ready) {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(persist, 200);
    }
  }, [session, ready]);
  useEffect(() => {
    player.volume(session.settings.volume);
  }, [session.settings.volume]);
  useEffect(() => {
    player.precise(view === "lyrics");
    return () => player.precise(false);
  }, [view]);
  useEffect(() => {
    if (ready && track && needsMetadata(track)) void enrichOnline(track);
  }, [ready, track?.id]);
  const lyricDuration =
    playback.duration > 0 ? playback.duration : track?.duration || 0;
  useEffect(() => {
    if (!doc || !track || !session.settings.romanisation) return;
    let cancelled = false;
    const id = track.id,
      original = doc.id;
    void romanizeDocument(doc)
      .then((romanisation) => {
        if (cancelled || !Object.keys(romanisation).length) return;
        update((session) => {
          const current = session.lyrics[id];
          return current?.id === original
            ? {
                ...session,
                lyrics: {
                  ...session.lyrics,
                  [id]: {
                    ...current,
                    romanisation: {
                      ...current.romanisation,
                      ...Object.fromEntries(
                        Object.entries(romanisation).filter(
                          ([lineId]) =>
                            current.romanisation[lineId] ===
                            doc.romanisation[lineId],
                        ),
                      ),
                    },
                  },
                },
              }
            : session;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc?.id, doc?.raw, track?.id, session.settings.romanisation]);
  // Auto-lookup effect: fires whenever the current track changes.
  useEffect(() => {
    if (!ready || !track) {
      setLyricLookup({ status: "idle" });
      return;
    }
    const id = track.id;
    // If we already have lyrics stored for this track, surface them directly.
    const originalCached = sessionRef.current.lyrics[id];
    const cached = originalCached
      ? normalizeCachedLyrics(originalCached, lyricDuration)
      : undefined;
    if (cached) {
      if (cached !== originalCached)
        update((s) => ({ ...s, lyrics: { ...s.lyrics, [id]: cached } }));
      setLyricLookup({ status: "found", doc: cached });
      return;
    }
    if (
      track.source &&
      playback.status === "loading" &&
      playback.duration <= 0
    ) {
      setLyricLookup({ status: "loading" });
      return;
    }
    let cancelled = false;
    setLyricLookup({ status: "loading" });
    lookupLyrics({ ...track, duration: lyricDuration }).then((result) => {
      if (cancelled) return;
      const attached = sessionRef.current.lyrics[id];
      setLyricLookup(attached ? { status: "found", doc: attached } : result);
      if (result.status === "found") {
        update((s) =>
          s.lyrics[id]
            ? s
            : { ...s, lyrics: { ...s.lyrics, [id]: result.doc } },
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    track?.id,
    track?.title,
    track?.artist,
    track?.album,
    ready,
    lyricRetry,
    lyricDuration,
    playback.status,
  ]);

  useEffect(() => {
    player.onEnded = () => {
      const s = sessionRef.current,
        selected = s.queue.find((i) => i.id === s.currentId);
      if (selected && s.settings.historyEnabled)
        update((x) => ({
          ...x,
          history: [
            ...x.history,
            { trackId: selected.trackId, at: new Date().toISOString() },
          ].slice(-500),
        }));
      const next = advance(s, 1, true);
      if (next) selectQueue(next, true);
      else persist();
    };
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target instanceof HTMLElement &&
          (e.target.matches("input,textarea,select,button") ||
            e.target.isContentEditable)) ||
        dialog ||
        variant
      )
        return;
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
  const lyricSynced = doc ? synchronizedLyrics(doc, lyricDuration) : false;
  const active =
    doc && lyricSynced ? activeLine(doc, playback.time * 1000) : null;
  const followTarget =
    doc && (lyricSynced || session.settings.estimatedScroll)
      ? lyricSynced
        ? active
        : estimatedFollowLine(doc, playback.time, lyricDuration)
      : null;
  useEffect(() => {
    if (follow && view === "lyrics")
      activeRef.current?.scrollIntoView({
        block: "center",
        behavior: lyricSynced ? "instant" : "smooth",
      });
  }, [followTarget, follow, view, lyricSynced]);
  useEffect(() => {
    if (
      playback.status === "playing" &&
      current &&
      session.settings.autoOpenLyrics &&
      autoOpenedLyrics.current !== current.id
    ) {
      autoOpenedLyrics.current = current.id;
      setView("lyrics");
      setFollow(true);
    }
  }, [playback.status, current?.id, session.settings.autoOpenLyrics]);
  useEffect(() => {
    if (dialog || variant || playlistTarget) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
      previousFocus.current?.focus();
    }
  }, [dialog, variant, playlistTarget]);
  function ask(
    title: string,
    label: string,
    value: string,
    submit: (value: string) => void,
  ) {
    setDialogValue(value);
    setDialog({ title, label, value, submit });
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }
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
    setFollow(true);
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
    setFollow(true);
  }
  function togglePlay() {
    if (!track) {
      const queued = sessionRef.current.queue[0];
      if (queued) {
        selectQueue(queued.id, true);
        return;
      }
      const first = tracks[0];
      if (first) playTrack(first);
      return;
    }
    if (playback.status === "playing" || playback.status === "buffering")
      player.pause();
    else if (playback.status === "error")
      void player.load(track.id, true, playback.time);
    else void player.play();
  }
  function skip(direction: 1 | -1) {
    if (direction === -1 && playback.time > 3) {
      player.seek(0);
      return;
    }
    const id = advance(sessionRef.current, direction);
    if (id) selectQueue(id, true);
  }
  async function importMusic(folder: boolean) {
    await action(async () => {
      const result = await library.importAudio(folder);
      if (!result.tracks.length) return;
      const before = new Set(tracks.map((t) => t.id));
      setTracks((all) => [
        ...all.filter((t) => !result.tracks.some((n) => n.id === t.id)),
        ...result.tracks,
      ]);
      const added = result.tracks.filter((t) => !before.has(t.id));
      setView("collection:local");
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
        tracksRef.current.find((saved) => saved.id === t.id) ||
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
      setPlaylistTarget(null);
      notify(`Added ${saved.title} to playlist`);
    });
  }
  function choosePlaylist(t: Track) {
    setDialogValue("");
    setPlaylistTarget(t);
  }
  function removeQueue(id: string) {
    const s = sessionRef.current;
    setUndo(s.queue);
    const queue = s.queue.filter((i) => i.id !== id);
    if (id === s.currentId) {
      const index = s.queue.findIndex((i) => i.id === id),
        next = queue[Math.min(index, queue.length - 1)];
      update((x) => ({
        ...x,
        queue,
        currentId: next?.id ?? null,
        position: 0,
      }));
      if (next) void player.load(next.trackId, false);
      else player.stop();
    } else update((x) => ({ ...x, queue }));
  }
  async function attach(kind: "original" | "romanisation" | "translation") {
    const selected = track?.id;
    if (!selected) return;
    await action(async () => {
      const input = await library.lyrics();
      if (!input) return;
      const parsed = parseLyrics(input.text, input.fileName);
      if (
        sessionRef.current.queue.find(
          (i) => i.id === sessionRef.current.currentId,
        )?.trackId !== selected
      )
        throw new Error(
          "The selected track changed. Attach the lyrics again for this track.",
        );
      if (kind === "original") {
        update((s) => ({ ...s, lyrics: { ...s.lyrics, [selected]: parsed } }));
        notify("Original lyrics attached locally");
      } else {
        if (!doc) throw new Error("Attach original lyrics first.");
        alignVariant(doc, parsed);
        setVariant({ doc: parsed, kind, trackId: selected, original: doc });
      }
    });
  }
  function confirmVariant() {
    if (!variant) return;
    if (
      !doc ||
      !track ||
      track.id !== variant.trackId ||
      doc.id !== variant.original.id
    ) {
      setVariant(null);
      setError(
        "The selected recording changed. Attach the supplied text again for this song.",
      );
      return;
    }
    try {
      const mapped = alignVariant(doc, variant.doc);
      update((s) => ({
        ...s,
        lyrics: { ...s.lyrics, [track.id]: { ...doc, [variant.kind]: mapped } },
      }));
      setVariant(null);
      notify("Supplied text attached to the original line IDs");
    } catch (e) {
      setError(formatError(e));
    }
  }
  function markInstrumental() {
    if (track)
      update((s) => ({
        ...s,
        lyrics: {
          ...s.lyrics,
          [track.id]: {
            id: crypto.randomUUID(),
            raw: "",
            fileName: "Marked instrumental by you",
            lines: [],
            fileOffset: 0,
            userOffset: 0,
            warnings: [],
            romanisation: {},
            translation: {},
            instrumental: true,
          },
        },
      }));
  }
  async function saveDiscovery(
    result: YtdlpSearchResult,
    mode: "play" | "save" | "next" | "queue",
  ) {
    await action(async () => {
      const base = youtubeTrack(result);
      const existing = tracksRef.current.find((t) => t.id === base.id);
      const selected =
        existing || sessionRef.current.queueTracks[base.id] || base;
      if (mode === "save") await saveOnline(selected);
      else if (mode === "play") playTrack(selected);
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
      // Source metadata and playback work immediately. Optional enrichment must
      // not block transport on an account restriction or an overloaded service.
      if (mode === "save" && (!existing || !selected.album))
        void enrichOnline(selected);
    });
  }
  async function enrichOnline(base: Track, explicit = false) {
    if (metadataInFlight.current.has(base.id)) return;
    metadataInFlight.current.add(base.id);
    try {
      let metadata = null;
      for (const query of metadataQueries(base)) {
        if (resolvedMusic.has(base.id)) break;
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
      const spotify =
        metadata || resolvedMusic.has(base.id)
          ? null
          : await library
              .spotifySearchTrack(base.title, base.artist, base.duration)
              .catch((e) => {
                console.warn("Optional Spotify metadata unavailable:", e);
                return null;
              });
      const source = resolvedMusic.get(base.id);
      if (!source && !spotify && !metadata) {
        if (explicit)
          notify(
            "No verified metadata is available right now. The saved source information is still available.",
          );
        return;
      }
      let enriched: Track = {
        ...base,
        title: source?.title || metadata?.title || spotify?.title || base.title,
        artist:
          source?.artist || metadata?.artist || spotify?.artist || base.artist,
        album: source?.album || metadata?.album || spotify?.album || base.album,
        artworkUrl:
          spotify?.artworkUrl || base.artworkUrl || metadata?.artworkUrl,
      };
      if (tracksRef.current.some((t) => t.id === base.id)) {
        enriched = await library.saveOnline(enriched, true);
        setTracks((all) =>
          all.map((t) => (t.id === enriched.id ? enriched : t)),
        );
      } else
        update((s) =>
          s.queue.some((entry) => entry.trackId === base.id)
            ? { ...s, queueTracks: { ...s.queueTracks, [base.id]: enriched } }
            : s,
        );
      if (explicit) notify(`Metadata updated for ${enriched.title}`);
    } catch (e) {
      if (explicit) throw e;
      console.warn("Optional metadata enrichment failed:", e);
    } finally {
      metadataInFlight.current.delete(base.id);
    }
  }
  async function relink(t: Track) {
    await action(async () => {
      const replacement = await library.relink(t.id);
      if (replacement) {
        setTracks((ts) => ts.map((x) => (x.id === t.id ? replacement : x)));
        if (track?.id === t.id) void player.load(t.id, false, playback.time);
        notify("File relinked. Playback stays paused.");
      }
    });
  }
  async function removeTrack(t: Track) {
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
        setUndo(null);
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
  async function saveCommons(t: Track, play = false) {
    await action(async () => {
      if (play)
        playTrack(tracksRef.current.find((saved) => saved.id === t.id) || t);
      else await saveOnline(t);
      notify(`${play ? "Playing" : "Saved"} ${t.title}`);
    });
  }
  async function saveOnline(t: Track) {
    const saved = await library.saveOnline(t);
    tracksRef.current = [
      ...tracksRef.current.filter((track) => track.id !== saved.id),
      saved,
    ];
    setTracks(tracksRef.current);
    return saved;
  }
  async function downloadTrack(t: Track) {
    setDownloads((downloads) => ({ ...downloads, [t.id]: "downloading" }));
    try {
      if (!tracksRef.current.some((track) => track.id === t.id))
        await saveOnline(t);
      const saved = await library.download(t.id);
      tracksRef.current = [
        ...tracksRef.current.filter((track) => track.id !== saved.id),
        saved,
      ];
      setTracks(tracksRef.current);
      setDownloads((downloads) => ({ ...downloads, [t.id]: "complete" }));
      notify(`${saved.title} is available offline`);
    } catch (error) {
      setDownloads((downloads) => ({ ...downloads, [t.id]: String(error) }));
      setError(String(error));
    }
  }
  function deleteOffline(t: Track) {
    ask(
      "Delete offline copy",
      "Type DELETE to remove the app-owned audio copy. The saved online source stays in your library.",
      "",
      (value) => {
        if (value !== "DELETE") return;
        void action(async () => {
          if (track?.id === t.id) player.stop();
          const saved = await library.deleteDownload(t.id);
          offlineTracks.delete(t.id);
          setTracks((tracks) =>
            tracks.map((track) => (track.id === saved.id ? saved : track)),
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
  const collections = libraryCollections(tracks, session.playlists);
  const collection = collections.find((candidate) => candidate.id === view);
  const builtin = view.startsWith("collection:");
  const playlist = session.playlists.find((p) => p.id === view);
  const visible = tracks.filter(
    (t) =>
      (view !== "favorites" || session.favorites.includes(t.id)) &&
      (!builtin || collection?.tracks.some((track) => track.id === t.id)) &&
      (!playlist || playlist.items.some((i) => i.trackId === t.id)) &&
      `${t.title} ${t.artist} ${t.album}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const heading =
    view === "favorites"
      ? "Your favorites"
      : collection
        ? collection.name
        : "Your library";
  const rows = playlist
    ? playlist.items.flatMap((entry) => {
        const t = visible.find((t) => t.id === entry.trackId);
        return t ? [{ t, entryId: entry.id }] : [];
      })
    : visible.map((t) => ({ t, entryId: t.id }));

  return (
    <div
      className={`app ${queueOpen ? "with-queue" : ""} ${mobile ? "android" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("library");
          }}
        >
          <span className="brand-icon">
            <Headphones size={23} />
          </span>
          Lumaire<span className="brand-dot">.</span>
        </a>
        <div className="sidebar-caption">YOUR SPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={view === "library" ? "selected" : ""}
            onClick={() => setView("library")}
          >
            <Library size={19} />
            Library<span className="nav-count">{collections.length}</span>
          </button>
          <button
            className={view === "discover" ? "selected" : ""}
            onClick={() => setView("discover")}
          >
            <Globe size={19} />
            Discover
          </button>
          <button
            className={view === "favorites" ? "selected" : ""}
            onClick={() => setView("favorites")}
          >
            <Heart size={19} />
            Favorites
          </button>
          <button
            className={view === "lyrics" ? "selected" : ""}
            onClick={() => setView("lyrics")}
          >
            <FileText size={19} />
            Lyric room{doc && <span className="small-dot" />}
          </button>
        </nav>
        <div className="sidebar-caption playlist-label">
          PLAYLISTS{" "}
          <IconButton
            label="Create playlist"
            onClick={() =>
              ask("A new collection", "Playlist name", "", (name) => {
                const id = crypto.randomUUID();
                update((s) => ({
                  ...s,
                  playlists: [...s.playlists, { id, name, items: [] }],
                }));
                setView(id);
              })
            }
          >
            <Plus size={17} />
          </IconButton>
        </div>
        <nav aria-label="Playlists" className="playlists-nav">
          {session.playlists.map((p) => (
            <button
              key={p.id}
              className={view === p.id ? "selected" : ""}
              onClick={() => setView(p.id)}
            >
              <ListMusic size={18} />
              <span className="ellipsis">{p.name}</span>
              <span className="nav-count">{p.items.length}</span>
            </button>
          ))}
          {!session.playlists.length && (
            <p className="sidebar-note">
              A little order for
              <br />
              everything you love.
            </p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="small-dot" /> On your device{" "}
            <span>Private by default</span>
          </div>
          <button
            className={`nav-settings ${view === "settings" ? "selected" : ""}`}
            onClick={() => setView("settings")}
          >
            <Settings2 size={18} />
            Settings & sources
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <select
            className="compact-navigation"
            aria-label="Navigate your library"
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            <option value="library">Library</option>
            <option value="discover">Discover</option>
            <option value="favorites">Favorites</option>
            <option value="lyrics">Lyric room</option>
            <option value="settings">Settings & sources</option>
            {collections
              .filter((collection) => !collection.playlist)
              .map((collection) => (
                <option value={collection.id} key={collection.id}>
                  {collection.name}
                </option>
              ))}
            {session.playlists.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="breadcrumb">
            Your space <ChevronRight size={14} />
            <span>
              {view === "lyrics"
                ? "Lyric room"
                : view === "settings"
                  ? "Settings"
                  : view === "discover"
                    ? "Discover"
                    : heading}
            </span>
          </div>
          <div className="topbar-actions">
            <span className="offline-badge">LOCAL FIRST</span>
            <IconButton
              label={queueOpen ? "Hide queue" : "Show queue"}
              active={queueOpen}
              onClick={() => setQueueOpen((x) => !x)}
            >
              <ListMusic size={20} />
            </IconButton>
          </div>
        </header>
        {(error || playback.error) && (
          <div className="banner error" role="alert">
            <span>{error || playback.error}</span>
            <button
              onClick={() => {
                setError("");
                if (playback.error && track)
                  void player.load(track.id, false, playback.time);
              }}
            >
              Retry
            </button>
            <IconButton label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </IconButton>
          </div>
        )}
        {message && (
          <div className="banner notice" role="status">
            <Check size={16} />
            <span>{message}</span>
            <IconButton
              label="Dismiss notification"
              onClick={() => setMessage("")}
            >
              <X size={16} />
            </IconButton>
          </div>
        )}
        <main id="main" tabIndex={-1}>
          {!ready && (
            <div className="empty">
              <Disc3 className="spin" size={32} />
              <h1>Opening your library</h1>
              {error && (
                <button onClick={() => location.reload()}>Try again</button>
              )}
            </div>
          )}
          {ready &&
            (view === "library" ||
              view === "favorites" ||
              playlist ||
              builtin) && (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">MUSIC, AT YOUR OWN PACE</p>
                    <h1>
                      {heading}
                      <span className="heading-dot">.</span>
                    </h1>
                    <p className="subtitle">
                      {playlist
                        ? `${playlist.items.length} saved entries · your own little world`
                        : view === "favorites"
                          ? "The songs you always come back to."
                          : "Your music. Your words. A little closer."}
                    </p>
                  </div>
                  <div className="heading-actions">
                    {view !== "library" && rows.length > 0 && (
                      <button
                        className="subtle"
                        onClick={() => {
                          const queue = rows
                            .filter(({ t }) => !t.missing)
                            .map(({ t }) => item(t.id));
                          if (!queue.length) return;
                          update((s) => ({
                            ...s,
                            queue,
                            currentId: queue[0].id,
                            position: 0,
                          }));
                          void player.load(queue[0].trackId, true);
                        }}
                      >
                        <Play size={16} />
                        Play collection
                      </button>
                    )}
                    {playlist && (
                      <>
                        <button
                          className="subtle"
                          onClick={() =>
                            ask(
                              "Rename collection",
                              "Playlist name",
                              playlist.name,
                              (name) =>
                                update((s) => ({
                                  ...s,
                                  playlists: s.playlists.map((p) =>
                                    p.id === playlist.id ? { ...p, name } : p,
                                  ),
                                })),
                            )
                          }
                        >
                          Rename
                        </button>
                        <IconButton
                          label="Delete playlist"
                          onClick={() =>
                            ask(
                              "Delete collection",
                              "Type DELETE to remove this playlist. Your files stay on disk.",
                              "",
                              (value) => {
                                if (value === "DELETE") {
                                  update((s) => ({
                                    ...s,
                                    playlists: s.playlists.filter(
                                      (p) => p.id !== playlist.id,
                                    ),
                                  }));
                                  setView("library");
                                }
                              },
                            )
                          }
                        >
                          <Trash2 size={17} />
                        </IconButton>
                      </>
                    )}
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void importMusic(false)}
                    >
                      <Plus size={17} />
                      {busy ? "Working…" : "Add music"}
                    </button>
                  </div>
                </div>
                <section className="library-tools">
                  <label className="search">
                    <Search size={17} />
                    <input
                      aria-label="Search local library"
                      placeholder="Find a song, artist, or album"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </label>
                  <span className="muted">
                    {visible.length} {visible.length === 1 ? "track" : "tracks"}
                  </span>
                  {!mobile && (
                    <button
                      className="subtle"
                      disabled={busy}
                      onClick={() => void importMusic(true)}
                    >
                      <FolderOpen size={16} />
                      Add folder
                    </button>
                  )}
                </section>
                {view === "library" ? (
                  <Collections
                    collections={collections}
                    query={query}
                    open={(id) => {
                      setView(id);
                      setQuery("");
                    }}
                  />
                ) : !tracks.length ? (
                  <section className="welcome">
                    <div className="record-art">
                      <div className="record">
                        <div className="record-center">
                          <Music2 size={30} />
                        </div>
                      </div>
                      <span className="art-spark">✦</span>
                    </div>
                    <p className="eyebrow">A SPACE FOR YOUR SOUND</p>
                    <h2>Make yourself at home.</h2>
                    <p>
                      Bring your music into Lumaire.
                      <br />
                      Listen, collect, and find the meaning between the lines.
                    </p>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void importMusic(false)}
                    >
                      <Plus size={18} />
                      Choose your music
                    </button>
                    <span className="welcome-note">
                      Local files · No account · No subscription
                    </span>
                    {!desktop && (
                      <p className="desktop-note">
                        Desktop library access requires{" "}
                        <code>npm run desktop</code>.
                      </p>
                    )}
                  </section>
                ) : !visible.length ? (
                  <div className="empty">
                    <Search size={30} />
                    <h2>
                      {query
                        ? "No matching music"
                        : view === "favorites"
                          ? "Your favorites start here"
                          : "An empty collection"}
                    </h2>
                    <p>
                      {query
                        ? "Try a different title, artist, or album."
                        : view === "favorites"
                          ? "Tap a heart beside a track to save it here."
                          : "Add tracks using the collection menu in your library."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="track-header">
                      <span>#</span>
                      <span>TRACK / ARTIST</span>
                      <span>ALBUM</span>
                      <span>TIME</span>
                      <span />
                    </div>
                    <div className="track-list">
                      {rows.map(({ t, entryId }, index) => (
                        <div
                          className={`track-row ${track?.id === t.id ? "current" : ""}`}
                          key={entryId}
                        >
                          <button
                            className="track-play"
                            aria-label={`Play ${t.title}`}
                            onClick={() => playTrack(t)}
                          >
                            {track?.id === t.id &&
                            playback.status === "playing" ? (
                              <span className="equalizer">▥</span>
                            ) : (
                              <>
                                <span className="track-index">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                <Play className="row-play" size={15} />
                              </>
                            )}
                          </button>
                          <button
                            className="track-meta"
                            onClick={() => playTrack(t)}
                          >
                            <Artwork
                              url={t.artworkUrl}
                              className={`color-${index % 5}`}
                            />
                            <span>
                              <strong dir="auto">{t.title}</strong>
                              <small dir="auto">
                                {t.artist}
                                {` · ${t.offline ? "Downloaded · Offline" : t.source ? "Saved online" : "Local file"} · ${t.format}`}
                                {t.missing ? " · File missing" : ""}
                              </small>
                            </span>
                          </button>
                          <span className="album ellipsis" title={t.album}>
                            {t.album}
                          </span>
                          <span className="duration">
                            {t.duration ? clock(t.duration) : "—"}
                          </span>
                          <div className="track-actions">
                            <IconButton
                              label={`${session.favorites.includes(t.id) ? "Unfavorite" : "Favorite"} ${t.title}`}
                              active={session.favorites.includes(t.id)}
                              onClick={() => favorite(t.id)}
                            >
                              <Heart
                                size={17}
                                fill={
                                  session.favorites.includes(t.id)
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            </IconButton>
                            <details className="track-menu">
                              <summary aria-label={`Actions for ${t.title}`}>
                                •••
                              </summary>
                              <div className="menu-popover">
                                <button
                                  disabled={
                                    busy ||
                                    t.offline ||
                                    downloads[t.id] === "downloading"
                                  }
                                  onClick={() => void removeTrack(t)}
                                >
                                  Remove from library
                                </button>
                                {t.source && !t.offline && (
                                  <button
                                    disabled={downloads[t.id] === "downloading"}
                                    onClick={() => void downloadTrack(t)}
                                  >
                                    Download for offline
                                  </button>
                                )}
                                {t.offline && (
                                  <button onClick={() => deleteOffline(t)}>
                                    Delete offline copy
                                  </button>
                                )}
                                <button onClick={() => queueTrack(t.id, true)}>
                                  Play next
                                </button>
                                <button onClick={() => queueTrack(t.id)}>
                                  Add to queue
                                </button>
                                {t.source?.providerId === "youtube" && (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      void action(() => enrichOnline(t, true))
                                    }
                                  >
                                    Refresh metadata
                                  </button>
                                )}
                                {!t.source && (
                                  <button
                                    disabled={mobile}
                                    title={
                                      mobile
                                        ? "Re-import this file with Add music in the Android prototype."
                                        : undefined
                                    }
                                    onClick={() => void relink(t)}
                                  >
                                    <Link2 size={14} />
                                    Relink file
                                  </button>
                                )}
                                {t.source?.providerId ===
                                  "wikimedia-commons" && (
                                  <a
                                    className="source-credits"
                                    href={t.source.pageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {t.source.attribution} · {t.source.license}
                                  </a>
                                )}
                                <button onClick={() => choosePlaylist(t)}>
                                  Save to playlist
                                </button>
                                {playlist && (
                                  <button
                                    onClick={() => {
                                      update((s) => ({
                                        ...s,
                                        playlists: s.playlists.map((p) =>
                                          p.id === playlist.id
                                            ? {
                                                ...p,
                                                items: p.items.filter(
                                                  (i) => i.id !== entryId,
                                                ),
                                              }
                                            : p,
                                        ),
                                      }));
                                    }}
                                  >
                                    Remove one from collection
                                  </button>
                                )}
                              </div>
                            </details>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="library-footer">
                      <span className="small-dot" /> Your saved sources and
                      files, organized here.
                    </p>
                  </>
                )}
              </>
            )}
          {ready && view === "lyrics" && (
            <section className="lyric-room">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">BETWEEN THE LINES</p>
                  <h1>
                    Listen a little closer<span className="heading-dot">.</span>
                  </h1>
                  <p className="subtitle">
                    {track
                      ? `${track.title} · ${track.artist}`
                      : "Choose a song to open its words."}
                  </p>
                </div>
                <div className="lyric-heading-actions">
                  <div className="lyric-settings">
                    <button
                      className="icon-button"
                      aria-label="Lyrics settings"
                      title="Lyrics settings"
                      aria-haspopup="true"
                      aria-expanded={lyricsMenuOpen}
                      aria-controls="lyrics-settings-menu"
                      onClick={() => setLyricsMenuOpen((x) => !x)}
                    >
                      <Settings2 size={16} />
                    </button>
                    {lyricsMenuOpen && (
                      <div
                        id="lyrics-settings-menu"
                        className="lyric-settings-menu"
                        role="group"
                        aria-label="Lyrics settings"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setLyricsMenuOpen(false);
                            e.currentTarget.parentElement
                              ?.querySelector("button")
                              ?.focus();
                          }
                        }}
                      >
                        <LyricsSettings
                          settings={session.settings}
                          setting={setting}
                          doc={doc}
                          cachedCount={
                            Object.values(session.lyrics).filter(
                              isFetchedLyrics,
                            ).length
                          }
                          clearCache={() => {
                            update(clearFetchedLyrics);
                            setLyricRetry((retry) => retry + 1);
                            notify(
                              "Cached lyrics cleared. Imported lyrics and your private key are preserved.",
                            );
                          }}
                          regenerate={() => {
                            if (!track || !doc) return;
                            const id = track.id,
                              original = doc.id;
                            void action(async () => {
                              const romanisation = await romanizeDocument({
                                ...doc,
                                romanisation: {},
                              });
                              update((session) =>
                                session.lyrics[id]?.id === original
                                  ? {
                                      ...session,
                                      lyrics: {
                                        ...session.lyrics,
                                        [id]: {
                                          ...session.lyrics[id],
                                          romanisation,
                                        },
                                      },
                                    }
                                  : session,
                              );
                              notify(
                                "Romanization refreshed locally. Original lyrics and timing are preserved.",
                              );
                            });
                          }}
                          applyTranslation={(id, values) =>
                            update((session) => {
                              const original =
                                track && session.lyrics[track.id];
                              return track && original?.id === id
                                ? {
                                    ...session,
                                    lyrics: {
                                      ...session.lyrics,
                                      [track.id]: {
                                        ...original,
                                        translation: values,
                                      },
                                    },
                                  }
                                : session;
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                  <button
                    className="subtle"
                    disabled={!track || busy}
                    onClick={() => void attach("original")}
                  >
                    <Upload size={16} />
                    {doc ? "Replace original" : "Attach lyrics"}
                  </button>
                </div>
              </div>
              {!doc ? (
                <div className="empty lyric-empty">
                  {lyricLookup.status === "loading" ? (
                    <>
                      <Loader2 size={36} className="spin" />
                      <h2>Looking up lyrics…</h2>
                      <p>Searching LRCLIB for {track?.title}.</p>
                    </>
                  ) : lyricLookup.status === "error" ? (
                    <>
                      <WifiOff size={36} />
                      <h2>Lookup failed</h2>
                      <p>{lyricLookup.message}</p>
                      <button
                        className="primary"
                        disabled={!track}
                        onClick={() => {
                          if (!track) return;
                          setLyricRetry((n) => n + 1);
                        }}
                      >
                        <RefreshCw size={16} />
                        Retry
                      </button>
                      <button
                        className="subtle"
                        disabled={!track || busy}
                        onClick={() => void attach("original")}
                      >
                        <Upload size={16} />
                        Attach lyrics manually instead
                      </button>
                    </>
                  ) : lyricLookup.status === "not_found" ? (
                    <>
                      <Wifi size={36} />
                      <h2>No lyrics found</h2>
                      <p>
                        No lyrics are available for this track yet.
                        <br />
                        Attach an LRC or text file manually.
                      </p>
                      <button
                        className="subtle"
                        disabled={!track}
                        onClick={() => setLyricRetry((n) => n + 1)}
                      >
                        <RefreshCw size={16} />
                        Retry lookup
                      </button>
                      <button
                        className="primary"
                        disabled={!track || busy}
                        onClick={() => void attach("original")}
                      >
                        <Upload size={16} />
                        Attach lyrics manually
                      </button>
                      <button
                        className="subtle"
                        disabled={!track}
                        onClick={markInstrumental}
                      >
                        Mark as instrumental
                      </button>
                    </>
                  ) : (
                    <>
                      <FileText size={36} />
                      <h2>The music has words. Bring them here.</h2>
                      <p>
                        Lyrics are looked up automatically when you play a
                        track.
                        <br />
                        Or attach an LRC or text file manually.
                      </p>
                      <button
                        className="primary"
                        disabled={!track || busy}
                        onClick={() => void attach("original")}
                      >
                        <Plus size={17} />
                        Attach original lyrics
                      </button>
                      <button
                        className="subtle"
                        disabled={!track}
                        onClick={markInstrumental}
                      >
                        Mark as instrumental
                      </button>
                    </>
                  )}
                </div>
              ) : doc.instrumental ? (
                <div className="empty">
                  <Music2 size={36} />
                  <h2>Let the music speak.</h2>
                  <p>You marked this recording as instrumental.</p>
                  <button
                    className="subtle"
                    onClick={() => void attach("original")}
                  >
                    Attach lyrics instead
                  </button>
                </div>
              ) : (
                <>
                  <p className="lyric-timing-status" role="status">
                    {lyricSynced
                      ? "Synced lyrics"
                      : session.settings.estimatedScroll
                        ? "Not synced · Estimated autoscroll"
                        : "Not synced · Manual scrolling"}
                  </p>
                  <div className="lyric-provenance">
                    <span>
                      Original · {doc.fileName}
                      {doc.source?.provider === "lrclib" &&
                        Number.isSafeInteger(doc.source.recordId) && (
                          <>
                            {" · "}
                            <a
                              href={`https://lrclib.net/tracks/${doc.source.recordId}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {doc.source.title} · {doc.source.artist}
                            </a>
                          </>
                        )}
                    </span>
                    <button onClick={() => void attach("romanisation")}>
                      {Object.keys(doc.romanisation).length
                        ? "Replace"
                        : "Attach"}{" "}
                      supplied Latin
                    </button>
                    <button onClick={() => void attach("translation")}>
                      {Object.keys(doc.translation).length
                        ? "Replace"
                        : "Attach"}{" "}
                      supplied English
                    </button>
                  </div>
                  {doc.warnings
                    .filter(
                      (w) => !w.startsWith("The selected lyric recording is "),
                    )
                    .map((w, i) => (
                      <p className="parser-warning" key={i}>
                        {w}
                      </p>
                    ))}
                  <div
                    className={`lyric-lines ${lyricSynced ? "" : "unsynced"}`}
                    style={
                      {
                        "--lyric-size": `${session.settings.lyricSize}px`,
                      } as React.CSSProperties
                    }
                    onWheel={() => setFollow(false)}
                    onTouchMove={() => setFollow(false)}
                  >
                    {doc.lines.map((line) => (
                      <button
                        key={line.id}
                        ref={line.id === followTarget ? activeRef : undefined}
                        className={`lyric-line ${active === line.id ? "is-active" : ""}`}
                        disabled={!lyricSynced || line.time === null}
                        onClick={() =>
                          player.seek(
                            Math.max(
                              0,
                              (line.time! + doc.fileOffset + doc.userOffset) /
                                1000,
                            ),
                          )
                        }
                        aria-label={
                          lyricSynced && line.time !== null
                            ? `Seek to ${clock((line.time + doc.fileOffset + doc.userOffset) / 1000)}: ${line.text}`
                            : line.text
                        }
                      >
                        {lyricLayers(doc, line, session.settings).map(
                          (layer, index) => (
                            <span
                              key={layer.kind}
                              className={`lyric-${layer.kind} ${index === 0 ? "lyric-primary" : ""}`}
                              lang={
                                layer.kind === "translation"
                                  ? "en"
                                  : layer.kind === "roman"
                                    ? "und-Latn"
                                    : /[\u0b80-\u0bff]/.test(line.text)
                                      ? "ta"
                                      : /[\u0900-\u097f]/.test(line.text)
                                        ? "und-Deva"
                                        : undefined
                              }
                              dir="auto"
                            >
                              {layer.text}
                            </span>
                          ),
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="lyric-bottom">
                    {lyricSynced && (
                      <>
                        <label>
                          Timing{" "}
                          <input
                            aria-label="Lyric timing offset in milliseconds"
                            type="number"
                            step={50}
                            min={-60000}
                            max={60000}
                            value={doc.userOffset}
                            onChange={(e) => {
                              const offset = Math.min(
                                60000,
                                Math.max(-60000, Number(e.target.value)),
                              );
                              update((s) => ({
                                ...s,
                                lyrics: {
                                  ...s.lyrics,
                                  [track!.id]: { ...doc, userOffset: offset },
                                },
                              }));
                            }}
                          />{" "}
                          ms
                        </label>
                        <span>
                          Positive = later · File offset {doc.fileOffset} ms
                        </span>
                      </>
                    )}
                    {!lyricSynced && (
                      <span>
                        {session.settings.estimatedScroll
                          ? "Scrolling is estimated from playback progress."
                          : "Estimated scrolling is off."}
                      </span>
                    )}
                    <button
                      className="subtle"
                      disabled={
                        !lyricSynced && !session.settings.estimatedScroll
                      }
                      onClick={() => setFollow((x) => !x)}
                    >
                      {!lyricSynced && !session.settings.estimatedScroll
                        ? "Manual scrolling"
                        : follow
                          ? "Following playback"
                          : "Resume following"}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
          {ready && view === "discover" && !mobile && (
            <section className="discover-page">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">SEARCH YOUTUBE FOR MUSIC</p>
                  <h1>
                    Discover new music<span className="heading-dot">.</span>
                  </h1>
                  <p className="subtitle">
                    {ytdlpAvailable
                      ? "Search YouTube and stream audio using yt-dlp. For personal, non-commercial use."
                      : "yt-dlp is required. Install yt-dlp and restart the app."}
                  </p>
                </div>
              </div>
              {!ytdlpAvailable && (
                <div className="banner error" role="alert">
                  <span>
                    yt-dlp not found. Please install yt-dlp
                    (https://github.com/yt-dlp/yt-dlp) and place yt-dlp.exe in
                    the same folder as Lumaire, or ensure it's available in your
                    system PATH.
                  </span>
                </div>
              )}
              <section className="library-tools">
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Search YouTube"
                    placeholder="Search for music, artist, or song"
                    value={discoveryQuery}
                    disabled={!ytdlpAvailable || discoverySearching}
                    onChange={(e) => setDiscoveryQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        discoveryQuery.trim() &&
                        ytdlpAvailable
                      ) {
                        e.preventDefault();
                        setDiscoverySearching(true);
                        setDiscoveryError("");
                        library
                          .ytdlpSearch(discoveryQuery.trim(), 20)
                          .then((results) => {
                            setDiscoveryResults(results);
                            setDiscoverySearching(false);
                            if (results.length === 0) {
                              setDiscoveryError(
                                "No results found. Try different keywords.",
                              );
                            }
                          })
                          .catch((err) => {
                            setDiscoveryError(formatError(err));
                            setDiscoverySearching(false);
                          });
                      }
                    }}
                  />
                  {discoveryQuery && (
                    <button
                      aria-label="Clear search"
                      onClick={() => {
                        setDiscoveryQuery("");
                        setDiscoveryResults([]);
                        setDiscoveryError("");
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </label>
                <button
                  className="primary"
                  disabled={
                    discoverySearching ||
                    !discoveryQuery.trim() ||
                    !ytdlpAvailable
                  }
                  onClick={() => {
                    setDiscoverySearching(true);
                    setDiscoveryError("");
                    library
                      .ytdlpSearch(discoveryQuery.trim(), 20)
                      .then((results) => {
                        setDiscoveryResults(results);
                        setDiscoverySearching(false);
                        if (results.length === 0) {
                          setDiscoveryError(
                            "No results found. Try different keywords.",
                          );
                        }
                      })
                      .catch((err) => {
                        setDiscoveryError(formatError(err));
                        setDiscoverySearching(false);
                      });
                  }}
                >
                  {discoverySearching ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Searching…
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      Search
                    </>
                  )}
                </button>
              </section>
              {discoveryError && (
                <div className="banner error" role="alert">
                  <span>{discoveryError}</span>
                  <IconButton
                    label="Dismiss error"
                    onClick={() => setDiscoveryError("")}
                  >
                    <X size={16} />
                  </IconButton>
                </div>
              )}
              {!discoveryResults.length &&
                !discoverySearching &&
                !discoveryError &&
                ytdlpAvailable && (
                  <div className="empty">
                    <Globe size={36} />
                    <h2>Search YouTube</h2>
                    <p>
                      Find and stream music from YouTube.
                      <br />
                      Stream URLs expire after a few hours. For personal,
                      non-commercial use only.
                    </p>
                  </div>
                )}
              {discoverySearching && (
                <div className="empty">
                  <Loader2 size={36} className="spin" />
                  <h2>Searching YouTube…</h2>
                </div>
              )}
              {discoveryResults.length > 0 && (
                <>
                  <div className="track-header">
                    <span>#</span>
                    <span>TRACK / CHANNEL</span>
                    <span>SOURCE</span>
                    <span>TIME</span>
                    <span />
                  </div>
                  <div className="track-list">
                    {discoveryResults.map((t, index) => (
                      <div className="track-row" key={t.id}>
                        <button
                          className="track-play"
                          aria-label={`Play ${t.title}`}
                          disabled={busy}
                          onClick={() => void saveDiscovery(t, "play")}
                        >
                          <span className="track-index">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <Play className="row-play" size={15} />
                        </button>
                        <button
                          className="track-meta"
                          onClick={() =>
                            window.open(
                              `https://www.youtube.com/watch?v=${t.id}`,
                              "_blank",
                            )
                          }
                        >
                          <Artwork
                            url={t.thumbnail}
                            className={`color-${index % 5}`}
                          />
                          <span>
                            <strong dir="auto">{t.title}</strong>
                            <small dir="auto">
                              {t.channel || "Unknown Channel"}
                            </small>
                          </span>
                        </button>
                        <span className="album ellipsis" title="YouTube">
                          YouTube
                        </span>
                        <span className="duration">
                          {t.duration ? clock(t.duration) : "—"}
                        </span>
                        <div className="track-actions">
                          <IconButton
                            label={`View ${t.title} on YouTube`}
                            onClick={() =>
                              window.open(
                                `https://www.youtube.com/watch?v=${t.id}`,
                                "_blank",
                              )
                            }
                          >
                            <ExternalLink size={17} />
                          </IconButton>
                          <details className="track-menu">
                            <summary aria-label={`Actions for ${t.title}`}>
                              •••
                            </summary>
                            <div className="menu-popover">
                              <button
                                disabled={busy}
                                onClick={() => void saveDiscovery(t, "save")}
                              >
                                Save to library
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => void saveDiscovery(t, "next")}
                              >
                                Play next
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => void saveDiscovery(t, "queue")}
                              >
                                Add to queue
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => choosePlaylist(youtubeTrack(t))}
                              >
                                Save to playlist
                              </button>
                              <button
                                disabled={
                                  downloads[`youtube:${t.id}`] === "downloading"
                                }
                                onClick={() =>
                                  void downloadTrack(youtubeTrack(t))
                                }
                              >
                                {downloads[`youtube:${t.id}`] === "downloading"
                                  ? "Downloading…"
                                  : "Download for offline"}
                              </button>
                            </div>
                          </details>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="library-footer">
                    <span className="small-dot" /> Results from YouTube ·{" "}
                    {discoveryResults.length} tracks · URLs expire after a few
                    hours
                  </p>
                </>
              )}
            </section>
          )}
          {ready && view === "discover" && (
            <>
              {mobile && (
                <section className="settings-card">
                  <h2>Android prototype</h2>
                  <p>
                    Play local files or open music from Commons. YouTube
                    playback and downloads need an Android resolver and are not
                    available yet.
                  </p>
                </section>
              )}
              <CommonsDiscovery
                save={(track, play) => void saveCommons(track, play)}
                download={(track) => void downloadTrack(track)}
                queue={queueRemote}
                playlist={choosePlaylist}
                pending={downloads}
              />
            </>
          )}
          {ready && view === "settings" && (
            <section className="settings-page">
              <p className="eyebrow">A PLAYER THAT'S YOURS</p>
              <h1>
                Keep it personal<span className="heading-dot">.</span>
              </h1>
              <p className="subtitle">
                Your music stays on your device. You stay in control.
              </p>
              <div className="settings-card">
                <h2>Library & portability</h2>
                <p>
                  SQLite stores your library, collections, queue, supplied lyric
                  text and preferences locally. Restored playback always starts
                  paused.
                </p>
                <div className="button-row">
                  <button
                    className="subtle"
                    disabled={busy || mobile}
                    onClick={() =>
                      void action(async () => {
                        persist();
                        if (
                          await library.export({
                            ...sessionRef.current,
                            position: playback.time,
                          })
                        )
                          notify(
                            "Library exported. Audio, lyric text, history and absolute paths were excluded.",
                          );
                      })
                    }
                  >
                    <Download size={16} />
                    Export library
                  </button>
                  <button
                    className="subtle"
                    disabled={busy || mobile}
                    onClick={() =>
                      ask(
                        "Import library backup",
                        "Type IMPORT to replace playlists, queue and settings from a backup. Existing audio entries are kept.",
                        "",
                        (value) => {
                          if (value === "IMPORT")
                            void action(async () => {
                              suspendPersistence.current = true;
                              if (persistTimer.current)
                                clearTimeout(persistTimer.current);
                              await saveChain.current;
                              let snapshot;
                              try {
                                snapshot = await library.import();
                              } finally {
                                suspendPersistence.current = false;
                              }
                              if (!snapshot) return;
                              player.stop();
                              const restored = restoreSession(
                                snapshot.session,
                                snapshot.tracks,
                              );
                              setTracks(snapshot.tracks);
                              setSession(restored);
                              const c = restored.queue.find(
                                (i) => i.id === restored.currentId,
                              );
                              if (c)
                                void player.load(
                                  c.trackId,
                                  false,
                                  restored.position,
                                );
                              notify(
                                "Backup imported. New tracks need explicit relinking.",
                              );
                            });
                        },
                      )
                    }
                  >
                    <Upload size={16} />
                    Import backup
                  </button>
                </div>
                <small>
                  {mobile
                    ? "Android backup import and export are not enabled in this prototype yet. Your library is stored on this device."
                    : "Backups contain metadata and settings. Audio and lyric text are excluded. Files imported on another device require Relink."}
                </small>
              </div>
              <div className="settings-card">
                <h2>Privacy</h2>
                <label className="switch-row">
                  <span>
                    Keep a local completed-track history
                    <small>Nothing is sent to an external service.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={session.settings.historyEnabled}
                    onChange={(e) =>
                      setting("historyEnabled", e.target.checked)
                    }
                  />
                </label>
                <div className="button-row">
                  <button
                    className="subtle"
                    onClick={() => {
                      update((s) => ({ ...s, history: [] }));
                      notify("Local listening history cleared");
                    }}
                  >
                    Clear history ({session.history.length})
                  </button>
                  <button
                    className="subtle"
                    onClick={() =>
                      ask(
                        "Clear supplied lyric cache",
                        "Type CLEAR to remove locally attached original and supplied lyric text. Audio files stay on disk.",
                        "",
                        (value) => {
                          if (value === "CLEAR") {
                            update((s) => ({ ...s, lyrics: {} }));
                            notify("Local lyric cache cleared");
                          }
                        },
                      )
                    }
                  >
                    Clear lyric cache
                  </button>
                </div>
              </div>
              <div className="settings-card">
                <h2>Offline downloads</h2>
                <p>
                  Only explicitly downloaded, licensed audio is stored here.
                  External local files are never deleted by these controls.
                </p>
                {Object.entries(downloads)
                  .filter(([, status]) => status !== "complete")
                  .map(([id, status]) => (
                    <div className="source-row" key={id}>
                      <span>
                        {tracks.find((track) => track.id === id)?.title ||
                          "Audio download"}{" "}
                        · {status === "downloading" ? "Downloading…" : status}
                      </span>
                      {status === "downloading" ? (
                        <button onClick={() => void library.cancelDownload(id)}>
                          Cancel download
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const track = tracks.find(
                              (track) => track.id === id,
                            );
                            if (track) void downloadTrack(track);
                          }}
                        >
                          Retry download
                        </button>
                      )}
                    </div>
                  ))}
                {tracks
                  .filter((track) => track.offline)
                  .map((track) => (
                    <div className="source-row" key={track.id}>
                      <span>{track.title} · Available offline</span>
                      <button onClick={() => deleteOffline(track)}>
                        Delete offline copy
                      </button>
                    </div>
                  ))}
              </div>
              <div className="settings-card">
                <h2>Sources</h2>
                <div className="source-row">
                  <span className="source-symbol">
                    <FolderOpen size={20} />
                  </span>
                  <div>
                    <strong>Local files</strong>
                    <p>Selected files only · Offline playback · No account</p>
                  </div>
                  <span className="source-status">Enabled</span>
                </div>
                <div className="source-row">
                  <span className="source-symbol">
                    <Globe size={20} />
                  </span>
                  <div>
                    <strong>YouTube (via yt-dlp)</strong>
                    <p>
                      Search and stream · URLs expire · Personal, non-commercial
                      use only
                    </p>
                  </div>
                  <span className="source-status">
                    {ytdlpAvailable ? "Enabled" : "Not Available"}
                  </span>
                </div>
                <p>
                  YouTube streaming requires yt-dlp. Stream URLs expire after a
                  few hours. Use is subject to YouTube Terms of Service. For
                  personal, non-commercial use only. Local files work
                  independently and offline.
                </p>
              </div>
              <div className="settings-card">
                <h2>Keyboard & playback</h2>
                <p>
                  <kbd>Space</kbd> Play / pause{" "}
                  <span className="shortcut-gap" />
                  <kbd>Alt</kbd> + <kbd>→</kbd> Next{" "}
                  <span className="shortcut-gap" />
                  <kbd>Alt</kbd> + <kbd>←</kbd> Previous
                </p>
                <p>
                  Use Tab and Enter for all controls. Shortcuts leave text
                  inputs alone. Lyrics follow the actual audio clock; scroll
                  away to read at your own pace.
                </p>
                <small>
                  Format compatibility depends on your Windows codecs. Playback
                  errors keep the queue intact. No gapless or bit-perfect claim.
                </small>
              </div>
              <p className="about">
                Lumaire 0.1.0 · Original local-first application
                <br />
                Built with React, TypeScript, Vite, Tauri 2, Rust and SQLite.
                Software notices are included in the project.
              </p>
            </section>
          )}
        </main>
      </div>
      {queueOpen && (
        <aside className="queue-pane">
          <header>
            <h2>
              Up next{" "}
              <span>
                {
                  session.queue.slice(
                    session.queue.findIndex(
                      (entry) => entry.id === session.currentId,
                    ) + 1,
                  ).length
                }
              </span>
            </h2>
            <IconButton label="Hide queue" onClick={() => setQueueOpen(false)}>
              <PanelRightClose size={18} />
            </IconButton>
          </header>
          <div className="queue-caption">YOUR LISTENING SESSION</div>
          <div className="queue-items">
            {session.queue.length ? (
              session.queue.map((entry, index) => {
                if (
                  index <
                  session.queue.findIndex(
                    (entry) => entry.id === session.currentId,
                  )
                )
                  return null;
                const t = listeningTracks.find((t) => t.id === entry.trackId);
                if (!t) return null;
                return (
                  <div
                    key={entry.id}
                    className={`queue-entry ${entry.id === session.currentId ? "current" : ""}`}
                  >
                    <button
                      className="queue-select"
                      aria-label={`Play queued ${t.title}`}
                      onClick={() => selectQueue(entry.id, true)}
                    >
                      <Artwork
                        url={t.artworkUrl}
                        className={`color-${index % 5}`}
                      />
                      <span>
                        <strong dir="auto">{t.title}</strong>
                        <small>
                          {entry.id === session.currentId
                            ? "Now playing"
                            : t.artist}
                        </small>
                      </span>
                    </button>
                    <div className="queue-controls">
                      <IconButton
                        label={`Move ${t.title} up`}
                        disabled={
                          entry.id === session.currentId ||
                          index <=
                            session.queue.findIndex(
                              (entry) => entry.id === session.currentId,
                            ) +
                              1
                        }
                        onClick={() =>
                          update((s) => reorderUpcoming(s, entry.id, -1))
                        }
                      >
                        <ArrowUp size={13} />
                      </IconButton>
                      <IconButton
                        label={`Move ${t.title} down`}
                        disabled={
                          entry.id === session.currentId ||
                          index === session.queue.length - 1
                        }
                        onClick={() =>
                          update((s) => reorderUpcoming(s, entry.id, 1))
                        }
                      >
                        <ArrowDown size={13} />
                      </IconButton>
                      <IconButton
                        label={`Remove queued ${t.title}`}
                        onClick={() => removeQueue(entry.id)}
                      >
                        <X size={14} />
                      </IconButton>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="queue-empty">
                <ListMusic size={28} />
                <p>
                  A good listening session
                  <br />
                  starts with one song.
                </p>
              </div>
            )}
          </div>
          <footer>
            {undo && (
              <button
                className="subtle"
                onClick={() => {
                  update((s) => ({ ...s, queue: undo }));
                  setUndo(null);
                }}
              >
                Undo removal
              </button>
            )}
            <button
              className="subtle"
              disabled={
                !session.queue.slice(
                  session.queue.findIndex(
                    (entry) => entry.id === session.currentId,
                  ) + 1,
                ).length
              }
              onClick={() => {
                setUndo(session.queue);
                update((s) => ({
                  ...s,
                  queue: s.queue.filter((entry) => entry.id === s.currentId),
                }));
              }}
            >
              Clear queue
            </button>
            <p>One song. Then another.</p>
          </footer>
        </aside>
      )}
      <footer className="transport" aria-label="Playback controls">
        <div className="now-playing">
          <Artwork url={track?.artworkUrl} className="transport-cover" />
          <div>
            <strong dir="auto">
              {track?.title ?? "Room for a little music"}
            </strong>
            <small dir="auto">
              {track?.artist ?? "Choose a track to begin"}
              {track
                ? ` · ${track.offline ? "Offline download" : track.source ? "Online" : "Local"} ${track.format}`
                : ""}
            </small>
          </div>
          {track && !tracks.some((saved) => saved.id === track.id) && (
            <button
              className="subtle save-current"
              disabled={busy}
              title="Keep this online source in your library. Audio is not downloaded."
              onClick={() =>
                void action(async () => {
                  await saveOnline(track);
                  notify("Saved to library · Internet required for streaming");
                })
              }
            >
              <Plus size={16} /> Save
            </button>
          )}
          {track && tracks.some((saved) => saved.id === track.id) && (
            <IconButton
              label="Favorite current track"
              active={session.favorites.includes(track.id)}
              onClick={() => favorite(track.id)}
            >
              <Heart
                size={17}
                fill={
                  session.favorites.includes(track.id) ? "currentColor" : "none"
                }
              />
            </IconButton>
          )}
          {track?.source && !track.offline && (
            <IconButton
              label="Download current track for offline"
              disabled={downloads[track.id] === "downloading"}
              onClick={() => void downloadTrack(track)}
            >
              <Download size={17} />
            </IconButton>
          )}
          {track && (
            <details className="track-menu current-track-menu">
              <summary aria-label="Current song actions">•••</summary>
              <div className="menu-popover">
                <button disabled={busy} onClick={() => choosePlaylist(track)}>
                  Save to playlist
                </button>
                {track.source &&
                  !track.offline &&
                  (downloads[track.id] === "downloading" ? (
                    <button
                      onClick={() =>
                        void action(() => library.cancelDownload(track.id))
                      }
                    >
                      Cancel download
                    </button>
                  ) : (
                    <button onClick={() => void downloadTrack(track)}>
                      Download for offline
                    </button>
                  ))}
                {track.offline && (
                  <button onClick={() => deleteOffline(track)}>
                    Delete offline copy
                  </button>
                )}
                <small>
                  Download only content you’re permitted to download. Saved
                  sources need internet; downloaded audio plays offline.
                </small>
              </div>
            </details>
          )}
        </div>
        <div className="player-center">
          <div className="player-buttons">
            <IconButton
              label="Shuffle"
              active={session.settings.shuffle}
              onClick={() => setting("shuffle", !session.settings.shuffle)}
            >
              <Shuffle size={17} />
            </IconButton>
            <IconButton
              label="Previous track"
              disabled={!track}
              onClick={() => skip(-1)}
            >
              <SkipBack size={19} fill="currentColor" />
            </IconButton>
            <button
              className="play-button"
              aria-label={
                playback.status === "playing" || playback.status === "buffering"
                  ? "Pause"
                  : "Play"
              }
              disabled={
                (!track && !tracks.length) || playback.status === "loading"
              }
              onClick={togglePlay}
            >
              {playback.status === "playing" ||
              playback.status === "buffering" ? (
                <Pause size={21} fill="currentColor" />
              ) : (
                <Play size={21} fill="currentColor" />
              )}
            </button>
            <IconButton
              label="Next track"
              disabled={!track}
              onClick={() => skip(1)}
            >
              <SkipForward size={19} fill="currentColor" />
            </IconButton>
            <IconButton
              label={`Repeat: ${session.settings.repeat}`}
              active={session.settings.repeat !== "off"}
              onClick={() =>
                setting(
                  "repeat",
                  session.settings.repeat === "off"
                    ? "all"
                    : session.settings.repeat === "all"
                      ? "one"
                      : "off",
                )
              }
            >
              {session.settings.repeat === "one" ? (
                <Repeat1 size={17} />
              ) : (
                <Repeat size={17} />
              )}
            </IconButton>
          </div>
          <div className="seek-row">
            <span data-testid="elapsed">{clock(playback.time)}</span>
            <input
              aria-label="Seek playback"
              type="range"
              min={0}
              max={playback.duration || 1}
              step={0.1}
              disabled={!playback.duration}
              value={Math.min(playback.time, playback.duration || 1)}
              onChange={(e) => {
                player.seek(Number(e.target.value));
                persist();
              }}
            />
            <span>{clock(playback.duration)}</span>
          </div>
        </div>
        <div className="player-right">
          <span className="playback-state" data-testid="playback-state">
            {playback.status === "idle" ? "Ready" : playback.status}
          </span>
          <IconButton
            label="Open lyrics"
            active={view === "lyrics"}
            onClick={() => setView("lyrics")}
          >
            <FileText size={18} />
          </IconButton>
          <Volume2 size={18} />
          <input
            aria-label="Volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={session.settings.volume}
            onChange={(e) => setting("volume", Number(e.target.value))}
          />
        </div>
      </footer>
      <dialog
        ref={dialogRef}
        onCancel={() => {
          setDialog(null);
          setVariant(null);
          setPlaylistTarget(null);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setDialog(null);
            setVariant(null);
            setPlaylistTarget(null);
          }
        }}
      >
        {playlistTarget && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const name = dialogValue.trim();
              if (name)
                void addOnlineToPlaylist(
                  playlistTarget,
                  crypto.randomUUID(),
                  name,
                );
            }}
          >
            <p className="eyebrow">YOUR COLLECTION</p>
            <h2>Save to playlist</h2>
            <p dir="auto">{playlistTarget.title}</p>
            <div className="playlist-choices">
              {session.playlists.map((playlist) => (
                <button
                  className="subtle"
                  type="button"
                  disabled={busy}
                  key={playlist.id}
                  onClick={() =>
                    void addOnlineToPlaylist(playlistTarget, playlist.id)
                  }
                >
                  {playlist.name}
                </button>
              ))}
            </div>
            <label>
              New playlist name
              <input
                autoFocus
                maxLength={100}
                value={dialogValue}
                onChange={(event) => setDialogValue(event.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button
                className="subtle"
                type="button"
                onClick={() => setPlaylistTarget(null)}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={busy || !dialogValue.trim()}
              >
                Create and save
              </button>
            </div>
          </form>
        )}
        {dialog && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = dialogValue.trim();
              if (value) {
                dialog.submit(value);
                setDialog(null);
              }
            }}
          >
            <p className="eyebrow">YOUR COLLECTION</p>
            <h2>{dialog.title}</h2>
            <label>
              {dialog.label}
              <input
                autoFocus
                maxLength={100}
                value={dialogValue}
                onChange={(e) => setDialogValue(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                className="subtle"
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button className="primary" disabled={!dialogValue.trim()}>
                Confirm
              </button>
            </div>
          </form>
        )}
        {variant && (
          <div>
            <p className="eyebrow">SUPPLIED TEXT · LOCAL ONLY</p>
            <h2>Confirm line alignment</h2>
            <p>
              Check that each supplied row belongs to the original line beside
              it. This preserves the original timestamps and line IDs.
            </p>
            <div className="variant-preview">
              {variant.original.lines.map((l, i) => (
                <div key={l.id}>
                  <span dir="auto">{l.text}</span>
                  <span dir="auto">{variant.doc.lines[i]?.text}</span>
                </div>
              ))}
            </div>
            <div className="dialog-actions">
              <button className="subtle" onClick={() => setVariant(null)}>
                Cancel
              </button>
              <button className="primary" onClick={confirmVariant}>
                Confirm matching lines
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
