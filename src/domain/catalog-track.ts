import type { CatalogTrack, CatalogArtist, YtdlpSearchResult } from "../adapters/native";
import type { Track } from "./types";
import { youtubeTrack } from "./online-track";
import { canonicalArtistCredit } from "./catalog-links";
import { matchSource, searchRoman, sourceCredits, sourceTitle } from "./source-matching";
import { playbackEvent } from "../player/diagnostics";

export async function canonicalArtistNames(catalog: CatalogTrack, lookup: (id: string) => Promise<CatalogArtist>): Promise<string> {
  if (!catalog.artists.length) return canonicalArtistCredit(catalog.artist);
  const names = await Promise.all(catalog.artists.map(async credit => {
    if (!credit.id || !/^(?:saavn:artist:|itunes:)[1-9]\d*$/.test(credit.id) || credit.name.includes(",")) return credit.name;
    try {
      const artist = await lookup(credit.id);
      return artist.id === credit.id && artist.name.trim() ? artist.name : credit.name;
    } catch { return credit.name; }
  }));
  return canonicalArtistCredit(names.join(", "));
}

export function canonicalTrack(
  catalog: CatalogTrack,
  candidate: YtdlpSearchResult,
  existing?: Track,
): Track {
  const source = youtubeTrack(candidate);
  return {
    ...source,
    ...(existing?.id === source.id ? existing : {}),
    source: source.source,
    title: catalog.title,
    artist: canonicalArtistCredit(catalog.artist),
    album: catalog.album,
    duration: catalog.duration,
    artworkUrl: catalog.artworkUrl || null,
    metadataSourceId: catalog.id,
  };
}

export function catalogQueueTrack(catalog: CatalogTrack): Track {
  return { id: catalog.id, metadataSourceId: catalog.id, title: catalog.title, artist: canonicalArtistCredit(catalog.artist),
    album: catalog.album, duration: catalog.duration, artworkUrl: catalog.artworkUrl, format: "catalog", fileName: "", missing: false };
}

export interface ResolutionOptions {
  verify?: (candidate: YtdlpSearchResult) => Promise<Partial<YtdlpSearchResult> | void>;
  exclude?: Set<string>;
}

function failureKind(error: unknown): string {
  const message = String(error);
  if (/not installed|install.*engine|failed to execute|cannot find.*(?:file|engine)/i.test(message)) return "engine";
  if (/not a bot|sign in|verification|confirm you/i.test(message)) return "verification";
  if (/timed? out|timeout|network|offline|could not reach|connection|resolve host|HTTP (?:429|5\d\d)/i.test(message)) return "network";
  if (/private|removed|not available|unavailable|not exist|not found|geo.block|copyright/i.test(message)) return "unavailable";
  return "extraction";
}

export async function resolveCatalogSource(
  catalog: CatalogTrack,
  search: (query: string, maxResults: number, catalog?: boolean) => Promise<YtdlpSearchResult[]>,
  options: ResolutionOptions = {},
): Promise<YtdlpSearchResult> {
  const candidates = new Map<string, YtdlpSearchResult>();
  const credits = sourceCredits(catalog), title = sourceTitle(catalog.title);
  if (!title || !credits.length || !/^(?:saavn:[\w-]{8}|itunes:[1-9]\d*)$/.test(catalog.id)) throw new Error("Invalid catalog track identity or credits. Refresh metadata and retry.");
  const primary = credits[0];
  const romanTitle = await searchRoman(title), romanArtist = await searchRoman(primary);
  const phases = [
    [`"${title.replaceAll('"', '')}" ${primary}`, `${title} ${primary}`],
    [...credits.slice(1, 4).map(artist => `${title} ${artist}`), `${title} ${catalog.album}`, ...(romanTitle !== title || romanArtist !== primary ? [`${romanTitle} ${romanArtist}`] : [])],
  ];
  const triedQueries = new Set<string>(), triedCandidates = new Set(options.exclude || []);
  let searches = 0, successfulSearches = 0, extractionFailures = 0;
  const searchFailures = new Set<string>(), streamFailures = new Set<string>();
  for (const phase of phases) {
    const queries = [...new Set(phase.map(query => query.trim().slice(0, 200)))].filter(query => !triedQueries.has(query));
    const responses = await Promise.allSettled(queries.map(async query => {
      triedQueries.add(query); searches++;
      playbackEvent({ trackId: catalog.id, stage: "search", query });
      const values = await search(query, 15, true);
      successfulSearches++;
      playbackEvent({ trackId: catalog.id, stage: "discovered", query, count: values.length });
      return values;
    }));
    responses.forEach(response => {
      if (response.status === "fulfilled") response.value.forEach(candidate => { if (!candidates.has(candidate.id)) candidates.set(candidate.id, candidate); });
      else { const reason = failureKind(response.reason); searchFailures.add(reason); playbackEvent({ trackId: catalog.id, stage: "search-failed", reason }); }
    });
    const matches: { candidate: YtdlpSearchResult; score: number }[] = [];
    for (const candidate of candidates.values()) {
      if (triedCandidates.has(candidate.id)) continue;
      triedCandidates.add(candidate.id);
      let match = await matchSource(catalog, candidate);
      if (match.reason === "duration-missing" && options.verify) {
        try { Object.assign(candidate, await options.verify(candidate)); match = await matchSource(catalog, candidate); }
        catch (error) { const reason = failureKind(error); streamFailures.add(reason); extractionFailures++; playbackEvent({ trackId: catalog.id, stage: "extraction-failed", candidateId: candidate.id, reason }); }
      }
      playbackEvent({ trackId: catalog.id, stage: match.accepted ? "matched" : "rejected", candidateId: candidate.id, reason: match.reason });
      if (match.accepted) matches.push({ candidate, score: match.score });
    }
    matches.sort((a, b) => a.score - b.score);
    for (const { candidate } of matches) {
      try {
        const details = await options.verify?.(candidate);
        if (details) {
          Object.assign(candidate, details);
          const verified = await matchSource(catalog, candidate);
          if (!verified.accepted) { playbackEvent({ trackId: catalog.id, stage: "rejected", candidateId: candidate.id, reason: `stream-${verified.reason}` }); continue; }
        }
        playbackEvent({ trackId: catalog.id, stage: options.verify ? "source-resolved" : "candidate-selected", candidateId: candidate.id });
        return candidate;
      } catch (error) {
        extractionFailures++;
        const reason = failureKind(error); streamFailures.add(reason);
        playbackEvent({ trackId: catalog.id, stage: "extraction-failed", candidateId: candidate.id, reason });
      }
    }
  }
  if (searchFailures.has("engine") || streamFailures.has("engine")) throw new Error("The streaming engine is unavailable. Open Settings, install or refresh the engine, and retry.");
  if (streamFailures.has("verification")) throw new Error("The audio provider requested sign-in or verification for the matching recordings. Retry later or choose another source.");
  if (extractionFailures && streamFailures.size === 1 && streamFailures.has("network")) throw new Error("Stream retrieval failed because the provider or network could not be reached. Check your connection and retry.");
  if (!successfulSearches && searches) throw new Error("Audio search failed: the source provider or network is unavailable. Check your connection and retry.");
  if (extractionFailures) throw new Error("Matching recordings were found, but stream extraction failed for all available candidates. Retry later or check the streaming engine in Settings.");
  if (successfulSearches < searches) throw new Error("Some audio searches failed. Source availability could not be confirmed; check your connection and retry.");
  throw new Error("No matching audio source could be verified for this catalog entry. Try searching the song directly in Discover, or retry.");
}
