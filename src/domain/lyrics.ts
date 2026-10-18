import type { LyricDocument } from "./types";

// Source line IDs depend on source order/occurrence, never on a timing offset or supplied variant.
export function parseLyrics(raw: string, fileName = "Lyrics"): LyricDocument {
  if (raw.length > 1_048_576)
    throw new Error("Lyric files must be smaller than 1 MB.");
  const lines: LyricDocument["lines"] = [],
    warnings: string[] = [];
  let fileOffset = 0,
    offsetTags = 0,
    timed = false;
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  text.split("\n").forEach((line, index) => {
    const offset = line.match(/^\[offset:([+-]?\d+)\]\s*$/i);
    if (offset) {
      const value = Number(offset[1]);
      if (Number.isSafeInteger(value) && Math.abs(value) <= 86400000) {
        fileOffset = value;
        offsetTags++;
      } else
        warnings.push(
          `Line ${index + 1}: file offset is outside the supported one-day range.`,
        );
      return;
    }
    if (/^\[(ar|ti|al|by|length|re|ve):.*\]\s*$/i.test(line)) return;
    const stamps = [
      ...line.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g),
    ];
    if (stamps.length) {
      timed = true;
      const body = line
        .replace(/\[\d{1,3}:[0-5]\d(?:[.:]\d{1,3})?\]/g, "")
        .trim();
      stamps.forEach((s, occurrence) =>
        lines.push({
          id: `l${index}-${occurrence}`,
          time:
            (Number(s[1]) * 60 + Number(s[2])) * 1000 +
            Number((s[3] || "").padEnd(3, "0")),
          text: body,
        }),
      );
    } else if (line.trim()) {
      if (/^\[.*\]/.test(line))
        warnings.push(
          `Line ${index + 1}: unsupported or invalid timestamp; shown as text.`,
        );
      lines.push({ id: `l${index}-0`, time: null, text: line.trim() });
    }
  });
  if (offsetTags > 1)
    warnings.push("Multiple file offsets: the last valid offset is used.");
  if (timed) lines.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
  if (!lines.length) throw new Error("The file contains no lyric lines.");
  return {
    id: crypto.randomUUID(),
    raw,
    fileName,
    lines,
    fileOffset,
    userOffset: 0,
    warnings,
    romanisation: {},
    translation: {},
    timingMode: timed ? "synced" : "unsynced",
  };
}

export function activeLine(doc: LyricDocument, mediaMs: number): string | null {
  if (doc.timingMode === "unsynced") return null;
  const clock = mediaMs - doc.fileOffset - doc.userOffset;
  let active: string | null = null;
  for (const line of doc.lines)
    if (line.time !== null && line.time <= clock) active = line.id;
  return active;
}

export function synchronizedLyrics(
  doc: LyricDocument,
  duration: number,
): boolean {
  if (
    doc.timingMode === "unsynced" ||
    doc.instrumental ||
    !doc.lines.some((line) => line.time !== null)
  )
    return false;
  // Legacy cached documents may contain LRC from a different-duration edition.
  if (
    doc.source &&
    (duration <= 0 || Math.abs(doc.source.duration - duration) > 2)
  )
    return false;
  return !doc.lines.some(
    (line) =>
      line.time !== null && duration > 0 && line.time > (duration + 2) * 1000,
  );
}

/** Approximate reading position only. Never assign timestamps or enable seeking. */
export function estimatedFollowLine(
  doc: LyricDocument,
  time: number,
  duration: number,
): string | null {
  if (
    !Number.isFinite(time) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    doc.instrumental
  )
    return null;
  const lines = doc.lines.filter((line) => line.text.trim());
  if (!lines.length) return null;
  const progress = Math.max(0, Math.min(1, time / duration));
  const weights = lines.map((line) =>
    Math.max(1, Array.from(line.text.trim()).length),
  );
  const target = progress * weights.reduce((sum, weight) => sum + weight, 0);
  let read = 0;
  for (let i = 0; i < lines.length; i++) {
    read += weights[i];
    if (target < read) return lines[i].id;
  }
  return lines.at(-1)!.id;
}

export function normalizeCachedLyrics(
  doc: LyricDocument,
  duration: number,
): LyricDocument {
  if (!doc.source) return doc; // Preserve explicitly imported local documents.
  const unsynced = !synchronizedLyrics(
    { ...doc, timingMode: "synced" },
    duration,
  );
  const warnings = doc.warnings.filter(
    (warning) => !warning.startsWith("The selected lyric recording is "),
  );
  const timingMode = unsynced ? "unsynced" : "synced";
  if (timingMode === doc.timingMode && warnings.length === doc.warnings.length)
    return doc;
  return {
    ...doc,
    warnings,
    timingMode,
  };
}

// A supplied LRC must have identical occurrence timestamps. Plain text requires explicit row confirmation.
export function alignVariant(
  original: LyricDocument,
  supplied: LyricDocument,
): Record<string, string> {
  if (original.lines.length !== supplied.lines.length)
    throw new Error(
      `Line count differs (${original.lines.length} original, ${supplied.lines.length} supplied). Attach a variant with one matching row per original line.`,
    );
  const timed = supplied.lines.some((l) => l.time !== null);
  if (timed && supplied.lines.some((l, i) => l.time !== original.lines[i].time))
    throw new Error(
      "The supplied timestamps differ from the original. Use matching LRC timestamps, or a plain text file with one row per line.",
    );
  return Object.fromEntries(
    original.lines.map((l, i) => [l.id, supplied.lines[i].text]),
  );
}
