import type { LyricDocument } from "./types";

const scripts: [number, number, string][] = [
  [0x0900, 0x097f, "devanagari"],
  [0x0980, 0x09ff, "bengali"],
  [0x0a00, 0x0a7f, "gurmukhi"],
  [0x0a80, 0x0aff, "gujarati"],
  [0x0b00, 0x0b7f, "oriya"],
  [0x0b80, 0x0bff, "tamil"],
  [0x0c00, 0x0c7f, "telugu"],
  [0x0c80, 0x0cff, "kannada"],
  [0x0d00, 0x0d7f, "malayalam"],
  [0x0d80, 0x0dff, "sinhala"],
];
const runs =
  /[\u0900-\u097f][\u0900-\u097f\u200c\u200d]*|[\u0980-\u09ff][\u0980-\u09ff\u200c\u200d]*|[\u0a00-\u0a7f][\u0a00-\u0a7f\u200c\u200d]*|[\u0a80-\u0aff][\u0a80-\u0aff\u200c\u200d]*|[\u0b00-\u0b7f][\u0b00-\u0b7f\u200c\u200d]*|[\u0b80-\u0bff][\u0b80-\u0bff\u200c\u200d]*|[\u0c00-\u0c7f][\u0c00-\u0c7f\u200c\u200d]*|[\u0c80-\u0cff][\u0c80-\u0cff\u200c\u200d]*|[\u0d00-\u0d7f][\u0d00-\u0d7f\u200c\u200d]*|[\u0d80-\u0dff][\u0d80-\u0dff\u200c\u200d]*/g;

/** Local script transliteration, not a claim of language-specific pronunciation. */
export async function romanizeDocument(
  doc: LyricDocument,
): Promise<Record<string, string>> {
  if (!doc.lines.some((line) => /[\u0900-\u0dff]/.test(line.text))) return {};
  const { default: Sanscript } =
    await import("@indic-transliteration/sanscript");
  if (!Sanscript.schemes.lumaire_tamil) {
    const tamil = structuredClone(Sanscript.schemes.tamil);
    // Tamil collapses Sanskrit k/kh/g/gh to க. Sanscript's reverse map picks
    // the last alias (gh), producing vaṇaghgham. Keep each native consonant's
    // first, unaspirated mapping in our own scheme without mutating the library.
    for (const group of ["consonants", "extra_consonants"]) {
      const seen = new Set<string>();
      tamil[group] = Object.fromEntries(
        Object.entries(tamil[group]).filter(([, value]) => {
          if (seen.has(value)) return false;
          seen.add(value);
          return true;
        }),
      );
    }
    Sanscript.addBrahmicScheme("lumaire_tamil", tamil);
    const roman = structuredClone(Sanscript.schemes.iast);
    Object.assign(roman.vowels, { ऎ: "e", ए: "ē", ऒ: "o", ओ: "ō" });
    Object.assign(roman.vowel_marks, {
      "ॆ": "e",
      "े": "ē",
      "ॊ": "o",
      "ो": "ō",
    });
    roman.consonants["ळ"] = "ḷ";
    Sanscript.addRomanScheme("lumaire_tamil_roman", roman);
  }
  for (const [, , script] of scripts) {
    if (script === "tamil" || Sanscript.schemes[`lumaire_${script}`]) continue;
    const scheme = structuredClone(Sanscript.schemes[script]);
    // The upstream Brahmic reader consumes one character at a time. Internal
    // single-character tokens let it handle multi-character nukta consonants
    // while retaining their existing Roman targets and following vowel marks.
    Object.entries(scheme.extra_consonants ?? {}).forEach(
      ([key, value], index) => {
        if (value.length > 1)
          scheme.extra_consonants[key] = String.fromCharCode(0xe000 + index);
      },
    );
    Sanscript.addBrahmicScheme(`lumaire_${script}`, scheme);
  }
  const result: Record<string, string> = {};
  for (const line of doc.lines) {
    const roman = line.text.replace(runs, (run) => {
      const code = run.codePointAt(0)!;
      const script = scripts.find(
        ([first, last]) => code >= first && code <= last,
      )?.[2];
      let text = run.replace(/[\u200c\u200d]/g, "").normalize("NFC");
      // NFC deliberately leaves several nukta letters decomposed. Sanscript's
      // maps contain their precomposed spelling; restore those exact tokens so
      // Hindi/Bengali/Punjabi diacritics don't leak into the Latin layer.
      if (script)
        for (const value of Object.values(
          Sanscript.schemes[script].extra_consonants ?? {},
        )) {
          const decomposed = value.normalize("NFD");
          if (decomposed !== value) text = text.replaceAll(decomposed, value);
        }
      if (script && script !== "tamil")
        for (const [key, value] of Object.entries(
          Sanscript.schemes[script].extra_consonants ?? {},
        )) {
          const token =
            Sanscript.schemes[`lumaire_${script}`].extra_consonants[key];
          if (token !== value) text = text.replaceAll(value, token);
        }
      return script
        ? Sanscript.t(
            text,
            `lumaire_${script}`,
            script === "tamil" ? "lumaire_tamil_roman" : "iast",
          )
        : run;
    });
    const existing = doc.romanisation[line.id];
    if (existing) {
      // Repair only an exact old generated value. Different supplied text is
      // preserved; concurrent manual changes are guarded by the caller too.
      const legacy = line.text.replace(runs, (run) => {
        const code = run.codePointAt(0)!;
        const script = scripts.find(
          ([first, last]) => code >= first && code <= last,
        )?.[2];
        return script ? Sanscript.t(run, script, "iast") : run;
      });
      if (existing !== legacy || roman === existing) continue;
    }
    if (roman !== line.text) result[line.id] = roman;
  }
  return result;
}
