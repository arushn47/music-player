import { beforeEach, expect, it, vi } from "vitest";
import { library } from "./native";
import { chartCountry, saveChartCountry, loadMusicMetadata, loadAppleChart } from "./music-providers";
vi.mock("./native", () => ({ library: { musicMetadata: vi.fn(), appleChart: vi.fn() } }));
beforeEach(() => { vi.mocked(library.musicMetadata).mockReset(); vi.mocked(library.appleChart).mockReset(); });
it("coalesces optional metadata and retries failures without replacing catalog objects", async () => {
  const value = { provider: "MusicBrainz", name: "Sushin Shyam", sourceUrl: "https://musicbrainz.org/artist/test", credits: [], releaseDate: null, country: "IN", entityType: "Person", disambiguation: null };
  vi.mocked(library.musicMetadata).mockResolvedValue(value);
  const results = await Promise.all([loadMusicMetadata("artist", "Sushin Shyam", ""), loadMusicMetadata("artist", "Sushin Shyam", "")]);
  expect(library.musicMetadata).toHaveBeenCalledTimes(1); expect(results).toEqual([value, value]);
  vi.mocked(library.musicMetadata).mockRejectedValueOnce(Error("Offline"));
  await expect(loadMusicMetadata("album", "Album", "Artist")).rejects.toThrow("Offline");
  vi.mocked(library.musicMetadata).mockResolvedValueOnce(null);
  await expect(loadMusicMetadata("album", "Album", "Artist")).resolves.toBeNull();
});
it("validates saved chart countries and persists a user choice", () => {
  const data = new Map<string,string>(); vi.stubGlobal("localStorage", { getItem: (key:string) => data.get(key), setItem: (key:string,value:string) => data.set(key,value) });
  expect(chartCountry()).toBe("in"); saveChartCountry("us"); expect(chartCountry()).toBe("us");
  for (const invalid of ["toString", "xx", "US", "../../"]) { data.set("lumaire-chart-country",invalid); expect(chartCountry()).toBe("in"); }
  vi.unstubAllGlobals();
});
it("coalesces chart requests and does not resolve ten song identities on page load", async () => {
  const chart = { source: "iTunes Store · Top Songs", entries: [], country: "in", updatedAt: null, stale: false, warning: null };
  vi.mocked(library.appleChart).mockResolvedValue(chart);
  const values = await Promise.all([loadAppleChart("in"), loadAppleChart("in")]);
  expect(library.appleChart).toHaveBeenCalledTimes(1); expect(values).toEqual([chart, chart]);
});
