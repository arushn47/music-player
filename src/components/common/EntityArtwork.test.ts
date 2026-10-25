import { beforeEach, describe, expect, it, vi } from "vitest";
import { library } from "../../adapters/native";
import { resolveEntityArtwork } from "./EntityArtwork";

vi.mock("../../adapters/native", () => ({ library: { lookupAlbum: vi.fn(), lookupArtist: vi.fn(), entityArtwork: vi.fn() } }));

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

  it("retains album metadata fallback when the album page lookup is unavailable", async () => {
    vi.mocked(library.lookupAlbum).mockRejectedValue(Error('Unavailable'));
    expect(await resolveEntityArtwork("album", "Album", "Artist", "Track")).toEqual(commons);
    expect(library.entityArtwork).toHaveBeenCalledWith("album", "Album", "Artist", "Track");
    expect(library.lookupArtist).not.toHaveBeenCalled();
  });
  it('uses the same album identity and cover as the album page, splitting track collaborations', async () => {
    vi.mocked(library.lookupAlbum).mockResolvedValue({ info: { id: 'saavn:album:1', title: 'King Of The Streets', artist: 'Emiway Bantai', artists: [], artworkUrl: 'cover.webp' }, tracks: [], partial: false });
    expect(await resolveEntityArtwork('album', 'King Of The Streets', 'Emiway Bantai, Keri Hilson, D.O.E.', 'Company')).toEqual({ url: 'cover.webp', sourceUrl: '', credit: 'Emiway Bantai · King Of The Streets' });
    expect(library.lookupAlbum).toHaveBeenCalledWith('saavn:album:search:Emiway%20Bantai:King%20Of%20The%20Streets');
    expect(library.entityArtwork).not.toHaveBeenCalled();
  });
  it('falls back from broken portraits without repeatedly returning the failed image', async () => {
    vi.mocked(library.lookupArtist).mockResolvedValue({ info: { id: '1', name: 'Artist', artworkUrl: 'broken.webp' }, topTracks: [], albums: [], similarArtists: [] });
    expect(await resolveEntityArtwork('artist', 'Artist', '', '', ['broken.webp'])).toEqual(commons);
    expect(await resolveEntityArtwork('artist', 'Artist', '', '', ['broken.webp', commons.url])).toBeNull();
  });
});
