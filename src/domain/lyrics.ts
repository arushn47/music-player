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
  };
}

export function activeLine(doc: LyricDocument, mediaMs: number): string | null {
  const clock = mediaMs - doc.fileOffset - doc.userOffset;
  let active: string | null = null;
  for (const line of doc.lines)
    if (line.time !== null && line.time <= clock) active = line.id;
  return active;
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
