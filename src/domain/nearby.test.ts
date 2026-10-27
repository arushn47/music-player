import { expect, it } from "vitest";
import { defaults } from "./types";
import { portableTrack } from "./nearby";

import { playSelection, resolveQueueEntry } from "./queue";
it("retains a guest's remote metadata when resolving the same source identity", () => {
  const track = { id: "youtube:fixture0001", title: "Synthetic", artist: "Lumaire", album: "", fileName: "", format: "YouTube", missing: false, duration: 36, source: { providerId: "youtube", sourceId: "fixture0001", pageUrl: "https://www.youtube.com/watch?v=fixture0001", license: "", licenseUrl: "", attribution: "Lumaire" } };
  const selected = playSelection(defaults(), track, false);
  expect(resolveQueueEntry(selected, selected.currentId!, track.id, track).queueTracks[track.id]).toEqual(track);
});

it('excludes private local files from portable sharing', () => {
  expect(portableTrack({ id: 'local', title: 'Private', artist: '', album: '', duration: 10, fileName: 'private.mp3', format: 'MP3', missing: false })).toBeNull();
});

