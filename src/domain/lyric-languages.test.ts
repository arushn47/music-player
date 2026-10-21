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
  it("hides only copied translations, even if a different translation is labelled English", () => {
    const doc = parseLyrics("I love you\nHello, WORLD!\nen uyire\nYou are meri jaan");
    const [english, copied, romanized, mixed] = doc.lines;
    doc.lineLanguages = { [english.id]: ["en"], [mixed.id]: ["en", "hi"] };
    doc.translation = { [english.id]: "I really love you", [copied.id]: "hello world", [romanized.id]: "My life", [mixed.id]: "You are my life" };
    const translations = (id: number) => lyricLayers(doc, doc.lines[id], defaults().settings).filter(layer => layer.kind === "translation");
    expect(translations(0)[0].text).toBe("I really love you");
    expect(translations(1)).toEqual([]);
    expect(translations(2)[0].text).toBe("My life");
    expect(translations(3)[0].text).toBe("You are my life");
  });
  it("retains translated mixed-language text despite an incorrect English label", () => {
    const doc = parseLyrics("Kal baarish hogi, stay with me");
    const line = doc.lines[0];
    doc.lineLanguages = { [line.id]: ["en"] };
    doc.translation = { [line.id]: "It will rain tomorrow, stay with me" };
    expect(lyricLayers(doc, line, defaults().settings).at(-1)?.kind).toBe("translation");
    doc.translation[line.id] = "KAL baarish hogi — stay with me!";
    expect(lyricLayers(doc, line, defaults().settings).some(layer => layer.kind === "translation")).toBe(false);
  });
});

it('hides cached English paraphrases for an English-only song while keeping mixed-song translations', () => {
  const doc = parseLyrics("To when it's down, get your money up");
  doc.englishOnly = true;
  doc.translation[doc.lines[0].id] = "Until it goes down, increase your wealth";
  expect(lyricLayers(doc, doc.lines[0], defaults().settings).some(layer => layer.kind === 'translation')).toBe(false);
  doc.englishOnly = false;
  expect(lyricLayers(doc, doc.lines[0], defaults().settings).some(layer => layer.kind === 'translation')).toBe(true);
});

it('recognizes cached English lyrics despite untranslated section labels but preserves unknown mixed lines', () => {
  const doc = parseLyrics('[Chorus: Singer]\nI love you');
  doc.languageSource = 'gemini';
  doc.lineLanguages = { [doc.lines[1].id]: ['eng'] };
  doc.translation = { [doc.lines[1].id]: 'I truly love you' };
  expect(lyricLayers(doc, doc.lines[1], defaults().settings).some(layer => layer.kind === 'translation')).toBe(false);
  doc.lines.push({ id: 'mixed', time: null, text: 'You are meri jaan' });
  expect(lyricLayers(doc, doc.lines[1], defaults().settings).some(layer => layer.kind === 'translation')).toBe(true);
});
