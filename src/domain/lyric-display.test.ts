import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { defaults } from "./types";
import { parseLyrics } from "./lyrics";
import { clearFetchedLyrics, lyricLayers, lyricSourceLink } from "./lyric-display";
import { restoreSession } from "./session";

describe("persistent lyric display preferences", () => {
  it("links verified provider IDs and rejects malformed cached links", () => {
    const doc = parseLyrics("[00:01]fixture");
    doc.source = { provider: "lrc.red", recordId: "IND292218474", title: "Song", artist: "Artist", duration: 200 };
    expect(lyricSourceLink(doc)?.url).toBe("https://lrc.red/s/IND292218474");
    doc.source.recordId = "../../bad";
    expect(lyricSourceLink(doc)).toBeUndefined();
    doc.source = { ...doc.source, provider: "lrclib", recordId: 42 };
    expect(lyricSourceLink(doc)?.url).toBe("https://lrclib.net/tracks/42");
    doc.source.recordId = "42";
    expect(lyricSourceLink(doc)).toBeUndefined();
  });
  it("controls layer visibility and order without changing source text or timing", () => {
    const doc = parseLyrics("[00:01]வணக்கம்"),
      line = doc.lines[0];
    doc.romanisation[line.id] = "vaṇakkam";
    doc.translation[line.id] = "Hello";
    const settings = defaults().settings;
    expect(lyricLayers(doc, line, settings).map((layer) => layer.kind)).toEqual(
      ["original", "roman", "translation"],
    );
    expect(
      lyricLayers(doc, line, { ...settings, originalFirst: false }).map(
        (layer) => layer.kind,
      ),
    ).toEqual(["roman", "original", "translation"]);
    expect(
      lyricLayers(doc, line, {
        ...settings,
        originalScript: false,
        translation: false,
      }),
    ).toEqual([{ kind: "roman", text: "vaṇakkam" }]);
    expect(
      lyricLayers(doc, line, {
        ...settings,
        romanisation: false,
        originalScript: false,
        translation: false,
      }),
    ).toEqual([{ kind: "original", text: "வணக்கம்" }]);
    expect(line.time).toBe(1000);
    expect(line.text).toBe("வணக்கம்");
  });
  it("restores global settings and discards unrecognized credential fields from preferences", () => {
    const restored = restoreSession(
      {
        ...defaults(),
        settings: {
          ...defaults().settings,
          originalScript: false,
          originalFirst: false,
          autoOpenLyrics: true,
          estimatedScroll: false,
          geminiModel: "chosen-model",
          geminiApiKey: "must-not-persist",
        },
      },
      [],
    );
    expect(restored.settings).toMatchObject({
      originalScript: false,
      originalFirst: false,
      autoOpenLyrics: true,
      estimatedScroll: false,
      geminiModel: "chosen-model",
    });
    expect(JSON.stringify(restored)).not.toContain("must-not-persist");
    expect(
      restoreSession(
        { settings: { geminiModel: "https://arbitrary-host" } },
        [],
      ).settings.geminiModel,
    ).toBe(defaults().settings.geminiModel);
  });
  it("clears fetched caches without deleting imported lyrics or changing settings", () => {
    const imported = parseLyrics("Supplied text"),
      fetched = parseLyrics("Cached text");
    fetched.source = {
      provider: "lrclib",
      recordId: 1,
      title: "Song",
      artist: "Artist",
      duration: 10,
    };
    const original = {
      ...defaults(),
      lyrics: {
        imported,
        fetched,
        fresh: {
          ...parseLyrics("Fresh provider text"),
          origin: "provider" as const,
        },
        instrumental: {
          ...parseLyrics("Instrumental fixture"),
          raw: "",
          lines: [],
          instrumental: true,
          fileName: "Instrumental · LRCLIB",
        },
      },
    };
    const cleared = clearFetchedLyrics(original);
    expect(cleared.lyrics).toEqual({ imported });
    expect(cleared.settings).toBe(original.settings);
    expect(original.lyrics.fetched).toBe(fetched);
  });
  it("scopes external lyrics opening to LRCLIB and lrc.red", () => {
    const capability = JSON.parse(readFileSync("src-tauri/capabilities/lyrics.json", "utf8"));
    expect(capability.windows).toEqual(["main"]);
    expect(capability.permissions[0].identifier).toBe("opener:allow-open-url");
    const urls = capability.permissions[0].allow.map((entry: { url: string }) => entry.url);
    expect(urls).toContain("https://lrclib.net/*");
    expect(urls).toContain("https://lrc.red/*");
  });
});

