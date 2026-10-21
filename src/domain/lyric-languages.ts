import type { LyricDocument } from "./types";

export function languageCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((code) => {
    if (typeof code !== "string" || !/^[a-z]{2,3}(?:-[a-z]{2,8})*$/i.test(code)) return [];
    try { return [new Intl.Locale(code).language]; } catch { return []; }
  }))];
}

export function lyricLanguageNames(doc: LyricDocument): string[] {
  const codes = [...new Set(doc.lines.flatMap((line) => languageCodes(doc.lineLanguages?.[line.id])))];
  const names = new Intl.DisplayNames(["en"], { type: "language" });
  return codes.map((code) => names.of(code) || code).sort();
}

export function englishLine(doc: LyricDocument, id: string): boolean {
  const codes = languageCodes(doc.lineLanguages?.[id]);
  return codes.length === 1 && codes[0] === "en";
}

export function sameLyricText(left: string, right: string): boolean {
  const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}]/gu, "").replace(/\s+/g, " ").trim();
  return normalize(left) === normalize(right);
}

export function englishLyrics(doc: LyricDocument): boolean {
  if (doc.englishOnly) return true;
  if (!doc.languageSource) return false;
  const sung = doc.lines.filter(line => /\p{L}/u.test(line.text) && !/^\s*\[.*\]\s*$/.test(line.text));
  return sung.length > 0 && sung.every(line => englishLine(doc, line.id));
}
