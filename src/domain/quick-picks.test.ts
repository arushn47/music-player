import { describe, expect, it } from 'vitest';
import { pickAlbum, pickArtists, quickPickSeeds, selectQuickPicks, type QuickPickCandidate } from './quick-picks';
import type { ListeningRecord } from './listening';
const now = Date.UTC(2026, 9, 24);
const song = (id: string, album = id, artist = `Artist ${id}`, genre = 'Film'): QuickPickCandidate => ({
  track: { id, title: `Song ${id}`, album, artist, duration: 180, fileName: `${id}.mp3`, missing: false, format: 'mp3' }, genre,
});
const record = (candidate: QuickPickCandidate, id = 'listen', ago = 10, ms = 120000): ListeningRecord => ({
  id, trackId: candidate.track.id, title: candidate.track.title, artist: candidate.track.artist, album: candidate.track.album,
  providerId: null, sourceId: null, artworkUrl: null, startedAt: now - ago * 86400000, updatedAt: now - ago * 86400000, listenedMs: ms, days: {},
});
const prefs = { records: [] as ListeningRecord[], favorites: [] as string[], languages: ['tamil'], now };
function assertCaps(picks: QuickPickCandidate[]) {
  const albums = new Map<string, number>(), artists = new Map<string, number>();
  for (const candidate of picks) {
    const album = pickAlbum(candidate.track); albums.set(album, (albums.get(album) || 0) + 1);
    for (const artist of pickArtists(candidate)) artists.set(artist, (artists.get(artist) || 0) + 1);
  }
  expect(Math.max(0, ...albums.values())).toBeLessThanOrEqual(2);
  expect(Math.max(0, ...artists.values())).toBeLessThanOrEqual(3);
}
describe('personalized Quick Picks', () => {
  it('fixes Petta concentration across the entire 20-song set, including collaborations and alternate provider album IDs', () => {
    const petta = Array.from({ length: 20 }, (_, i) => ({ ...song(`petta${i}`, i % 2 ? 'Petta' : 'Petta (Original Motion Picture Soundtrack)', 'Anirudh'), artists: ['Anirudh', `Singer ${i}`] }));
    const others = Array.from({ length: 30 }, (_, i) => song(`other${i}`, `Album ${i}`, `Artist ${i % 10}`));
    const picks = selectQuickPicks([...petta, ...others], { ...prefs, records: [record(petta[0])], favorites: [petta[1].track.id] });
    expect(picks).toHaveLength(20); assertCaps(picks);
    expect(picks.filter(pick => pickAlbum(pick.track) === 'petta')).toHaveLength(2);
    expect(new Set(picks.map(pick => pickAlbum(pick.track))).size).toBeGreaterThanOrEqual(10);
  });
  it('uses favorites and listening affinities, while retaining relevant discoveries instead of random diversity', () => {
    const favorite = song('favorite', 'Known album', 'Loved artist', 'Jazz');
    const familiar = song('familiar', 'Other album', 'Other loved artist', 'Jazz');
    const relevant = Array.from({ length: 6 }, (_, i) => song(`jazz${i}`, `Jazz ${i}`, `New jazz artist ${i}`, 'Jazz'));
    const unrelated = Array.from({ length: 15 }, (_, i) => song(`metal${i}`, `Metal ${i}`, `Metal artist ${i}`, 'Metal'));
    const picks = selectQuickPicks([...unrelated, ...relevant, favorite, familiar], { ...prefs, favorites: ['favorite'], records: [record(familiar)] }, 6);
    expect(picks.map(pick => pick.track.id)).toContain('favorite');
    expect(picks.some(pick => pick.track.id.startsWith('jazz'))).toBe(true);
    expect(picks.filter(pick => pick.genre === 'Jazz').length).toBeGreaterThan(picks.filter(pick => pick.genre === 'Metal').length);
    expect(selectQuickPicks([...unrelated, ...relevant, favorite, familiar], { ...prefs, favorites: ['favorite'], records: [record(familiar)] }, 6)).toEqual(picks);
  });
  it('deduplicates local/catalog IDs and cross-provider editions by title plus performer, without merging unrelated artists', () => {
    const local = song('local', 'Album', 'Singer'); local.track.metadataSourceId = 'saavn:abcdefgh';
    const duplicate = song('saavn:abcdefgh', 'Album', 'Singer');
    const edition = song('itunes:123', 'Album', 'Singer'); edition.track.title = 'Song local (Remastered)';
    const other = song('different', 'Different', 'Different singer'); other.track.title = local.track.title;
    const picks = selectQuickPicks([local, duplicate, edition, other], prefs);
    expect(picks.map(pick => pick.track.id)).toEqual(['local', 'different']);
  });
  it('filters overplayed songs using session counts and looped listening, but ignores accidental starts', () => {
    const repeated = song('repeated'), looped = song('looped'), accidental = song('accidental'), older = song('older');
    const records = [record(repeated, 'a', 1), record(repeated, 'b', 2), record(repeated, 'c', 3), record(looped, 'loop', 1, 600000), ...[1, 2, 3].map(i => record(accidental, `short${i}`, 1, 1000)), record(older, 'old', 10, 900000)];
    expect(selectQuickPicks([repeated, looped, accidental, older], { ...prefs, records }).map(pick => pick.track.id).sort()).toEqual(['accidental', 'older']);
  });
  it('counts a shared artist across collaborations instead of treating each credit string as a new artist', () => {
    const pool = Array.from({ length: 12 }, (_, i) => ({ ...song(`joint${i}`, `Album ${i}`), artists: ['Shared singer', `Guest ${i}`] }));
    const picks = selectQuickPicks(pool, prefs); expect(picks).toHaveLength(3); assertCaps(picks);
  });
  it('mixes familiar/local tracks with online discoveries when both are available', () => {
    const local = Array.from({ length: 10 }, (_, i) => song(`local${i}`));
    const online = Array.from({ length: 15 }, (_, i) => {
      const candidate = song(`online${i}`); candidate.track.format = 'catalog'; return candidate;
    });
    const picks = selectQuickPicks([...online, ...local], { ...prefs, favorites: local.map(candidate => candidate.track.id) }, 10);
    expect(picks.some(pick => pick.track.format === 'catalog')).toBe(true);
    expect(picks.some(pick => pick.track.format === 'mp3')).toBe(true);
    assertCaps(picks);
  });
  it('relaxes soft balance for small/offline pools, returns fewer picks rather than breaking hard caps, and rejects malformed tracks', () => {
    const pool = Array.from({ length: 8 }, (_, i) => song(`small${i}`, 'Only album', 'Only artist'));
    const missing = song('missing'); missing.track.missing = true;
    const invalid = song('invalid'); invalid.track.duration = NaN;
    expect(selectQuickPicks([...pool, missing, invalid], prefs)).toHaveLength(2);
    expect(selectQuickPicks([], prefs)).toEqual([]);
    const unknown = [song('u1', 'Unknown album'), song('u2', 'Unknown album'), song('u3', 'Unknown album')];
    expect(selectQuickPicks(unknown, prefs)).toHaveLength(3);
  });
  it('uses verified language metadata as a preference, never guessing language from artist names', () => {
    const tamil = song('tamil'); tamil.language = 'Tamil';
    const hindi = song('hindi'); hindi.language = 'Hindi';
    expect(selectQuickPicks([hindi, tamil], prefs, 1)[0].track.id).toBe('tamil');
  });
});

it('seeds radios from favorites and unsaved history, including overplayed songs as taste signals, across different artists', () => {
  const liked = song('liked', 'Album', 'Favorite singer'), recent = song('history', 'History album', 'Recent singer');
  const collaboration = song('joint', 'Other album', 'Favorite singer, Guest');
  const seeds = quickPickSeeds([liked.track, collaboration.track], { ...prefs, favorites: ['liked'], records: [record(recent, 'history', 1, 900000)] });
  expect(seeds.map(track => track.id)).toEqual(['liked', 'history']);
});
it('uses favorite artist and album preferences even without liked tracks or listening history', () => {
  const loved = song('loved', 'Favorite album', 'Favorite artist'), unrelated = song('unrelated');
  expect(selectQuickPicks([unrelated, loved], { ...prefs, favoriteArtists: ['Favorite artist'], favoriteAlbums: ['Favorite album'] }, 1)[0].track.id).toBe('loved');
});
