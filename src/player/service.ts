import { library, mobile } from "../adapters/native";
import { PlaybackController } from "./controller";
import { AndroidPlaybackController } from "./android";

// Structured music credits from the existing stream resolution request. Never
// retain its expiring URL, and never turn an uploader name into a performer.
export const resolvedMusic = new Map<
  string,
  { title: string; artist: string; album: string }
>();

export const musicResolved = new EventTarget();
export const offlineTracks = new Set<string>();

export const player = mobile
  ? new AndroidPlaybackController()
  : new PlaybackController(async (id) => {
    if (offlineTracks.has(id)) return library.media(id);
    // Check if this is a YouTube track (format: youtube:videoId)
    if (id.startsWith("youtube:")) {
      const videoId = id.slice(id.indexOf(":") + 1);
      const stream = await library.ytdlpGetStream(videoId);
      if (stream.track?.trim() && stream.artist?.trim()) {
        if (resolvedMusic.size >= 128)
          resolvedMusic.delete(resolvedMusic.keys().next().value!);
        resolvedMusic.set(id, {
          title: stream.track.trim(),
          artist: stream.artist.trim(),
          album: stream.album?.trim() || "",
        });
        musicResolved.dispatchEvent(
          new CustomEvent("resolved", { detail: id }),
        );
      }
      return stream.streamUrl;
    }
    // Check if this is a Commons track (format: wikimedia-commons:sourceId)
    if (id.startsWith("wikimedia-commons:")) {
      const sourceId = id.slice(id.indexOf(":") + 1);
      const resolved = await library.resolveCommons(sourceId);
      return resolved.url;
    }
    // Default to local file resolution
    return library.media(id);
  });
