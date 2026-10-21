import { expect, it } from "vitest";
import { parseLyrics, synchronizedLyrics, upgradeSyncedLyrics } from "./lyrics";

it("upgrades cached plain text without losing aligned translations, pronunciation or language labels", () => {
  const old = { ...parseLyrics("First line\nSecond line"), origin: "provider" as const };
  const fresh = parseLyrics("[ti:Song]\n[00:01]First line\n[00:05]Second line");
  old.translation = { [old.lines[0].id]: "Meaning" };
  old.romanisation = { [old.lines[0].id]: "Pronunciation" };
  old.lineLanguages = { [old.lines[0].id]: ["ta"] };
  old.processedModel = "cached-model";
  const upgraded = upgradeSyncedLyrics(old, fresh, 369);
  expect(synchronizedLyrics(upgraded, 369)).toBe(true);
  expect(upgraded.translation[fresh.lines[0].id]).toBe("Meaning");
  expect(upgraded.romanisation[fresh.lines[0].id]).toBe("Pronunciation");
  expect(upgraded.lineLanguages?.[fresh.lines[0].id]).toEqual(["ta"]);
  expect(upgraded.processedModel).toBe("cached-model");
});

it("never overwrites imported lyrics or applies timestamps for a different audio edition", () => {
  const old = { ...parseLyrics("First line"), origin: "provider" as const };
  const fresh = parseLyrics("[00:01]First line");
  fresh.source = { provider: "lrclib", recordId: 42, title: "Song", artist: "Artist", duration: 369 };
  expect(upgradeSyncedLyrics(old, fresh, 339)).toBe(old);
  const imported = { ...old, origin: "imported" as const };
  expect(upgradeSyncedLyrics(imported, fresh, 369)).toBe(imported);
  const manual = { ...old, translationSource: "imported" as const };
  expect(upgradeSyncedLyrics(manual, parseLyrics("[00:01]Different line"), 369)).toBe(manual);
  expect(upgradeSyncedLyrics(old, parseLyrics("Plain text"), 369)).toBe(old);
});

it("keeps recording-duration and timestamp validation when upgrading", () => {
  const doc = parseLyrics("[00:01]First line\n[06:05]Last line");
  doc.source = { provider: "lrclib", recordId: 42, title: "Song", artist: "Artist", duration: 369 };
  expect(synchronizedLyrics(doc, 370.1)).toBe(true);
  expect(synchronizedLyrics(doc, 376.58)).toBe(false);
  expect(synchronizedLyrics(doc, 339)).toBe(false);
  expect(synchronizedLyrics(doc, 380)).toBe(false);
  doc.lines[1].time = 390000;
  expect(synchronizedLyrics(doc, 376.58)).toBe(false);
});
