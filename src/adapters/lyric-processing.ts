import { invoke } from "@tauri-apps/api/core";
import type { LyricDocument } from "../domain/types";
import { languageCodes } from "../domain/lyric-languages";

export const GEMINI_KEY_CHANGED = "lumaire:gemini-key-changed";
export const GEMINI_PROCESS_RETRY = "lumaire:gemini-process-retry";
export type LyricProcessingState = {
  status: "idle" | "processing" | "complete" | "error";
  message?: string;
};
export type ProcessedLyrics = {
  romanisation: Record<string, string>;
  translation: Record<string, string>;
  lineLanguages?: Record<string, string[]>;
};
const pending = new Map<string, Promise<ProcessedLyrics>>();

export function processLyrics(
  doc: LyricDocument,
  model: string,
): Promise<ProcessedLyrics> {
  const key = JSON.stringify([doc.id, doc.raw, model]);
  const existing = pending.get(key);
  if (existing) return existing;
  const request = invoke<ProcessedLyrics>("process_lyrics", {
    lines: doc.lines.map(({ id, text }) => ({ id, text })),
    model,
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export function mergeProcessedLyrics(
  current: LyricDocument,
  original: LyricDocument,
  values: ProcessedLyrics,
  model: string,
): LyricDocument {
  if (current.id !== original.id || current.raw !== original.raw)
    return current;
  // A supplied file or a manual change made while Gemini was working wins.
  const romanisation =
    current.romanisationSource === "imported"
      ? current.romanisation
      : {
          ...current.romanisation,
          ...Object.fromEntries(
            Object.entries(values.romanisation).filter(
              ([id]) =>
                !current.romanisation[id] ||
                current.romanisation[id] === current.localRomanisation?.[id] ||
                (current.romanisationSource === "gemini" &&
                  current.romanisation[id] === original.romanisation[id]),
            ),
          ),
        };
  const translation =
    current.translationSource === "imported"
      ? current.translation
      : {
          ...current.translation,
          ...Object.fromEntries(
            Object.entries(values.translation).filter(
              ([id]) =>
                !current.translation[id] ||
                (current.translationSource === "gemini" &&
                  current.translation[id] === original.translation[id]),
            ),
          ),
        };
  const lineLanguages = { ...current.lineLanguages, ...values.lineLanguages };
  const textual = current.lines.filter(line => /\p{L}/u.test(line.text));
  return {
    ...current,
    romanisation,
    translation,
    romanisationSource:
      current.romanisationSource === "imported" ? "imported" : "gemini",
    translationSource:
      current.translationSource === "imported" ? "imported" : "gemini",
    processedModel: model,
    lineLanguages,
    languageSource: values.lineLanguages ? "gemini" : current.languageSource,
    englishOnly: values.lineLanguages ? textual.length > 0 && textual.every(line => {
      const codes = languageCodes(lineLanguages[line.id]);
      return codes.length === 1 && codes[0] === "en";
    }) : current.englishOnly,
  };
}
