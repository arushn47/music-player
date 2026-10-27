import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EngineSetupDialog } from "./EngineSetupDialog";
import type { EngineSetupProps } from "../common/EngineSetupCard";

const props: EngineSetupProps = { engineState: "missing", engineError: "", engineProgress: null, engineCancelling: false, onInstallYoutubeEngine: async () => {}, onCancelYoutubeEngineInstall: async () => {} };
it("requires setup in a labelled dialog with no dismiss or skip button", () => {
  const html = renderToStaticMarkup(<EngineSetupDialog {...props} />);
  expect(html).toContain('<dialog');
  expect(html).toContain('aria-labelledby="engine-setup-title"');
  expect(html).toContain("once to continue into Lumaire");
  expect(html).not.toMatch(/Close|Skip|Later|keep browsing/);
});
it("keeps failed setup actionable and explains automatic completion", () => {
  const error = renderToStaticMarkup(<EngineSetupDialog {...props} engineState="error" engineError="Download failed" />);
  expect(error).toContain("Download failed");
  expect(error).toContain("Retry setup");
  const installing = renderToStaticMarkup(<EngineSetupDialog {...props} engineState="installing" />);
  expect(installing).toContain("This dialog closes when playback is ready");
  expect(installing).not.toContain("keep browsing");
});
