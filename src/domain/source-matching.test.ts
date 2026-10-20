import { describe, expect, it, vi } from "vitest";
import type { CatalogTrack, YtdlpSearchResult } from "../adapters/native";
import { matchSource } from "./source-matching";
import { resolveCatalogSource } from "./catalog-track";

const song: CatalogTrack = { id: "saavn:12345678", title: 'Evening Sky (From "Film")', artist: "Writer, A. R. Singer, Guest", artists: [{ name: "Writer" }, { name: "A. R. Singer" }, { name: "Guest" }], album: "Film", duration: 210 };
const video: YtdlpSearchResult = { id: "abcdefghijk", title: "Evening Sky - Video Song | Guest | Film | HD", channel: "Film Label", duration: 216, thumbnail: null };

describe("shared recording identity", () => {
  it("uses credits across the complete title, including label uploads and collaborators", async () => {
    expect(await matchSource(song, video)).toMatchObject({ accepted: true });
    expect(await matchSource({ ...song, artist: "Beyoncé", artists: [] }, { ...video, title: "Evening Sky (Official Audio)", artist: "Beyonce" })).toMatchObject({ accepted: true });
    expect(await matchSource(song, { ...video, title: "A.R. Singer—Evening Sky" })).toMatchObject({ accepted: true });
    expect(await matchSource(song, { ...video, title: "Evening Sky | AR Singer" })).toMatchObject({ accepted: true });
  });
  it.each([
    [{ title: "Evening Sky 2 - Video Song | Guest" }, "title"],
    [{ title: "Evening Sky Remix | Guest" }, "recording-version"],
    [{ title: "Evening Sky Reprise | Guest" }, "recording-version"],
    [{ title: "Evening Sky | Guest reaction" }, "non-music"],
    [{ title: "Evening Sky", channel: "Other" }, "artist"],
    [{ id: "https://example.com" }, "invalid-id"],
    [{ duration: 300 }, "duration"],
  ] as const)("rejects mismatches with a stage reason %j", async (override, reason) => {
    expect(await matchSource(song, { ...video, ...override })).toMatchObject({ accepted: false, reason });
  });
  it("matches one minor long-word spelling difference but keeps short words distinct", async () => {
    expect(await matchSource({ ...song, title: "Moonlight" }, { ...video, title: "Moonlite | Guest" })).toMatchObject({ accepted: false });
    expect(await matchSource({ ...song, title: "Moonlight" }, { ...video, title: "Moonlighht | Guest" })).toMatchObject({ accepted: true });
    expect(await matchSource({ ...song, title: "Moon" }, { ...video, title: "Mood | Guest" })).toMatchObject({ accepted: false });
  });
  it("handles cross-script forms without conflating different native-script words", async () => {
    expect(await matchSource({ ...song, title: "नमस्ते" }, { ...video, title: "Namaste | Guest" })).toMatchObject({ accepted: true });
    expect(await matchSource({ ...song, title: "கூட" }, { ...video, title: "கட | Guest" })).toMatchObject({ accepted: false });
    expect(await matchSource({ ...song, title: "夜に駆ける", artist: "Artist", artists: [] }, { ...video, title: "Artist「夜に駆ける」 Official Music Video" })).toMatchObject({ accepted: true });
  });
  it("requires independent album evidence for abbreviated multi-part artist credits", async () => {
    const catalog = { ...song, artist: "Firstname Middle Lastname", artists: [] };
    expect(await matchSource(catalog, { ...video, title: "Evening Sky - Official Audio Song | Film | Firstname" })).toMatchObject({ accepted: true });
    expect(await matchSource(catalog, { ...video, title: "Evening Sky - Official Audio Song | Firstname" })).toMatchObject({ accepted: false, reason: "artist" });
  });
  it("tries other credible candidates after extraction failure", async () => {
    const second = { ...video, id: "lmnopqrstuv", duration: 218 };
    const verify = vi.fn().mockRejectedValueOnce(Error("private video")).mockResolvedValueOnce(undefined);
    expect(await resolveCatalogSource(song, vi.fn().mockResolvedValue([video, second]), { verify })).toBe(second);
    expect(verify).toHaveBeenCalledTimes(2);
  });
  it("searches collaborators and the album only after initial queries fail to match", async () => {
    const search = vi.fn(async (query: string) => query.includes("Guest") ? [video] : []);
    expect(await resolveCatalogSource(song, search)).toBe(video);
    expect(search.mock.calls.some(([q]) => q === "Evening Sky Guest")).toBe(true);
    expect(search.mock.calls.every(([q]) => !q.includes('From "Film"'))).toBe(true);
  });
  it("uses extracted duration when a flat-search result lacks it", async () => {
    const result = await resolveCatalogSource(song, vi.fn().mockResolvedValue([{ ...video, duration: null }]), { verify: async () => ({ duration: 216 }) });
    expect(result.duration).toBe(216);
  });
  it("reports extraction failures separately from empty successful searches and transport failures", async () => {
    await expect(resolveCatalogSource(song, vi.fn().mockResolvedValue([video]), { verify: async () => { throw Error("403"); } })).rejects.toThrow("stream extraction failed");
    await expect(resolveCatalogSource(song, vi.fn().mockResolvedValue([]))).rejects.toThrow("No matching audio source");
    await expect(resolveCatalogSource(song, vi.fn().mockRejectedValue(Error("Offline")))).rejects.toThrow("Audio search failed");
  });
  it("validates catalog provider identities before searching", async () => {
    const search = vi.fn();
    await expect(resolveCatalogSource({ ...song, id: "saavn:album:123" }, search)).rejects.toThrow("Invalid catalog");
    expect(search).not.toHaveBeenCalled();
    expect(await resolveCatalogSource({ ...song, id: "itunes:42" }, vi.fn().mockResolvedValue([video]))).toBe(video);
  });
});
