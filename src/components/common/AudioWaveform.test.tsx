import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { AudioWaveform } from "./AudioWaveform";

describe("AudioWaveform component", () => {
  it("renders with resting state when paused", () => {
    const html = renderToStaticMarkup(<AudioWaveform isPlaying={false} />);
    expect(html).toContain("is-paused");
    expect(html).not.toContain("is-playing");
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders with active animation class when playing", () => {
    const html = renderToStaticMarkup(<AudioWaveform isPlaying={true} />);
    expect(html).toContain("is-playing");
    expect(html).not.toContain("is-paused");
  });

  it("renders requested sample columns in one SVG path with no animation", () => {
    const html = renderToStaticMarkup(<AudioWaveform isPlaying={true} bars={16} />);
    expect(html.match(/class="waveform-path"/g)).toHaveLength(1);
    expect(html.match(/\d+ 11V13/g)).toHaveLength(16);
    expect(html).not.toContain("animation");
  });
});
