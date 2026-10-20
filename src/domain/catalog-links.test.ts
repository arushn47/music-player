import { describe, expect, it } from "vitest";
import { albumReference, artistCredits, artistReference, canonicalArtistCredit } from "./catalog-links";

describe("catalog navigation references", () => {
  it("preserves Emiway Bantai's full credit and resolves the legacy alias without fuzzy matches", () => {
    expect(canonicalArtistCredit("Emiway, Guest")).toBe("Emiway Bantai, Guest");
    expect(canonicalArtistCredit("EMIWAY BANTAI")).toBe("Emiway Bantai");
    expect(canonicalArtistCredit("Emiway Tribute")).toBe("Emiway Tribute");
    expect(artistCredits("Emiway")[0].name).toBe("Emiway Bantai");
    expect(artistReference("Emiway")).toBe("saavn:artist:name:Emiway%20Bantai");
  });
  it("keeps individual collaboration credits and escapes locator delimiters", () => {
    expect(artistCredits("KR$NA, Seedhe Maut").map(credit => credit.name)).toEqual(["KR$NA", "Seedhe Maut"]);
    expect(artistReference("AC/DC: Live")).toBe("saavn:artist:name:AC%2FDC%3A%20Live");
    expect(albumReference("Yours: Truly", "KR$NA, Phenom")).toBe("saavn:album:search:KR%24NA:Yours%3A%20Truly");
  });
  it("does not create links for placeholder metadata", () => {
    expect(artistCredits("Unknown artist")).toEqual([]);
    expect(albumReference("Unknown", "Emiway")).toBeNull();
    expect(albumReference("Album", "Unknown artist")).toBeNull();
  });
});
