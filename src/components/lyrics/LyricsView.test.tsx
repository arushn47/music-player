import React, { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LyricsView, type LyricsViewProps } from "./LyricsView";
import { parseLyrics, activeLine, normalizeCachedLyrics } from "../../domain/lyrics";
import { defaults } from "../../domain/types";

it("renders recovered word timings through overlapping vocal lines and backwards seeks", () => {
  const cached = parseLyrics("[00:01]<00:01>Lead <00:02>voice<00:04>\n[00:03]<00:03>Backing<00:05>");
  delete cached.lines[0].words;
  const doc = normalizeCachedLyrics(cached, 10);
  const noop = () => {};
  const props: LyricsViewProps = {
    doc, lyricSynced: true, lyricLookup: {status: "found", doc}, follow: true,
    setFollow: noop, followTarget: null, active: null, activeRef: createRef(), busy: false,
    session: defaults(), setting: noop, onUpdateOffset: noop, clearCache: noop, regenerate: noop,
    processingState: {status: "idle"}, translateLyrics: async () => {}, onRetryLookup: noop,
    onMarkInstrumental: noop, onSeek: noop,
  };
  for (const [seconds, wordCount, activeCount] of [[1.5, 2, 1], [3.5, 3, 2], [4.5, 1, 1], [1.5, 2, 1], [0, 0, 0]]) {
    const html = renderToStaticMarkup(<LyricsView {...props} mediaTime={seconds} active={activeLine(doc, seconds * 1000)}/>);
    expect(html.match(/class="lyric-word"/g)?.length ?? 0).toBe(wordCount);
    expect(html.match(/class="lyric-line is-active"/g)?.length ?? 0).toBe(activeCount);
  }
});
