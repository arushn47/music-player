import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.hoisted(() => { vi.stubGlobal("Audio", class { preload = ""; addEventListener() {} }); });
import { App } from "./App";

afterAll(() => vi.unstubAllGlobals());

describe("application playback controls", () => {
  it("renders the normal controller before selecting a track or opening expanded mode", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html.match(/aria-label="Playback controls"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Seek playback"');
    expect(html).not.toContain('class="expanded-player"');
  });
});
