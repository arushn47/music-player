import { describe, expect, it } from "vitest";
import { parseLyrics } from "../domain/lyrics";
import { mergeProcessedLyrics } from "./lyric-processing";

describe("background Gemini result ownership", () => {
  it("retains per-line languages and recognizes a confirmed English document", () => {
    const doc = parseLyrics("I love you\nStay with me");
    const lineLanguages = Object.fromEntries(doc.lines.map(line => [line.id, ["en"]]));
    const next = mergeProcessedLyrics(doc, doc, { romanisation: {}, translation: {}, lineLanguages }, "model");
    expect(next.lineLanguages).toEqual(lineLanguages);
    expect(next.englishOnly).toBe(true);
    expect(next.languageSource).toBe("gemini");
    expect(mergeProcessedLyrics({ ...doc, raw: "Changed" }, doc, { romanisation: {}, translation: {}, lineLanguages }, "model").lineLanguages).toBeUndefined();
  });
  it("replaces generated local pronunciation and caches the model without changing timing", () => {
    const doc = parseLyrics("[00:01]தமிழ்");
    const id = doc.lines[0].id;
    const current = {
      ...doc,
      romanisation: { [id]: "thamizh" },
      localRomanisation: { [id]: "thamizh" },
    };
    const next = mergeProcessedLyrics(
      current,
      doc,
      { romanisation: { [id]: "Tamil" }, translation: { [id]: "Tamil" } },
      "model",
    );
    expect(next.romanisation[id]).toBe("Tamil");
    expect(next.translation[id]).toBe("Tamil");
    expect(next.lines).toBe(doc.lines);
    expect(next.processedModel).toBe("model");
  });
  it("preserves supplied text, concurrent edits and a replaced original", () => {
    const doc = parseLyrics("[00:01]தமிழ்");
    const id = doc.lines[0].id;
    const current = {
      ...doc,
      romanisation: { [id]: "My pronunciation" },
      translation: { [id]: "My meaning" },
    };
    const values = {
      romanisation: { [id]: "AI" },
      translation: { [id]: "AI" },
    };
    const next = mergeProcessedLyrics(current, doc, values, "model");
    expect(next.romanisation[id]).toBe("My pronunciation");
    expect(next.translation[id]).toBe("My meaning");
    const replaced = { ...current, id: "replacement" };
    expect(mergeProcessedLyrics(replaced, doc, values, "model")).toBe(replaced);
  });
});
