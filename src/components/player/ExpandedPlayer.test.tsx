import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ExpandedPlayer } from "./ExpandedPlayer";
import { PlayerBar, type PlayerBarProps } from "./PlayerBar";
import { defaults } from "../../domain/types";
import { restoreSession } from "../../domain/session";

it("defaults old sessions to Immersive and persists the Minimal choice", () => {
  expect(restoreSession({ settings: {} }, []).settings.fullscreenLayout).toBe("immersive");
  expect(restoreSession({ settings: { fullscreenLayout: "minimal" } }, []).settings.fullscreenLayout).toBe("minimal");
  expect(restoreSession({ settings: { fullscreenLayout: "invalid" } }, []).settings.fullscreenLayout).toBe("immersive");
});
it("reuses one transport, hides unavailable lyrics, and retains the classic optional layout", () => {
  const noop = () => {};
  const session = defaults();
  const props = {session, playback: {status: "paused", time: 0, duration: 20}, tracks: [], downloads: {}, onSetting: noop} as unknown as PlayerBarProps;
  for (const layout of ["immersive", "minimal"] as const) {
    session.settings.fullscreenLayout = layout;
    const html = renderToStaticMarkup(<ExpandedPlayer controls={<PlayerBar {...props}/>} lyrics={<div>Lyric fixture</div>} onClose={noop} follow setFollow={noop} canFollow={false} translateLyrics={async()=>{}}/>);
    expect(html).toContain(`expanded-player is-${layout}`);
    expect(html.split('aria-label="Seek playback"')).toHaveLength(2);
    expect(html.includes('aria-label="Song lyrics"')).toBe(layout === "minimal");
  }
});
