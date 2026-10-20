import { beforeEach, describe, expect, it, vi } from "vitest";
import { library } from "../../adapters/native";
import { resolveEntityArtwork } from "./EntityArtwork";

vi.mock("../../adapters/native", () => ({ library: { lookupArtist: vi.fn(), entityArtwork: vi.fn() } }));

const commons = { url: "commons.webp", sourceUrl: "https://commons.wikimedia.org/wiki/File:Portrait", credit: "Photographer · CC BY" };

describe("Tracker artist portraits", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(library.entityArtwork).mockResolvedValue(commons); });

  it("uses the artist page profile before requesting Commons artwork", async () => {
    vi.mocked(library.lookupArtist).mockResolvedValue({ info: { id: "123", name: "Artist", artworkUrl: "profile.webp" }, topTracks: [], albums: [], similarArtists: [] });
    expect(await resolveEntityArtwork("artist", "Artist", "", "")).toEqual({ url: "profile.webp", sourceUrl: "", credit: "Artist · Catalog portrait" });
    expect(library.lookupArtist).toHaveBeenCalledWith("saavn:artist:name:Artist");
    expect(library.entityArtwork).not.toHaveBeenCalled();
  });

  it("preserves attributed Commons fallback when a profile has no portrait", async () => {
    vi.mocked(library.lookupArtist).mockResolvedValue({ info: { id: "123", name: "Artist" }, topTracks: [], albums: [], similarArtists: [] });
    expect(await resolveEntityArtwork("artist", "Artist", "", "")).toEqual(commons);
  });

  it("still loads fallback artwork when the catalog request fails", async () => {
    vi.mocked(library.lookupArtist).mockRejectedValue(new Error("Unavailable"));
    expect(await resolveEntityArtwork("artist", "Artist", "", "")).toEqual(commons);
  });

  it("keeps album artwork resolution unchanged", async () => {
    expect(await resolveEntityArtwork("album", "Album", "Artist", "Track")).toEqual(commons);
    expect(library.entityArtwork).toHaveBeenCalledWith("album", "Album", "Artist", "Track");
    expect(library.lookupArtist).not.toHaveBeenCalled();
  });
});
