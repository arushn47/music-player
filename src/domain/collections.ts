import type { Playlist, Session, Track } from "./types";

export interface Collection {
  id: string;
  name: string;
  description: string;
  tracks: Track[];
  playlist?: Playlist;
}

/** Derived membership avoids migrations and never rewrites user playlists. */
export function libraryCollections(
  tracks: Track[],
  playlists: Playlist[],
): Collection[] {
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const builtins = [
    {
      id: "collection:local",
      name: "Local",
      description: "Files linked from your device",
      tracks: tracks.filter((track) => !track.source),
    },
    {
      id: "collection:online",
      name: "Saved online",
      description: "Saved sources · connection required",
      tracks: tracks.filter((track) => track.source && !track.offline),
    },
    {
      id: "collection:downloads",
      name: "Downloads",
      description: "Available offline on this device",
      tracks: tracks.filter((track) => track.offline),
    },
  ].filter((collection) => collection.tracks.length);
  return [
    ...builtins,
    ...playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      description: "Your playlist",
      playlist,
      tracks: playlist.items.flatMap((item) => {
        const track = byId.get(item.trackId);
        return track ? [track] : [];
      }),
    })),
  ];
}

export function withoutTrack(session: Session, id: string): Session {
  const queue = session.queue.filter((entry) => entry.trackId !== id);
  const currentRemoved = !queue.some((entry) => entry.id === session.currentId);
  const index = Math.max(
    0,
    session.queue.findIndex((entry) => entry.id === session.currentId),
  );
  const currentId = currentRemoved
    ? (queue[Math.min(index, queue.length - 1)]?.id ?? null)
    : session.currentId;
  return {
    ...session,
    queueTracks: Object.fromEntries(
      Object.entries(session.queueTracks).filter(([trackId]) => trackId !== id),
    ),
    queue,
    currentId,
    position: currentRemoved ? 0 : session.position,
    favorites: session.favorites.filter((trackId) => trackId !== id),
    playlists: session.playlists.map((playlist) => ({
      ...playlist,
      items: playlist.items.filter((entry) => entry.trackId !== id),
    })),
    lyrics: Object.fromEntries(
      Object.entries(session.lyrics).filter(([trackId]) => trackId !== id),
    ),
    history: session.history.filter((entry) => entry.trackId !== id),
  };
}
