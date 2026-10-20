import type { LyricDocument, LyricLine, Preferences, Session } from "./types";
import { englishLine, sameLyricText } from "./lyric-languages";

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
  if (settings.translation && doc.translation[line.id] && !englishLine(doc, line.id) && !sameLyricText(line.text, doc.translation[line.id]))
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
