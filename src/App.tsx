import { useSyncExternalStore } from "react";
import { initializeUpdates, getUpdateState, subscribeToUpdates, dismissReleaseNotes, supportsWindowsUpdates } from "./adapters/updater";
import { UpdateDialog } from "./components/modals/UpdateDialog";
import { downloadProgressText } from "./domain/downloads";
import { mergePlaylistImport, type PlaylistImportOptions } from "./domain/playlist-import";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Disc3 } from "lucide-react";
import { desktop, mobile, library, type CatalogTrack } from "./adapters/native";
import { TopBar, Banners, MobileTabBar } from "./components/common";
import { PlayerBar } from "./components/player";
import { ExpandedPlayer } from "./components/player/ExpandedPlayer";
import { Sidebar } from "./components/sidebar";
import { QueuePanel } from "./components/queue";
import {
  SaveToPlaylistModal,
  AddMusicModal,
  PromptModal,
  LineAlignmentModal,
  type PromptDialogData,
} from "./components/modals";
import { LyricsView } from "./components/lyrics";
import { DiscoveryView, SettingsView, LibraryView, ArtistView, AlbumView } from "./components/views";
import { useAlbumDownloads } from "./hooks/useAlbumDownloads";
import {
  initialDiscoveryViewState,
  type DiscoveryViewState,
} from "./components/views/DiscoveryView";
import { libraryCollections } from "./domain/collections";
import { restoreSession } from "./domain/session";
import { type Track, type Playlist } from "./domain/types";
import {
  useLibraryManager,
  usePlayback,
  useLyricsEngine,
  useClickOutsideMenus,
} from "./hooks";
import { useListeningHistory } from "./hooks/useListeningHistory";
import { HistoryView } from "./components/views/HistoryView";
import { historyTrack, type ListeningRecord } from "./domain/listening";
import { clearListening } from "./player/listening-service";
import { reorderUpcoming } from "./domain/queue";
import { applyTheme, storeTheme } from "./theme";
import { isTauri } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import type { CatalogAction } from "./components/common/CatalogTrackActions";
import { EngineSetupCard } from "./components/common/EngineSetupCard";
import { clearDiscoverySearches } from "./adapters/discovery-home";
import { catalogQueueTrack } from "./domain/catalog-track";
import { CollectionHub } from "./components/views/CollectionHub";
import { useNearby } from "./hooks/useNearby";
import { useLyricOverlay } from "./hooks/useLyricOverlay";
import { overlaySnapshot } from "./domain/lyric-overlay";
import { mergeSharedPlaylists, type SharedState } from "./domain/nearby";
import { item } from "./domain/types";
import { collections as collectionAdapter } from "./adapters/collections";

type View =
  | "library"
  | "favorites"
  | "lyrics"
  | "settings"
  | "discover"
  | { type: "artist"; id: string }
  | { type: "album"; id: string }
  | string;

export function App() {
  const libraryManager = useLibraryManager();
  const {
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
    resolveDiscovery,
  } = libraryManager;
  const engineSetup = {
    engineState: libraryManager.engineState,
    engineError: libraryManager.engineError,
    engineProgress: libraryManager.engineProgress,
    engineCancelling: libraryManager.engineCancelling,
    onInstallYoutubeEngine: libraryManager.installYoutubeEngine,
    onCancelYoutubeEngineInstall: libraryManager.cancelYoutubeEngineInstall,
  };

  const [view, setRawView] = useState<View>("discover");
  const [discoverRoute, setDiscoverRoute] = useState<View>("discover");
  const currentViewRef = useRef<View>(view);
  currentViewRef.current = view;

  const scrollPositions = useRef(new Map<string, number>());
  const viewKey = (v: View) => (typeof v === "object" ? `${v.type}:${v.id}` : String(v));

  const setView = useCallback((next: View | ((prev: View) => View)) => {
    const main = document.getElementById("main");
    if (main) {
      scrollPositions.current.set(viewKey(currentViewRef.current), main.scrollTop);
    }
    setRawView(next);
  }, []);

  const [catalogHistory, setCatalogHistory] = useState<View[]>([]);

  function selectView(next: View) {
    if (next === "discover" && typeof view === "object") {
      setView("discover");
      setDiscoverRoute("discover");
      setCatalogHistory([]);
      return;
    }
    setView(next === "discover" ? discoverRoute : next);
  }

  useLayoutEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    const key = viewKey(view);
    main.scrollTop = scrollPositions.current.get(key) ?? 0;
  }, [view]);

  function navigateCatalog(next: View) {
    setCatalogHistory(history => typeof view === "object" ? [...history, view] : [view]);
    setView(next);
    setDiscoverRoute(next);
  }
  function backFromCatalog() {
    const previous = catalogHistory[catalogHistory.length - 1] ?? "discover";
    setView(previous);
    setDiscoverRoute(typeof previous === "object" ? previous : "discover");
    setCatalogHistory(history => history.slice(0, -1));
  }
  const [query, setQuery] = useState("");
  const [discoveryState, setDiscoveryState] = useState<DiscoveryViewState>(
    initialDiscoveryViewState,
  );
  const [queueOpen, setQueueOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dialog, setDialog] = useState<PromptDialogData | null>(null);
  const [playlistTarget, setPlaylistTarget] = useState<Track | null>(null);
  const [addMusicPlaylist, setAddMusicPlaylist] = useState<Playlist | null>(null);
  const listeningHistory = useListeningHistory(
    ready,
    sessionRef,
    tracksRef,
    session.settings.historyEnabled,
  );
  useEffect(() => {
    if (ready && !session.settings.historyEnabled) clearDiscoverySearches();
  }, [ready, session.settings.historyEnabled]);
  useClickOutsideMenus();

  useEffect(() => {
    if (!ready) return;
    const preference = {
      themeMode: session.settings.themeMode,
      accentColor: session.settings.accentColor,
    };
    applyTheme(preference);
    storeTheme(preference);
    if (isTauri()) {
      void emit("lumaire:theme-change", preference).catch(() => {});
    }
  }, [ready, session.settings.themeMode, session.settings.accentColor]);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const messageTimeoutRef = useRef<number | null>(null);

  const current = session.queue.find((i) => i.id === session.currentId);
  const listeningTracks = [
    ...tracks,
    ...Object.values(session.queueTracks).filter(
      (t) => !tracks.some((saved) => saved.id === t.id),
    ),
  ];
  const track = listeningTracks.find((t) => t.id === current?.trackId);
  const doc = track ? session.lyrics[track.id] : undefined;

  useEffect(() => {
    scrollPositions.current.set("lyrics", 0);
    if (view === "lyrics") {
      document.getElementById("main")?.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [track?.id, view]);

  const updateState = useSyncExternalStore(subscribeToUpdates, getUpdateState, getUpdateState);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  useEffect(() => { void initializeUpdates(); }, []);
  useEffect(() => { if (updateState.unreadNotes) setUpdatesOpen(true); }, [updateState.unreadNotes]);
  const closeUpdates = () => { dismissReleaseNotes(); setUpdatesOpen(false); };
  const [expanded, setExpanded] = useState(false);
  const expandOrigin = useRef<DOMRect | null>(null);
  function openExpanded() { expandOrigin.current = document.querySelector(".cover-expand")?.getBoundingClientRect() || null; setExpanded(true); }
  function closeExpanded() { setExpanded(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".cover-expand")?.focus()); }
  const [collectionHub, setCollectionHub] = useState<"import" | "devices" | false>(false);
  const followRef = useRef<(f: boolean) => void>(() => {});

  const playbackEngine = usePlayback({
    resolveQueuedTrack: async (queued) =>
      resolveDiscovery(await library.lookupCatalog(queued.id)),
    session,
    update,
    sessionRef,
    tracksRef,
    tracks,
    currentTrack: track,
    view: typeof view === "object" ? "discover" : view,
    setView: selectView,
    notify,
    persist,
    dialogOpen: Boolean(dialog || playlistTarget || collectionHub || updatesOpen),
    onSetFollow: (f) => followRef.current(f),
    onToggleQueue: () => setQueueOpen((q) => !q),
    queueOpen,
  });

  const lyricsEngine = useLyricsEngine({
    track,
    doc,
    playback: playbackEngine.playback,
    session,
    update,
    sessionRef,
    ready,
    view: expanded ? "lyrics" : typeof view === "object" ? "discover" : view,
    notify,
    action,
    setError,
  });

  followRef.current = lyricsEngine.setFollow;

  const {
    player,
    playback,
    undo,
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
  } = playbackEngine;

  const floatingLyrics = useLyricOverlay(
    overlaySnapshot(libraryManager.pendingTrack?.id === playback.trackId ? libraryManager.pendingTrack : track,
      libraryManager.pendingTrack?.id === playback.trackId ? undefined : doc, session.settings, playback.status, lyricsEngine.lyricSynced, lyricsEngine.active, lyricsEngine.lyricLookup.status),
    () => {
      if (libraryManager.pendingTrack?.id === playback.trackId && playback.status === 'error') libraryManager.retryPendingPlayback(playTrack);
      else togglePlay();
    }, skip, setError,
  );

  const nearby = useNearby({ session, tracks, track, playback, update, resolve: async queued => resolveDiscovery(await library.lookupCatalog(queued.id)) });
  useEffect(() => { if (nearby.error) setError(`Nearby connection: ${nearby.error}`); }, [nearby.error]);

  async function keepImportedTracks(imported: Track[]) {
    const fresh = imported.filter(track => !tracksRef.current.some(saved => saved.id === track.id));
    const catalog = fresh.filter(track => track.format === "catalog");
    const saved = catalog.length ? await collectionAdapter.saveCatalogTracks(catalog) : [];
    for (const track of fresh.filter(track => track.format !== "catalog")) saved.push(await library.saveOnline(track));
    tracksRef.current = [...tracksRef.current, ...saved.filter(track => !tracksRef.current.some(existing => existing.id === track.id))];
    setTracks(tracksRef.current);
  }
  async function importPlaylist(name: string, imported: Track[], options: PlaylistImportOptions) {
    mergePlaylistImport(sessionRef.current.playlists, name, imported, tracksRef.current, options);
    await keepImportedTracks(imported);
    const result = mergePlaylistImport(sessionRef.current.playlists, name, imported, tracksRef.current, options);
    update(s => ({ ...s, playlists: result.playlists }));
    setCollectionHub(false); setView(result.playlist.id);
    notify(result.merged ? result.added ? `Added ${result.added} new songs to ${result.playlist.name}.` : `Already imported—all ${result.playlist.items.length} songs are in your playlist.` : `Imported ${result.added} tracks. Audio is resolved when played.`);
  }
  async function syncPlaylists(data: SharedState) {
    await keepImportedTracks([...new Map(data.playlists.flatMap(playlist => playlist.tracks).map(track => [track.id, track])).values()]);
    let report = "";
    update(session => { const merged = mergeSharedPlaylists(session, data.playlists); report = `${merged.added} playlists synced · ${merged.conflicts} conflicting edits kept as device copies`; return merged.session; });
    notify(report || "Shared playlists synced.");
  }

  function handleQueueTrack(id: string, next = false) {
    queueTrack(id, next);
    setQueueOpen(true);
  }

  function handleCatalogTrack(result: CatalogTrack, mode: "play" | "save" | "next" | "queue") {
    if (mode === "next" || mode === "queue") setQueueOpen(true);
    void saveDiscovery(result, mode, playTrack);
  }

  function playCatalogCollection(results: CatalogTrack[], shuffle = false) {
    const collection = results.map(result => [...tracksRef.current, ...Object.values(sessionRef.current.queueTracks)].find(track => track.metadataSourceId === result.id && track.offline && !track.missing) || catalogQueueTrack(result));
    if (!collection.length) return;
    libraryManager.clearPendingPlayback();
    playCollectionTrack(collection, shuffle ? Math.floor(Math.random() * collection.length) : 0, shuffle);
  }

  async function playCatalogAlbum(id: string) {
    try {
      const album = await library.lookupAlbum(id);
      if (!album.tracks.length) throw Error("No album tracks are available.");
      playCatalogCollection(album.tracks);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  }

  const albumDownloads = useAlbumDownloads(downloadCatalogTrack);

  async function downloadCatalogTrack(result: CatalogTrack, onStage?: (stage: string, percent?: number) => void, signal?: AbortSignal): Promise<boolean> {
    try {
      if (signal?.aborted) return false;
      const saved = tracksRef.current.find(track => track.metadataSourceId === result.id);
      if (saved?.offline) return true;
      onStage?.("Finding audio source");
      const track = saved?.format !== "catalog" && saved ? saved : await resolveDiscovery(result);
      if (signal?.aborted) return false;
      onStage?.("Saving offline");
      return await downloadTrack(track, signal, progress => onStage?.(downloadProgressText(progress), progress.total ? Math.min(100, progress.received / progress.total * 100) : undefined));
    } catch (error) { if (!signal?.aborted) setError(error instanceof Error ? error.message : String(error)); return false; }
  }

  function handleCatalogAction(result: CatalogTrack, mode: CatalogAction) {
    if (mode === "save" || mode === "next" || mode === "queue") return handleCatalogTrack(result, mode);
    if (mode === "download") return void downloadCatalogTrack(result);
    const saved = tracksRef.current.find(track => track.metadataSourceId === result.id);
    if (mode === "remove" && saved) return void removeTrack(saved, () => playbackEngine.setUndo(null));
    if (mode === "delete-offline" && saved) return deleteOffline(saved, track?.id, ask);
    void action(async () => {
      if (mode === "refresh") {
        await enrichOnline(saved || await resolveDiscovery(result), true);
        return;
      }
      const selected = saved?.format !== "catalog" && saved ? saved : await resolveDiscovery(result);
      if (mode === "favorite") {
        if (!saved || saved.format === "catalog") await saveOnline(selected);
        favorite(selected.id);
      } else if (mode === "playlist") choosePlaylist(selected);
    });
  }

  function handleQueueRemote(t: Track, next = false) {
    queueRemote(t, next);
    setQueueOpen(true);
  }

  function recordedTrack(record: ListeningRecord) {
    return (
      listeningTracks.find((t) => t.id === record.trackId) ??
      historyTrack(record)
    );
  }
  function replayHistory(record: ListeningRecord) {
    const t = recordedTrack(record);
    if (
      !t.source &&
      !tracksRef.current.some((saved) => saved.id === t.id && !saved.missing)
    ) {
      setError(
        "This local recording is no longer available. Import or relink the original file to play it again.",
      );
      return;
    }
    playTrack(t);
  }

  useEffect(() => {
    if (dialog || lyricsEngine.variant || playlistTarget || addMusicPlaylist) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
      previousFocus.current?.focus();
    }
  }, [dialog, lyricsEngine.variant, playlistTarget, addMusicPlaylist]);

  function ask(
    title: string,
    label: string,
    value: string,
    submit: (name: string) => void,
  ) {
    setDialog({ title, label, value, submit });
  }

  function choosePlaylist(t: Track) {
    setPlaylistTarget(t);
  }

  const collections = libraryCollections(tracks, session.playlists);
  const collection = collections.find((candidate) => candidate.id === view);
  const builtin = typeof view === "string" && view.startsWith("collection:");
  const playlist = session.playlists.find((p) => p.id === view);
  const collectionTracks = tracks.filter(
    (t) =>
      (view !== "favorites" || session.favorites.includes(t.id)) &&
      (!builtin ||
        collection?.tracks.some((candidate) => candidate.id === t.id)) &&
      (!playlist || playlist.items.some((i) => i.trackId === t.id)),
  );
  const visible = collectionTracks.filter(t =>
      `${t.title} ${t.artist} ${t.album?.trim() || "Unknown"}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const heading =
    view === "history"
      ? "Tracker"
      : view === "favorites"
        ? "Your favorites"
        : collection
          ? collection.name
          : "Your library";
  const rows = playlist
    ? playlist.items.flatMap((entry) => {
        const t = visible.find((candidate) => candidate.id === entry.trackId);
        return t ? [{ t, entryId: entry.id }] : [];
      })
    : visible.map((t) => ({ t, entryId: t.id }));
  const fullCollection = playlist ? playlist.items.flatMap(entry => {
    const track = collectionTracks.find(track => track.id === entry.trackId);
    return track ? [track] : [];
  }) : collectionTracks;

  const lyricsPanel = (<LyricsView embedded={expanded}
              onNavigateArtist={id => { setExpanded(false); navigateCatalog({ type: "artist", id }); }}
              track={track}
              doc={doc}
              lyricSynced={lyricsEngine.lyricSynced}
              lyricLookup={lyricsEngine.lyricLookup}
              follow={lyricsEngine.follow}
              setFollow={lyricsEngine.setFollow}
              followTarget={lyricsEngine.followTarget}
              active={lyricsEngine.active}
              activeRef={lyricsEngine.activeRef}
              busy={busy}
              session={session}
              setting={setting}
              onUpdateOffset={lyricsEngine.updateOffset}
              clearCache={lyricsEngine.clearCache}
              regenerate={lyricsEngine.regenerate}
              processingState={lyricsEngine.processingState}
              translateLyrics={lyricsEngine.translateLyrics}
              romanizing={lyricsEngine.romanizing}
              onRetryLookup={lyricsEngine.retryLookup}
              audioDuration={lyricsEngine.lyricDuration}
              onAlbumRecording={() => {
                if (!track?.metadataSourceId) return;
                void action(async () => {
                  const catalog = await library.lookupCatalog(track.metadataSourceId!);
                  playTrack(await resolveDiscovery(catalog, true));
                });
              }}
              onMarkInstrumental={lyricsEngine.markInstrumental}
              onSeek={(seconds) => seek(seconds)}
            />);
  const playerControls = (<PlayerBar onExpand={mobile ? undefined : openExpanded}
        autoplayLoading={playbackEngine.autoplayLoading}
        onFloatingLyrics={floatingLyrics.supported ? floatingLyrics.toggle : undefined}
        floatingLyricsOpen={floatingLyrics.open}
        floatingLyricsLocked={floatingLyrics.locked}
        floatingLyricsBusy={floatingLyrics.busy}
        track={libraryManager.pendingTrack?.id === playback.trackId ? libraryManager.pendingTrack : track}
        tracks={tracks}
        playback={playback}
        session={session}
        downloads={downloads}
        busy={busy}
        view={typeof view === "object" ? "discover" : view}
        setView={selectView}
        mobile={mobile}
        queueOpen={queueOpen}
        onToggleQueue={() => setQueueOpen((x) => !x)}
        onSeek={(seconds) => seek(seconds)}
        onTogglePlay={() => {
          if (libraryManager.pendingTrack?.id === playback.trackId && playback.status === "error") libraryManager.retryPendingPlayback(playTrack);
          else togglePlay();
        }}
        onSkip={skip}
        onFavorite={favorite}
        onNavigateArtist={id => navigateCatalog({ type: "artist", id })}
        onChoosePlaylist={choosePlaylist}
        onDownloadTrack={(t) => void downloadTrack(t)}
        onDeleteOffline={(t) => deleteOffline(t, track?.id, ask)}
        onSaveOnline={(t) =>
          void action(async () => {
            await saveOnline(t);
            notify("Saved to library · Internet required for streaming");
          })
        }
        onCancelDownload={(trackId) =>
          void action(() => library.cancelDownload(trackId))
        }
        onSetting={setting}
      />);

  return (
    <div
      className={`app ${queueOpen ? "with-queue" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobile ? "android" : ""}`}
    >
      {updatesOpen && <UpdateDialog onClose={closeUpdates} />}
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar
        onHome={() => {
          scrollPositions.current.set("discover", 0);
          setView("discover");
          setDiscoverRoute("discover");
          setCatalogHistory([]);
        }}
        view={typeof view === "object" ? "discover" : view}
        setView={selectView}
        collectionsCount={collections.length}
        playlists={session.playlists}
        collections={collections}
        hasLyricsDoc={Boolean(doc)}
        queueOpen={queueOpen}
        onToggleQueue={() => setQueueOpen((x) => !x)}
        onCreatePlaylist={() =>
          ask("A new collection", "Playlist name", "", (name) => {
            const id = crypto.randomUUID();
            update((s) => ({
              ...s,
              playlists: [...s.playlists, { id, name, items: [] }],
            }));
            setView(id);
          })
        }
      />
      <div className="workspace">
        {!mobile && (
          <TopBar
            view={typeof view === "object" ? "discover" : view}
            heading={heading}
            sidebarCollapsed={sidebarCollapsed}
            queueOpen={queueOpen}
            onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
            onToggleQueue={() => setQueueOpen((x) => !x)}
            onOpenUpdates={supportsWindowsUpdates() && updateState.version ? () => setUpdatesOpen(true) : undefined}
            updateLabel={updateState.stage === "ready" ? "Restart to update" : updateState.stage === "downloading" ? `Downloading${updateState.progress === undefined ? "…" : ` ${updateState.progress}%`}` : `Update v${updateState.version}`}
            onOpenImport={() => setCollectionHub("import")}
            onOpenConnect={() => setCollectionHub("devices")}
            onOpenCollectionHub={() => setCollectionHub("import")}
            nearbySharing={ready && Boolean(nearby.hostLink)}
            nearbyFollowing={ready && Boolean(nearby.following)}
            onStopFollowing={() => nearby.setFollowing(false)}
          />
        )}
        <Banners
          error={error}
          playbackError={playback.error}
          message={message}
          hasTrack={Boolean(track || libraryManager.pendingTrack)}
          onRetryPlayback={() => {
            if (libraryManager.pendingTrack?.id === playback.trackId) libraryManager.retryPendingPlayback(playTrack);
            else if (track) void player.load(track.id, true, playback.time);
          }}
          onDismissError={() => setError("")}
          onDismissMessage={() => {
            setMessage("");
            if (messageTimeoutRef.current) {
              window.clearTimeout(messageTimeoutRef.current);
              messageTimeoutRef.current = null;
            }
          }}
        />
        <main id="main" tabIndex={-1}>
          {ready && !mobile && view === "library" && tracks.length === 0 && !ytdlpAvailable && <EngineSetupCard {...engineSetup} />}
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
              <LibraryView
                view={typeof view === "object" ? "discover" : view}
                heading={heading}
                playlist={playlist}
                tracks={tracks}
                visible={visible}
                rows={rows}
                currentTrack={track}
                playbackStatus={playback.status}
                session={session}
                downloads={downloads}
                collections={collections}
                query={query}
                busy={busy}
                mobile={mobile}
                desktop={desktop}
                onSetQuery={setQuery}
                onSelectView={setView}
                onPlayAll={() => {
                  const playable = fullCollection.filter((t) => !t.missing);
                  playCollectionTrack(playable, 0, false);
                }}
                onShufflePlay={() => {
                  const playable = fullCollection.filter((t) => !t.missing);
                  if (!playable.length) return;
                  const start = Math.floor(Math.random() * playable.length);
                  playCollectionTrack(playable, start, true);
                }}
                onPlayTrackInList={(_t, index) => {
                  playCollectionTrack(
                    rows.map((r) => r.t),
                    index,
                  );
                }}
                onImportMusic={(folder) =>
                  void importMusic(folder, () => setView("collection:local"))
                }
                onRenamePlaylist={(p) =>
                  ask("Rename collection", "Playlist name", p.name, (name) =>
                    update((s) => ({
                      ...s,
                      playlists: s.playlists.map((pl) =>
                        pl.id === p.id ? { ...pl, name } : pl,
                      ),
                    })),
                  )
                }
                onDeletePlaylist={(p) =>
                  ask(
                    "Delete collection",
                    "Type DELETE to remove this playlist. Your files stay on disk.",
                    "",
                    (value) => {
                      if (value === "DELETE") {
                        update((s) => ({
                          ...s,
                          playlists: s.playlists.filter((pl) => pl.id !== p.id),
                        }));
                        setView("library");
                      }
                    },
                  )
                }
                onFavorite={favorite}
                onNavigateArtist={id => navigateCatalog({ type: "artist", id })}
                onNavigateAlbum={id => navigateCatalog({ type: "album", id })}
                onRemoveTrack={(t) =>
                  void removeTrack(t, () => playbackEngine.setUndo(null))
                }
                onDownloadTrack={(t) => void downloadTrack(t)}
                onDeleteOffline={(t) => deleteOffline(t, track?.id, ask)}
                onQueueTrack={handleQueueTrack}
                onEnrichOnline={(t) => void action(() => enrichOnline(t, true))}
                onRelinkTrack={(t) => void relink(t, track?.id, playback.time)}
                onChoosePlaylist={choosePlaylist}
                onOpenAddMusic={(p) => setAddMusicPlaylist(p)}
                onRemoveFromPlaylist={(playlistId, entryId) => {
                  update((s) => ({
                    ...s,
                    playlists: s.playlists.map((p) =>
                      p.id === playlistId
                        ? {
                            ...p,
                            items: p.items.filter((i) => i.id !== entryId),
                          }
                        : p,
                    ),
                  }));
                }}
              />
            )}
          {ready && view === "history" && (
            <HistoryView
              {...listeningHistory}
              records={listeningHistory.records.map((record) => {
                const current = listeningTracks.find(
                  (t) => t.id === record.trackId,
                );
                if (!current) return record;
                return {
                  ...record,
                  title: current.title || record.title,
                  artist:
                    current.artist &&
                    !/^unknown(?: artist)?$/i.test(current.artist)
                      ? current.artist
                      : record.artist,
                  album: current.album?.trim() || record.album,
                  artworkUrl: current.artworkUrl || record.artworkUrl,
                };
              })}
              onRefresh={listeningHistory.refresh}
              onNavigateArtist={id => navigateCatalog({ type: "artist", id })}
              onNavigateAlbum={id => navigateCatalog({ type: "album", id })}
              mobile={mobile}
              enabled={session.settings.historyEnabled}
              favorites={session.favorites}
              onReplay={replayHistory}
              onQueue={(record) => handleQueueRemote(recordedTrack(record))}
              onFavorite={(record) =>
                void action(async () => {
                  const t = recordedTrack(record);
                  if (!tracksRef.current.some((saved) => saved.id === t.id)) {
                    if (!t.source)
                      throw new Error(
                        "Import this local recording again before adding it to Favorites.",
                      );
                    await saveOnline(t);
                  }
                  favorite(t.id);
                })
              }
            />
          )}
          {ready && view === "lyrics" && !expanded && (
lyricsPanel
          )}
          {ready && view === "discover" && (
            <DiscoveryView
              {...engineSetup}
              recentRecords={listeningHistory.records.map(record => {
                const artworkUrl = listeningTracks.find(track => track.id === record.trackId)?.artworkUrl;
                return artworkUrl ? { ...record, artworkUrl } : record;
              })}
              historyEnabled={session.settings.historyEnabled}
              onReplay={replayHistory}
              onImportMusic={() => void importMusic(false, () => setView("collection:local"))}
              onOpenLibrary={() => selectView("library")}
              state={discoveryState}
              onStateChange={setDiscoveryState}
              ytdlpAvailable={ytdlpAvailable}
              mobile={mobile}
              busy={busy}
              downloads={downloads}
              onSaveDiscovery={handleCatalogTrack}
              onPlayAlbum={playCatalogAlbum}
              savedTracks={tracks}
              favorites={session.favorites}
              onCatalogAction={handleCatalogAction}
              onChoosePlaylist={choosePlaylist}
              onDownloadTrack={(trackItem) => void downloadTrack(trackItem)}
              onSaveCommons={(trackItem, play) =>
                void saveCommons(trackItem, play, playTrack)
              }
              onQueueRemote={handleQueueRemote}
              onNavigateArtist={(artistId) => navigateCatalog({ type: "artist", id: artistId })}
              onNavigateAlbum={(albumId) => navigateCatalog({ type: "album", id: albumId })}
            />
          )}
          {ready && typeof discoverRoute === "object" && discoverRoute.type === "artist" && (
            <div hidden={typeof view !== "object"}>
              <ArtistView
                key={discoverRoute.id}
                artistId={discoverRoute.id}
                onNavigateAlbum={(albumId) => navigateCatalog({ type: "album", id: albumId })}
                onNavigateArtist={(artistId) => navigateCatalog({ type: "artist", id: artistId })}
                onSaveDiscovery={handleCatalogTrack}
                savedTracks={tracks}
                favorites={session.favorites}
                onCatalogAction={handleCatalogAction}
                busy={busy}
                downloads={downloads}
                onBack={backFromCatalog}
              />
            </div>
          )}
          {ready && typeof discoverRoute === "object" && discoverRoute.type === "album" && (
            <div hidden={typeof view !== "object"}>
              <AlbumView
                key={discoverRoute.id}
                albumId={discoverRoute.id}
                onPlayCollection={playCatalogCollection}
                onDownloadAlbum={tracks => void albumDownloads.start(discoverRoute.id, tracks)}
                downloadProgress={albumDownloads.progress[discoverRoute.id]}
                onPauseDownload={() => albumDownloads.pause(discoverRoute.id)}
                onCancelDownload={() => albumDownloads.cancel(discoverRoute.id)}
                onlineAvailable={ytdlpAvailable}
                favoriteAlbums={session.favoriteAlbums}
                onFavoriteAlbum={album => update(s => ({ ...s, favoriteAlbums: s.favoriteAlbums.some(saved => saved.id === album.id) ? s.favoriteAlbums.filter(saved => saved.id !== album.id) : [...s.favoriteAlbums, { id: album.id, title: album.title, artist: album.artist, artworkUrl: album.artworkUrl, year: album.year }] }))}
                onSaveDiscovery={handleCatalogTrack}
                savedTracks={tracks}
                favorites={session.favorites}
                onCatalogAction={handleCatalogAction}
                busy={busy}
                downloads={downloads}
                onBack={backFromCatalog}
                onNavigateArtist={(artistId) => navigateCatalog({ type: "artist", id: artistId })}
              />
            </div>
          )}
          {ready && view === "settings" && (
            <SettingsView
              session={session}
              tracks={tracks}
              downloads={downloads}
              busy={busy}
              mobile={mobile}
              ytdlpAvailable={ytdlpAvailable}
              {...engineSetup}
              onRefreshYoutubeEngine={libraryManager.refreshYoutubeEngine}
              onExportLibrary={() =>
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
              onImportBackup={() =>
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
                          void player.load(c.trackId, false, restored.position);
                        notify(
                          "Backup imported. New tracks need explicit relinking.",
                        );
                      });
                  },
                )
              }
              onSetting={setting}
              onClearHistory={() => {
                void action(async () => {
                  await clearListening();
                  update((s) => ({ ...s, history: [] }));
                  listeningHistory.refresh();
                  notify("Local listening history cleared");
                });
              }}
              onClearLyricCache={() =>
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
              onCancelDownload={(id) => void library.cancelDownload(id)}
              onRetryDownload={(t) => void downloadTrack(t)}
              onDeleteOffline={(t) => deleteOffline(t, track?.id, ask)}
            />
          )}
        </main>
      </div>
      {queueOpen && (
        <QueuePanel
          session={session}
          listeningTracks={listeningTracks}
          undo={undo}
          onClose={() => setQueueOpen(false)}
          onSelectQueue={(id, play) => selectQueue(id, play)}
          onReorderUpcoming={(id, delta) =>
            update((s) => reorderUpcoming(s, id, delta))
          }
          onRemoveQueue={(id) => removeQueue(id)}
          onUndoRemoval={undoRemoval}
          onClearQueue={clearQueue}
          onNavigateArtist={id => navigateCatalog({ type: "artist", id })}
        />
      )}
      {(!expanded || mobile) && playerControls}
      {expanded && !mobile && (
        <ExpandedPlayer
          follow={lyricsEngine.follow}
          setFollow={lyricsEngine.setFollow}
          canFollow={Boolean(doc && (lyricsEngine.lyricSynced || session.settings.estimatedScroll))}
          translateLyrics={lyricsEngine.translateLyrics}
          processingState={lyricsEngine.processingState}
          romanizing={lyricsEngine.romanizing}
          controls={playerControls}
          lyrics={lyricsPanel}
          onClose={closeExpanded}
          origin={expandOrigin.current}
          doc={doc}
          session={session}
          onSetting={setting}
        />
      )}
      {collectionHub && (
        <CollectionHub
          initialTab={collectionHub}
          onClose={() => setCollectionHub(false)}
          playlists={session.playlists}
          onImport={importPlaylist}
          nearby={nearby}
          onSync={syncPlaylists}
        />
      )}
      <MobileTabBar
        view={typeof view === "object" ? "discover" : view}
        setView={selectView}
        hasLyricsDoc={Boolean(doc)}
      />
      <dialog
        ref={dialogRef}
        className={playlistTarget || addMusicPlaylist ? "save-playlist-modal" : ""}
        onCancel={() => {
          setDialog(null);
          lyricsEngine.setVariant(null);
          setPlaylistTarget(null);
          setAddMusicPlaylist(null);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setDialog(null);
            lyricsEngine.setVariant(null);
            setPlaylistTarget(null);
            setAddMusicPlaylist(null);
          }
        }}
      >
        {addMusicPlaylist && (
          <AddMusicModal
            playlist={addMusicPlaylist}
            tracks={tracks}
            session={session}
            busy={busy}
            onClose={() => setAddMusicPlaylist(null)}
            onAddTrack={async (target, playlistId) => {
              await addOnlineToPlaylist(target, playlistId);
            }}
            onImportLocal={() => {
              setAddMusicPlaylist(null);
              void importMusic(false, () => setView("collection:local"));
            }}
          />
        )}
        {playlistTarget && (
          <SaveToPlaylistModal
            playlistTarget={playlistTarget}
            tracks={tracks}
            session={session}
            busy={busy}
            onClose={() => setPlaylistTarget(null)}
            onSave={async (target, playlistId, newName) => {
              await addOnlineToPlaylist(target, playlistId, newName);
            }}
            onRemove={(playlistId, trackId, playlistName) => {
              update((s) => ({
                ...s,
                playlists: s.playlists.map((p) =>
                  p.id === playlistId
                    ? {
                        ...p,
                        items: p.items.filter((i) => i.trackId !== trackId),
                      }
                    : p,
                ),
              }));
              setPlaylistTarget(null);
              notify(`Removed from ${playlistName}`);
            }}
          />
        )}
        {dialog && (
          <PromptModal dialog={dialog} onClose={() => setDialog(null)} />
        )}
        {lyricsEngine.variant && (
          <LineAlignmentModal
            variant={lyricsEngine.variant}
            onCancel={() => lyricsEngine.setVariant(null)}
            onConfirm={lyricsEngine.confirmVariant}
          />
        )}
      </dialog>
    </div>
  );
}
