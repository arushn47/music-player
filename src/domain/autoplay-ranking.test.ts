import { expect, it } from 'vitest';
import { rankAutoplay, type AutoplayContext, type AutoplayPreferences, type RadioCandidate } from './autoplay-ranking';
import { defaults } from './types';
import { catalogQuickPick } from './quick-picks';
import type { CatalogTrack } from '../adapters/native';
import type { ListeningRecord } from './listening';
import radioFixtures from './fixtures/autoplay-radio.json';
import magaleFixture from './fixtures/autoplay-magale.json';

const now = Date.UTC(2026, 9, 25);
const song = (id: string, artist = id, lang = 'tamil'): CatalogTrack => ({ id: `itunes:${id}`, title: `Song ${id}`, artist, artists: [{ name: artist }], album: `Album ${id}`, duration: 180, language: lang, genre: 'Pop' });
const anchor = song('1', 'Anchor');
const track = (song: CatalogTrack) => catalogQuickPick(song).track;
const pool = (...songs: CatalogTrack[]): RadioCandidate[] => songs.map((track, position) => ({ track, position, sources: ['anchor', 'context'] }));
const preferences = (): AutoplayPreferences => ({ session: defaults(), saved: [], records: [], languages: ['tamil'] });
const context = (): AutoplayContext => ({ anchor: track(anchor), current: track(anchor), metadata: [anchor], recent: [], skipped: [], excluded: [track(anchor)], now });
const record = (song: CatalogTrack, age = 0, listenedMs = 180000): ListeningRecord => ({ id: `listen-${song.id}-${age}`, trackId: song.id, title: song.title, artist: song.artist, album: song.album, artworkUrl: null, providerId: null, sourceId: null, listenedMs, startedAt: now - age, updatedAt: now - age, days: {} });

it('keeps radio order on cold start, filters unsupported languages and remains deterministic', () => {
  const candidates = pool(song('2'), song('3'), song('4', 'Other', 'german'));
  const result = rankAutoplay(candidates, preferences(), context());
  expect(result.map(item => item.track.id)).toEqual(['itunes:2', 'itunes:3']);
  expect(rankAutoplay(candidates, preferences(), context())).toEqual(result);
});
it('connects repeat listening duration, likes and favorite artists to explainable ranking', () => {
  const loved = song('3', 'Loved'), unrelated = song('2');
  const pref = preferences();
  pref.records = [record(loved), record(loved, 86400000), record(loved, 2 * 86400000)];
  pref.saved = [track(loved)]; pref.session.favorites = [loved.id];
  pref.session.favoriteArtists = [{ id: 'itunes:5', name: loved.artist }];
  const result = rankAutoplay(pool(unrelated, loved), pref, context());
  expect(result[0].track.id).toBe(loved.id);
  expect(result[0].reasons.join(',')).toContain('artist-affinity');
  expect(result[0].reasons.join(',')).toContain('liked-song:4');
});
it('weights recent meaningful listening more than old or accidental starts without making short plays dislikes', () => {
  const recent = song('2', 'Recent'), old = song('3', 'Old'), short = song('4', 'Short');
  const pref = preferences();
  pref.records = [record(recent, 86400000), record(old, 180 * 86400000), record(short, 0, 1000)];
  const result = rankAutoplay(pool(old, short, recent), pref, context());
  expect(result[0].track.id).toBe(recent.id);
  expect(result.find(item => item.track.id === short.id)?.reasons.join(',')).not.toContain('skip');
});
it('never admits a different language through preferences or learned history', () => {
  const hindi = song('3', 'Tamil Artist Name', 'hindi'), unknown = song('4', 'Hindi Singer', 'german');
  const pref = preferences(); pref.records = [record(hindi)];
  expect(rankAutoplay(pool(hindi, unknown), pref, context())).toEqual([]);
  pref.records = []; pref.languages.push('hindi');
  expect(rankAutoplay(pool(hindi), pref, context())).toEqual([]);
});
it.each(['tamil', 'malayalam', 'hindi', 'english'])('requires the original %s language even for heavily liked alternatives', lang => {
  const seed = {...anchor, language: lang};
  const ctx = {...context(), anchor: track(seed), metadata: [seed]};
  const wrong = song('9', 'Loved', lang === 'hindi' ? 'tamil' : 'hindi');
  const correct = song('2', 'New', lang);
  const pref = preferences(); pref.languages = [wrong.language!]; pref.saved = [track(wrong)];
  pref.session.favorites = [wrong.id]; pref.session.favoriteArtists = [{id: 'artist', name: wrong.artist}];
  pref.records = Array.from({length: 20}, (_, i) => record(wrong, i * 1000));
  expect(rankAutoplay(pool(wrong, correct), pref, ctx).map(item => item.track.id)).toEqual([correct.id]);
});
it('does not guess missing seed or candidate languages', () => {
  expect(rankAutoplay(pool(song('2')), preferences(), {...context(), metadata: []})).toEqual([]);
  for (const language of [null, '', 'unknown', 'und']) expect(rankAutoplay(pool({...song('2'), language}), preferences(), context())).toEqual([]);
});
it('cannot broaden the pool with current or taste radio, even in the same language', () => {
  expect(rankAutoplay([{track: song('2'), position: 0, sources: ['taste', 'context']}], preferences(), context())).toEqual([]);
});
it('filters incompatible recordings before duplicate-title detection', () => {
  const good = song('2'), wrong = {...song('3', 'Other', 'hindi'), title: good.title};
  expect(rankAutoplay(pool(wrong, good), preferences(), context()).map(item => item.track.id)).toEqual([good.id]);
});
it('rejects known genre conflicts and permits untagged same-language radio as the agreed fallback', () => {
  expect(rankAutoplay(pool({...song('2'), genre: null}, {...song('3'), genre: 'Rock'}), preferences(), context()).map(item => item.track.id)).toEqual(['itunes:2']);
});
it('excludes queued editions and recent explicit skips, then decays skip penalties', () => {
  const skipped = song('2'), alternate = { ...song('3'), title: `${anchor.title} (Slowed + Reverb)` };
  const ctx = context(); ctx.skipped = [{ track: track(skipped), at: now - 60000 }];
  expect(rankAutoplay(pool(skipped, alternate), preferences(), ctx)).toEqual([]);
  ctx.skipped[0].at = now - 3600000;
  expect(rankAutoplay(pool(skipped), preferences(), ctx)[0].reasons.join(',')).toContain('explicit-skip:');
  ctx.skipped[0].at = now - 2 * 86400000;
  expect(rankAutoplay(pool(skipped), preferences(), ctx)[0].reasons.join(',')).not.toContain('explicit-skip');
});
it('blocks excessive artists, preserves language continuity, and periodically boosts anchor-related discovery', () => {
  const sameArtist = song('2', 'Repeated'), discovery = song('3', 'New');
  const ctx = context(); ctx.recent = [song('10', 'Repeated'), song('11', 'Repeated'), song('12', 'Third')];
  const result = rankAutoplay(pool(sameArtist, discovery), preferences(), ctx);
  expect(result.map(item => item.track.id)).toEqual([discovery.id]);
  expect(result[0].reasons.join(',')).toContain('discovery:5');
  expect(result[0].reasons.join(',')).not.toContain('language-repeat');
});
it('keeps the anchor influential when the latest autoplay song drifts to a different artist', () => {
  const ctx = context(); ctx.current = track(song('9', 'Drift'));
  const a = song('2'), b = song('3');
  const result = rankAutoplay([{ track: a, sources: ['anchor'], position: 0 }, { track: b, sources: ['context'], position: 0 }], preferences(), ctx);
  expect(result[0].track.id).toBe(a.id);
});
it('continues discovery turns after the bounded recent-track window is full', () => {
  const ctx = context(); ctx.turn = 84; ctx.recent = Array.from({ length: 80 }, (_, index) => song(String(index + 100)));
  expect(rankAutoplay(pool(song('2', 'New')), preferences(), ctx)[0].reasons.join(',')).toContain('discovery:5');
});
it('prioritizes a reliably matching genre over a liked seed artist in a different genre', () => {
  const match = song('2', 'New artist'), mismatch = { ...song('3', anchor.artist), genre: 'Rock' };
  const pref = preferences(); pref.saved = [track(mismatch)]; pref.session.favorites = [mismatch.id];
  pref.records = [record(mismatch), record(mismatch, 86400000), record(mismatch, 2 * 86400000)];
  const result = rankAutoplay(pool(mismatch, match), pref, context());
  expect(result[0].track.id).toBe(match.id);
  expect(result[0].reasons).toContain('anchor-genre:12.00');
  expect(result.map(item => item.track.id)).toEqual([match.id]);
});
it('does not promote the seed artist or album ahead of better ordered related radio songs', () => {
  const related = song('2', 'New artist');
  const albumTrack = { ...song('3', anchor.artist), album: anchor.album };
  const result = rankAutoplay(pool(related, albumTrack), preferences(), context());
  expect(result[0].track.id).toBe(related.id);
  expect(result[1].reasons).toContain('anchor-album:-6.00');
  expect(result[1].reasons.join(',')).not.toMatch(/anchor-artist|current-artist/);
});
it('keeps the original language after drift instead of penalizing language continuity', () => {
  const ctx = context(); ctx.current = track(song('9', 'Current', 'hindi'));
  ctx.metadata.push(song('9', 'Current', 'hindi'));
  ctx.recent = [song('10'), song('11')];
  const pref = preferences(); pref.languages = ['tamil', 'hindi'];
  const result = rankAutoplay(pool(song('3', 'Other', 'hindi'), song('2')), pref, ctx);
  expect(result[0].track.language).toBe('tamil');
  expect(result[0].reasons).toContain('anchor-language:6.00');
});
it('relaxes artist caps when a small radio has no remaining diverse candidates', () => {
  const ctx = context(); ctx.recent = [song('10', 'Repeated'), song('11', 'Repeated')];
  const result = rankAutoplay(pool(song('2', 'Repeated')), preferences(), ctx);
  expect(result).toHaveLength(1);
  expect(result[0].reasons).toContain('artist-cap-relaxed');
});
it('does not invent genre, mood or energy from language labels, titles or artist names', () => {
  const ctx = context(); ctx.metadata = [{ ...anchor, genre: 'Tamil Soundtrack' }];
  const result = rankAutoplay(pool({ ...song('2', 'Energetic Rock Singer'), genre: null }), preferences(), ctx);
  expect(result[0].reasons.join(',')).not.toMatch(/genre|mood|energy/);
});
it('keeps the captured Magale radio Tamil despite a liked Hindi injection', () => {
  const wrong = {...song('999', 'Loved Hindi', 'hindi'), genre: null};
  const pref = preferences(); pref.languages = ['hindi']; pref.saved = [track(wrong)];
  pref.session.favorites = [wrong.id]; pref.records = [record(wrong)];
  const result = rankAutoplay(pool(wrong, ...magaleFixture.radio), pref, {
    ...context(), anchor: track(magaleFixture.seed), current: track(magaleFixture.seed), metadata: [magaleFixture.seed], excluded: [track(magaleFixture.seed)],
  });
  expect(result.length).toBeGreaterThan(0);
  expect(result.every(item => item.track.language === 'tamil')).toBe(true);
  expect(result.some(item => item.track.id === wrong.id)).toBe(false);
});

it.each(radioFixtures)('continues ten distinct related picks from real radio for $seed.title', ({ seed, radio }) => {
  const recent: CatalogTrack[] = [], seedTrack = track(seed);
  const pref = preferences(); pref.languages = [seed.language!];
  for (let turn = 1; turn <= 10; turn++) {
    const ranked = rankAutoplay(pool(...radio), pref, {
      anchor: seedTrack, current: seedTrack, metadata: [seed], recent,
      skipped: [], excluded: [seedTrack, ...recent.map(track)], turn, now,
    });
    expect(ranked.length).toBeGreaterThan(0);
    const next = ranked[0];
    expect(next.track.language).toBe(seed.language);
    expect(recent.some(item => item.id === next.track.id)).toBe(false);
    expect(next.reasons.join(',')).not.toMatch(/anchor-artist|current-artist|genre|energy|mood/);
    recent.push(next.track);
  }
});
