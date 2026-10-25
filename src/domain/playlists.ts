import type { Playlist } from "./types";

export function stampPlaylistUpdates(previous: Playlist[], next: Playlist[], now: number): Playlist[] {
  const existing = new Map(previous.map(playlist => [playlist.id, playlist]));
  return next.map(playlist => {
    const old = existing.get(playlist.id);
    if (old === playlist) return playlist;
    const changed = !old || old.name !== playlist.name ||
      (old.items !== playlist.items && (old.items.length !== playlist.items.length ||
        old.items.some((entry, index) => entry.trackId !== playlist.items[index].trackId)));
    return changed ? { ...playlist, updatedAt: now } : { ...playlist, updatedAt: old.updatedAt };
  });
}
