import type { Track } from "./types";
import type { YtdlpSearchResult } from "../adapters/native";
import { canonicalArtistCredit } from "./catalog-links";

const presentationLabel =
  /^(?:(?:official\s+)?(?:music\s+)?(?:lyric(?:s)?(?:\s+video)?|audio|video|visuali[sz]er)|hd|hq|4k)$/i;
const channelArtist = (channel: string | null) => {
  const value = (channel || "").trim();
  if (/ - Topic$/i.test(value)) return value.replace(/ - Topic$/i, "");
  if (/vevo$/i.test(value)) return value.replace(/vevo$/i, "");
  return "Unknown artist";
};

export function cleanVideoTitle(value: string): string {
  return value
    .normalize("NFKC")
    .replace(
      /[([](?:official (?:music )?video|official audio|lyric video|lyrics|audio|hd|hq|4k)[)\]]/gi,
      "",
    )
    .split(/\s*[|｜]\s*/)[0]
    .replace(/\s+(?:[-–—]\s*)?lyrical(?:\s*[([](?:Tamil|Telugu|Hindi|Malayalam|Kannada|Bengali|Punjabi)[)\]])?\s*$/i, "")
    .replace(
      /\s+(?:[-–—]\s*)?(?:official\s+(?:music\s+)?(?:video|audio)|(?:official\s+)?lyric(?:s)?(?:\s+video)?|visuali[sz]er)(?:\s*[-–—])?\s*$/i,
      "",
    )
    .replace(/\s+/g, " ")
    .replace(/\s*[([]prod(?:uced)?\.?\s*(?:by\b|[.:])[^)\]]*[)\]]/gi, "")
    .trim();
}

/** Ambiguous title orders are verified by catalogs, never accepted as credits outright. */
export function metadataQueries(
  track: Track,
): { title: string; artist: string }[] {
  const queries = [{ title: track.title, artist: track.artist }];
  const parts = cleanVideoTitle(track.fileName).split(/(?:\s+[-–—]\s*|\s*[-–—]\s+)/);
  if (
    parts.length === 2 &&
    !parts.some((part) => presentationLabel.test(part))
  ) {
    queries.push({ title: parts[0], artist: parts[1] });
    queries.push({ title: parts[1], artist: parts[0] });
  }
  return queries.filter(
    (query, index) =>
      queries.findIndex(
        (candidate) =>
          candidate.title === query.title && candidate.artist === query.artist,
      ) === index,
  );
}

export const needsMetadata = (track: Track) =>
  !track.metadataSourceId && (
  /^unknown(?: artist)?$/i.test(track.artist.trim()) ||
  !track.artist.trim() ||
  !track.album.trim() ||
  !track.artworkUrl);

export function youtubeTrack(result: YtdlpSearchResult): Track {
  const title = cleanVideoTitle(result.title);
  const parts = title.split(/(?:\s+[-–—]\s*|\s*[-–—]\s+)/);
  let song = title,
    artist = channelArtist(result.channel);
  if (parts.length > 1) {
    const left = parts[0].trim(),
      right = parts.slice(1).join(" - ").trim();
    // "Song - Lyric Video" describes presentation, not Artist - Song.
    if (presentationLabel.test(right) || /^from\s+["“]/i.test(right))
      song = left;
    else if (presentationLabel.test(left)) song = right;
    else if (
      artist !== "Unknown artist" &&
      right.toLocaleLowerCase() === artist.toLocaleLowerCase()
    )
      song = left;
    else {
      artist = left;
      song = right;
    }
  }
  return {
    id: `youtube:${result.id}`,
    title: result.track?.trim() || song,
    artist: canonicalArtistCredit(result.artist?.trim() || artist),
    album: result.album?.trim() || "",
    duration: result.duration || 0,
    fileName: result.title,
    missing: false,
    format: "YouTube",
    artworkUrl: result.thumbnail,
    source: {
      providerId: "youtube",
      sourceId: result.id,
      pageUrl: `https://www.youtube.com/watch?v=${result.id}`,
      license: "YouTube Terms of Service",
      licenseUrl: "https://www.youtube.com/t/terms",
      attribution: result.channel || "Unknown",
    },
  };
}

/** Repair known online credit aliases and presentation-label inversions; keep IDs and user data. */
export function repairYoutubeTrack(track: Track): Track {
  if (track.source?.providerId !== "youtube") return track;
  const source = track.source;
  const artist = canonicalArtistCredit(track.artist);
  if (artist !== track.artist) track = { ...track, artist };
  if (
    track.metadataSourceId ||
    !presentationLabel.test(track.title.trim())
  )
    return track;
  const parsed = youtubeTrack({
    id: source.sourceId,
    title: track.fileName,
    channel: source.attribution,
    duration: track.duration,
    thumbnail: track.artworkUrl || null,
  });
  if (!parsed.title || presentationLabel.test(parsed.title)) return track;
  return { ...track, title: parsed.title, artist: parsed.artist };
}
