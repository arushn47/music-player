import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Session, Track } from '../domain/types';
import type { Playback } from '../player/controller';
import type { CatalogTrack } from '../adapters/native';
import type { ListeningRecord } from '../domain/listening';

// Run the real hook, adapter, ranking and queue mutations; only React scheduling and I/O are controlled.
const hooks = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[], pending: [] as (() => void)[], dirty: false }));
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = typeof initial === 'function' ? initial() : initial;
    return [hooks.slots[slot], (value: unknown) => { const next = typeof value === 'function' ? value(hooks.slots[slot]) : value; if (!Object.is(next, hooks.slots[slot])) { hooks.slots[slot] = next; hooks.dirty = true; } }];
  },
  useRef: (value: unknown) => { const slot = hooks.cursor++; if (!(slot in hooks.slots)) hooks.slots[slot] = { current: value }; return hooks.slots[slot]; },
  useEffect: (run: () => void | (() => void), dependencies?: unknown[]) => {
    const slot = hooks.cursor++, old = hooks.slots[slot] as { dependencies?: unknown[]; cleanup?: () => void } | undefined;
    if (!old || !dependencies || dependencies.some((value, index) => !Object.is(value, old.dependencies?.[index]))) {
      hooks.pending.push(() => { old?.cleanup?.(); hooks.slots[slot] = { dependencies, cleanup: run() }; });
    }
  },
}));
const bridge = vi.hoisted(() => ({
  recommend: vi.fn(), lookup: vi.fn(), resolve: vi.fn(), notify: vi.fn(),
  listeners: new Set<(state: Playback) => void>(),
  player: { state: {} as Playback, subscribe: vi.fn(), pause: vi.fn(), load: vi.fn(), play: vi.fn(), volume: vi.fn(), precise: vi.fn(), seek: vi.fn(), stop: vi.fn(), onEnded: () => {}, onNext: () => {}, onPrevious: () => {} },
}));
vi.mock('./useTaskbarControls', () => ({ useTaskbarControls: () => {} }));
vi.mock('../adapters/native', () => ({ mobile: false, library: { recommendCatalog: bridge.recommend, lookupCatalog: bridge.lookup, searchCatalog: vi.fn().mockResolvedValue([]) } }));
vi.mock('../player/service', () => ({ player: bridge.player, playbackTracks: new Map(), prepareCatalogCandidate: vi.fn() }));
import { usePlayback } from './usePlayback';
import { defaults } from '../domain/types';
import { playCollection } from '../domain/queue';
import { catalogQuickPick } from '../domain/quick-picks';
const song = (id: number, artist = `Artist ${id}`, language = 'tamil'): CatalogTrack => ({ id: `itunes:${id}`, title: `Song ${id}`, artist, artists: [{ name: artist }], album: `Album ${id}`, duration: 180, language, genre: 'Pop' });
const playable = (song: CatalogTrack): Track => ({ ...catalogQuickPick(song).track, id: `audio:${song.id}`, metadataSourceId: song.id, format: 'webm' });
let serial = 10000;
let anchor: CatalogTrack;
let sessionRef: { current: Session };
let tracksRef: { current: Track[] };
let records: ListeningRecord[];
let api: ReturnType<typeof usePlayback>;
function emit(next: Partial<Playback>) { bridge.player.state = { ...bridge.player.state, ...next }; bridge.listeners.forEach(listener => listener(bridge.player.state)); }
function render() {
  for (let pass = 0; pass < 10; pass++) {
    hooks.cursor = 0; hooks.dirty = false;
    api = usePlayback({ session: sessionRef.current, sessionRef, tracksRef, tracks: tracksRef.current, listeningRecords: records, update: fn => { sessionRef.current = fn(sessionRef.current); hooks.dirty = true; }, resolveQueuedTrack: bridge.resolve, view: 'home', setView: vi.fn(), notify: bridge.notify, persist: vi.fn(), dialogOpen: false });
    const pending = hooks.pending.splice(0); pending.forEach(run => run());
    if (!hooks.dirty) break;
  }
}
async function settle() { for (let index = 0; index < 50; index++) { await Promise.resolve(); render(); } }
function finish() { emit({ status: 'ended', time: 180 }); bridge.player.onEnded(); render(); }
beforeEach(() => {
  vi.clearAllMocks(); hooks.slots = []; hooks.pending = []; hooks.cursor = 0; bridge.listeners.clear(); records = [];
  anchor = song(serial++);
  const first = playable(anchor); tracksRef = { current: [first] };
  sessionRef = { current: playCollection({ ...defaults(), settings: { ...defaults().settings, autoplay: true } }, [first], 0) };
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('document', { visibilityState: 'visible' });
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ languages: ['tamil', 'hindi'] }) });
  bridge.player.state = { status: 'playing', trackId: first.id, playbackId: 'initial', time: 20, duration: 180, error: null };
  bridge.player.subscribe.mockImplementation(listener => { bridge.listeners.add(listener); return () => bridge.listeners.delete(listener); });
  bridge.player.pause.mockImplementation(() => emit({ status: 'paused' }));
  bridge.player.load.mockImplementation(async id => emit({ status: 'playing', trackId: id, playbackId: `play-${serial++}`, time: 0 }));
  bridge.lookup.mockImplementation(async id => id === anchor.id ? anchor : song(Number(id.split(':')[1])));
  bridge.recommend.mockResolvedValue([song(serial++), song(serial++), song(serial++)]);
  bridge.resolve.mockImplementation(async track => ({ ...track, id: `audio:${track.id}`, metadataSourceId: track.id, format: 'webm' }));
  render();
});
afterEach(() => { vi.unstubAllGlobals(); });

it('keeps playback shortcuts enabled inside the fullscreen player but not other dialogs', () => {
  const callback = vi.mocked(window.addEventListener).mock.calls.find(([name]) => name === 'keydown')?.[1] as (event: KeyboardEvent) => void;
  expect(callback).toBeTypeOf('function');
  for (const blocked of [false, true]) {
    bridge.player.seek.mockClear();
    const event = { key: 'ArrowRight', code: 'ArrowRight', preventDefault: vi.fn(), target: { tagName: 'BUTTON', blur: vi.fn(), closest: (selector: string) => selector.startsWith('dialog[open]:not(.expanded-player)') && blocked ? {} : null } } as unknown as KeyboardEvent;
    callback(event);
    expect(bridge.player.seek).toHaveBeenCalledTimes(blocked ? 0 : 1);
  }
});

it.each(['tamil', 'hindi'])('uses Tracker and favorites without overriding the seed language for %s', async language => {
  const first = song(serial++), loved = song(serial++, 'Loved artist', language);
  tracksRef.current.push(playable(loved)); sessionRef.current.favorites = [playable(loved).id];
  sessionRef.current.favoriteArtists = [{ id: 'itunes:99', name: loved.artist }];
  records = [1, 2, 3].map(day => ({ id: String(day), trackId: playable(loved).id, metadataSourceId: loved.id, title: loved.title, artist: loved.artist, album: loved.album, artworkUrl: null, sourceId: null, providerId: 'youtube', startedAt: Date.now() - day * 86400000, updatedAt: Date.now() - day * 86400000, listenedMs: 180000, days: {} }));
  bridge.recommend.mockResolvedValue([first, loved]); render(); finish(); await settle();
  expect(bridge.player.load).toHaveBeenCalledWith(`audio:${language === anchor.language ? loved.id : first.id}`, true);
  expect(sessionRef.current.queue.at(-1)?.requested).toBe(false);
});
it('supports sparse history and retains its original anchor across twelve autoplay advances without duplicates', async () => {
  const songs = Array.from({ length: 25 }, () => song(serial++)); bridge.recommend.mockResolvedValue(songs);
  for (let index = 0; index < 12; index++) { finish(); await settle(); }
  const ids = sessionRef.current.queue.map(entry => entry.trackId);
  expect(ids).toHaveLength(13); expect(new Set(ids).size).toBe(ids.length);
  expect(bridge.recommend.mock.calls.filter(([id]) => id === anchor.id)).toHaveLength(1);
  expect(bridge.player.load).toHaveBeenCalledTimes(12);
});
it('falls back to anchor radio when personal providers fail and skips unavailable recordings', async () => {
  const taste = playable(song(serial++)); tracksRef.current.push(taste); sessionRef.current.favorites = [taste.id];
  const unavailable = song(serial++), available = song(serial++);
  bridge.recommend.mockImplementation(async id => { if (id === taste.metadataSourceId) throw Error('Offline'); return [unavailable, available]; });
  bridge.resolve.mockImplementation(async track => { if (track.id === unavailable.id) throw Error('Unavailable'); return { ...track, id: `audio:${track.id}`, format: 'webm' }; });
  finish(); await settle();
  expect(bridge.player.load).toHaveBeenCalledWith(`audio:${available.id}`, true);
});
it('never resolves a different-language fallback when matching recordings are unavailable', async () => {
  const unavailable = song(serial++), wrong = song(serial++, 'Loved Hindi', 'hindi');
  bridge.recommend.mockResolvedValue([unavailable, wrong]);
  sessionRef.current.favorites = [wrong.id]; tracksRef.current.push(playable(wrong));
  bridge.resolve.mockRejectedValue(Error('Unavailable'));
  finish(); await settle();
  expect(bridge.resolve.mock.calls.map(([candidate]) => candidate.id)).toEqual([unavailable.id]);
  expect(bridge.player.load).not.toHaveBeenCalled();
});
it('stops safely when seed language metadata cannot be verified', async () => {
  bridge.lookup.mockRejectedValue(Error('Metadata offline'));
  finish(); await settle();
  expect(bridge.resolve).not.toHaveBeenCalled();
  expect(bridge.player.load).not.toHaveBeenCalled();
  expect(bridge.notify).toHaveBeenCalledWith(expect.stringContaining('could not verify'));
});
it.each(['disable', 'manual-queue', 'track-change', 'resume'])('discards an in-flight recommendation after %s', async action => {
  let done!: (track: Track) => void;
  bridge.resolve.mockImplementation(() => new Promise<Track>(resolve => { done = resolve; }));
  finish(); await settle(); expect(bridge.resolve).toHaveBeenCalled();
  const manual = playable(song(serial++));
  if (action === 'disable') sessionRef.current = { ...sessionRef.current, settings: { ...sessionRef.current.settings, autoplay: false } };
  if (action === 'manual-queue') api.queueRemote(manual, true);
  if (action === 'track-change') api.playTrack(manual);
  if (action === 'resume') emit({ status: 'playing' });
  render(); bridge.player.load.mockClear();
  done(playable(song(serial++))); await settle();
  expect(bridge.player.load).not.toHaveBeenCalled();
  if (action === 'manual-queue') expect(sessionRef.current.queue.at(-1)?.trackId).toBe(manual.id);
});
it('preserves manual queue priority and never asks radio while a manual next song exists', async () => {
  const manual = playable(song(serial++)); api.queueRemote(manual, true); render(); finish(); await settle();
  expect(bridge.recommend).not.toHaveBeenCalled();
  expect(bridge.player.load).toHaveBeenCalledWith(manual.id, true, 0);
});

it('starts autoplay from completion without waiting for a visible React render', async () => {
  Object.assign(document, { visibilityState: 'hidden' });
  emit({ status: 'ended', time: 180 });
  bridge.player.onEnded();
  for (let index = 0; index < 10; index++) await Promise.resolve();
  expect(bridge.recommend).toHaveBeenCalled();
  await settle();
  expect(bridge.player.load).toHaveBeenCalledTimes(1);
});
it.each(['explicit-next', 'seek', 'error', 'manual-change'])('records a weak skip only for explicit Next, not %s', async action => {
  if (action === 'explicit-next') { bridge.player.onNext(); await settle(); }
  if (action === 'seek') api.seek(60);
  if (action === 'error') emit({ status: 'error', error: 'Network failure' });
  const manual = playable(song(serial++)), alternative = song(serial++);
  api.playTrack(manual); render();
  bridge.recommend.mockResolvedValue([anchor, alternative]);
  bridge.player.load.mockClear(); finish(); await settle();
  expect(bridge.player.load).toHaveBeenCalledWith(`audio:${action === 'explicit-next' ? alternative.id : anchor.id}`, true);
});
