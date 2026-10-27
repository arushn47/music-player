import type { ListeningResume, Session, Track } from './types';
import type { ListeningRecord } from './listening';
import { MIN_LISTEN_MS, historyTrack } from './listening';
import { playbackQueue } from './queue';
import { recommendationKey } from './quick-picks';

export function checkpointListening(session: Session, tracks: Track[], position: number, ended = false, now = Date.now()): Session {
  const queue = session.queue;
  const current = queue.find(entry => entry.id === session.currentId);
  if (!current || queue.length < 2 || queue.length > 1000 || !Number.isFinite(position)) return session;
  const savedById = new Map(tracks.map(track => [track.id, track]));
  const metadata = queue.map(entry => savedById.get(entry.trackId) || session.queueTracks[entry.trackId]);
  if (metadata.some(track => !track || track.missing)) return session;
  const first = metadata[0]!;
  const playlist = session.playlists.find(list => list.items.length === queue.length && list.items.every((entry, index) => entry.trackId === queue[index].trackId || entry.trackId === metadata[index]!.metadataSourceId));
  const album = first.album && !/unknown/i.test(first.album) && metadata.every(track => track!.album === first.album);
  const kind = playlist ? 'playlist' : album ? 'album' : 'queue';
  if (kind === 'queue' && queue.length < 2) return session;
  const id = playlist ? `playlist:${playlist.id}` : album ? `album:${first.album}:${first.artist}` : `queue:${queue[0].id}`;
  const order = playbackQueue(session);
  const last = order[order.length - 1]?.id === current.id;
  const duration = metadata[queue.indexOf(current)]!.duration;
  const completed = last && (ended || (duration > 0 && position >= duration - 2));
  const previous = (session.listeningResumes || []).filter(item => item.id !== id);
  if (completed) return { ...session, listeningResumes: previous };
  if (position < 10 && order[0]?.id === current.id) return session;
  const resume: ListeningResume = {
    id, kind, title: playlist?.name || (album ? first.album : `Queue · ${first.title}`),
    queue: [...queue], queueTracks: Object.fromEntries(metadata.filter(track => !savedById.has(track!.id)).map(track => [track!.id, track!])),
    currentId: current.id, position: Math.max(0, position), shuffleOrder: [...session.shuffleOrder],
    shuffle: session.settings.shuffle, updatedAt: now,
  };
  return { ...session, listeningResumes: [resume, ...previous].slice(0, 12) };
}

export function homeHistory(records: ListeningRecord[], saved: Track[], favorites: string[], online: boolean, now = Date.now()) {
  const groups = new Map<string, { track: Track; last: number; started: number; count: number; recent: number }>();
  const savedById = new Map(saved.map(track => [track.id, track]));
  const identities = new Map<string, string>();
  let firstListen = now;
  for (const record of records) {
    if (record.listenedMs < MIN_LISTEN_MS) continue;
    firstListen = Math.min(firstListen, record.startedAt);
    const track = savedById.get(record.trackId) || (record.providerId === 'youtube' ? historyTrack(record) : undefined);
    if (!track || track.missing || (!online && (track.source?.providerId === 'youtube' || track.format === 'catalog') && !track.offline)) continue;
    const identity = track.metadataSourceId || track.id;
    const fingerprint = `${recommendationKey(track.title)}:${recommendationKey(track.artist)}`;
    const key = identities.get(identity) || identities.get(fingerprint) || identity;
    identities.set(identity, key);
    identities.set(fingerprint, key);
    const existing = groups.get(key);
    if (existing) {
      existing.last = Math.max(existing.last, record.updatedAt);
      existing.started = Math.max(existing.started, record.startedAt);
      existing.count++;
      if (now - record.updatedAt < 30 * 86400000) existing.recent++;
    } else groups.set(key, { track, last: record.updatedAt, started: record.startedAt, count: 1, recent: now - record.updatedAt < 30 * 86400000 ? 1 : 0 });
  }
  const all = [...groups.values()];
  // New libraries need a meaningful gap without waiting a full month for this shelf.
  const forgottenAfter = Math.max(3 * 86400000, Math.min(30 * 86400000, (now - firstListen) / 4));
  const forgotten = all.filter(item => now - item.last >= forgottenAfter && (favorites.includes(item.track.id) || (!!item.track.metadataSourceId && favorites.includes(item.track.metadataSourceId)) || item.count >= 3)).sort((a, b) => b.count - a.count || a.last - b.last).slice(0, 12).map(item => item.track);
  const rotation = all.filter(item => item.recent >= 3 && !forgotten.includes(item.track)).sort((a, b) => b.recent - a.recent || b.last - a.last).slice(0, 12).map(item => item.track);
  // Activity must match Tracker chronology, even when a song also belongs to another shelf.
  const recent = all.sort((a, b) => b.started - a.started).slice(0, 20).map(item => item.track);
  return { recent, rotation, forgotten };
}
