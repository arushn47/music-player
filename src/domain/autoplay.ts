import type { CatalogTrack } from '../adapters/native';
import type { Track } from './types';
import { catalogQueueTrack } from './catalog-track';
import { isQueuedCatalog } from './queue';
import { sourceTitle } from './source-matching';

// Alternate editions are the same song for autoplay, even if the recording differs.
export const autoplayTitle = (title: string): string => sourceTitle(title)
  .replace(/\s*[([][^)\]]*\b(?:acoustic|reprise|remix|remaster(?:ed)?|live|instrumental|karaoke|cover|version|edit|slowed|sped|reverb|lofi|lo-fi)\b[^)\]]*[)\]]/gi, '')
  .replace(/\s*[-–—:]\s*(?:acoustic|reprise|remix|remaster(?:ed)?|live|instrumental|karaoke|cover|slowed|sped|lofi|lo-fi)\b.*$/i, '').trim();
const key = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');
export function autoplayCandidates(candidates: CatalogTrack[], seed: Track, queued: Track[]): CatalogTrack[] {
  const seen = new Set(queued.map(track => key(autoplayTitle(track.title))));
  seen.add(key(autoplayTitle(seed.title)));
  return candidates.filter(track => {
    const title = key(autoplayTitle(track.title));
    if (!title || seen.has(title) || queued.some(known => [known.id, known.metadataSourceId].includes(track.id))) return false;
    seen.add(title);
    return true;
  });
}

export async function resolveAutoplayCandidate(
  candidates: CatalogTrack[],
  resolve: (track: Track) => Promise<Track>,
  active: () => boolean,
): Promise<Track | null> {
  // Check two recordings at a time so one slow source cannot hold up a playable alternative.
  const choices = candidates.slice(0, 5);
  for (let index = 0; index < choices.length; index += 2) {
    if (!active()) return null;
    try {
      const track = await Promise.any(choices.slice(index, index + 2).map(async candidate => {
        if (!active()) throw new Error('Cancelled');
        const resolved = await resolve(catalogQueueTrack(candidate));
        if (!active() || isQueuedCatalog(resolved) || resolved.missing) throw new Error('Unavailable');
        return resolved;
      }));
      return active() ? track : null;
    } catch {
      if (!active()) return null;
    }
  }
  return null;
}
