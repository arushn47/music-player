import { beforeEach, describe, expect, it, vi } from "vitest";
import { cachedHomeAlbums, clearDiscoverySearches, discoveryPreferences, loadHomeAlbums, rememberDiscoverySearch, setDiscoveryLanguage } from "./discovery-home";
import { library } from "./native";
vi.mock("./native", () => ({ library: { discoverAlbums: vi.fn() } }));
const album = { id: "saavn:album:42", title: "Album", artist: "Artist", artists: [], artworkUrl: "https://c.saavncdn.com/a.jpg" };
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  vi.mocked(library.discoverAlbums).mockReset();
});
describe("discovery preferences and album cache", () => {
  it("bounds and deduplicates submitted searches and lets users clear them", () => {
    rememberDiscoverySearch("  Artist  "); rememberDiscoverySearch("artist");
    expect(discoveryPreferences().searches).toEqual(["artist"]);
    for (let i = 0; i < 8; i++) rememberDiscoverySearch(`Query ${i}`);
    expect(discoveryPreferences().searches).toHaveLength(6);
    setDiscoveryLanguage("tamil"); clearDiscoverySearches();
    expect(discoveryPreferences()).toEqual({ language: "tamil", searches: [] });
    localStorage.setItem("lumaire-discovery", '{"language":"invalid","searches":[null,4,""]}');
    expect(discoveryPreferences()).toEqual({ language: "hindi", searches: [] });
  });
  it("shares in-flight requests and reuses a fresh cache across navigation", async () => {
    vi.mocked(library.discoverAlbums).mockResolvedValue([album]);
    await Promise.all([loadHomeAlbums("tamil"), loadHomeAlbums("tamil")]);
    await loadHomeAlbums("tamil");
    expect(library.discoverAlbums).toHaveBeenCalledTimes(1);
    expect(cachedHomeAlbums("tamil")?.albums[0].title).toBe("Album");
  });
  it("retains stale data on failure and retries later instead of caching the rejection", async () => {
    localStorage.setItem("lumaire-discovery-albums-hindi", JSON.stringify({ albums: [album], updatedAt: Date.now() - 86400000 }));
    vi.mocked(library.discoverAlbums).mockRejectedValueOnce(Error("Offline")).mockResolvedValueOnce([album]);
    await expect(loadHomeAlbums("hindi")).rejects.toThrow("Offline");
    expect(cachedHomeAlbums("hindi")?.albums).toHaveLength(1);
    await expect(loadHomeAlbums("hindi")).resolves.toHaveProperty("albums");
  });
  it("rejects malformed cache metadata and unsafe artwork", () => {
    localStorage.setItem("lumaire-discovery-albums-english", JSON.stringify({ albums: [{ ...album, artworkUrl: "javascript:bad" }, { ...album, id: "invalid" }], updatedAt: Date.now() }));
    expect(cachedHomeAlbums("english")?.albums).toHaveLength(1);
    expect(cachedHomeAlbums("english")?.albums[0].artworkUrl).toBeNull();
    localStorage.setItem("lumaire-discovery-albums-english", "broken json");
    expect(cachedHomeAlbums("english")).toBeNull();
  });
});
