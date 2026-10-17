# Lumaire desktop transition — Phase 1 audit

17 October 2026, Asia/Kolkata. **Current user decision: Windows desktop first. Status: documentation and environment audit complete; feasibility remains untested.** No dependency installation, application scaffold, resolver execution, media download or prototype occurred. Phase 2 requires review; Phase 3 requires successful Phase 2 tests and a subsequent planning review.

## Recommendation

Use independently authored React/TypeScript/Vite UI and domain logic inside Tauri 2, with Rust owning scoped file access, SQLite operations and an optional replaceable resolver process. Start by proving local playback in the actual WebView2 shell. Separately prove resolution and then stream playback; do not infer one from the other. HTML audio is the first engine candidate, not a final selection. A backend is unnecessary for this design.

The local core is feasible in principle at ₹0 additional cash on existing hardware. An authorized, unrestricted replacement for the complete mainstream catalogue remains unverified. Desktop privileges remove browser process restrictions; they do not remove provider contracts or music rights.

## Documentation audit and reconciliation

Read all **15 existing Markdown files**: index, documents 01–13 and evidence index. The project contained 50 files, all within documentation/evidence; no application implementation was present. [Pre-edit inventory](evidence/desktop-transition/pre-edit-inventory.json) records every file's size and SHA-256 before changes.

| Conflict | Reconciled current position / affected documents |
|---|---|
| Website-first PRD/index versus retained Tauri design | Latest explicit desktop decision takes precedence. 02/04/README now say Windows/Tauri; 13 retains website research as history |
| IndexedDB/reselection acceptance versus desktop persistence | SQLite and scoped local file references proposed; offline cold launch after installation required. Missing/moved files still need explicit relinking; 02/03/04 |
| Desktop optional P2 versus required shell | Tauri/Rust is the current platform. Website/helper is future work, with no parity promise; 03/07/10 |
| WEB-01/full implementation milestones versus requested three phases | 09 now gates documentation → review → local prototype → separate resolver/stream tests → full-app planning. WEB-01 remains historical |
| Blanket exclusion of extraction versus requested optional yt-dlp integration | Controlled resolver is an architectural proposal, with independent source permission and distribution gates. No arbitrary executable plugins, cookies, bypass or hidden downloads; 04/05/08/10 |
| Earlier native readiness might imply a working build | Toolchain presence is observed; Rust unavailable in checked locations, linking and playback untested. Historical 12 is not current build certification |
| TuneScript might imply free offline generation | Retain supplied synchronized original/romanisation/translation. Inspected TuneScript uses Gemini/browser APIs and lacks established reuse permission; generation remains optional, 06 unchanged |

The decision history is **initial desktop proposal → user-confirmed website-first → user-confirmed return to desktop**. Earlier findings are not erased. Documents 01/11 remain dated research; 12/13 are explicitly historical. No brand redesign is proposed: retain Lumaire identity, lyric hierarchy, focus mode, queue and persistent transport. The workspace contains specifications, not a validated visual implementation or token set.

## Read-only development environment audit

Observed 17 October 2026 at approximately 20:15 IST. Existing executables/version queries and file inventory only. [Observation record](evidence/desktop-transition/environment-observation.json).

| Prerequisite | Verified observation | Limit / action after review |
|---|---|---|
| Node.js | v24.15.0, `C:\Program Files\nodejs\node.exe` | Exact future Vite/Tauri package versions and engine constraints not selected |
| Package manager | pnpm 12.11.2; npm command also present | Use existing pnpm after pinning; no install or lockfile generated |
| Rust / Cargo / rustup | Not found on PATH; standard user rustc/cargo files absent | **Blocks native build.** Does not prove no alternate installation exists. Locate or install MSVC-target Rust only after review |
| MSVC | vswhere reports complete VS Build Tools 2022 17.14.36301.6 with VC x86/x64 component; x64 cl.exe file version 19.44.35211.0 | Ordinary shell lacks cl on PATH; developer environment/linker test still needed. No compiler invoked |
| Windows SDK | Include/Lib 10.0.22621.0 and x64 rc.exe found | File presence does not certify headers/libs/linking completeness |
| WebView2 | Application directory 155.0.4283.62 found | Runtime initialization, actual used version and codecs require prototype |
| yt-dlp/runtime packaging | No Lumaire resolver installed or executed | Earlier Nuclear installation has its own resolver; it is not adopted as our dependency |

[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) require the native Windows toolchain and WebView2. Existing directories are evidence of presence, not a successful build. No setup command is authorized by this report.

## Nuclear: verified source findings and limits

This combines earlier selected-source/installed-plugin evidence with fresh official streaming/source review. Mutable branch retrievals have differing cache dates; this is not a single-commit reconstruction or runtime certification. [Detailed source links and limitations](13-lumaire-web-provider-architecture.md), [installed artifacts](11-installed-nuclear-investigation.md).

| Stage | Nuclear finding | Independent Lumaire proposal |
|---|---|---|
| Metadata | Separate capability-based providers return catalogue identities/details; installed Spotify adapter provides metadata, not Spotify audio | Local index plus optional separately approved metadata adapters |
| Discovery | Streaming provider searches recording candidates before obtaining audio | Candidate adapter returns stable source IDs, duration, edition and provenance |
| Matching | Provider ordering, duration/version evidence and user correction influence selection; no universal perfect matching engine established | Explicit matcher, explain ambiguity; saved exact binding first, user selects uncertain results |
| Resolution | Selected candidate resolved just in time; cached URLs expire and failures receive bounded attempts | Resolve only selected recording; ephemeral media ticket, bounded same-record refresh |
| Native host | TypeScript invokes Tauri commands; Rust launches yt-dlp and parses structured results | Typed Rust resolver service behind domain ports; UI receives no process arguments |
| Playback | Separate HTML audio engine with HLS/MSE hooks; source conversion can use a Rust loopback range relay | Test WebView2 audio first; add only a justified transport/decoder route after measurement |

Nuclear's [streaming documentation](https://docs.nuclearplayer.com/nuclear/plugins/streaming) explicitly separates discovery/resolution; the [Rust host](https://github.com/nukeop/nuclear/blob/master/packages/player/src-tauri/src/ytdlp.rs) and [source conversion](https://github.com/nukeop/nuclear/blob/master/packages/player/src/services/streamResolution/audioSource.ts) establish native responsibilities. A resolved URL is not proof of browser decode, seeking or required-header support. SDK availability is not proof that an executable works. Do not copy Nuclear's plugin loader, SDK, hifi or provider implementation; their AGPL obligations require separate review.

## Proposed architecture and feasibility matrix

The detailed original contracts and bridge controls are in [04 Current architecture](04-architecture.md). Keep metadata → candidate discovery → matching → resolution → playback separate, with SQLite and lyric documents outside the resolver lifecycle.

| Route | Technical assessment | ₹0 / permission consequence |
|---|---|---|
| Local files → scoped asset reference → WebView2 audio | Strong initial candidate; MP3/PCM WAV and seeking still untested | No backend/key; lawful local use; mandatory offline path |
| Cleared direct HTTPS audio → WebView2 audio | Conditional on codec, redirects, headers, byte ranges and expiry | Existing host must permit use; no implied caching or catalogue grant |
| Optional yt-dlp → Rust → ephemeral stream → audio | Native execution feasible in principle; no Lumaire test yet; runtime dependencies and upstream changes matter | Tool licence permits specified uses/distribution under conditions; source terms still independent |
| Scoped native media transport | Conditional fallback if direct playback fails | No hosting bill; adds security/Range/cancellation work; never open URL proxy |
| Native decoder alternative | Evaluate only if WebView2 cannot meet essential fixtures | Extra binaries, device/output integration and licensing review; no engine chosen yet |
| Official visible YouTube embed | Historical browser mechanism; Tauri origin/referrer/UX requires separate validation | Keeps service player/ads/restrictions; no free audio extraction entitlement |
| Mandatory remote resolver/audio backend | Unnecessary for desktop proposal | Excluded: hosting, egress, privacy and availability undermine constraint |

## yt-dlp distribution and source permission

The [upstream licensing section](https://github.com/yt-dlp/yt-dlp#licensing) distinguishes Unlicense source from PyInstaller executables containing GPLv3+ code. Exact release artifacts and bundled notices/source obligations must be audited. No blanket permissive licence applies to every `yt-dlp.exe`. FFmpeg licensing depends on its build; avoid adding a transcoder without demonstrated need.

| Arrangement | Assessment / proposal |
|---|---|
| User selects an existing verified executable | Preferred feasibility route; record path, version/hash and declared origin. No executable redistributed by Lumaire, but setup friction and binary trust remain; does not clear source access |
| Ship a Tauri sidecar executable | Technically documented by [Tauri](https://v2.tauri.app/develop/sidecar/); audit exact artifact, GPL notices/corresponding-source arrangements and separate/combined-work implications before distribution. Process separation alone is not legal clearance |
| User-approved managed installation/update | Later possibility; explicit source/version/bytes/checksum/notice, verified staging and rollback. No silent download, self-update or remote plugin installation |
| Bundle Python/source instead | Different runtime/packaging burden; source licence alone does not cover all bundled dependencies. Not selected |

Upstream documents EJS plus a JS runtime for full YouTube support. [EJS guidance](https://github.com/yt-dlp/yt-dlp/wiki/EJS) recommends Deno and supports explicitly configured Node; installed development Node does not imply end users have a runtime or that unrestricted Node is a suitable sandbox. Review runtime permissions and exact script supply chain. Do not enable remote-component fetch automatically. Resolution without post-processing may avoid FFmpeg; test exact formats rather than assuming it.

[YouTube terms](https://www.youtube.com/static?template=terms) restrict unauthorized automated access and content use; obtaining a URL does not establish service authorization. A creator's recording permission alone may not satisfy platform terms. Recordings, compositions, lyrics, translations, artwork and software have independent permissions; personal playback does not authorize redistribution. No cookie harvesting, credential extraction, account restriction workaround, DRM circumvention or token-generation workaround is proposed. Fail with a clear unsupported/access error when permission or access is absent.

## Proposed changes, blockers and next review

Documentation changes are completed; all runtime work below is **proposed, not executed**.

| Priority / blocker | Scope / smallest resolving action |
|---|---|
| B01 Rust unavailable in checked paths | Native build blocked: locate alternate toolchain or review a free Rust/MSVC setup plan; validate linker/SDK/WebView2 startup in Phase 2 |
| B02 Decoder and transport unknown | Local prototype first; measure actual audio/seek/end/clock. Separately test cleared resolved streams; retain a failed-case record rather than adding a proxy immediately |
| B03 Resolver supply chain/distribution undecided | Pin executable/runtime and notices before running; use explicit existing-tool selection for initial test if available and trustworthy |
| B04 YouTube/source permission unresolved | Blocks an approved YouTube integration/public catalogue promise, independently of technical success. Use a source/fixture whose automated access and media use are authorized; otherwise mark that source test blocked |
| B05 Exact app dependencies and SQLite binding not selected | Review versions/licences before Phase 2 installation; no full application dependency set now |
| B06 TuneScript/automatic lyric generation | Optional-feature-only gate: reuse permission, offline engine, text rights and quality unverified. Supplied three-layer reader remains viable |
| B07 Public installer trust under ₹0 | No paid signing service assumed. Unsigned distribution can produce reputation/security prompts; checksums/source do not replace trusted signing. Review packaging later; never tell users to disable protections |

[Windows signing guidance](https://v2.tauri.app/distribute/sign/windows/) explains the distribution trust trade-off. Existing Windows licence, PC, storage, electricity and connectivity are assumed; user data usage and engineering/maintenance time are real costs. No cloud, hosting, paid API, subscription or automatic paid fallback is required. A system WebView2 runtime may need separately disclosed installation on another PC; offline installation packaging remains untested.

**Next experiment after review:** Phase 2A minimal local-audio Tauri slice, then 2B isolated controlled resolution, then 2C resolved-stream playback. [09 Roadmap](09-roadmap.md) defines pass/fail records and stop conditions. Do not begin full UI/library work or plan a committed full-app implementation until these gates succeed. If source permission blocks 2B, record it and review the scope; do not count local playback as successful streaming validation.
