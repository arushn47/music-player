import { createRomanizer } from "lyric-romanizer";
import { transliterate } from "transliteration";

const foreign = /[\u0370-\u052f\u0590-\u08ff\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af][\p{M}\u0370-\u052f\u0590-\u08ff\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u200c\u200d]*/gu;
const fallback = (text: string): string => transliterate(text) || text;
let engine: ReturnType<typeof createRomanizer> | undefined;
let enginePath = "";
export async function romanizeForeignLocally(lines: string[], japanese = false, dictPath = "/romanization/ja"): Promise<string[]> {
  if (!engine || enginePath !== dictPath) { engine = createRomanizer({ japaneseDictPath: dictPath, engines: { arabic: fallback, hebrew: fallback, other: fallback } }); enginePath = dictPath; }
  return Promise.all(lines.map(async line => {
    const spans = [...line.matchAll(foreign)];
    const roman = await Promise.all(spans.map(span => /[\u0370-\u03ff]/.test(span[0]) ? fallback(span[0]) : engine!.romanizeLine(span[0], japanese && /[\u3040-\u30ff\u3400-\u9fff]/.test(span[0]) ? { script: "japanese" } : undefined)));
    let index = 0;
    return line.replace(foreign, () => roman[index++]);
  }));
}
