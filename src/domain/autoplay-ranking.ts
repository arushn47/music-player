import type { CatalogTrack } from '../adapters/native';
import type { Session, Track } from './types';
import { MIN_LISTEN_MS, historyTrack, type ListeningRecord } from './listening';
import { artistCredits } from './catalog-links';
import { autoplayCandidates } from './autoplay';
import { catalogQuickPick, pickAlbum, pickArtists, recommendationKey, sameRecommendation } from './quick-picks';

export interface RadioCandidate {
  track: CatalogTrack;
  sources: ('anchor' | 'context' | 'taste')[];
  position: number;
}
export interface AutoplayPreferences {
  session: Session;
  saved: Track[];
  records: ListeningRecord[];
  languages: string[];
}
export interface AutoplayContext {
  anchor: Track;
  current: Track;
  metadata: CatalogTrack[];
  recent: CatalogTrack[];
  skipped: { track: Track; at: number }[];
  excluded: Track[];
  turn?: number;
  now?: number;
}
const same = (a: Track, b: Track) => sameRecommendation({ track: a }, { track: b });
const artistsOf = (track: Track) => pickArtists({ track });
const language = (track?: CatalogTrack) => {
  const value = recommendationKey(track?.language || '');
  return ['unknown', 'und', 'zxx'].includes(value) ? '' : value;
};
const genre = (track?: CatalogTrack) => {
  const value = recommendationKey(track?.genre || '');
  return value.includes('soundtrack') || ['unknown', 'regionalindian', 'indian', 'world', 'hindi', 'tamil', 'telugu', 'malayalam', 'kannada', 'punjabi', 'bengali', 'marathi', language(track)].includes(value) ? '' : value;
};

/** Pure, stable scores; reasons are returned for tests/debugging, never sent to a provider. */
export function rankAutoplay(pool: RadioCandidate[], preferences: AutoplayPreferences, context: AutoplayContext): { track: CatalogTrack; score: number; reasons: string[] }[] {
  const now = context.now ?? Date.now(), day = 86400000;
  const known = [...context.metadata, ...pool.map(item => item.track)];
  const metadata = (track: Track) => known.find(item => [track.id, track.metadataSourceId].includes(item.id))
    ?? (track.title ? known.find(item => same(catalogQuickPick(item).track, track)) : undefined);
  const anchor = metadata(context.anchor), current = metadata(context.current);
  const anchorLanguage = language(anchor);
  if (!anchorLanguage) return [];
  const artistTaste = new Map<string, number>(), albumTaste = new Map<string, number>(), languageTaste = new Map<string, number>();
  const add = (map: Map<string, number>, key: string, weight: number) => { if (key) map.set(key, (map.get(key) || 0) + weight); };
  const boost = (track: Track, weight: number) => {
    artistsOf(track).forEach(artist => add(artistTaste, artist, weight));
    const album = pickAlbum(track);
    if (!album.startsWith('unknown:')) add(albumTaste, album, weight);
    const lang = language(metadata(track));
    if (lang) add(languageTaste, lang, weight);
  };
  const records = preferences.records.filter(record => record.listenedMs >= MIN_LISTEN_MS && record.startedAt <= now)
    .sort((a, b) => b.startedAt - a.startedAt).slice(0, 2000);
  for (const record of records) {
    // Actual listened time, not playback position, supplies duration and repeat signals.
    boost(historyTrack(record), Math.min(3, Math.log2(1 + record.listenedMs / 60000)) * Math.exp(-(now - record.startedAt) / (30 * day)));
  }
  const favorites = new Set(preferences.session.favorites);
  for (const track of preferences.saved) if (favorites.has(track.id) || !!track.metadataSourceId && favorites.has(track.metadataSourceId)) boost(track, 4);
  for (const artist of preferences.session.favoriteArtists) artistCredits(artist.name).forEach(credit => add(artistTaste, recommendationKey(credit.name), 4));
  for (const album of preferences.session.favoriteAlbums) add(albumTaste, pickAlbum({ id: album.id, album: album.title }), 3);
  const affinity = (map: Map<string, number>, keys: string[]) => Math.max(0, ...keys.map(key => Math.min(1, (map.get(key) || 0) / 6)));
  const recentSkips = context.skipped.filter(item => item.at <= now && now - item.at < 10 * 60000).map(item => item.track);
  const anchorGenre = genre(anchor), currentGenre = genre(current);
  const compatible = pool.filter(item => {
    const candidateGenre = genre(item.track);
    return language(item.track) === anchorLanguage && item.sources.includes('anchor')
      && (!anchorGenre || !candidateGenre || candidateGenre === anchorGenre);
  });
  const eligible = new Set(autoplayCandidates(compatible.map(item => item.track), context.current, [...context.excluded, ...recentSkips]).map(track => track.id));
  const recentArtists = context.recent.slice(-3).flatMap(track => artistsOf(catalogQuickPick(track).track));
  const recentAlbums = context.recent.slice(-2).map(track => pickAlbum(catalogQuickPick(track).track));
  const repeated = new Set<string>();
  const discoveryTurn = (context.turn ?? context.recent.length + 1) % 4 === 0;
  const scored = compatible.filter(item => eligible.has(item.track.id)).flatMap(item => {
    const track = item.track, candidate = catalogQuickPick(track).track, artists = artistsOf(candidate), lang = language(track);
    if (!track.title.trim() || !Number.isFinite(track.duration) || track.duration <= 0 || lang !== anchorLanguage || !item.sources.includes('anchor')) return [];
    const candidateGenre = genre(track);
    const repetition = artists.reduce((max, artist) => Math.max(max, recentArtists.filter(other => other === artist).length), 0);
    if (repetition >= 2) repeated.add(track.id);
    const reasons: string[] = [];
    let score = 0;
    const weight = (reason: string, value: number) => { if (value) { score += value; reasons.push(`${reason}:${value.toFixed(2)}`); } };
    weight('anchor-radio', item.sources.includes('anchor') ? 8 : 0);
    weight('current-radio', item.sources.includes('context') ? 4 : 0);
    weight('taste-radio', item.sources.includes('taste') ? 3 : 0);
    weight('provider-order', 3 / (1 + item.position / 5));
    weight('artist-affinity', affinity(artistTaste, artists) * 3);
    weight('album-affinity', affinity(albumTaste, [pickAlbum(candidate)]));
    weight('liked-song', favorites.has(track.id) || preferences.saved.some(saved => favorites.has(saved.id) && same(saved, candidate)) ? 4 : 0);
    weight('anchor-language', lang && lang === language(anchor) ? 6 : 0);
    weight('current-language', lang && lang === language(current) ? 2 : 0);
    weight('preferred-language', lang && preferences.languages.map(recommendationKey).includes(lang) ? 2 : 0);
    weight('learned-language', affinity(languageTaste, [lang]) * 2);
    // Broad catalog/language labels are not musical genres; missing mood/energy stays unknown.
    weight('anchor-genre', candidateGenre && anchorGenre && candidateGenre === anchorGenre ? 12 : 0);
    weight('current-genre', candidateGenre && currentGenre && candidateGenre === currentGenre ? 4 : 0);
    weight('genre-mismatch', candidateGenre && anchorGenre && candidateGenre !== anchorGenre ? -6 : 0);
    weight('anchor-album', pickAlbum(candidate) === pickAlbum(context.anchor) ? -6 : 0);
    weight('artist-repeat', -repetition * 6);
    weight('album-repeat', recentAlbums.includes(pickAlbum(candidate)) ? -4 : 0);
    weight('recent-listen', -Math.min(4, records.filter(record => now - record.updatedAt < day && same(historyTrack(record), candidate)).length * 2));
    const skipped = context.skipped.filter(item => item.at <= now && now - item.at < day && same(item.track, candidate));
    weight('explicit-skip', -skipped.reduce((sum, item) => sum + 2 * Math.exp(-(now - item.at) / (3 * 3600000)), 0));
    weight('discovery', discoveryTurn && affinity(artistTaste, artists) === 0 && item.sources.includes('anchor') ? 5 : 0);
    return [{ track, score, reasons }];
  });
  const best = Math.max(...scored.map(item => item.score));
  const alternatives = scored.filter(item => !repeated.has(item.track.id));
  // Keep related music when the remaining radio has no comparable diverse alternative.
  const strict = alternatives.some(item => item.score >= best - 8);
  const result = strict ? alternatives : scored.map(item => repeated.has(item.track.id) ? { ...item, reasons: [...item.reasons, 'artist-cap-relaxed'] } : item);
  return result.sort((a, b) => b.score - a.score || a.track.id.localeCompare(b.track.id));
}
