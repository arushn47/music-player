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
import { library, desktop, type RemoteTrack, type YtdlpSearchResult } from "./adapters/native";
import { lookupLyrics, type LookupState } from "./adapters/lrclib";
import { activeLine, alignVariant, parseLyrics } from "./domain/lyrics";
import { advance, move } from "./domain/queue";
import { restoreSession } from "./domain/session";
import {
  defaults,
  item,
  type LyricDocument,
  type Session,
  type Track,
} from "./domain/types";
import { PlaybackController, type Playback } from "./player/controller";
import { getCurrentWindow } from "@tauri-apps/api/window";

const player = new PlaybackController(async (id) => {
  // Check if this is a YouTube track (format: youtube:videoId)
  if (id.startsWith("youtube:")) {
    const videoId = id.split(":")[1];
    const stream = await library.ytdlpGetStream(videoId);
    return stream.streamUrl;
  }
  // Check if this is a Commons track (format: wikimedia-commons:sourceId)
  if (id.startsWith("wikimedia-commons:")) {
    const sourceId = id.split(":")[1];
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
type View = "library" | "favorites" | "lyrics" | "settings" | "discover" | string;
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
    [follow, setFollow] = useState(true);
  const [variant, setVariant] = useState<{
    doc: LyricDocument;
    kind: "romanisation" | "translation";
    trackId: string;
    original: LyricDocument;
  } | null>(null);
  const [undo, setUndo] = useState<Session["queue"] | null>(null);
  const [lyricLookup, setLyricLookup] = useState<LookupState>({ status: "idle" });
  // Track which track ID we last triggered a lookup for, to avoid double-firing.
  const lastLookupId = useRef<string | null>(null);
  // Discovery state
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryResults, setDiscoveryResults] = useState<YtdlpSearchResult[]>([]);
  const [discoverySearching, setDiscoverySearching] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [ytdlpAvailable, setYtdlpAvailable] = useState(false);
  const current = session.queue.find((i) => i.id === session.currentId),
    track = tracks.find((t) => t.id === current?.trackId),
    doc = track ? session.lyrics[track.id] : undefined;
  const sessionRef = useRef(session),
    readyRef = useRef(false),
    saveChain = useRef(Promise.resolve()),
    persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    suspendPersistence = useRef(false);
  const activeRef = useRef<HTMLButtonElement | null>(null),
    dialogRef = useRef<HTMLDialogElement>(null),
    previousFocus = useRef<HTMLElement | null>(null);
  sessionRef.current = session;
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
    const s = { ...sessionRef.current, position: player.state.time };
    saveChain.current = saveChain.current
      .then(() => library.save(s))
      .catch((e) =>
        setError(`Your latest changes could not be saved. ${formatError(e)}`),
      );
  }
  useEffect(() => {
    if (!desktop) return;
    const unsubscribe = getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      if (!readyRef.current) {
        await getCurrentWindow().destroy();
        return;
      }
      player.pause();
      const latest = { ...sessionRef.current, position: player.state.time };
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
    const unsubscribe = player.subscribe(setPlayback);
    library
      .load()
      .then((snapshot) => {
        const restored = restoreSession(snapshot.session, snapshot.tracks);
        setTracks(snapshot.tracks);
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
    library.ytdlpCheckAvailable().then(setYtdlpAvailable).catch(() => setYtdlpAvailable(false));
    
    const timer = setInterval(persist, 2000);
    const onHidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      unsubscribe();
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
  // Auto-lookup effect: fires whenever the current track changes.
  useEffect(() => {
    if (!ready || !track) {
      setLyricLookup({ status: "idle" });
      return;
    }
    const id = track.id;
    // If we already have lyrics stored for this track, surface them directly.
    const cached = sessionRef.current.lyrics[id];
    if (cached) {
      setLyricLookup({ status: "found", doc: cached });
      return;
    }
    // Avoid re-fetching the same track (e.g. seek/pause triggers re-render).
    if (lastLookupId.current === id) return;
    lastLookupId.current = id;
    setLyricLookup({ status: "loading" });
    lookupLyrics(track).then((result) => {
      // Ignore if the track changed while we were awaiting.
      if (lastLookupId.current !== id) return;
      setLyricLookup(result);
      if (result.status === "found") {
        // Persist auto-fetched lyrics into session so they survive restart.
        update((s) => ({ ...s, lyrics: { ...s.lyrics, [id]: result.doc } }));
      } else if (result.status === "instrumental") {
        // Mark as instrumental in session so we don't query again on restart.
        update((s) => ({
          ...s,
          lyrics: {
            ...s.lyrics,
            [id]: {
              id: crypto.randomUUID(),
              raw: "",
              fileName: "Instrumental · LRCLIB",
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
    });
  }, [track?.id, ready]);

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
  const active = doc ? activeLine(doc, playback.time * 1000) : null;
  useEffect(() => {
    if (follow && view === "lyrics")
      activeRef.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
  }, [active, follow, view]);
  useEffect(() => {
    if (dialog || variant) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
      previousFocus.current?.focus();
    }
  }, [dialog, variant]);
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
    update((s) => ({ ...s, currentId: id, position: 0 }));
    void player.load(selected.trackId, autoplay);
    setFollow(true);
  }
  function playTrack(t: Track) {
    const queued = sessionRef.current.queue.find((i) => i.trackId === t.id);
    if (queued) {
      selectQueue(queued.id, true);
      return;
    }
    const entry = item(t.id);
    update((s) => ({
      ...s,
      queue: [...s.queue, entry],
      currentId: entry.id,
      position: 0,
    }));
    void player.load(t.id, true);
    setFollow(true);
  }
  function togglePlay() {
    if (!track) {
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
      if (!sessionRef.current.queue.length) {
        const queue = result.tracks.map((t) => item(t.id));
        update((s) => ({ ...s, queue, currentId: queue[0].id, position: 0 }));
        void player.load(queue[0].trackId, false);
      }
      notify(
        `${added.length} ${added.length === 1 ? "track" : "tracks"} added${result.tracks.length > added.length ? ` · ${result.tracks.length - added.length} already in your library` : ""}${result.warnings.length ? ` · ${result.warnings.join(" ")}` : ""}`,
      );
    });
  }
  const favorite = (id: string) =>
    update((s) => ({
      ...s,
      favorites: s.favorites.includes(id)
        ? s.favorites.filter((f) => f !== id)
        : [...s.favorites, id],
    }));
  function queueTrack(id: string, next = false) {
    const entry = item(id);
    update((s) => {
      const queue = [...s.queue];
      const index = queue.findIndex((i) => i.id === s.currentId);
      queue.splice(next ? index + 1 : queue.length, 0, entry);
      return { ...s, queue };
    });
    notify(next ? "Added to play next" : "Added to queue");
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
  const playlist = session.playlists.find((p) => p.id === view);
  const visible = tracks.filter(
    (t) =>
      (view !== "favorites" || session.favorites.includes(t.id)) &&
      (!playlist || playlist.items.some((i) => i.trackId === t.id)) &&
      `${t.title} ${t.artist} ${t.album}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const heading =
    view === "favorites"
      ? "Your favorites"
      : playlist
        ? playlist.name
        : "Your library";
  const rows = playlist
    ? playlist.items.flatMap((entry) => {
        const t = visible.find((t) => t.id === entry.trackId);
        return t ? [{ t, entryId: entry.id }] : [];
      })
    : visible.map((t) => ({ t, entryId: t.id }));

  return (
    <div className={`app ${queueOpen ? "with-queue" : ""}`}>
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
            Library<span className="nav-count">{tracks.length}</span>
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
            (view === "library" || view === "favorites" || playlist) && (
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
                  <button
                    className="subtle"
                    disabled={busy}
                    onClick={() => void importMusic(true)}
                  >
                    <FolderOpen size={16} />
                    Add folder
                  </button>
                </section>
                {!tracks.length ? (
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
                            <span className={`cover color-${index % 5}`}>
                              <Music2 size={20} />
                            </span>
                            <span>
                              <strong dir="auto">{t.title}</strong>
                              <small dir="auto">
                                {t.artist}
                                {` · ${t.format}`}
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
                                <button onClick={() => queueTrack(t.id, true)}>
                                  Play next
                                </button>
                                <button onClick={() => queueTrack(t.id)}>
                                  Add to queue
                                </button>
                                <button onClick={() => void relink(t)}>
                                  <Link2 size={14} />
                                  Relink file
                                </button>
                                {session.playlists.map((p) => (
                                  <button
                                    key={p.id}
                                    onClick={() => {
                                      update((s) => ({
                                        ...s,
                                        playlists: s.playlists.map((x) =>
                                          x.id === p.id
                                            ? {
                                                ...x,
                                                items: [...x.items, item(t.id)],
                                              }
                                            : x,
                                        ),
                                      }));
                                      notify(`Added to ${p.name}`);
                                    }}
                                  >
                                    Add to {p.name}
                                  </button>
                                ))}
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
                      <span className="small-dot" /> Your library lives here. No
                      music leaves your device.
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
                <button
                  className="subtle"
                  disabled={!track || busy}
                  onClick={() => void attach("original")}
                >
                  <Upload size={16} />
                  {doc ? "Replace original" : "Attach lyrics"}
                </button>
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
                          lastLookupId.current = null;
                          setLyricLookup({ status: "loading" });
                          lookupLyrics(track, sessionRef.current.lyrics[track.id]).then((result) => {
                            setLyricLookup(result);
                            if (result.status === "found") {
                              update((s) => ({ ...s, lyrics: { ...s.lyrics, [track.id]: result.doc } }));
                            }
                          });
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
                        LRCLIB has no entry for this recording.
                        <br />
                        Attach an LRC or text file manually.
                      </p>
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
                  <div className="lyric-toolbar">
                    <label>
                      <input
                        type="checkbox"
                        checked={session.settings.romanisation}
                        onChange={(e) =>
                          setting("romanisation", e.target.checked)
                        }
                      />
                      Latin romanisation
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={session.settings.translation}
                        onChange={(e) =>
                          setting("translation", e.target.checked)
                        }
                      />
                      English meaning
                    </label>
                    <label className="font-control">
                      Aa{" "}
                      <input
                        aria-label="Lyric font size"
                        type="range"
                        min={18}
                        max={46}
                        value={session.settings.lyricSize}
                        onChange={(e) =>
                          setting("lyricSize", Number(e.target.value))
                        }
                      />
                    </label>
                  </div>
                  <div className="lyric-provenance">
                    <span>Original · {doc.fileName}</span>
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
                  {doc.warnings.map((w, i) => (
                    <p className="parser-warning" key={i}>
                      {w}
                    </p>
                  ))}
                  {!Object.keys(doc.romanisation).length &&
                    session.settings.romanisation && (
                      <p className="missing-layer">
                        Latin romanisation unavailable · attach supplied text
                        above.
                      </p>
                    )}
                  {!Object.keys(doc.translation).length &&
                    session.settings.translation && (
                      <p className="missing-layer">
                        English meaning unavailable · attach supplied text
                        above.
                      </p>
                    )}
                  <div
                    className="lyric-lines"
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
                        ref={line.id === active ? activeRef : undefined}
                        className={`lyric-line ${active === line.id ? "is-active" : ""}`}
                        disabled={line.time === null}
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
                          line.time !== null
                            ? `Seek to ${clock((line.time + doc.fileOffset + doc.userOffset) / 1000)}: ${line.text}`
                            : line.text
                        }
                      >
                        <span
                          className="lyric-original"
                          lang={
                            /[\u0B80-\u0BFF]/.test(line.text) ? "ta" : undefined
                          }
                          dir="auto"
                        >
                          {line.text || "♪"}
                        </span>
                        {session.settings.romanisation &&
                          doc.romanisation[line.id] && (
                            <span
                              className="lyric-roman"
                              lang="ta-Latn"
                              dir="auto"
                            >
                              {doc.romanisation[line.id]}
                            </span>
                          )}
                        {session.settings.translation &&
                          doc.translation[line.id] && (
                            <span
                              className="lyric-translation"
                              lang="en"
                              dir="auto"
                            >
                              {doc.translation[line.id]}
                            </span>
                          )}
                      </button>
                    ))}
                  </div>
                  <div className="lyric-bottom">
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
                    <button
                      className="subtle"
                      onClick={() => setFollow((x) => !x)}
                    >
                      {follow ? "Following playback" : "Resume following"}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
          {ready && view === "discover" && (
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
                  <span>yt-dlp not found. Please install yt-dlp (https://github.com/yt-dlp/yt-dlp) and place yt-dlp.exe in the same folder as Lumaire, or ensure it's available in your system PATH.</span>
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
                      if (e.key === "Enter" && discoveryQuery.trim() && ytdlpAvailable) {
                        e.preventDefault();
                        setDiscoverySearching(true);
                        setDiscoveryError("");
                        library.ytdlpSearch(discoveryQuery.trim(), 20)
                          .then(results => {
                            setDiscoveryResults(results);
                            setDiscoverySearching(false);
                            if (results.length === 0) {
                              setDiscoveryError("No results found. Try different keywords.");
                            }
                          })
                          .catch(err => {
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
                  disabled={discoverySearching || !discoveryQuery.trim() || !ytdlpAvailable}
                  onClick={() => {
                    setDiscoverySearching(true);
                    setDiscoveryError("");
                    library.ytdlpSearch(discoveryQuery.trim(), 20)
                      .then(results => {
                        setDiscoveryResults(results);
                        setDiscoverySearching(false);
                        if (results.length === 0) {
                          setDiscoveryError("No results found. Try different keywords.");
                        }
                      })
                      .catch(err => {
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
                  <IconButton label="Dismiss error" onClick={() => setDiscoveryError("")}>
                    <X size={16} />
                  </IconButton>
                </div>
              )}
              {!discoveryResults.length && !discoverySearching && !discoveryError && ytdlpAvailable && (
                <div className="empty">
                  <Globe size={36} />
                  <h2>Search YouTube</h2>
                  <p>
                    Find and stream music from YouTube.
                    <br />
                    Stream URLs expire after a few hours. For personal, non-commercial use only.
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
                          onClick={() => {
                            // Add to library and play
                            const localTrack: Track = {
                              id: `youtube:${t.id}`,
                              title: t.title,
                              artist: t.channel || "Unknown Artist",
                              album: "YouTube",
                              duration: t.duration || 0,
                              fileName: t.title,
                              missing: false,
                              format: "YouTube",
                              source: {
                                providerId: "youtube",
                                sourceId: t.id,
                                pageUrl: `https://www.youtube.com/watch?v=${t.id}`,
                                license: "YouTube Terms of Service",
                                licenseUrl: "https://www.youtube.com/t/terms",
                                attribution: t.channel || "Unknown",
                              },
                            };
                            setTracks((all) => {
                              if (all.find((x) => x.id === localTrack.id)) return all;
                              return [...all, localTrack];
                            });
                            const entry = item(localTrack.id);
                            update((s) => ({
                              ...s,
                              queue: [...s.queue, entry],
                              currentId: entry.id,
                              position: 0,
                            }));
                            // Play - resolver handles youtube: prefix
                            void player.load(localTrack.id, true);
                            setFollow(true);
                            notify(`Playing ${t.title} from YouTube`);
                          }}
                        >
                          <span className="track-index">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <Play className="row-play" size={15} />
                        </button>
                        <button
                          className="track-meta"
                          onClick={() => window.open(`https://www.youtube.com/watch?v=${t.id}`, "_blank")}
                        >
                          <span className={`cover color-${index % 5}`}>
                            <Music2 size={20} />
                          </span>
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
                            onClick={() => window.open(`https://www.youtube.com/watch?v=${t.id}`, "_blank")}
                          >
                            <ExternalLink size={17} />
                          </IconButton>
                          <details className="track-menu">
                            <summary aria-label={`Actions for ${t.title}`}>
                              •••
                            </summary>
                            <div className="menu-popover">
                              <button onClick={() => {
                                const localTrack: Track = {
                                  id: `youtube:${t.id}`,
                                  title: t.title,
                                  artist: t.channel || "Unknown Artist",
                                  album: "YouTube",
                                  duration: t.duration || 0,
                                  fileName: t.title,
                                  missing: false,
                                  format: "YouTube",
                                  source: {
                                    providerId: "youtube",
                                    sourceId: t.id,
                                    pageUrl: `https://www.youtube.com/watch?v=${t.id}`,
                                    license: "YouTube Terms of Service",
                                    licenseUrl: "https://www.youtube.com/t/terms",
                                    attribution: t.channel || "Unknown",
                                  },
                                };
                                setTracks((all) => {
                                  if (all.find((x) => x.id === localTrack.id)) return all;
                                  return [...all, localTrack];
                                });
                                queueTrack(localTrack.id, true);
                              }}>
                                Play next
                              </button>
                              <button onClick={() => {
                                const localTrack: Track = {
                                  id: `youtube:${t.id}`,
                                  title: t.title,
                                  artist: t.channel || "Unknown Artist",
                                  album: "YouTube",
                                  duration: t.duration || 0,
                                  fileName: t.title,
                                  missing: false,
                                  format: "YouTube",
                                  source: {
                                    providerId: "youtube",
                                    sourceId: t.id,
                                    pageUrl: `https://www.youtube.com/watch?v=${t.id}`,
                                    license: "YouTube Terms of Service",
                                    licenseUrl: "https://www.youtube.com/t/terms",
                                    attribution: t.channel || "Unknown",
                                  },
                                };
                                setTracks((all) => {
                                  if (all.find((x) => x.id === localTrack.id)) return all;
                                  return [...all, localTrack];
                                });
                                queueTrack(localTrack.id);
                              }}>
                                Add to queue
                              </button>
                              <button onClick={() => window.open(`https://www.youtube.com/watch?v=${t.id}`, "_blank")}>
                                <ExternalLink size={14} />
                                View on YouTube
                              </button>
                            </div>
                          </details>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="library-footer">
                    <span className="small-dot" /> Results from YouTube · {discoveryResults.length} tracks · URLs expire after a few hours
                  </p>
                </>
              )}
            </section>
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
                    disabled={busy}
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
                    disabled={busy}
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
                  Backups contain metadata and settings. Audio and lyric text
                  are excluded. Files imported on another device require Relink.
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
                    <p>Search and stream · URLs expire · Personal, non-commercial use only</p>
                  </div>
                  <span className="source-status">{ytdlpAvailable ? "Enabled" : "Not Available"}</span>
                </div>
                <p>
                  YouTube streaming requires yt-dlp. Stream URLs expire after a few hours.
                  Use is subject to YouTube Terms of Service. For personal, non-commercial use only.
                  Local files work independently and offline.
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
              Up next <span>{session.queue.length}</span>
            </h2>
            <IconButton label="Hide queue" onClick={() => setQueueOpen(false)}>
              <PanelRightClose size={18} />
            </IconButton>
          </header>
          <div className="queue-caption">YOUR LISTENING SESSION</div>
          <div className="queue-items">
            {session.queue.length ? (
              session.queue.map((entry, index) => {
                const t = tracks.find((t) => t.id === entry.trackId);
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
                      <span className={`cover color-${index % 5}`}>
                        <Music2 size={17} />
                      </span>
                      <span>
                        <strong dir="auto">{t.title}</strong>
                        <small>
                          {entry.id === session.currentId
                            ? "Now selected"
                            : t.artist}
                        </small>
                      </span>
                    </button>
                    <div className="queue-controls">
                      <IconButton
                        label={`Move ${t.title} up`}
                        disabled={index === 0}
                        onClick={() =>
                          update((s) => ({
                            ...s,
                            queue: move(s.queue, entry.id, -1),
                          }))
                        }
                      >
                        <ArrowUp size={13} />
                      </IconButton>
                      <IconButton
                        label={`Move ${t.title} down`}
                        disabled={index === session.queue.length - 1}
                        onClick={() =>
                          update((s) => ({
                            ...s,
                            queue: move(s.queue, entry.id, 1),
                          }))
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
              disabled={!session.queue.length}
              onClick={() => {
                setUndo(session.queue);
                update((s) => ({
                  ...s,
                  queue: [],
                  currentId: null,
                  position: 0,
                }));
                player.stop();
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
          <span className="cover transport-cover">
            {track ? <Music2 size={25} /> : <Disc3 size={25} />}
          </span>
          <div>
            <strong dir="auto">
              {track?.title ?? "Room for a little music"}
            </strong>
            <small dir="auto">
              {track?.artist ?? "Choose a track to begin"}
              {track ? ` · Local ${track.format}` : ""}
            </small>
          </div>
          {track && (
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
              disabled={!tracks.length || playback.status === "loading"}
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
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setDialog(null);
            setVariant(null);
          }
        }}
      >
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
