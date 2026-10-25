import { beforeEach, expect, it, vi } from 'vitest';
import { library } from './native';
import { loadDiscoverPage } from './discovery-home';
import { quickPickTracks, loadQuickPickPool } from './quick-picks';
import { catalogQuickPick, type QuickPickCandidate } from '../domain/quick-picks';
import type { CatalogTrack } from './native';
vi.mock('./native', () => ({ library: { media: vi.fn(), recommendCatalog: vi.fn(), searchCatalog: vi.fn(), resolveCommons: vi.fn(), ytdlpSearch: vi.fn(), ytdlpGetStream: vi.fn() } }));
vi.mock('./discovery-home', async () => ({ ...await vi.importActual<typeof import('./discovery-home')>('./discovery-home'), loadDiscoverPage: vi.fn() }));
const catalog = (id: string, album = id, artist = id): CatalogTrack => ({ id, title: `Song ${id}`, artist, album, artists: [{ name: artist }], duration: 180 });
const local = (id: string, album = id, artist = id): QuickPickCandidate => ({ track: { id, title: `Song ${id}`, artist, album, duration: 180, format: 'mp3', fileName: id, missing: false } });
const preferences = { records: [], favorites: [], languages: [] };
const feed = (songs: CatalogTrack[]) => ({ newAlbums: [], newSingles: [], trending: songs, topSongs: [], chartTitle: '', warnings: [] });
beforeEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
it('returns immediately with globally diverse local/catalog picks and performs zero media or stream requests', () => {
  const pool = [...Array.from({ length: 12 }, (_, i) => local(`petta${i}`, 'Petta', `Singer ${i}`)), ...Array.from({ length: 24 }, (_, i) => catalogQuickPick(catalog(`saavn:song${String(i).padStart(4, '0')}`, `Album ${i}`, `Artist ${i % 8}`)))];
  const tracks = quickPickTracks(pool, preferences, true);
  expect(tracks).toHaveLength(20); expect(tracks.filter(track => track.album === 'Petta').length).toBeLessThanOrEqual(2);
  expect(tracks.some(track => track.format === 'catalog')).toBe(true); expect(tracks.some(track => track.format === 'mp3')).toBe(true);
  for (const method of [library.media, library.ytdlpSearch, library.ytdlpGetStream, library.resolveCommons]) expect(method).not.toHaveBeenCalled();
});
it('rejects known missing tracks and invalid playback identities, and retains downloads/local tracks when the engine is unavailable', () => {
  const missing = local('missing'); missing.track.missing = true;
  const online = catalogQuickPick(catalog('saavn:abcdefgh')), invalid = catalogQuickPick(catalog('saavn:bad'));
  const downloaded = local('downloaded'); downloaded.track.offline = true;
  const tracks = quickPickTracks([missing, invalid, online, local('local'), downloaded], preferences, false);
  expect(tracks.map(track => track.id).sort()).toEqual(['downloaded', 'local']);
  expect(quickPickTracks([invalid], preferences, true)).toEqual([]);
});
it('blends multiple personal radios with discovery, tolerates provider failure and reuses cached radios', async () => {
  const seeds = ['saavn:seed0001', 'saavn:seed0002', 'saavn:seed0003'].map(id => catalogQuickPick(catalog(id)).track);
  vi.mocked(loadDiscoverPage).mockResolvedValue(feed(Array.from({ length: 100 }, (_, i) => catalog(`feed${i}`))));
  vi.mocked(library.recommendCatalog).mockImplementation(async id => { if (id.endsWith('3')) throw Error('Offline'); return [catalog(`radio${id}`)]; });
  const pool = await loadQuickPickPool(['tamil'], seeds, () => true);
  expect(pool.some(candidate => candidate.track.id === 'radiosaavn:seed0001')).toBe(true);
  expect(pool.some(candidate => candidate.track.id === 'radiosaavn:seed0002')).toBe(true);
  await loadQuickPickPool(['tamil'], seeds.slice(0, 2), () => true); expect(library.recommendCatalog).toHaveBeenCalledTimes(3);
});
it('uses the available feed within 2.5 seconds even if personal radios never settle', async () => {
  vi.useFakeTimers();
  try {
    vi.mocked(loadDiscoverPage).mockResolvedValue(feed([catalog('saavn:fast0001')]));
    vi.mocked(library.recommendCatalog).mockReturnValue(new Promise(() => {}));
    const work = loadQuickPickPool(['tamil'], [catalogQuickPick(catalog('saavn:slow0001')).track], () => true);
    await vi.advanceTimersByTimeAsync(2500);
    expect((await work).map(candidate => candidate.track.id)).toEqual(['saavn:fast0001']);
  } finally { vi.useRealTimers(); }
});
it('does not launch a late radio after local seed matching exceeds the metadata budget, or schedule work after navigation', async () => {
  vi.useFakeTimers();
  try {
    let resolve: ((songs: CatalogTrack[]) => void) | undefined;
    vi.mocked(loadDiscoverPage).mockResolvedValue(feed([]));
    vi.mocked(library.searchCatalog).mockReturnValue(new Promise(done => { resolve = done; }));
    const seed = local('slow-local'); const work = loadQuickPickPool(['tamil'], [seed.track], () => true);
    await vi.advanceTimersByTimeAsync(2500); expect(await work).toEqual([]);
    resolve!([{ ...catalog('saavn:late0001'), title: seed.track.title, artist: seed.track.artist, artists: [{ name: seed.track.artist }] }]);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(library.recommendCatalog).not.toHaveBeenCalled();
    vi.clearAllMocks(); await loadQuickPickPool(['tamil'], [], () => false); expect(loadDiscoverPage).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
