/**
 * LRCLIB lyrics provider for Lumaire.
 *
 * All network I/O happens inside the Rust `fetch_lyrics` Tauri command so the
 * WebView2 Content-Security-Policy is not involved. This module only shapes
 * the response into the existing LyricDocument format.
 *
 * Terms: LRCLIB is a free, open lyrics database with no API key requirement.
 * Caching is encouraged; we store results in the session `lyrics` map just
 * like manually attached docs.
 */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { parseLyrics } from "../domain/lyrics";
import type { LyricDocument, Track } from "../domain/types";

/** Shape returned by the Rust fetch_lyrics command. */
type LyricResult =
  | { kind: "synced"; lrc: string }
  | { kind: "plain"; text: string }
  | { kind: "instrumental" }
  | { kind: "not_found" };

export type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; doc: LyricDocument }
  | { status: "instrumental" }
  | { status: "not_found" }
  | { status: "error"; message: string };

/**
 * Fetch lyrics for a track from LRCLIB via the native command.
 * Returns a LookupState describing the outcome; never throws.
 *
 * Pass `cachedDoc` if the session already has lyrics for this track —
 * it will be returned immediately as `found` without a network round-trip.
 */
export async function lookupLyrics(
  track: Track,
  cachedDoc?: LyricDocument,
): Promise<LookupState> {
  // Not running inside Tauri — skip silently.
  if (!isTauri()) return { status: "idle" };

  // Use cached session lyrics if present (manually attached or prior lookup).
  if (cachedDoc) return { status: "found", doc: cachedDoc };

  try {
    const result = await invoke<LyricResult>("fetch_lyrics", {
      title: track.title,
      artist: track.artist === "Unknown artist" ? "" : track.artist,
      album: track.album,
      duration: track.duration,
    });

    switch (result.kind) {
      case "synced": {
        // Use filename "<title> · LRCLIB" so provenance is clear in the UI.
        const doc = parseLyrics(result.lrc, `${track.title} · LRCLIB`);
        return { status: "found", doc };
      }
      case "plain": {
        const doc = parseLyrics(result.text, `${track.title} · LRCLIB (plain)`);
        return { status: "found", doc };
      }
      case "instrumental":
        return { status: "instrumental" };
      case "not_found":
        return { status: "not_found" };
    }
  } catch (e) {
    return {
      status: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
