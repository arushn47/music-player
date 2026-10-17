# Feature prioritization

Date: **17 October 2026**. Links: [PRD](02-prd.md), [architecture](04-architecture.md), [lyrics](06-lyrics-system.md), [roadmap](09-roadmap.md), [risks](08-licensing-risks.md).

Complexity is relative engineering uncertainty, not an estimate of elapsed time or cost: S = one bounded component; M = several components; L = platform/source/quality investigation. No person-week estimate is justified before a working baseline.

## MVP: useful without external services

| Priority / requirement | Feature | Complexity | Dependency / risk | Release test |
|---|---|---|---|---|
| P0 F01 | Select/import local MP3, WAV and FLAC candidate formats; transport, seek, volume | M | WebView2 codec/seek validation; format list shrinks to verified cases | Network-off playback/seek/error fixtures |
| P0 F02–04 | Desktop SQLite library, queue, favorites, playlists, session metadata and JSON export/import | M | Stable IDs, Rust-scoped files, SQLite transactions/migrations, backup and explicit relinking | Offline cold restart, duplicate, missing-file, migration/storage-failure and round-trip tests |
| P0 F05 | Local TXT + LRC, line sync, offset, auto-scroll, lyric font controls | M | Authorized text; timestamp and encoding correctness | Seek/offset/pause/track-change fixture suite |
| P0 F06 | Original + romanised + translated rows using supplied authorized variants | M | Line identity/mapping and RTL rendering | Combined view works fully offline with prepared fixture |
| P0 F09–11 | Recovery UI, named controls, privacy defaults, export/delete | M | No unsafe HTML/path/URL handling | Keyboard/screen-reader/offline/error tests |
| P0 project trust | Rights/provenance records and source capability enforcement | M | Rights apply separately to text/audio/art | Unsupported download/translation disabled |

Phase 1.5 explicitly revises the earlier mandatory-generation proposal: supplied variants are P0; automatic generation is conditional P1. Initial reading pair is Tamil original / supplied Latin / supplied English. An unavailable generator must not block original lyrics or prepared variant display. [Validation and change rationale](12-phase-1.5-validation.md).

## First online / subsequent releases

| Priority | Feature | Complexity | Required evidence / risk |
|---|---|---|---|
| Conditional P1 F07 | Local Tamil→ISO 15919 script conversion | M | Exact artifact/transitive notices, mixed-script/no-mutation cases and fluent review; script ≠ pronunciation |
| Conditional P1 F08 | Optional Jamendo noncommercial streaming | M | Public credential-distribution interpretation, track rights and live playback remain unresolved; [Phase 1.5](12-phase-1.5-validation.md) downgrades suitability |
| P1 | Optional MusicBrainz enrichment and ListenBrainz scrobbling | M | Rate limits/UA, separate artwork rights, opt-in/token storage; metadata not audio |
| Conditional P1 | Official visible embedded-player mode | M | Provider terms, player visibility/ads, event/clock and user-gesture tests; [WEB-01](13-lumaire-web-provider-architecture.md) specified, not executed |
| Current platform | Tauri 2 + Rust desktop shell | M | Native toolchain and local playback are Phase 2 gates, not a completed foundation |
| Conditional feasibility | Replaceable local yt-dlp resolver | L | Separate resolution/playback tests, controlled native process, pinned binary/runtime licence audit and source-permission gate; never required for local playback |
| P2 optional | Browser edition | L | Historical website findings retained; separate file/storage/codec/permission validation, no parity promise |
| P1 | Sleep timer, local history/stats, theme density preferences | S–M | Local privacy/storage; no fake precision in listening counts |
| P1 conditional | Offline machine translation language pack | L | Each model's license, rights to transform text, distribution size, CPU/memory and quality benchmark |
| P1 conditional | Audius source | M | Complete API contract, per-track access/rights review, quota/expiry/region tests |
| P2 conditional | Authorized LRCLIB / external lyrics | M | Rights/caching/translation policy and live access behavior validated |
| P2 | Word-timed supplied lyrics, pronunciation corrections, A–B practice loop | M | Timed fixture format, accessible loop controls; no invented word timestamps |
| P2 | EQ, gain/replay-gain candidate, simple crossfade | L | DSP/source compatibility, clipping/headroom, interruption/output tests; not bit-perfect claim |
| P2 | Authenticated LAN remote / official optional embeds | L | Local network auth/origin threat model; platform embed restrictions and UX |

These are retained product priorities, not authorization or a committed full-app plan. The user's latest decision supersedes website-first ordering: Windows/Tauri 2 + Rust, React/TypeScript/Vite and proposed SQLite. Phase 1 audit → review → Phase 2 local playback, separate resolution and stream-playback tests → Phase 3 full-app planning only after success. Public source inclusion retains permission/runtime gates. [Current audit](14-desktop-transition-audit.md).

## Deliberately excluded from initial foundation

| Feature | Reason |
|---|---|
| All Spotify/YouTube Music recordings without subscription/ads/restrictions | No verified permission/cost foundation; source extraction is not clearance |
| Arbitrary HTTP resolvers or executable plugin marketplace | Unknown rights, credentials/network trust and substantial support surface |
| Universal stream downloads or source-to-source silent fallback | Contradicts source-specific permissions and recording identity |
| DJ Automix, beat matching and lossless/Atmos promises | Large audio/model/output-path scope with no baseline measurements |
| Central streaming proxy, account service, shared lyric/translation corpus | Hosting/privacy/licensing costs undermine zero required backend |
| Cloud AI/chat, collaborative rooms, native phone/TV/Wear clients | Recurring resources or large multi-platform testing effort |

Reconsider exclusions only through a new decision with evidence, owner and acceptance criteria. Do not add feature breadth to compensate for a weak pilot result.
