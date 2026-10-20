import { describe, expect, it } from "vitest";
import { parseLyrics } from "./lyrics";
import { romanizeDocument } from "./romanization";

describe("romanization quality and alignment", () => {
  it.each([
    ["नमस्ते", "namaste"],
    ["নমস্কার", "namaskaara"],
    ["ਸਤਿ", "sati"],
    ["નમસ્તે", "namaste"],
    ["ନମସ୍କାର", "namaskaara"],
    ["வணக்கம்", "vanakkam"],
    ["నమస్కారం", "namaskaaram"],
    ["ನಮಸ್ಕಾರ", "namaskaara"],
    ["നമസ്കാരം", "namaskaaram"],
    ["ආයුබෝවන්", "aayubovan"],
  ])(
    "transliterates %s without dropping characters",
    async (text, expected) => {
      const doc = parseLyrics(`[00:01]${text}`);
      expect(await romanizeDocument(doc)).toEqual({
        [doc.lines[0].id]: expected,
      });
      expect(doc.lines[0].text).toBe(text);
      expect(doc.lines[0].time).toBe(1000);
    },
  );
  it("keeps Tamil short/long vowels and native consonants distinct, without false aspirates", async () => {
    const doc = parseLyrics(
      "காலை ஒளி\nதமிழ்\nக கா கி கீ கு கூ கெ கே கை கொ கோ கௌ",
    );
    const roman = await romanizeDocument(doc);
    expect(roman[doc.lines[0].id]).toBe("kaalai oli");
    expect(roman[doc.lines[1].id]).toBe("thamizh");
    expect(roman[doc.lines[2].id]).toBe(
      "ka kaa ki kee ku koo ke kee kai ko koo kau",
    );
  });
  it("handles shaping joiners and decomposed vowels without breaking conjuncts or Latin punctuation", async () => {
    const doc = parseLyrics("क्‍ष, friend!\nகொ");
    const roman = await romanizeDocument(doc);
    expect(roman[doc.lines[0].id]).toBe("ksha, friend!");
    expect(roman[doc.lines[1].id]).toBe("ko");
  });
  it("automatically repairs exact legacy generated Tamil while preserving supplied text", async () => {
    const doc = parseLyrics("வணக்கம்\nகாலை ஒளி");
    doc.romanisation[doc.lines[0].id] = "vaṇaghgham";
    doc.romanisation[doc.lines[1].id] = "Kaalai oli (supplied)";
    expect(await romanizeDocument(doc)).toEqual({
      [doc.lines[0].id]: "vanakkam",
    });
  });
  it("upgrades cached academic text but never changes Gemini, supplied text, timing or Latin spelling", async () => {
    const doc = parseLyrics("தமிழ் தமிழ் café\nHello");
    doc.romanisation[doc.lines[0].id] = "tamiḻ tamiḻ café";
    expect((await romanizeDocument(doc))[doc.lines[0].id]).toBe(
      "thamizh thamizh café",
    );
    doc.romanisationSource = "gemini";
    expect(await romanizeDocument(doc)).toEqual({});
  });
  it("converts decomposed nukta spellings without leaking source marks into the Latin layer", async () => {
    const doc = parseLyrics("क़ ख़ ग़ ज़ ड़ ढ़ फ़\nড় ঢ় য়\nਖ਼ ਗ਼ ਜ਼ ਫ਼");
    const roman = await romanizeDocument(doc);
    for (const line of doc.lines) {
      expect(roman[line.id]).toBeTruthy();
      expect(roman[line.id]).not.toMatch(/[\u0900-\u0aff]/);
    }
    expect(roman[doc.lines[0].id]).toContain("q");
    expect(roman[doc.lines[0].id]).toContain("z");
  });
});
