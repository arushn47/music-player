import { library, mobile, type YtdlpSearchResult, type YtdlpStreamInfo } from "../adapters/native";
import { PlaybackController } from "./controller";
import { AndroidPlaybackController } from "./android";
import type { Track } from "../domain/types";
import { resolveCatalogSource } from "../domain/catalog-track";
import { playbackEvent } from "./diagnostics";

const preparedStreams = new Map<string, { stream: YtdlpStreamInfo; expires: number }>();
const attemptedSources = new Map<string, Set<string>>();
const streamRequests = new Map<string, Promise<YtdlpStreamInfo>>();
async function preparedStream(id: string): Promise<YtdlpStreamInfo> {
  const cached = preparedStreams.get(id);
  if (cached && cached.expires > Date.now()) return cached.stream;
  const pending = streamRequests.get(id);
  if (pending) return pending;
  const request = library.ytdlpGetStream(id).then(stream => {
    if (preparedStreams.size >= 128) preparedStreams.delete(preparedStreams.keys().next().value!);
    preparedStreams.set(id, { stream, expires: Date.now() + 120000 });
    return stream;
  }).finally(() => streamRequests.delete(id));
  streamRequests.set(id, request);
  return request;
}
export async function prepareCatalogCandidate(candidate: YtdlpSearchResult): Promise<Partial<YtdlpSearchResult>> {
  const stream = await preparedStream(candidate.id);
  return { duration: stream.duration || candidate.duration, track: stream.track || candidate.track, artist: stream.artist || candidate.artist };
}

// Structured music credits from the existing stream resolution request. Never
// retain its expiring URL, and never turn an uploader name into a performer.
export const resolvedMusic = new Map<
  string,
  { title: string; artist: string; album: string }
>();

export const musicResolved = new EventTarget();
export const offlineTracks = new Set<string>();
export const playbackTracks = new Map<string, Track>();

export const player = mobile
  ? new AndroidPlaybackController((id) => playbackTracks.get(id))
  : new PlaybackController(async (id, retry = false) => {
    if (offlineTracks.has(id)) return library.media(id);
    // Check if this is a YouTube track (format: youtube:videoId)
    if (id.startsWith("youtube:")) {
      const videoId = id.slice(id.indexOf(":") + 1);
      if (!retry || !attemptedSources.has(id)) {
        if (attemptedSources.size >= 128) attemptedSources.delete(attemptedSources.keys().next().value!);
        attemptedSources.set(id, new Set([videoId]));
      }
      const attempted = attemptedSources.get(id)!;
      let stream: YtdlpStreamInfo;
      try {
        if (retry) throw new Error("The previous audio URL failed to load. Retry playback or choose another recording.");
        stream = await preparedStream(videoId);
      } catch (error) {
        const track = playbackTracks.get(id);
        if (!track?.metadataSourceId) throw error;
        const catalog = await library.lookupCatalog(track.metadataSourceId);
        const candidate = await resolveCatalogSource(catalog, library.ytdlpSearch, { exclude: attempted, verify: prepareCatalogCandidate });
        attempted.add(candidate.id);
        stream = preparedStreams.get(candidate.id)!.stream;
      }
      playbackEvent({ trackId: id, stage: "stream-ready", candidateId: [...attempted].at(-1) });
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
