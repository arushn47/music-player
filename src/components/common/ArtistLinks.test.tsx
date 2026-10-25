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

it("caps the number of rendered artists when maxArtists is provided", () => {
  const html = renderToStaticMarkup(<ArtistLinks artistString="Sai Abhyankkar, Harini, Karthik Netha" onNavigateArtist={() => {}} maxArtists={2} />);
  expect(html.match(/<button/g)).toHaveLength(2);
  expect(html).toContain('>Sai Abhyankkar</button>');
  expect(html).toContain('>Harini</button>');
  expect(html).not.toContain('>Karthik Netha</button>');
  expect(html).toContain('…');
});


it("does not reuse a collaboration provider ID for individual artist links", () => {
  const html = renderToStaticMarkup(<ArtistLinks artists={[{ id: "saavn:artist:42", name: "Hasan Raheem and Abdullah" }]} onNavigateArtist={() => {}} />);
  expect(html.match(/<button/g)).toHaveLength(2);
  expect(html).toContain(">Hasan Raheem</button>");
  expect(html).toContain(">Abdullah</button>");
});
