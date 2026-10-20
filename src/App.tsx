import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Disc3 } from "lucide-react";
import { desktop, mobile, library, type CatalogTrack } from "./adapters/native";
import { TopBar, Banners, MobileTabBar } from "./components/common";
import { PlayerBar } from "./components/player";
import { Sidebar } from "./components/sidebar";
import { QueuePanel } from "./components/queue";
import {
  SaveToPlaylistModal,
  PromptModal,
  LineAlignmentModal,
  type PromptDialogData,
} from "./components/modals";
import { LyricsView } from "./components/lyrics";
import { DiscoveryView, SettingsView, LibraryView, ArtistView, AlbumView } from "./components/views";
import {
  initialDiscoveryViewState,
  type DiscoveryViewState,
} from "./components/views/DiscoveryView";
import { libraryCollections } from "./domain/collections";
import { restoreSession } from "./domain/session";
import { type Track } from "./domain/types";
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
import type { CatalogAction } from "./components/common/CatalogTrackActions";

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

  const [view, setView] = useState<View>("library");
  const [discoverRoute, setDiscoverRoute] = useState<View>("discover");
  function selectView(next: View) {
    if (typeof view === "object") {
      catalogScroll.current.set(`${view.type}:${view.id}`, document.getElementById("main")?.scrollTop ?? 0);
    }
    setView(next === "discover" ? discoverRoute : next);
  }
  const [catalogHistory, setCatalogHistory] = useState<View[]>([]);
  const catalogScroll = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    if (typeof view !== "object") return;
    const main = document.getElementById("main");
    if (!main) return;
    const key = `${view.type}:${view.id}`;
    main.scrollTop = catalogScroll.current.get(key) ?? 0;
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
  const listeningHistory = useListeningHistory(
    ready,
    sessionRef,
    tracksRef,
    session.settings.historyEnabled,
  );
  useClickOutsideMenus();

  useEffect(() => {
    if (!ready) return;
    const preference = {
      themeMode: session.settings.themeMode,
      accentColor: session.settings.accentColor,
    };
    applyTheme(preference);
    storeTheme(preference);
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

  const followRef = useRef<(f: boolean) => void>(() => {});

  const playbackEngine = usePlayback({
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
    dialogOpen: Boolean(dialog || playlistTarget),
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
    view: typeof view === "object" ? "discover" : view,
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

  function handleQueueTrack(id: string, next = false) {
    queueTrack(id, next);
    setQueueOpen(true);
  }

  function handleCatalogTrack(result: CatalogTrack, mode: "play" | "save" | "next" | "queue") {
    if (mode === "next" || mode === "queue") setQueueOpen(true);
    void saveDiscovery(result, mode, playTrack);
  }

  function handleCatalogAction(result: CatalogTrack, mode: CatalogAction) {
    if (mode === "save" || mode === "next" || mode === "queue") return handleCatalogTrack(result, mode);
    const saved = tracksRef.current.find(track => track.metadataSourceId === result.id);
    if (mode === "remove" && saved) return void removeTrack(saved, () => playbackEngine.setUndo(null));
    if (mode === "delete-offline" && saved) return deleteOffline(saved, track?.id, ask);
    void action(async () => {
      if (mode === "refresh") {
        await enrichOnline(saved || await resolveDiscovery(result), true);
        return;
      }
      const selected = saved || await resolveDiscovery(result);
      if (mode === "favorite") {
        if (!saved) await saveOnline(selected);
        favorite(selected.id);
      } else if (mode === "playlist") choosePlaylist(selected);
      else if (mode === "download") await downloadTrack(selected);
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
    if (dialog || lyricsEngine.variant || playlistTarget) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
      previousFocus.current?.focus();
    }
  }, [dialog, lyricsEngine.variant, playlistTarget]);

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
  const visible = tracks.filter(
    (t) =>
      (view !== "favorites" || session.favorites.includes(t.id)) &&
      (!builtin ||
        collection?.tracks.some((candidate) => candidate.id === t.id)) &&
      (!playlist || playlist.items.some((i) => i.trackId === t.id)) &&
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

  return (
    <div
      className={`app ${queueOpen ? "with-queue" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobile ? "android" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar
        view={typeof view === "object" ? "discover" : view}
        setView={selectView}
        collectionsCount={collections.length}
        playlists={session.playlists}
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
                  const playable = rows
                    .map(({ t }) => t)
                    .filter((t) => !t.missing);
                  const start = session.settings.shuffle
                    ? Math.floor(Math.random() * playable.length)
                    : 0;
                  playCollectionTrack(playable, start);
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
          {ready && view === "lyrics" && (
            <LyricsView
              onNavigateArtist={id => navigateCatalog({ type: "artist", id })}
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
              attach={lyricsEngine.attach}
              clearCache={lyricsEngine.clearCache}
              regenerate={lyricsEngine.regenerate}
              processingState={lyricsEngine.processingState}
              onRetryLookup={lyricsEngine.retryLookup}
              onMarkInstrumental={lyricsEngine.markInstrumental}
              onSeek={(seconds) => seek(seconds)}
            />
          )}
          {ready && view === "discover" && (
            <DiscoveryView
              state={discoveryState}
              onStateChange={setDiscoveryState}
              ytdlpAvailable={ytdlpAvailable}
              mobile={mobile}
              busy={busy}
              downloads={downloads}
              onSaveDiscovery={handleCatalogTrack}
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
              onInstallYoutubeEngine={libraryManager.installYoutubeEngine}
              engineState={libraryManager.engineState}
              engineError={libraryManager.engineError}
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
      <PlayerBar
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
      />
      <MobileTabBar
        view={typeof view === "object" ? "discover" : view}
        setView={selectView}
        hasLyricsDoc={Boolean(doc)}
      />
      <dialog
        ref={dialogRef}
        className={playlistTarget ? "save-playlist-modal" : ""}
        onCancel={() => {
          setDialog(null);
          lyricsEngine.setVariant(null);
          setPlaylistTarget(null);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setDialog(null);
            lyricsEngine.setVariant(null);
            setPlaylistTarget(null);
          }
        }}
      >
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
