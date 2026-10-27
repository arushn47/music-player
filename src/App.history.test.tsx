import { afterAll, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { localDay, type ListeningRecord } from "./domain/listening";
import type { Track } from "./domain/types";

const fixture = vi.hoisted(() => {
  vi.stubGlobal("Audio", class { preload = ""; addEventListener() {} });
  return { tracks: [] as Track[], records: [] as ListeningRecord[] };
});
vi.mock("react", async importOriginal => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => react.useState(initial === "home" ? "history" : initial) };
});
vi.mock("./hooks/useLibraryManager", async importOriginal => {
  const hooks = await importOriginal<typeof import("./hooks/useLibraryManager")>();
  return { useLibraryManager: () => ({ ...hooks.useLibraryManager(), ready: true, tracks: fixture.tracks }) };
});
vi.mock("./hooks/useListeningHistory", () => ({ useListeningHistory: () => ({
  records: fixture.records, loading: false, error: "", refresh: () => {},
}) }));
import { App } from "./App";

afterAll(() => vi.unstubAllGlobals());

it("keeps synced recap counts and metadata independent of each device's local tracks", () => {
  const now = Date.now();
  fixture.records = Array.from({ length: 10 }, (_, i) => ({
    id: `play-${i}`, trackId: "youtube:abcdefghijk", metadataSourceId: `itunes:${100 + i}`,
    title: `Recorded song ${i}`, artist: "Recorded artist", album: `Recorded album ${i}`,
    artworkUrl: null, providerId: "youtube", sourceId: "abcdefghijk",
    startedAt: now - 30000, updatedAt: now, listenedMs: 20000, days: { [localDay(now)]: 20000 },
  }));
  const stored = structuredClone(fixture.records);
  fixture.tracks = [];
  const withoutCache = renderToStaticMarkup(<App />);
  fixture.tracks = [{
    id: "youtube:abcdefghijk", metadataSourceId: "itunes:999", title: "Different local title",
    artist: "Local A, Local B, Local C", album: "Different local album", duration: 180,
    fileName: "", format: "YouTube", missing: false,
  }];
  const withCache = renderToStaticMarkup(<App />);
  const recap = (html: string) => html.match(/<dl class="listening-recap-metrics">.*?<\/dl>/)?.[0];
  expect(recap(withCache)).toBe(recap(withoutCache));
  expect(recap(withCache)).toContain("<dt>Artists</dt><dd>1</dd>");
  expect(recap(withCache)).toContain("<dt>Albums</dt><dd>10</dd>");
  expect(withCache).toContain("Recorded artist");
  expect(withCache).not.toContain("Different local album");
  expect(fixture.records).toEqual(stored);
});
