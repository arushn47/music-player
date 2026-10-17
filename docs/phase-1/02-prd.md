# Product requirements document

Status: proposed, **17 October 2026**. Evidence: [research](01-research-report.md). Constraints: [source matrix](05-source-feasibility.md), [risks](08-licensing-risks.md). Priority source: [feature plan](03-feature-prioritization.md).

## Problem and audience

Listeners who enjoy songs in unfamiliar scripts often switch between a player, lyric page, transliteration tool and translation page. Recording mismatches and timing errors undermine understanding. Enthusiast players add setup and source complexity; familiar streaming interfaces may not provide the combined text experience desired.

Primary pilot: Windows users with lawfully usable local music who want to follow Tamil/Hindi and English text. These are proposed research cohorts based on the user's example, not proven supported languages. Secondary audience: independent-music discovery listeners using optional permitted sources. Mainstream subscription avoidance is an expressed motivation; the plan must not claim that a limited authorized catalogue fulfills complete mainstream replacement.

## Product outcome and constraints

Deliver an original free player that remains useful offline, preserves the user's library and gives them a readable original/romanised/translated lyric view when those texts are available and authorized. Core use needs no account, API key, hosted backend or subscription. ₹0 means no additional cash expenditure on existing hardware/connectivity, not zero labor, bandwidth, power or future service risk.

The latest explicit user decision returns Lumaire to **Windows desktop first: Tauri 2 + Rust, React + TypeScript + Vite**. Rust mediates local files, SQLite and an optional replaceable yt-dlp resolver; the UI uses domain/provider ports. Select playback only after WebView2 compatibility tests. No required backend or paid API. The [current architecture](04-architecture.md) and [desktop audit](14-desktop-transition-audit.md) supersede delivery assumptions in the [historical website investigation](13-lumaire-web-provider-architecture.md). Phase 1 is documentation/environment audit only; reviewed Phase 2 prototypes must succeed before Phase 3 full-app planning.

## User stories and requirements

| ID | Story / functional requirement | Acceptance / release scope |
|---|---|---|
| F01 | As a new listener, I can pick local files and play without creating an account | After installation, cold launch, add, start/pause, seek, volume and next work with networking disabled and every resolver disabled on the declared Windows format fixture set |
| F02 | As a library owner, I can search and organize my music | Title/artist/album search, favorites, queue order, repeat/shuffle, playlist add/remove/rename; duplicates handled predictably |
| F03 | As a returning user, I recover my session | SQLite stores queue, playlists, selected record, position and settings transactionally; cold reopen paused offline, relink missing/moved scoped files explicitly, never unexpectedly audible |
| F04 | As a user, I can move my library | Versioned JSON playlist/settings export/import; missing files remain listed and can be relinked; no secrets/audio silently exported |
| F05 | As a listener, I can load authorized lyrics | Plain text and line-timed LRC; offsets, seek-to-line, auto-scroll, readable no-lyrics/instrumental/invalid states |
| F06 | As a language learner, I can compare texts | Preserve supplied original; explicitly show missing original/variants; load authorized translation/romanisation sidecars by confirmed line identity; pending, unavailable and generated states are distinct |
| F07 — conditional P1 | As a user, I can request local script conversion when validated | Tamil→ISO 15919 candidate; generated output is outside required MVP until the exact tool, scheme and reviewer gate pass; preserve source and corrections |
| F08 — P1, outside MVP | As an online listener, I know where audio comes from | Optional bounded adapter only after permission/credential/runtime gate; Jamendo is conditional, not cleared; provenance, attribution and no-offline capability visible |
| F09 | As a listener facing failures, I keep control | Retry/skip/change source are explicit; queue survives errors; no silent different recording or unauthorized fallback |
| F10 | As a privacy-conscious user, I decide what leaves the device | Local history default; opt-in external integrations; delete history/cache and view provider disclosures |
| F11 | As a keyboard/screen-reader user, I can operate the player | Named controls, focus recovery, announced errors; lyric motion never steals focus; full essentials keyboard-operable |

F06 supports the combined experience without depending on a translation service. **Required first-release pair: Tamil original with supplied Latin romanisation and English meaning; no generated language-quality claim. Automatic offline machine translation is not promised.** TuneScript 1.3.2 was inspected in Phase 1.5: it uses Gemini cloud inference and browser APIs; direct reuse remains licence-dependent. See [validation](12-phase-1.5-validation.md) for evidence, acceptance protocols and proposed scope revisions.

## Non-functional requirements

| ID | Requirement | Proposed validation target, not a measured result |
|---|---|---|
| N01 | Zero required recurring cash cost | Core runs with network blocked and no provider credentials; no billing-enabled services |
| N02 | Playback responsiveness | On a recorded baseline Windows PC, p95 local play-to-audible ≤1 s for warm imported MP3 fixtures; UI input response ≤100 ms excluding OS file dialogs |
| N03 | Efficient library handling | Search results p95 ≤200 ms for 10,000 metadata records after index creation; scanning runs off UI thread |
| N04 | Audio continuity | One-hour mixed-fixture queue without app-caused stop, crash or duplicate history completion; do not infer gapless from this test |
| N05 | Timing integrity | Reference authorized fixtures retain line timestamps through variants; active-line drift ≤150 ms excluding deliberately injected offsets, documented measurement method |
| N06 | Accessibility | Target WCAG 2.2 AA for app UI; keyboard + Windows screen-reader checks, 200% zoom, contrast measurement and reduced-motion validation |
| N07 | Data integrity/security | Transactional writes and schema migration/restore tests; no raw session cookies, remote HTML rendering or arbitrary shell commands |
| N08 | Honest compatibility | Publish tested OS, formats, languages, output paths and source capabilities; unsupported cases degrade gracefully |

Do not set arbitrary RAM/installer claims before baseline measurement. Report idle/playing/scanning memory on the baseline machine; Phase 2 measures a minimal prototype, Phase 3 revisits full-app limits. No full native/browser equivalence is assumed.

## Success metrics and research plan

Pilot ten consenting target listeners using their own or authorized sample content. Proposed go/no-go signals: at least eight finish first-play and three-text viewing tasks without assistance; at least five voluntarily return within a week; at least six prefer the combined view for a named task; all can identify source and unavailable translation status. Collect observations and interviews without default product analytics. These thresholds are hypotheses and sample sizes are too small for market-size claims.

Track first-play time, source-error recovery, corrections needed per language pair, failed recording matches and voluntarily reported return use. Collect no full lyrics or listening history in research reports without consent. Build a player only if the value persists beyond access to free mainstream streams.

## Scope exclusions and review questions

Exclude subscription bypass, DRM/anti-bot workarounds, unrestricted downloads, public user uploads, catalog rehosting, paid-owner APIs, cloud sync, live rooms, TV/mobile-native parity, executable plugins, word-level timing generation and full DJ Automix from MVP. Advanced audio starts with transport/volume and later simple DSP only for compatible permitted sources.

Current recommendation: Windows desktop local core, supplied Tamil/Latin/English reading and independent implementation with proposed MIT licensing. SQLite is preferred for local relational state; exact binding/version is pending review. Optional yt-dlp discovery/resolution requires separate technical, distribution and source-permission tests; absence must never disable local music. Rust availability blocks native builds. Owner licence approval/notices gate distribution; TuneScript, generation and source permissions gate optional features. See [10](10-decisions.md) and [14](14-desktop-transition-audit.md). This phase remains documentation-only.
