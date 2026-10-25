import { romanizeDocument } from "../domain/romanization";
import { invoke } from "@tauri-apps/api/core";
import type { LyricDocument } from "../domain/types";
import { languageCodes, englishLyrics } from "../domain/lyric-languages";
import { mobile } from "./native";

export const GEMINI_KEY_CHANGED = "lumaire:gemini-key-changed";
export const GEMINI_PROCESS_RETRY = "lumaire:gemini-process-retry";
export type LyricProcessingState = {
  status: "idle" | "processing" | "complete" | "error";
  message?: string;
  provider?: "gemini" | "google";
};
export type ProcessedLyrics = {
  romanisation: Record<string, string>;
  translation: Record<string, string>;
  lineLanguages?: Record<string, string[]>;
  warnings?: string[];
  incomplete?: boolean;
};
const pending = new Map<string, Promise<ProcessedLyrics>>();

export async function processPreferredLyrics(doc: LyricDocument, model: string, language: string): Promise<{
  values: ProcessedLyrics;
  provider: "gemini" | "google";
  model: string;
}> {
  const keyed = await invoke<boolean>("gemini_key_status");
  const provider = keyed ? "gemini" : "google";
  return {
    values: keyed && doc.processedModel === model && doc.languageSource === "gemini"
      ? { romanisation: {}, translation: {} }
      : await (keyed ? processLyrics(doc, model) : processKeylessLyrics(doc, language)),
    provider,
    model: keyed ? model : `google-web:${language}`,
  } as const;
}

export function processKeylessLyrics(doc: LyricDocument, language: string): Promise<ProcessedLyrics> {
  if (englishLyrics(doc)) return Promise.resolve({ romanisation: {}, translation: {}, lineLanguages: doc.lineLanguages });
  const lines = doc.lines.filter(line => !(doc.processedModel === `google-web:${language}` && doc.translationSource === "google" && doc.translation[line.id]));
  if (!lines.length) return Promise.resolve({ romanisation: {}, translation: {} });
  const key = JSON.stringify(["google", doc.id, doc.raw, language, lines.map(line => line.id)]);
  const existing = pending.get(key);
  if (existing) return existing;
  const request = invoke<ProcessedLyrics>("process_keyless_lyrics", {
    lines: lines.map(({ id, text }) => ({ id, text })), language,
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export function processLyrics(
  doc: LyricDocument,
  model: string,
): Promise<ProcessedLyrics> {
  if (englishLyrics(doc)) return Promise.resolve({ romanisation: {}, translation: {}, lineLanguages: doc.lineLanguages });
  const key = JSON.stringify([doc.id, doc.raw, model]);
  const existing = pending.get(key);
  if (existing) return existing;
  const request = invoke<ProcessedLyrics>("process_lyrics", {
    lines: doc.lines.map(({ id, text }) => ({ id, text })),
    model,
  }).then(async values => {
    if (!values.warnings?.length) return values;
    try {
      const local = await romanizeDocument({ ...doc, romanisation: {}, romanisationSource: undefined });
      return { ...values, romanisation: { ...local, ...values.romanisation } };
    } catch {
      return { ...values, warnings: [...values.warnings, "Offline pronunciation could not load; valid translations were kept."] };
    }
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export function mergeProcessedLyrics(
  current: LyricDocument,
  original: LyricDocument,
  values: ProcessedLyrics,
  model: string,
  provider: "gemini" | "google" = "gemini",
): LyricDocument {
  if (current.id !== original.id || current.raw !== original.raw)
    return current;
  if (current.processedModel !== original.processedModel && current.processedModel !== model) return current;
  // Supplied text and concurrent manual/provider changes win.
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
                ((current.romanisationSource === "gemini" || current.romanisationSource === "google") &&
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
                ((current.translationSource === "gemini" || current.translationSource === "google") &&
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
      current.romanisationSource === "imported" ? "imported" : Object.keys(values.romanisation).length ? provider : current.romanisationSource,
    translationSource:
      current.translationSource === "imported" ? "imported" : Object.keys(values.translation).length ? provider : current.translationSource,
    processedModel: values.incomplete ? undefined : model,
    lineLanguages,
    languageSource: values.lineLanguages ? provider : current.languageSource,
    englishOnly: values.lineLanguages ? textual.length > 0 && textual.every(line => {
      const codes = languageCodes(lineLanguages[line.id]);
      return codes.length === 1 && codes[0] === "en";
    }) : current.englishOnly,
  };
}
