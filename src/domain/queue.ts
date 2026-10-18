import { item, type QueueItem, type Session, type Track } from "./types";

/** Playing a single selection replaces the current song, keeping only upcoming requests. */
export function playSelection(
  session: Session,
  track: Track,
  saved: boolean,
): Session {
  const index = session.queue.findIndex(
    (entry) => entry.id === session.currentId,
  );
  const upcoming = session.queue
    .slice(index + 1)
    .filter((entry) => entry.requested);
  const current = item(track.id);
  const queue = [current, ...upcoming];
  const activeIds = new Set(queue.map((entry) => entry.trackId));
  return {
    ...session,
    queue,
    currentId: current.id,
    position: 0,
    queueTracks: Object.fromEntries(
      Object.entries(
        saved
          ? session.queueTracks
          : { ...session.queueTracks, [track.id]: track },
      ).filter(([id]) => activeIds.has(id)),
    ),
  };
}

/** Explicit requests play before the rest of an album/collection, even in shuffle. */
export function enqueue(session: Session, id: string, next = false): Session {
  const queue = [...session.queue];
  const index = queue.findIndex((entry) => entry.id === session.currentId);
  let at = index + 1;
  if (!next) while (at < queue.length && queue[at].requested) at++;
  queue.splice(at, 0, { ...item(id), requested: true });
  return { ...session, queue };
}

export function reorderUpcoming(
  session: Session,
  id: string,
  delta: number,
): Session {
  const current = session.queue.findIndex(
    (entry) => entry.id === session.currentId,
  );
  const from = session.queue.findIndex((entry) => entry.id === id);
  if (from <= current || from + delta <= current) return session;
  // A manual reorder specifies the displayed upcoming order, including any
  // collection items moved between explicit requests.
  const queue = move(session.queue, id, delta).map((entry, index) =>
    index > current ? { ...entry, requested: true } : entry,
  );
  return { ...session, queue };
}
export function advance(
  session: Session,
  direction: 1 | -1,
  ended = false,
  random = Math.random,
): string | null {
  const q = session.queue,
    index = q.findIndex((i) => i.id === session.currentId);
  if (!q.length) return null;
  if (ended && session.settings.repeat === "one") return session.currentId;
  if (direction === 1) {
    const requested = q.slice(index + 1).find((entry) => entry.requested);
    if (requested) return requested.id;
  }
  if (session.settings.shuffle && q.length > 1) {
    const other = q.filter((i) => i.id !== session.currentId);
    return other[
      Math.min(other.length - 1, Math.floor(random() * other.length))
    ].id;
  }
  const next = index + direction;
  if (next >= 0 && next < q.length) return q[next].id;
  if (session.settings.repeat === "all")
    return q[(next + q.length) % q.length].id;
  return null;
}
export function move(
  items: QueueItem[],
  id: string,
  delta: number,
): QueueItem[] {
  const out = [...items],
    from = out.findIndex((i) => i.id === id),
    to = from + delta;
  if (from < 0 || to < 0 || to >= out.length) return out;
  [out[from], out[to]] = [out[to], out[from]];
  return out;
}
