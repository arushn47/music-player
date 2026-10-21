import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EngineSetupCard, type EngineSetupProps } from "./EngineSetupCard";

const defaults: EngineSetupProps = {
  engineState: "missing", engineError: "", engineProgress: null, engineCancelling: false,
  onInstallYoutubeEngine: async () => {}, onCancelYoutubeEngineInstall: async () => {},
};
const render = (props: Partial<EngineSetupProps> = {}) => renderToStaticMarkup(<EngineSetupCard {...defaults} {...props} />);

describe("online playback setup feedback", () => {
  it("offers setup without asking users to manage executable paths", () => {
    const html = render();
    expect(html).toContain("Enable online playback");
    expect(html).toContain("Local music works without this step");
    expect(html).not.toContain('role="alert"');
  });
  it("shows real per-file progress and cancellation, then switches to verification without a false percentage", () => {
    const progress = { stage: "downloading" as const, component: "yt-dlp.exe", received: 5242880, total: 10485760, attempt: 1 };
    const html = render({ engineState: "installing", engineProgress: progress });
    expect(html).toContain("50%");
    expect(html).toContain('value="50"');
    expect(html).toContain("file 1 of 2");
    expect(html).toContain("Cancel setup");
    const verifying = render({ engineState: "installing", engineProgress: { ...progress, stage: "verifying" } });
    expect(verifying).toContain("Verifying yt-dlp.exe");
    expect(verifying).not.toContain('value="50"');
    const unknown = render({ engineState: "installing", engineProgress: { ...progress, total: null } });
    expect(unknown).not.toContain("%");
  });
  it("preserves actionable failures and offers retry instead of claiming success", () => {
    const html = render({ engineState: "error", engineError: "The official download server returned HTTP 403." });
    expect(html).toContain('role="alert"');
    expect(html).toContain("HTTP 403");
    expect(html).toContain("Retry setup");
    expect(html).not.toContain("Online playback is ready");
  });
});
