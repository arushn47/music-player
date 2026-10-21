import { expect, it } from "vitest";
import { discoverySeeds, personalPicks } from "./personal-discovery";
import type { CatalogTrack } from "../adapters/native";
it("ranks explicit favorites, excludes repeats and diversifies real catalog picks", () => {
  const candidates: CatalogTrack[] = Array.from({ length: 6 }, (_, i) => ({ id: `itunes:${i + 1}`, title: `Song ${i}`, artist: i < 4 ? "Artist A" : "Artist B", album: "", artists: [], duration: 120 }));
  const known = [{ ...candidates[0], format: "catalog", fileName: "", missing: false }];
  expect(discoverySeeds(known, [known[0].id], [], 0)).toEqual(["Artist A"]);
  const picks = personalPicks([...candidates, candidates[2]], ["Artist A", "Artist B"], known, [], 0);
  expect(picks).toHaveLength(4); expect(new Set(picks.map(pick => pick.track.id)).size).toBe(4);
  expect(picks.some(pick => pick.track.id === known[0].id)).toBe(false);
  expect(personalPicks(candidates, [], [], [])).toEqual([]);
});
