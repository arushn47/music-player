import type { CatalogTrack } from "../adapters/native";
import type { ListeningRecord } from "./listening";
import type { Track } from "./types";

const key = (text: string) => text.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function discoverySeeds(tracks: Track[], favorites: string[], records: ListeningRecord[], now = Date.now()): string[] {
  const scores = new Map<string, { name: string; score: number }>();
  const add = (artist: string, score: number) => artist.split(/,| & /).map(name => name.trim()).filter(Boolean).forEach(name => {
    const id = key(name); const old = scores.get(id); scores.set(id, { name, score: (old?.score || 0) + score });
  });
  tracks.filter(track => favorites.includes(track.id)).forEach(track => add(track.artist, 5));
  records.filter(record => record.listenedMs >= 30000).forEach(record => add(record.artist, Math.min(4, record.listenedMs / 180000) / (1 + Math.max(0, now - record.updatedAt) / (30 * 86400000))));
  return [...scores.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 3).map(value => value.name);
}

export function personalPicks(candidates: CatalogTrack[], seeds: string[], known: Track[], records: ListeningRecord[], now = Date.now()): { track: CatalogTrack; reason: string }[] {
  const seen = new Set(known.map(track => `${key(track.title)}|${key(track.artist)}`));
  const ids = new Set(known.flatMap(track => [track.id, track.metadataSourceId || ""]));
  records.filter(record => now - record.updatedAt < 7 * 86400000).forEach(record => { ids.add(record.metadataSourceId || record.trackId); seen.add(`${key(record.title)}|${key(record.artist)}`); });
  const artists = new Map<string, number>(); const picks: { track: CatalogTrack; reason: string }[] = [];
  const ranked = candidates.map(track => ({ track, seed: seeds.find(seed => key(track.artist).includes(key(seed))) })).filter(value => value.seed).sort((a, b) => seeds.indexOf(a.seed!) - seeds.indexOf(b.seed!) || a.track.title.localeCompare(b.track.title));
  for (const { track, seed } of ranked) {
    const identity = `${key(track.title)}|${key(track.artist)}`, count = artists.get(seed!) || 0;
    if (ids.has(track.id) || seen.has(identity) || count >= 2) continue;
    seen.add(identity); ids.add(track.id); artists.set(seed!, count + 1);
    picks.push({ track, reason: `Because you listen to ${seed}` });
    if (picks.length === 6) break;
  }
  return picks;
}
