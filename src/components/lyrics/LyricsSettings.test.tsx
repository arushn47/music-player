import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LyricsSettings } from "./LyricsSettings";
import { defaults } from "../../domain/types";

it("restores display preferences and non-tech AI controls without model input", () => {
  const html = renderToStaticMarkup(<LyricsSettings settings={defaults().settings} setting={() => {}} processingState={{ status: "idle" }} regenerate={() => {}} clearCache={() => {}} cachedCount={0} />);
  for (const name of ["Romanization", "Original script", "Original first", "Auto-open lyrics", "Estimated scroll", "Auto-translate"]) {
    expect(html).toContain(`aria-label="${name}"`);
  }
  expect(html).not.toContain("TRANSLATE WITHOUT A KEY");
  expect(html).not.toContain('aria-label="Translation"');
  expect(html).not.toContain('aria-label="Gemini model"');
});
