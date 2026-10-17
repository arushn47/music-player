# Gated roadmap — desktop feasibility first

Status: **documentation only, 17 October 2026**. Latest user decision: Windows/Tauri 2 + Rust with React/TypeScript/Vite. No installations or implementation in Phase 1. This roadmap replaces the website milestone sequence; [13](13-lumaire-web-provider-architecture.md) and D14/D16 in [10](10-decisions.md) retain website findings and WEB-01 as history.

Related: [audit/blockers](14-desktop-transition-audit.md), [architecture](04-architecture.md), [PRD](02-prd.md), [lyrics](06-lyrics-system.md), [risks](08-licensing-risks.md).

## Phase 1 — current review package

Read and reconcile all existing documentation, inventory the environment without installing, specify adapter/native boundaries and review distribution/source permissions. Record verified observations separately from source-documented behavior, assumptions and tests.

**Exit:** reviewed audit, proposed changes and blockers. Documentation is prepared; review is pending. The user's desktop choice is already confirmed. It is not necessary to reconfirm that choice, but it does not authorize Phase 2 installation/prototypes in this phase.

## Phase 2 — minimal experiments, only after review

No full library UI, plugin system, production migrations, installer release, advanced DSP or model integration in these prototypes. Choose/pin only the small dependency set needed for each experiment after review; record notices and actual tool versions. Use user-authored or individually cleared audio/lyrics. Each run records fixture permission/hash, OS/WebView2/device, versions, operation, audible result and failure detail without private URLs/text.

| Gate | Smallest experiment | Pass record / stop condition |
|---|---|---|
| P2-0 Toolchain | Locate or review installation of Rust/Cargo MSVC target; verify existing linker/SDK and start a minimal Tauri window | Successful native compile/link/start in actual WebView2. Stop on missing prerequisite; no bulk reinstall of present tools |
| P2-A Local audio first | One file picker, scoped local media reference, minimal HTML audio controls; MP3 and PCM WAV, optional FLAC; no resolver/network | Audible 30 seconds, play/pause, forward/back seek, end once, source switch without overlap; network-off cold launch after installation. Record unsupported formats; FLAC not advertised unless passed |
| P2-A persistence/clock check | Minimal local playlist/session round trip using proposed SQLite binding, plus one self-authored LRC and supplied variant fixture; no full library implementation | Offline restart restores playlist order/repeats and paused selection; missing file remains repairable. Clock/seek/offset never changes source line IDs or supplied variant alignment |
| P2-B Resolution separately | Native service with a selected verified executable/runtime and one permitted candidate; structured metadata/URL output only, no media-file saving or playback yet | Source permits automated access/use; bounded JSON yields selected recording identity, codec/container/protocol, expiry if known and transport requirements; URL/headers remain private. Record tool/runtime versions and side effects |
| P2-B failure controls | Absent tool, malformed/oversized output, timeout, cancellation/track switch, denied/unavailable recording using controlled fixtures; one limited live authorized case separately | Typed errors, child tree terminates, no late result changes selection; no cookies/config/plugins/hooks/hidden media downloads. Simulated responses do not certify live extraction. If source permission is absent, mark the live test blocked |
| P2-C Stream playback separately | Feed one successfully resolved authorized stream through playback port, direct first; retain one local file for comparison | Audible 30 seconds, pause/resume, seek where advertised, buffering/end/error behavior, actual media clock and no simultaneous old track. Test actual WebView2, not only browser canPlayType |
| P2-C transport/expiry | Inspect codec/manifest/ranges/headers/redirect behavior; simulate expiry deterministically and re-resolve the same recording within a bounded budget | No signed URL persisted; no infinite retries or silent alternate song. If direct audio fails, classify cause before proposing scoped transport/HLS/MSE or native decoder |
| P2-D Engine decision/review | Compare measured successful and failed routes and minimal security/notice review | Select HTML audio only if essential fixture paths pass. Otherwise document a bounded alternative experiment; do not proceed to full application on failed assumptions |

Proposed local targets from [12](12-phase-1.5-validation.md) remain full-product acceptance hypotheses; a 30-second prototype does not prove the PRD's one-hour continuity, p95 timings or lyric quality. Include rapid switches and cancellation so a resolved URL alone is never counted as successful playback.

If a scoped native relay is needed, first review a ticket-only design and test loopback binding/authentication, URL/redirect restrictions, Range/206/416, cancellation and cleanup. No generic open proxy. Do not add FFmpeg or a new decoder merely to hide an unclassified error.

**Exit:** local playback/persistence/clock and separate authorized resolver/stream playback evidence succeed, plus review of engine/transport and remaining permissions. If streaming remains blocked, stop and request a scoped decision; local success does not silently waive the user's gate. No automatic move into full implementation.

## Phase 3 — full application planning only after success

Prepare the detailed application plan from measured evidence: stable domain IDs, scoped indexing/SQLite migrations/backups, queue/session recovery, Lumaire screens/accessibility, synchronized supplied lyric layers, typed source adapters, packaging and dependency notices. This is a future planning task, not a committed implementation schedule.

Retained product priorities in [03](03-feature-prioritization.md) and acceptance targets in [02](02-prd.md) inform that plan. Optional generation/TuneScript/catalogue adapters/DSP each retain their own rights, quality, privacy and cost gates. Website work remains optional future scope.

## ₹0 and release trade-offs

Use existing hardware, storage, internet and Windows installation; local builds/tests and no mandatory cloud/API/account. Labour, power, disk and data usage are not zero. Tool/runtime downloads are explicit after review. No paid fallback or billing-enabled dependency.

Distribution is a later gate: unsigned Windows builds may show security/reputation prompts. Do not require paid certificates/store enrollment or ask users to disable protection. Review [Tauri signing guidance](https://v2.tauri.app/distribute/sign/windows/), WebView2 provisioning, exact resolver/runtime notices and update authenticity before a public package. SQLite binding, fixture/lyric rights and dependency inventory are not yet certified.

Stop/review if toolchain, safe process supervision, codec/transport compatibility or source permission fails. No unrestricted mainstream catalogue promise is established, even if an extraction experiment works.
