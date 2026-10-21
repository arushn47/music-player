import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArtistLinks } from "./ArtistLinks";

it("renders each legacy collaboration credit as its own artist button", () => {
  const html = renderToStaticMarkup(<ArtistLinks artistString="Bayaan, Hasan Raheem & Rovalio" onNavigateArtist={() => {}} />);
  expect(html.match(/<button/g)).toHaveLength(3);
  expect(html).toContain('>Hasan Raheem</button>');
  expect(html).toContain('>Rovalio</button>');
});

it("keeps an authoritative structured group name intact, even without a provider ID", () => {
  const html = renderToStaticMarkup(<ArtistLinks artists={[{ name: "Of Monsters & Men" }]} onNavigateArtist={() => {}} />);
  expect(html.match(/<button/g)).toHaveLength(1);
  expect(html).toContain('>Of Monsters &amp; Men</button>');
});
