import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseLyrics } from "../domain/lyrics";
import { mergeProcessedLyrics, processLyrics, processKeylessLyrics, processPreferredLyrics } from "./lyric-processing";
const bridge = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: bridge.invoke, isTauri: () => true }));
beforeEach(() => bridge.invoke.mockReset());

describe("background Gemini result ownership", () => {
  it("prioritizes a saved key over Google cached results and never falls back after a Gemini error", async () => {
    const original = parseLyrics("[00:01]தமிழ்");
    const doc = { ...original, processedModel: "google-web:auto", translationSource: "google" as const, translation: { [original.lines[0].id]: "Tamil" } };
    const values = { romanisation: {}, translation: {}, lineLanguages: { [doc.lines[0].id]: ["ta", "en"] } };
    bridge.invoke.mockResolvedValueOnce(true).mockResolvedValueOnce(values);
    expect(await processPreferredLyrics(doc, "model", "auto")).toEqual({ values, provider: "gemini", model: "model" });
    expect(bridge.invoke.mock.calls.map(call => call[0])).toEqual(["gemini_key_status", "process_lyrics"]);
    bridge.invoke.mockReset().mockResolvedValueOnce(true).mockRejectedValueOnce(Error("Gemini unavailable"));
    await expect(processPreferredLyrics(doc, "model", "auto")).rejects.toThrow("Gemini unavailable");
    expect(bridge.invoke.mock.calls.map(call => call[0])).toEqual(["gemini_key_status", "process_lyrics"]);
  });
  it("uses keyless translation only without a key and reuses the selected Gemini model", async () => {
    const doc = parseLyrics("[00:01]தமிழ்");
    const values = { romanisation: {}, translation: {} };
    bridge.invoke.mockResolvedValueOnce(false).mockResolvedValueOnce(values);
    expect((await processPreferredLyrics(doc, "model", "ta")).provider).toBe("google");
    expect(bridge.invoke.mock.calls.map(call => call[0])).toEqual(["gemini_key_status", "process_keyless_lyrics"]);
    bridge.invoke.mockReset().mockResolvedValueOnce(true);
    await processPreferredLyrics({ ...doc, processedModel: "model", languageSource: "gemini" }, "model", "auto");
    expect(bridge.invoke).toHaveBeenCalledTimes(1);
    bridge.invoke.mockReset().mockRejectedValueOnce(Error("Private settings unavailable"));
    await expect(processPreferredLyrics(doc, "model", "auto")).rejects.toThrow("Private settings unavailable");
    expect(bridge.invoke).toHaveBeenCalledTimes(1);
  });
  it("uses the same native keyless command on phones, shares requests and retries errors", async () => {
    const doc = parseLyrics("[00:01]தமிழ்");
    bridge.invoke.mockResolvedValueOnce({ translation: {}, romanisation: {} });
    await Promise.all([processKeylessLyrics(doc, "ta"), processKeylessLyrics(doc, "ta")]);
    expect(bridge.invoke).toHaveBeenCalledTimes(1);
    expect(bridge.invoke).toHaveBeenCalledWith("process_keyless_lyrics", { lines: doc.lines.map(({ id, text }) => ({ id, text })), language: "ta" });
    bridge.invoke.mockRejectedValueOnce(Error("Offline"));
    await expect(processKeylessLyrics(doc, "ta")).rejects.toThrow("Offline");
    bridge.invoke.mockResolvedValueOnce({ translation: {}, romanisation: {} });
    await processKeylessLyrics(doc, "ta");
    expect(bridge.invoke).toHaveBeenCalledTimes(3);
    const cached = { ...doc, translationSource: "google" as const, processedModel: "google-web:ta", translation: { [doc.lines[0].id]: "Tamil" } };
    await processKeylessLyrics(cached, "ta");
    expect(bridge.invoke).toHaveBeenCalledTimes(3);
  });
  it("stores keyless provenance, preserves timing/imports and ignores a superseded provider", () => {
    const doc = parseLyrics("[00:01]தமிழ்");
    const id = doc.lines[0].id;
    const values = { romanisation: { [id]: "thamizh" }, translation: { [id]: "Tamil" }, lineLanguages: { [id]: ["ta"] } };
    const next = mergeProcessedLyrics(doc, doc, values, "google-web:ta", "google");
    expect(next.lines).toBe(doc.lines);
    expect(next.translationSource).toBe("google");
    expect(next.languageSource).toBe("google");
    expect(next.romanisationSource).toBe("google");
    expect(mergeProcessedLyrics(next, doc, values, "model")).toBe(next);
    const supplied = { ...doc, translation: { [id]: "Supplied" }, translationSource: "imported" as const };
    expect(mergeProcessedLyrics(supplied, supplied, values, "google-web:ta", "google").translation[id]).toBe("Supplied");
  });
  it("retains per-line languages and recognizes a confirmed English document", () => {
    const doc = parseLyrics("I love you\nStay with me");
    const lineLanguages = Object.fromEntries(doc.lines.map(line => [line.id, ["en"]]));
    const next = mergeProcessedLyrics(doc, doc, { romanisation: {}, translation: {}, lineLanguages }, "model");
    expect(next.lineLanguages).toEqual(lineLanguages);
    expect(next.englishOnly).toBe(true);
    expect(next.languageSource).toBe("gemini");
    expect(mergeProcessedLyrics({ ...doc, raw: "Changed" }, doc, { romanisation: {}, translation: {}, lineLanguages }, "model").lineLanguages).toBeUndefined();
  });
  it("replaces generated local pronunciation and caches the model without changing timing", () => {
    const doc = parseLyrics("[00:01]தமிழ்");
    const id = doc.lines[0].id;
    const current = {
      ...doc,
      romanisation: { [id]: "thamizh" },
      localRomanisation: { [id]: "thamizh" },
    };
    const next = mergeProcessedLyrics(
      current,
      doc,
      { romanisation: { [id]: "Tamil" }, translation: { [id]: "Tamil" } },
      "model",
    );
    expect(next.romanisation[id]).toBe("Tamil");
    expect(next.translation[id]).toBe("Tamil");
    expect(next.lines).toBe(doc.lines);
    expect(next.processedModel).toBe("model");
  });
  it("preserves supplied text, concurrent edits and a replaced original", () => {
    const doc = parseLyrics("[00:01]தமிழ்");
    const id = doc.lines[0].id;
    const current = {
      ...doc,
      romanisation: { [id]: "My pronunciation" },
      translation: { [id]: "My meaning" },
    };
    const values = {
      romanisation: { [id]: "AI" },
      translation: { [id]: "AI" },
    };
    const next = mergeProcessedLyrics(current, doc, values, "model");
    expect(next.romanisation[id]).toBe("My pronunciation");
    expect(next.translation[id]).toBe("My meaning");
    const replaced = { ...current, id: "replacement" };
    expect(mergeProcessedLyrics(replaced, doc, values, "model")).toBe(replaced);
  });
});

it('does not invoke either translation provider for a confirmed English song, even on manual retry', async () => {
  const doc = { ...parseLyrics("Run it up, the sun is up"), englishOnly: true };
  await processLyrics(doc, "model");
  await processKeylessLyrics(doc, "auto");
  expect(bridge.invoke).not.toHaveBeenCalled();
});
