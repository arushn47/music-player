import type { Playlist, Session, Track } from "./types";
import { catalogQueueTrack } from "./catalog-track";
import { isQueuedCatalog } from "./queue";
import { item } from "./types";

export interface SharedPlaylist { id: string; name: string; tracks: Track[] }
export interface SharedState { playlists: SharedPlaylist[]; now: { track: Track; position: number; playing: boolean } | null }

export function portableTrack(track?: Track | null): Track | null {
  if (!track) return null;
  const catalog = track.metadataSourceId && catalogQueueTrack({ id: track.metadataSourceId, title: track.title, artist: track.artist, album: track.album, duration: track.duration, artworkUrl: track.artworkUrl, artists: [] });
  if (catalog && isQueuedCatalog(catalog)) return catalog;
  if (!track.source) return null;
  return { ...track, fileName: "", offline: false, missing: false, artworkUrl: track.artworkUrl?.startsWith("https://") ? track.artworkUrl : null };
}
const fingerprint = (name: string, ids: string[]) => JSON.stringify([name, ids]);

export function mergeSharedPlaylists(session: Session, playlists: SharedPlaylist[]): { session: Session; added: number; conflicts: number } {
  const result = [...session.playlists]; let added = 0, conflicts = 0;
  for (const shared of playlists) {
    const next = fingerprint(shared.name, shared.tracks.map(track => track.id));
    const index = result.findIndex(playlist => playlist.syncSource === shared.id);
    const old = result[index];
    if (old?.syncFingerprint === next) continue;
    const modified = old && fingerprint(old.name, old.items.map(entry => entry.trackId)) !== (old.syncLocalFingerprint || old.syncFingerprint);
    const name = modified || old?.name.endsWith(" (device copy)") ? `${shared.name} (device copy)` : shared.name;
    const playlist: Playlist = { id: old && !modified ? old.id : crypto.randomUUID(), name, items: shared.tracks.map(track => item(track.id)), syncSource: shared.id, syncFingerprint: next, syncLocalFingerprint: fingerprint(name, shared.tracks.map(track => track.id)) };
    if (modified) { conflicts++; result[index] = { ...old, syncSource: undefined, syncFingerprint: undefined, syncLocalFingerprint: undefined }; }
    if (old && !modified) result[index] = playlist;
    else result.push(playlist);
    added++;
  }
  return { session: { ...session, playlists: result }, added, conflicts };
}
