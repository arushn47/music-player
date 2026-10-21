import { describe, expect, it } from "vitest";
import {
  activeLine,
  estimatedFollowLine,
  normalizeCachedLyrics,
  parseLyrics,
  synchronizedLyrics,
} from "./lyrics";

describe("automatic lyric timing and estimated following", () => {
  it("follows untimed text from the media clock without creating timestamps", () => {
    const doc = parseLyrics("one\ntwo\nsix");
    expect(estimatedFollowLine(doc, 0, 30)).toBe(doc.lines[0].id);
    expect(estimatedFollowLine(doc, 15, 30)).toBe(doc.lines[1].id);
    expect(estimatedFollowLine(doc, 30, 30)).toBe(doc.lines[2].id);
    expect(estimatedFollowLine(doc, 90, 30)).toBe(doc.lines[2].id);
    expect(estimatedFollowLine(doc, 15, 0)).toBe(null);
    expect(doc.lines.every((line) => line.time === null)).toBe(true);
    expect(activeLine(doc, 15000)).toBe(null);
  });
  it("distinguishes cached mismatched LRC from synchronized playback", () => {
    const doc = parseLyrics("[00:01]one\n[00:05]two");
    doc.source = {
      provider: "lrclib",
      recordId: 1,
      title: "Song",
      artist: "Artist",
      duration: 188,
    };
    expect(synchronizedLyrics(doc, 188)).toBe(true);
    expect(synchronizedLyrics(doc, 226)).toBe(false);
    const normalized = normalizeCachedLyrics(doc, 226);
    expect(activeLine(normalized, 5000)).toBe(null);
    expect(synchronizedLyrics(normalized, 226)).toBe(false);
    expect(
      synchronizedLyrics(normalizeCachedLyrics(normalized, 188), 188),
    ).toBe(true);
    const plain = parseLyrics("one\ntwo");
    plain.source = doc.source;
    expect(synchronizedLyrics(normalizeCachedLyrics(plain, 188), 188)).toBe(
      false,
    );
    expect(doc.timingMode).toBe("synced");
  });
  it("rejects out-of-range timestamps while keeping local imports readable", () => {
    const doc = parseLyrics("[99:00]one");
    expect(synchronizedLyrics(doc, 30)).toBe(false);
    expect(normalizeCachedLyrics(doc, 30)).toBe(doc);
  });
  it("computes focus distance strictly when following is active and suppresses it when browsing", () => {
    const doc = parseLyrics("[00:01]line 0\n[00:05]line 1\n[00:10]line 2");
    const active = doc.lines[1].id;
    const activeIndex = doc.lines.findIndex((l) => l.id === active);

    // Following active: distances are computed around activeIndex
    const followingDistances = doc.lines.map((_, index) => Math.abs(index - activeIndex));
    expect(followingDistances).toEqual([1, 0, 1]);

    // Browsing (follow = false): distances are suppressed (null), disabling blur and fade
    const isFollowing = false;
    const browsingDistances = doc.lines.map((_, index) => (isFollowing ? Math.abs(index - activeIndex) : null));
    expect(browsingDistances).toEqual([null, null, null]);
  });
});
