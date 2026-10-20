import { describe, expect, it } from "vitest";
import { activeLine, alignVariant, parseLyrics } from "./lyrics";
import { defaults, item } from "./types";
import { advance, move } from "./queue";
import { restoreSession } from "./session";
describe("immutable lyric timing and supplied layers", () => {
  it("uses millisecond/centisecond precision, repeated timestamps, last file offset and stable IDs", () => {
    const doc = parseLyrics(
      "\uFEFF[offset:100]\n[offset:200]\n[00:10.00][00:20.125]வணக்கம்\n[00:30.5]ஒளி",
    );
    expect(doc.lines.map((l) => l.time)).toEqual([10000, 20125, 30500]);
    expect(doc.warnings).toHaveLength(1);
    const ids = doc.lines.map((l) => l.id);
    doc.userOffset = -50;
    expect(activeLine(doc, 10149)).toBe(null);
    expect(activeLine(doc, 10150)).toBe(ids[0]);
    expect(activeLine(doc, 20275)).toBe(ids[1]);
    expect(doc.lines.map((l) => l.id)).toEqual(ids);
  });
  it("keeps plain text readable without fake timing and preserves malformed lines with a warning", () => {
    const doc = parseLyrics("one\n[01:88]invalid\nthree");
    expect(doc.lines.every((l) => l.time === null)).toBe(true);
    expect(doc.warnings).toHaveLength(1);
    expect(activeLine(doc, 999999)).toBe(null);
  });
  it("maps supplied rows to source IDs and rejects mismatched timing or line counts", () => {
    const doc = parseLyrics("[00:01]அ\n[00:02]ஆ");
    const supplied = parseLyrics("a\naa");
    expect(alignVariant(doc, supplied)).toEqual({
      [doc.lines[0].id]: "a",
      [doc.lines[1].id]: "aa",
    });
    expect(() => alignVariant(doc, parseLyrics("[00:01]a\n[00:03]aa"))).toThrow(
      "timestamps differ",
    );
    expect(() => alignVariant(doc, parseLyrics("one"))).toThrow(
      "Line count differs",
    );
  });
});
describe("queue and recovery", () => {
  const queue = [item("a"), item("a"), item("b")];
  it("preserves intentional repeats when reordering and only wraps when enabled", () => {
    const s = { ...defaults(), queue, currentId: queue[2].id };
    expect(advance(s, 1)).toBe(null);
    s.settings.repeat = "all";
    expect(advance(s, 1)).toBe(queue[0].id);
    s.settings.repeat = "one";
    expect(advance(s, 1, true)).toBe(queue[2].id);
    expect(move(queue, queue[1].id, -1).map((i) => i.id)).toEqual([
      queue[1].id,
      queue[0].id,
      queue[2].id,
    ]);
  });
  it("shuffle never picks the current queue item", () => {
    const s = { ...defaults(), queue, currentId: queue[0].id };
    s.settings.shuffle = true;
    expect(advance(s, 1)).toBe(queue[1].id);
  });
  it("sanitizes untrusted backup references and settings", () => {
    const tracks = [
      {
        id: "a",
        title: "a",
        artist: "a",
        album: "a",
        duration: 2,
        fileName: "a.wav",
        missing: true,
        format: "WAV",
      },
    ];
    const s = restoreSession(
      {
        ...defaults(),
        queue: [...queue],
        currentId: queue[2].id,
        settings: { ...defaults().settings, volume: 900, lyricSize: 2 },
      },
      tracks,
    );
    expect(s.queue).toHaveLength(2);
    expect(s.currentId).toBe(queue[0].id);
    expect(s.settings.volume).toBe(1);
    expect(s.settings.lyricSize).toBe(18);
  });
});
