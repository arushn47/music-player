import React, { type CSSProperties } from "react";
import type { LyricLine } from "../../domain/types";
import { wordProgress } from "../../domain/lyrics";
import "./word-lyrics.css";

export function WordLyrics({ line, clock }: { line: LyricLine; clock: number }) {
  if (!line.words?.length) return <>{line.text}</>;
  return <>{line.words.map((word, index) => {
    const progress = wordProgress(word, clock);
    const active = Number.isFinite(clock) && clock >= word.time && (word.end === undefined || clock < word.end);
    // Overlapping, one-way rises form a wave; the sung word never pulses back down.
    const elapsed = Number.isFinite(clock) ? Math.max(0, (clock - word.time) / 1000) : 0;
    const spring = elapsed * 5;
    const lift = -3 * (elapsed >= 2 ? 1 : 1 - (1 + spring) * Math.exp(-spring));
    const match = word.text.match(/^(\s*)(.*?)(\s*)$/s);
    const leading = match ? match[1] : "";
    const text = match ? match[2] : word.text;
    const trailing = match ? match[3] : "";
    return <React.Fragment key={index}>
      {leading}
      <span className="lyric-word" data-word-state={active ? "active" : progress > 0 ? "sung" : "upcoming"}
        style={{ "--word-lift": `${lift}px`, "--word-progress": `${progress * 100}%` } as CSSProperties}><span className="lyric-word-ink">{text}</span></span>
      {trailing}
    </React.Fragment>;
  })}</>;
}
