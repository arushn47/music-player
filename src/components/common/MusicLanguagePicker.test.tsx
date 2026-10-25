import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MusicLanguagePicker } from "./MusicLanguagePicker";
import { MusicLanguageOnboarding } from "../modals/MusicLanguageOnboarding";

it("offers accessible multi-select checkboxes with independent selections", () => {
  const html = renderToStaticMarkup(<MusicLanguagePicker value={["tamil", "malayalam"]} onChange={() => {}} />);
  expect(html.match(/type="checkbox"/g)).toHaveLength(9);
  expect(html.match(/checked=""/g)).toHaveLength(2);
  expect(html).toContain("Languages you listen to");
});
it("offers onboarding with skip and settings guidance only until completed", () => {
  vi.stubGlobal("localStorage", { getItem: () => null });
  const html = renderToStaticMarkup(<MusicLanguageOnboarding />);
  expect(html).toContain("Which languages do you listen to?");
  expect(html).toContain(">Skip</button>");
  expect(html).toContain(">Continue</button>");
  expect(html).toContain("Music preferences");
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ onboarded: true, languages: [] }) });
  expect(renderToStaticMarkup(<MusicLanguageOnboarding />)).toBe("");
  vi.unstubAllGlobals();
});
