import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileTabBar } from "./MobileTabBar";

it("has five destinations including Lyric Room and highlights exactly one parent destination", () => {
  for (const [view, label] of [["lyrics", "Lyrics"], ["home", "Home"], ["search", "Discover"], ["favorites", "Library"], ["albums", "Library"], ["artists", "Library"], ["collection:local", "Library"], ["playlist-uuid", "Library"], ["history", "Tracker"]]) {
    const html = renderToStaticMarkup(<MobileTabBar view={view} setView={() => {}} />);
    expect(html.match(/<button/g)).toHaveLength(5);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain(`aria-label="${label}" aria-current="page"`);
  }
});

it("does not mislabel secondary screens as Library", () => {
  const html = renderToStaticMarkup(<MobileTabBar view="settings" setView={() => {}} />);
  expect(html).not.toContain('aria-current="page"');
});
