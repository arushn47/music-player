import type { QueueItem, Session } from "./types";
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
