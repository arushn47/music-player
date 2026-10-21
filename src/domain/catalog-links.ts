import type { CatalogArtistCredit } from "../adapters/native";

const usable = (value: string): boolean => Boolean(value.trim()) && !/^unknown(?: artist| album)?$|^local collection$|^youtube$/i.test(value.trim());

export function canonicalArtistCredit(value: string): string {
  return value.split(",").map(name => /^emiway(?: bantai)?$/i.test(name.trim()) ? "Emiway Bantai" : name.trim()).join(", ");
}

export function artistCredits(value: string): CatalogArtistCredit[] {
  // shortcut: legacy separators are ambiguous in group names; prefer structured credits when available.
  return canonicalArtistCredit(value).split(/\s*,\s*|\s+&\s+/).filter(usable).map(name => ({ name, id: artistReference(name) }));
}

export function artistReference(name: string): string {
  return `saavn:artist:name:${encodeURIComponent(canonicalArtistCredit(name))}`;
}

export function albumReference(title: string, artist: string): string | null {
  const credit = artistCredits(artist)[0];
  return usable(title) && credit ? `saavn:album:search:${encodeURIComponent(credit.name)}:${encodeURIComponent(title.trim())}` : null;
}
