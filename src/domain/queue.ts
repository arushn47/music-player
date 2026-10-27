import { item, type QueueItem, type Session, type Track } from "./types";

export function isQueuedCatalog(track?: Track | null): boolean {
  if (!track) return false;
  return track.format === "catalog" && track.metadataSourceId === track.id && isCatalogId(track.id);
}
export function isCatalogId(id: string): boolean {
  return /^saavn:[A-Za-z0-9_-]{8}$/.test(id) || /^musicbrainz:recording:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id) || (/^itunes:[1-9]\d{0,19}$/.test(id) && BigInt(id.slice(7)) <= 18446744073709551615n);
}

export function resolveQueueEntry(session: Session, entryId: string, catalogId: string, track: Track): Session {
  if (session.currentId !== entryId || !session.queue.some(entry => entry.id === entryId && entry.trackId === catalogId)) return session;
  const queueTracks = { ...session.queueTracks, [track.id]: track };
  if (track.id !== catalogId) delete queueTracks[catalogId];
  return { ...session, queue: session.queue.map(entry => entry.trackId === catalogId ? { ...entry, trackId: track.id } : entry), queueTracks };
}

/** Background verification must never replace the selected occurrence or resurrect removed entries. */
export function resolveUpcomingCatalog(session: Session, catalogId: string, track: Track): Session {
  const order = playbackQueue(session);
  const current = order.findIndex(entry => entry.id === session.currentId);
  const upcoming = new Set(order.slice(current + 1).filter(entry => entry.trackId === catalogId).map(entry => entry.id));
  if (!upcoming.size || isQueuedCatalog(track) || track.missing || track.metadataSourceId !== catalogId) return session;
  const queue = session.queue.map(entry => upcoming.has(entry.id) ? { ...entry, trackId: track.id } : entry);
  const queueTracks = { ...session.queueTracks, [track.id]: track };
  if (!queue.some(entry => entry.trackId === catalogId)) delete queueTracks[catalogId];
  return { ...session, queue, queueTracks };
}

/** Persist one shuffled sequence so Previous and Up next reflect actual playback. */
export function playbackQueue(session: Session): QueueItem[] {
  if (!session.settings.shuffle || !session.shuffleOrder?.length)
    return session.queue;
  const byId = new Map(session.queue.map((entry) => [entry.id, entry]));
  const order = [...new Set(session.shuffleOrder)].flatMap((id) => {
    const entry = byId.get(id);
    byId.delete(id);
    return entry ? [entry] : [];
  });
  return [...order, ...byId.values()];
}

function shuffled<T>(values: T[], random = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function setShuffle(
  session: Session,
  enabled: boolean,
  random = Math.random,
): Session {
  const order = playbackQueue(session);
  const index = order.findIndex((entry) => entry.id === session.currentId);
  const rest = order.slice(index + 1);
  return {
    ...session,
    settings: { ...session.settings, shuffle: enabled },
    shuffleOrder: enabled
      ? [
          ...order.slice(0, index + 1),
          ...rest.filter((entry) => entry.requested),
          ...shuffled(
            rest.filter((entry) => !entry.requested),
            random,
          ),
        ].map((entry) => entry.id)
      : [],
  };
}

export function playCollection(
  session: Session,
  tracks: Track[],
  startIndex: number,
  random = Math.random,
): Session {
  const selected = tracks[startIndex];
  if (!selected || selected.missing) return session;
  const playable = tracks
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => !track.missing);
  const queue = playable.map(({ track }) => item(track.id));
  const selectedIndex = playable.findIndex(({ index }) => index === startIndex);
  const current = queue[selectedIndex];
  return {
    ...session,
    queue,
    currentId: current.id,
    position: 0,
    shuffleOrder: session.settings.shuffle
      ? [
          current,
          ...shuffled(
            queue.filter((entry) => entry.id !== current.id),
            random,
          ),
        ].map((entry) => entry.id)
      : [],
    queueTracks: {
      ...session.queueTracks,
      ...Object.fromEntries(
        playable
          .filter(({ track }) => track.source || isQueuedCatalog(track))
          .map(({ track }) => [track.id, track]),
      ),
    },
  };
}

/** Playing a single selection replaces the current song, keeping only upcoming requests. */
export function playSelection(
  session: Session,
  track: Track,
  saved: boolean,
): Session {
  const order = playbackQueue(session);
  const index = order.findIndex((entry) => entry.id === session.currentId);
  const upcoming = order.slice(index + 1).filter((entry) => entry.requested);
  const current = item(track.id);
  const queue = [current, ...upcoming];
  const activeIds = new Set(queue.map((entry) => entry.trackId));
  return {
    ...session,
    queue,
    shuffleOrder: session.settings.shuffle
      ? queue.map((entry) => entry.id)
      : [],
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
  const queue = [...playbackQueue(session)];
  const index = queue.findIndex((entry) => entry.id === session.currentId);
  let at = index + 1;
  if (!next) while (at < queue.length && queue[at].requested) at++;
  queue.splice(at, 0, { ...item(id), requested: true });
  const added = { ...session, queue };
  if (!session.settings.shuffle) return added;
  const natural = [...session.queue];
  let insertAt =
    natural.findIndex((entry) => entry.id === session.currentId) + 1;
  if (!next)
    while (insertAt < natural.length && natural[insertAt].requested) insertAt++;
  natural.splice(insertAt, 0, queue[at]);
  return {
    ...session,
    queue: natural,
    shuffleOrder: queue.map((entry) => entry.id),
  };
}

export function reorderUpcoming(
  session: Session,
  id: string,
  delta: number,
): Session {
  const order = [...playbackQueue(session)];
  const current = order.findIndex((entry) => entry.id === session.currentId);
  const from = order.findIndex((entry) => entry.id === id);
  const to = from + delta;
  if (from <= current || !Number.isInteger(delta) || !delta || to <= current || to >= order.length) return session;
  const [entry] = order.splice(from, 1);
  order.splice(to, 0, entry);
  // A manual reorder specifies the displayed upcoming order, including any
  // collection items moved between explicit requests.
  const queue = order.map((entry, index) =>
    index > current ? { ...entry, requested: true } : entry,
  );
  return {
    ...session,
    queue,
    shuffleOrder: session.settings.shuffle
      ? queue.map((entry) => entry.id)
      : [],
  };
}
export function advance(
  session: Session,
  direction: 1 | -1,
  ended = false,
): string | null {
  const q = playbackQueue(session),
    index = q.findIndex((i) => i.id === session.currentId);
  if (!q.length) return null;
  if (ended && session.settings.repeat === "one") return session.currentId;
  const next = index + direction;
  if (next >= 0 && next < q.length) return q[next].id;
  if (session.settings.repeat === "all")
    return q[(next + q.length) % q.length].id;
  return null;
}

export function advanceAfterFailure(session: Session, failed: Set<string>): string | null {
  const order = playbackQueue(session);
  const current = order.findIndex(entry => entry.id === session.currentId);
  for (let step = 1; step < order.length; step++) {
    const index = current + step;
    if (index >= order.length && session.settings.repeat !== "all") break;
    const entry = order[index % order.length];
    if (!failed.has(entry.id)) return entry.id;
  }
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
