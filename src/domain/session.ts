import { defaults, type QueueItem, type Session, type Track } from "./types";
// Backups and database contents are untrusted. Normalize before rendering or playing.
export function restoreSession(value: unknown, tracks: Track[]): Session {
  const base = defaults();
  if (!value || typeof value !== "object") return base;
  const v = value as Partial<Session>,
    savedIds = new Set(tracks.map((t) => t.id));
  const requestedIds = new Set(
    Array.isArray(v.queue) ? v.queue.map((entry) => entry?.trackId) : [],
  );
  const queueTracks: Record<string, Track> = {};
  // Only stable remote identities can be restored without a library row. Local
  // file access always requires the backend's saved path mapping.
  for (const [id, candidate] of Object.entries(v.queueTracks ?? {})
    .filter(([id]) => requestedIds.has(id) && !savedIds.has(id))
    .slice(0, 500)) {
    const t = candidate as Track;
    const source = t?.source;
    if (t?.id !== id || !source || typeof source.sourceId !== "string")
      continue;
    const youtube =
      source.providerId === "youtube" &&
      /^[A-Za-z0-9_-]{11}$/.test(source.sourceId);
    const commons =
      source.providerId === "wikimedia-commons" &&
      /^[1-9]\d*$/.test(source.sourceId);
    if (
      (!youtube && !commons) ||
      id !== `${source.providerId}:${source.sourceId}` ||
      ![
        t.title,
        t.artist,
        t.album,
        t.fileName,
        t.format,
        source.pageUrl,
        source.license,
        source.licenseUrl,
        source.attribution,
      ].every((value) => typeof value === "string") ||
      !Number.isFinite(t.duration)
    )
      continue;
    queueTracks[id] = {
      id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      fileName: t.fileName,
      duration: Math.max(0, t.duration),
      format: t.format,
      missing: false,
      artworkUrl:
        typeof t.artworkUrl === "string" && t.artworkUrl.startsWith("https://")
          ? t.artworkUrl
          : null,
      source: {
        providerId: source.providerId,
        sourceId: source.sourceId,
        pageUrl: youtube
          ? `https://www.youtube.com/watch?v=${source.sourceId}`
          : `https://commons.wikimedia.org/?curid=${source.sourceId}`,
        license: source.license,
        licenseUrl: source.licenseUrl,
        attribution: source.attribution,
      },
    };
  }
  const ids = new Set([...savedIds, ...Object.keys(queueTracks)]);
  const cleanItems = (items: unknown, validIds = ids): QueueItem[] =>
    Array.isArray(items)
      ? items
          .filter(
            (i) =>
              i &&
              typeof i.id === "string" &&
              typeof i.trackId === "string" &&
              validIds.has(i.trackId),
          )
          .slice(0, 50000)
          .map((i) => ({
            id: i.id,
            trackId: i.trackId,
            ...(i.requested === true ? { requested: true } : {}),
          }))
      : [];
  const queue = cleanItems(v.queue);
  // Item IDs must remain unique, even when the same track is intentionally repeated.
  const seen = new Set<string>();
  for (const i of queue) {
    if (seen.has(i.id)) i.id = crypto.randomUUID();
    seen.add(i.id);
  }
  const p = v.settings ?? base.settings;
  return {
    ...base,
    queue,
    queueTracks,
    currentId: queue.some((i) => i.id === v.currentId)
      ? v.currentId!
      : (queue[0]?.id ?? null),
    position: Number.isFinite(v.position) ? Math.max(0, Number(v.position)) : 0,
    favorites: Array.isArray(v.favorites)
      ? v.favorites.filter((id) => savedIds.has(id))
      : [],
    playlists: Array.isArray(v.playlists)
      ? v.playlists
          .filter(
            (p) => p && typeof p.id === "string" && typeof p.name === "string",
          )
          .map((p) => ({
            ...p,
            name: p.name.slice(0, 100),
            items: cleanItems(p.items, savedIds),
          }))
      : [],
    lyrics:
      v.lyrics && typeof v.lyrics === "object"
        ? Object.fromEntries(
            Object.entries(v.lyrics).filter(
              ([id, d]) =>
                ids.has(id) &&
                d &&
                typeof d.raw === "string" &&
                typeof d.fileName === "string" &&
                Array.isArray(d.warnings) &&
                d.warnings.every((w) => typeof w === "string") &&
                Array.isArray(d.lines) &&
                d.lines.every(
                  (l) =>
                    l &&
                    typeof l.id === "string" &&
                    typeof l.text === "string" &&
                    (l.time === null || Number.isFinite(l.time)),
                ) &&
                Number.isFinite(d.fileOffset) &&
                Number.isFinite(d.userOffset) &&
                d.romanisation &&
                d.translation &&
                Object.values(d.romanisation).every(
                  (t) => typeof t === "string",
                ) &&
                Object.values(d.translation).every(
                  (t) => typeof t === "string",
                ),
            ),
          )
        : {},
    history: Array.isArray(v.history)
      ? v.history
          .filter((h) => h && ids.has(h.trackId) && typeof h.at === "string")
          .slice(-500)
      : [],
    settings: {
      volume: Number.isFinite(p.volume)
        ? Math.min(1, Math.max(0, p.volume))
        : 0.75,
      repeat: ["all", "one"].includes(p.repeat) ? p.repeat : "off",
      shuffle: p.shuffle === true,
      romanisation: p.romanisation !== false,
      translation: p.translation !== false,
      originalScript: p.originalScript !== false,
      originalFirst: p.originalFirst !== false,
      autoOpenLyrics: p.autoOpenLyrics === true,
      estimatedScroll: p.estimatedScroll !== false,
      geminiModel:
        typeof p.geminiModel === "string" &&
        /^[A-Za-z0-9._-]{1,100}$/.test(p.geminiModel)
          ? p.geminiModel
          : base.settings.geminiModel,
      lyricSize: Number.isFinite(p.lyricSize)
        ? Math.max(18, Math.min(46, p.lyricSize))
        : 28,
      historyEnabled: p.historyEnabled !== false,
    },
  };
}
