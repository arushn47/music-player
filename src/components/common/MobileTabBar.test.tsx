import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileTabBar } from "./MobileTabBar";

it("has four destinations and highlights exactly one parent destination", () => {
  for (const [view, label] of [["home", "Home"], ["search", "Discover"], ["favorites", "Library"], ["albums", "Library"], ["artists", "Library"], ["collection:local", "Library"], ["playlist-uuid", "Library"], ["history", "Tracker"]]) {
    const html = renderToStaticMarkup(<MobileTabBar view={view} setView={() => {}} />);
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain(`aria-label="${label}" aria-current="page"`);
    expect(html).not.toContain('aria-label="Lyrics"');
  }
});

it("does not mislabel secondary screens as Library", () => {
  const html = renderToStaticMarkup(<MobileTabBar view="settings" setView={() => {}} />);
  expect(html).not.toContain('aria-current="page"');
});
