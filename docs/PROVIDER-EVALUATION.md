# Provider integration and evaluation — 24 October 2026

## Decision

Keep JioSaavn for discovery, search identities, artist/album catalog pages and playback resolution. MusicBrainz is optional, separately attributed metadata enrichment on artist/album detail pages, with verified iTunes fallback. Apple charts are an additional country-specific Top 10, never a replacement for a regional JioSaavn chart. ListenBrainz remains evaluation-only.

## Implemented behavior

- MusicBrainz artist and release-group searches accept only a unique high-scoring exact normalized name/title with matching artist credits. Generic soundtrack labels are normalized, but background-score/live/remix distinctions and Indic combining marks are preserved. Ambiguous records are rejected. Source links, dates at their supplied precision and artist credits are shown separately; existing catalog IDs, artwork, saved playlists and playback metadata are not overwritten.
- MusicBrainz requests identify Lumaire, are serialized at least 1.1 seconds apart, and are limited to artist/album pages after a 300 ms dwell. iTunes fallback shares the existing approximate 20/minute gate. No per-card metadata searches and no required account/key.
- Optional HTTP requests have a six-second timeout and 2 MB body limit, with no stacked retries. Metadata caches are bounded to 128 keys, with 24-hour successful and five-minute negative TTLs. The renderer coalesces concurrent identical requests. These new caches are in memory and reset on application restart.
- Apple Music Most Played is attempted first for the selected country. If unavailable, the official iTunes Store Top Songs feed is used and labeled accordingly; purchase charts are never presented as Apple Music streaming charts. The original JioSaavn chart remains visible. A country selector defaults to India and persists independently of language preferences.
- Apple chart rank/order is preserved, with exactly ten unique validated identities required. A corrupt/incomplete chart is rejected rather than re-ranking surviving rows. Artwork URLs are restricted to Apple's CDN and upgraded to 600px when supported. Catalog song lookup occurs only when Play is clicked, not ten times on chart load.
- Apple caches are bounded to 16 countries, with one-hour freshness, up to 24-hour stale-on-error use and a short failed-request cooldown. An explicit refresh is rate-limited. Source, country, update time and fallback/stale status are visible. Chart errors do not block search or JioSaavn discovery.

## Live observations

A small read-only sample was run from this machine. Timings are individual observations, not an SLA or a broad quality ranking.

| Language/sample | MusicBrainz artist search | Album search sample |
|---|---|---|
| Malayalam — Sushin Shyam / Kumbalangi Nights | exact score-100 artist | HTTP 503; coverage inconclusive |
| Tamil — Anirudh Ravichander / Vikram | exact score-100 artist | Vikram score 100; first release 2022-05-15; artist-credit present |
| Telugu — M. M. Keeravani / RRR | exact score-100 artist | no results for this query |
| Hindi — Amit Trivedi / Dev D | exact score-100 artist | no results for this query |
| Punjabi — Diljit Dosanjh / GOAT | exact score-100 artist | G.O.A.T. score 100; first release 2020-07-30 |
| International — Taylor Swift / Midnights | exact score-100 artist among lower-ranked alternatives | score-100 album; first release 2022-10-21 |

Artist HTTP samples took approximately 0.6–4.3 seconds. Album requests varied from 0.5–5.4 seconds, including empty/error results. Query failures or naming differences must not be interpreted as proof an album is absent from MusicBrainz. The actual Rust integration separately verified MusicBrainz data for Sushin Shyam and Vikram, including its date and credits. A local HTTP fixture verifies fallback to iTunes when MusicBrainz cannot supply a confident match.

Apple's public US Music feed returned ten entries and ten artwork URLs in a Python probe (~2.1 s). The India Music probe timed out; the India iTunes chart returned ten entries in ~1.4 s. The actual Rust integration returned ten correctly labeled iTunes Store entries for both IN and US during its run, demonstrating the production fallback. One upgraded Apple artwork fetch was 600×600 pixels, approximately 123 KB, in ~0.7 s. This is an image-quality sample, not verification of every cover.

## ListenBrainz Fresh Releases assessment

The official `/1/explore/fresh-releases/` endpoint was tested without an account:

- A 30-day request exceeded the evaluation's 4 MB response budget.
- A three-day request around 2026-10-24 returned 934 releases, 405,824 bytes, in approximately 4.25 s.
- Those records provided artist names/MBIDs and dates but no language field. Using them as a language-specific home feed would need additional matching/enrichment requests.
- Against five date-comparable albums in a 100-entry JioSaavn mixed-language release sample, two English titles overlapped. Telugu/Hindi/Tamil editions of Namit Malhotra's Ramayana had no normalized-title match in this small sample. Title-only matching can miss renamed/alternate editions; this is not an exhaustive identity or coverage audit. There were no date-comparable Malayalam albums in that baseline, so no Malayalam coverage conclusion is justified.
- No sampled well-known artist appearing in that three-day window proves nothing about their overall coverage or whether they released anything in those days.

There is no demonstrated regional coverage advantage or loading-performance advantage, so ListenBrainz is not fetched by the production UI and no working release feed is removed.

## Reproduction and remaining checks

Run `python scripts/evaluate-music-providers.py --date 2026-10-24` for bounded public API samples. The script uses a meaningful User-Agent and spaces MusicBrainz requests; the emitted JSON contains metadata and timing summaries, not audio, account information or lyric contents. It stops after repeated failures. Private `.test-data/` run artifacts also contain the narrower release comparison and artwork probe.

Additional opt-in Rust tests: `live_regional_metadata` and `live_country_charts`. Normal tests use local HTTP fixtures and do not contact providers.

Limitations: this is a deliberately small sample. Broader language coverage, ambiguous same-name artists/releases and multiple editions require further evaluation before changing canonical sources. MusicBrainz artist credits are release-group artist credits, not a complete performer/composer personnel listing. Existing artist images remain unchanged; no unverified cross-provider cover is substituted. New caches are per process, and the supplemental panels require network after a restart. Official Apple feeds can time out; the iTunes fallback measures a different chart and is identified as such. UI verification and final test/build results are recorded in CURRENT-STATUS.md.

## Primary references

- https://musicbrainz.org/doc/MusicBrainz_API
- https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- https://performance-partners.apple.com/search-api
- https://rss.marketingtools.apple.com/
- https://github.com/metabrainz/listenbrainz-server/blob/master/listenbrainz/webserver/views/explore_api.py
