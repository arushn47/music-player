import { library, type CatalogTrack } from './native';
import { blendDiscoveryResults, loadDiscoverPage, type DiscoveryLanguage } from './discovery-home';
import { catalogQuickPick, selectQuickPicks, sameRecommendation, type QuickPickCandidate, type QuickPickPreferences } from '../domain/quick-picks';
import { isCatalogId, isQueuedCatalog } from '../domain/queue';
import type { Track } from '../domain/types';

const radio = new Map<string, { at: number; request: Promise<CatalogTrack[]> }>();
export function recommendations(id: string): Promise<CatalogTrack[]> {
  const cached = radio.get(id);
  if (cached && Date.now() - cached.at < 30 * 60000) return cached.request;
  const request = library.recommendCatalog(id).catch(error => { radio.delete(id); throw error; });
  if (radio.size >= 24) radio.delete(radio.keys().next().value!);
  radio.set(id, { at: Date.now(), request });
  return request;
}
const seedMatches = new Map<string, { at: number; request: Promise<string | undefined> }>();
export function seedId(track: Track): Promise<string | undefined> {
  const id = track.metadataSourceId || track.id;
  if (isCatalogId(id)) return Promise.resolve(id);
  if (!track.artist.trim() || /^unknown/i.test(track.artist)) return Promise.resolve(undefined);
  const key = JSON.stringify([track.title, track.artist]);
  const cached = seedMatches.get(key);
  if (cached && Date.now() - cached.at < 30 * 60000) return cached.request;
  const request = library.searchCatalog(`${track.title} ${track.artist}`.slice(0, 200), 5)
    .then(matches => matches.find(match => sameRecommendation({ track }, catalogQuickPick(match)))?.id)
    .catch(() => { seedMatches.delete(key); return undefined; });
  if (seedMatches.size >= 24) seedMatches.delete(seedMatches.keys().next().value!);
  seedMatches.set(key, { at: Date.now(), request });
  return request;
}
export async function loadQuickPickPool(languages: DiscoveryLanguage[], seeds: Track[], active: () => boolean): Promise<QuickPickCandidate[]> {
  if (!active()) return [];
  let accepting = true;
  const groups: CatalogTrack[][] = [];
  const tasks = [
    loadDiscoverPage(languages).then(value => [...value.trending, ...value.newSingles, ...value.topSongs]),
    ...seeds.slice(0, 3).map(async track => {
      const id = await seedId(track);
      return id && accepting && active() ? recommendations(id) : [];
    }),
  ].map(async (task, index) => {
    const songs = await task;
    if (accepting && active()) groups[index] = songs;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Optional metadata gets one shared budget; a slow radio must not hold up the feed.
  await Promise.race([Promise.allSettled(tasks), new Promise<void>(resolve => { timer = setTimeout(resolve, 2500); })]);
  clearTimeout(timer);
  accepting = false;
  return active() ? blendDiscoveryResults(groups.filter(Boolean), 160).map(catalogQuickPick) : [];
}

export function quickPickTracks(pool: QuickPickCandidate[], preferences: QuickPickPreferences, onlineAvailable: boolean): Track[] {
  const eligible = pool.filter(({ track }) => {
    if (track.missing) return false;
    if (track.offline) return true;
    if (isQueuedCatalog(track)) return onlineAvailable;
    if (track.format === 'catalog') return false;
    if (track.source?.providerId === 'youtube') return onlineAvailable && /^[\w-]{11}$/.test(track.source.sourceId);
    if (track.source?.providerId === 'wikimedia-commons') return !!track.source.sourceId;
    return !track.source && !!track.fileName;
  });
  // Stream matching/extraction belongs to Play, never to rendering a recommendation shelf.
  return selectQuickPicks(eligible, preferences).map(candidate => candidate.track);
}
