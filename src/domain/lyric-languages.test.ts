import { describe, expect, it } from "vitest";
import { parseLyrics } from "./lyrics";
import { defaults } from "./types";
import { englishLine, languageCodes, lyricLanguageNames } from "./lyric-languages";
import { lyricLayers } from "./lyric-display";

describe("lyric languages and redundant translation", () => {
  it("normalizes language aliases, lists all sung languages, and tolerates invalid cached values", () => {
    const doc = parseLyrics("Hello\nவணக்கம்\nnamaste");
    doc.lineLanguages = Object.fromEntries(doc.lines.map((line, i) => [line.id, [["eng"], ["ta", "en"], ["hin"]][i]]));
    expect(lyricLanguageNames(doc)).toEqual(["English", "Hindi", "Tamil"]);
    expect(languageCodes(["eng", "en-US", "garbage value", null])).toEqual(["en"]);
    expect(languageCodes("en")).toEqual([]);
    expect(englishLine(doc, doc.lines[1].id)).toBe(false);
  });
  it("hides English and copied translations but preserves translated code-mixed and Romanized lines", () => {
    const doc = parseLyrics("I love you\nHello, WORLD!\nen uyire\nYou are meri jaan");
    const [english, copied, romanized, mixed] = doc.lines;
    doc.lineLanguages = { [english.id]: ["en"], [mixed.id]: ["en", "hi"] };
    doc.translation = { [english.id]: "I really love you", [copied.id]: "hello world", [romanized.id]: "My life", [mixed.id]: "You are my life" };
    const translations = (id: number) => lyricLayers(doc, doc.lines[id], defaults().settings).filter(layer => layer.kind === "translation");
    expect(translations(0)).toEqual([]);
    expect(translations(1)).toEqual([]);
    expect(translations(2)[0].text).toBe("My life");
    expect(translations(3)[0].text).toBe("You are my life");
  });
});
