import type { CatalogTrack } from '../adapters/native';
import type { Track } from './types';
import { artistCredits } from './catalog-links';
import { catalogQueueTrack } from './catalog-track';
import { autoplayTitle } from './autoplay';
import { MIN_LISTEN_MS, historyTrack, type ListeningRecord } from './listening';

export interface QuickPickCandidate {
  track: Track;
  artists?: string[];
  genre?: string | null;
  language?: string | null;
}
export interface QuickPickPreferences {
  records: ListeningRecord[];
  favorites: string[];
  languages: string[];
  favoriteArtists?: string[];
  favoriteAlbums?: string[];
  now?: number;
}
export const recommendationKey = (value: string): string => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');
const usable = (value: string): boolean => !!value && !/^(unknown(?:artist|album)?|variousartists|youtube|localcollection)$/.test(value);
export function pickArtists(candidate: QuickPickCandidate): string[] {
  return [...new Set((candidate.artists?.length ? candidate.artists : artistCredits(candidate.track.artist).map(credit => credit.name)).map(recommendationKey).filter(usable))];
}
export function pickAlbum(track: Pick<Track, 'album' | 'id'>): string {
  const name = recommendationKey(track.album.replace(/\s*\((?:original\s+)?(?:motion\s+picture\s+)?soundtrack\)\s*$/i, ''));
  return usable(name) ? name : `unknown:${track.id}`;
}
export function catalogQuickPick(track: CatalogTrack): QuickPickCandidate {
  return { track: catalogQueueTrack(track), artists: track.artists.map(credit => credit.name), genre: track.genre, language: track.language };
}
const titleKey = (track: Pick<Track, 'title'>): string => recommendationKey(autoplayTitle(track.title));
export function sameRecommendation(a: QuickPickCandidate, b: QuickPickCandidate): boolean {
  const ids = [a.track.id, a.track.metadataSourceId].filter(Boolean);
  if ([b.track.id, b.track.metadataSourceId].some(id => id && ids.includes(id))) return true;
  return titleKey(a.track) === titleKey(b.track) && pickArtists(a).some(artist => pickArtists(b).includes(artist));
}

export function quickPickSeeds(saved: Track[], preferences: QuickPickPreferences): Track[] {
  const now = preferences.now ?? Date.now(), favorites = new Set(preferences.favorites);
  const liked = saved.filter(track => !track.missing && [track.id, track.metadataSourceId].some(id => id && favorites.has(id)));
  const recent = preferences.records.filter(record => record.listenedMs >= MIN_LISTEN_MS && record.startedAt <= now)
    .sort((a, b) => Math.min(3, Math.log2(1 + b.listenedMs / 60000)) * Math.exp(-(now - b.startedAt) / 2592000000)
      - Math.min(3, Math.log2(1 + a.listenedMs / 60000)) * Math.exp(-(now - a.startedAt) / 2592000000)).map(historyTrack);
  const result: Track[] = [], artists = new Set<string>();
  for (const track of [...liked, ...recent, ...saved.filter(track => !track.missing)]) {
    const credits = pickArtists({ track });
    if (!credits.length || credits.some(artist => artists.has(artist))) continue;
    result.push(track); credits.forEach(artist => artists.add(artist));
    if (result.length === 3) break;
  }
  return result;
}

/** One selection pass owns the limits for the entire shelf, including all sources. */
export function selectQuickPicks(pool: QuickPickCandidate[], preferences: QuickPickPreferences, limit = 20): QuickPickCandidate[] {
  const now = preferences.now ?? Date.now(), day = 86400000;
  const favorites = new Set(preferences.favorites);
  const artists = new Map<string, number>(), albums = new Map<string, number>(), genres = new Map<string, number>(), languages = new Map<string, number>();
  const add = (map: Map<string, number>, key: string, weight: number) => { if (usable(key)) map.set(key, (map.get(key) || 0) + weight); };
  const history = preferences.records.filter(record => record.listenedMs >= MIN_LISTEN_MS && record.startedAt <= now);
  const identityKeys = (track: Pick<Track, 'id' | 'metadataSourceId' | 'title' | 'artist'>, credits: string[]) => [
    ...[track.id, track.metadataSourceId].filter(Boolean).map(id => `id:${id}`),
    ...credits.map(artist => `song:${titleKey(track)}:${artist}`),
  ];
  const historyIndex = new Map<string, Set<ListeningRecord>>(), favoriteKeys = new Set<string>();
  for (const record of history) {
    for (const key of identityKeys({ id: record.trackId, metadataSourceId: record.metadataSourceId, title: record.title, artist: record.artist }, artistCredits(record.artist).map(credit => recommendationKey(credit.name)))) {
      const rows = historyIndex.get(key) || new Set<ListeningRecord>(); rows.add(record); historyIndex.set(key, rows);
    }
  }
  for (const candidate of pool) if ([candidate.track.id, candidate.track.metadataSourceId].some(id => id && favorites.has(id))) {
    identityKeys(candidate.track, pickArtists(candidate)).forEach(key => favoriteKeys.add(key));
  }
  const favorite = (candidate: QuickPickCandidate) => identityKeys(candidate.track, pickArtists(candidate)).some(key => favoriteKeys.has(key));
  const related = (candidate: QuickPickCandidate) => [...new Set(identityKeys(candidate.track, pickArtists(candidate)).flatMap(key => [...(historyIndex.get(key) || [])]))];
  for (const artist of preferences.favoriteArtists || []) artistCredits(artist).forEach(credit => add(artists, recommendationKey(credit.name), 3));
  for (const album of preferences.favoriteAlbums || []) add(albums, pickAlbum({ id: album, album }), 3);
  for (const record of history) {
    const weight = Math.min(3, Math.log2(1 + record.listenedMs / 60000)) * Math.exp(-Math.max(0, now - record.startedAt) / (30 * day));
    artistCredits(record.artist).forEach(credit => add(artists, recommendationKey(credit.name), weight));
    add(albums, pickAlbum({ id: record.trackId, album: record.album }), weight);
  }
  // Provider genres/languages are learned only from known recordings, never inferred from names.
  for (const candidate of pool) {
    const weight = (favorite(candidate) ? 3 : 0) + (related(candidate).length ? 1 : 0);
    if (!weight) continue;
    pickArtists(candidate).forEach(artist => add(artists, artist, weight));
    add(albums, pickAlbum(candidate.track), weight);
    add(genres, recommendationKey(candidate.genre || ''), weight);
    add(languages, recommendationKey(candidate.language || ''), weight);
  }
  for (const map of [artists, albums, genres, languages]) {
    const maximum = Math.max(1, ...map.values());
    for (const [key, weight] of map) map.set(key, Math.min(1, weight / maximum));
  }
  const affinity = (map: Map<string, number>, keys: string[]) => Math.max(0, ...keys.map(key => map.get(key) || 0));
  const candidates: { candidate: QuickPickCandidate; score: number; familiar: boolean; local: boolean }[] = [];
  const seen = new Set<string>();
  for (const candidate of pool) {
    const track = candidate.track, keys = identityKeys(track, pickArtists(candidate));
    if (track.missing || !track.title.trim() || !Number.isFinite(track.duration) || track.duration <= 0 || keys.some(key => seen.has(key))) continue;
    const listens = related(candidate), recent = listens.filter(record => record.startedAt >= now - 7 * day);
    // A long loop in one session counts too; short accidental starts do not.
    if (recent.length >= 3 || recent.reduce((sum, record) => sum + record.listenedMs, 0) >= track.duration * 1000 * 3) continue;
    keys.forEach(key => seen.add(key));
    const familiar = favorite(candidate) || listens.length > 0;
    const score = 1 + (favorite(candidate) ? 4 : 0) + affinity(artists, pickArtists(candidate)) * 6
      + affinity(albums, [pickAlbum(track)]) * 2 + affinity(genres, [recommendationKey(candidate.genre || '')]) * 3
      + affinity(languages, [recommendationKey(candidate.language || '')]) * 2
      + (preferences.languages.some(language => recommendationKey(language) === recommendationKey(candidate.language || '')) ? 2 : 0)
      + (familiar ? 1 : 0) - recent.length * 2;
    candidates.push({ candidate, score, familiar, local: !track.source && track.format !== 'catalog' || !!track.offline });
  }
  const selected: QuickPickCandidate[] = [], albumCounts = new Map<string, number>(), artistCounts = new Map<string, number>(), genreCounts = new Map<string, number>();
  let familiarCount = 0, localCount = 0;
  while (selected.length < limit) {
    let best = -1, bestScore = -Infinity;
    candidates.forEach((item, index) => {
      const album = pickAlbum(item.candidate.track), credits = pickArtists(item.candidate), genre = recommendationKey(item.candidate.genre || '');
      if ((albumCounts.get(album) || 0) >= 2 || credits.some(artist => (artistCounts.get(artist) || 0) >= 3)) return;
      // Soft balance can relax with a small pool; identity and album/artist caps never do.
      const wantedFamiliar = familiarCount < Math.ceil((selected.length + 1) * 0.4);
      const wantedLocal = localCount < Math.ceil((selected.length + 1) * 0.25);
      const score = item.score + (item.familiar === wantedFamiliar ? 18 : 0) + (item.local === wantedLocal ? 6 : 0)
        - (albumCounts.get(album) || 0) * 5 - credits.reduce((max, artist) => Math.max(max, artistCounts.get(artist) || 0), 0) * 4 - (genreCounts.get(genre) || 0) * 0.5;
      if (score > bestScore) { bestScore = score; best = index; }
    });
    if (best < 0) break;
    const [item] = candidates.splice(best, 1), album = pickAlbum(item.candidate.track);
    selected.push(item.candidate); add(albumCounts, album, 1);
    pickArtists(item.candidate).forEach(artist => add(artistCounts, artist, 1));
    add(genreCounts, recommendationKey(item.candidate.genre || ''), 1);
    if (item.familiar) familiarCount++;
    if (item.local) localCount++;
  }
  return selected;
}
