import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DownloadedBadge } from "./DownloadedBadge";
import { CatalogTrackList } from "./CatalogTrackList";
import { Collections } from "../views/Collections";
import { libraryCollections } from "../../domain/collections";
import { item, type Track } from "../../domain/types";
import type { CatalogTrack } from "../../adapters/native";

const catalog: CatalogTrack = { id: "saavn:test", title: "Song", artist: "Artist", artists: [], album: "Album", duration: 60 };
const saved: Track = { id: "youtube:abcdefghijk", metadataSourceId: catalog.id, title: "Song", artist: "Artist", album: "Album", duration: 60, fileName: "song.m4a", format: "m4a", offline: true, missing: false };
const rows = (downloads: Record<string, string>) => renderToStaticMarkup(<CatalogTrackList tracks={[catalog]} savedTracks={[saved]} favorites={[]} onCatalogAction={() => {}} onSaveDiscovery={() => {}} busy={false} downloads={downloads} />);

describe("downloaded indicators", () => {
  it("labels only completed downloads with an available file", () => {
    expect(renderToStaticMarkup(<DownloadedBadge track={saved} />)).toContain('aria-label="Downloaded"');
    for (const track of [undefined, { ...saved, offline: false }, { ...saved, missing: true }]) {
      expect(renderToStaticMarkup(<DownloadedBadge track={track} />)).toBe("");
    }
  });
  it("matches catalog metadata to its saved download and leaves terminal states playable", () => {
    for (const status of ["complete", "Cancelled", "Network failure"]) {
      const html = rows({ [catalog.id]: status });
      expect(html).toContain('aria-label="Downloaded"');
      expect(html).not.toContain('disabled=""');
      expect(html).not.toMatch(/class="[^"]*\bspin\b/);
    }
  });
  it("recognizes active downloads by the resolved source identity", () => {
    const html = rows({ [saved.id]: "downloading" });
    expect(html).toContain('disabled=""');
    expect(html).toMatch(/class="[^"]*\bspin\b/);
  });
  it("marks only fully downloaded collections, excluding partial or unresolved playlists", () => {
    const online = { ...saved, id: "other", offline: false };
    const collections = libraryCollections([saved, online], [
      { id: "complete", name: "Complete", items: [item(saved.id)] },
      { id: "partial", name: "Partial", items: [item(saved.id), item(online.id)] },
      { id: "unresolved", name: "Unresolved", items: [item(saved.id), item("missing")] },
      { id: "empty", name: "Empty", items: [] },
    ]);
    const html = renderToStaticMarkup(<Collections collections={collections} query="" open={() => {}} />);
    expect(html.match(/aria-label="Downloaded"/g)).toHaveLength(2);
    expect(html).not.toContain("Saved online");
  });
});
