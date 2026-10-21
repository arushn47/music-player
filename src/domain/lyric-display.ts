import type { LyricDocument, LyricLine, Preferences, Session } from "./types";
import { sameLyricText, englishLyrics } from "./lyric-languages";

export function lyricSourceLink(doc: LyricDocument): { name: string; url: string } | undefined {
  const source = doc.source;
  if (source?.provider === "lrclib" && typeof source.recordId === "number" && Number.isSafeInteger(source.recordId) && source.recordId > 0)
    return { name: "LRCLIB", url: `https://lrclib.net/tracks/${source.recordId}` };
  if (source?.provider === "lrc.red" && typeof source.recordId === "string" && /^[A-Z]{2}[A-Z0-9]{10}$/.test(source.recordId))
    return { name: "lrc.red", url: `https://lrc.red/s/${source.recordId}` };
}

export function lyricLayers(
  doc: LyricDocument,
  line: LyricLine,
  settings: Preferences,
) {
  const roman = settings.romanisation ? doc.romanisation[line.id] : "";
  const layers: { kind: "original" | "roman" | "translation"; text: string }[] =
    [];
  // A line without a Roman variant stays readable even in Roman-only mode.
  if (settings.originalScript || !roman)
    layers.push({ kind: "original", text: line.text || "♪" });
  if (roman) {
    const layer = { kind: "roman" as const, text: roman };
    if (settings.originalFirst) layers.push(layer);
    else layers.unshift(layer);
  }
  if (settings.translation && !englishLyrics(doc) && doc.translation[line.id] && !sameLyricText(line.text, doc.translation[line.id]))
    layers.push({ kind: "translation", text: doc.translation[line.id] });
  return layers;
}

export function isFetchedLyrics(doc: LyricDocument): boolean {
  return (
    doc.origin === "provider" ||
    !!doc.source ||
    (!!doc.instrumental && doc.fileName === "Instrumental · LRCLIB")
  );
}

export function clearFetchedLyrics(session: Session): Session {
  return {
    ...session,
    lyrics: Object.fromEntries(
      Object.entries(session.lyrics).filter(([, doc]) => !isFetchedLyrics(doc)),
    ),
  };
}
