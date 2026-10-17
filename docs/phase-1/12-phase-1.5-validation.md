# Phase 1.5 — Technical validation and documentation review

**Historical validation:** this review preceded a user-confirmed website-first period, preserved in [13](13-lumaire-web-provider-architecture.md), and the latest user-confirmed return to Windows desktop. [14](14-desktop-transition-audit.md) and [04](04-architecture.md) are now current. Source/licensing findings and failed-probe evidence remain dated evidence; this earlier readiness verdict does not certify a build or authorize skipping the new Phase 2 tests.

**17 October 2026, Asia/Kolkata. Verdict: READY WITH CONDITIONS for an original local-first foundation; not ready for public release or an unrestricted subscription-replacement promise.** This is a planning verdict, not authorization to implement. No application code, prototype, package installation, source modification in TuneScript, account creation or model request occurred.

## Executive summary

- TuneScript was found at `D:\CODING\Extensions\tunescript`, version **1.3.2**. It is a YouTube Music browser extension using **Gemini cloud inference**, not an offline translation engine. Its integration requires a transport/storage/UI adaptation and a resolved reuse licence.
- No licence/notice file or package manifest was found in the bounded TuneScript source inventory. Its local comparison maps are explicitly not a pronunciation engine. Keep TuneScript and automatic generation outside the required core.
- **Jamendo is downgraded from V to C** for a distributable adapter. The earlier research missed a credential-disclosure ambiguity. A read-API test was attempted using Jamendo's documented testing ID, but transport failed; no successful response or audio playback was established.
- Recommended MVP: Windows local playback and library/playlist persistence, authorized TXT/LRC, supplied Tamil original / Latin romanisation / English meaning with explicit alignment and corrections. No compulsory online source, API key, cloud model or backend.
- Build Tools and WebView2 are present. Rust/Cargo are unavailable on PATH and the standard user Rust path checked is absent. A real native build, codec tests and language-quality checks remain future gates.

## Audit method and evidence boundaries

Read the twelve existing Markdown planning documents, evidence index, relevant source/release metadata and installed-app findings. Parsed the eight-record browser bundle and fourteen-record installed-artifact bundle; all ten files in the existing native evidence manifest matched recorded hashes and sizes. This validates retained file integrity, not every conclusion or reference-product feature. [Baseline audit](evidence/phase-1.5/baseline-audit.json).

Reviewed TuneScript's manifest, README, core lyric/transform/request/cache/provider code and language/privacy/validation documentation. Recorded seventeen file hashes in [TuneScript inspection](evidence/phase-1.5/tunescript-inspection.json). Excluded `.git`, `.env`, build/work output and dependencies from source inventory. Git identity commands were denied by filesystem access; no commit or clean-worktree assertion is made. No keys were read or used. Ordinary source inspection was sufficient; completed REA reference analysis was reused rather than repeated.

Evidence types: **source-verified** means code/docs read, not executed; **documented** means primary provider guidance; **attempted** includes failed probes; **proposed** means a future requirement/test. TuneScript's own reports of 226 checks and Firefox trials were read as project-reported history, not rerun or counted as Phase 1.5 successes.

## Documentation discrepancies and resolutions

| ID | Discrepancy / unsupported implication | Resolution and affected documents |
|---|---|---|
| A01 | Source matrix labels Jamendo V despite pending credentials/runtime work; public credential packaging was unresolved | Downgrade to C; no bundled production credentials or backend proxy assumption. Source matrix, risks, decision register. |
| A02 | P0 script generation is mandatory in lyrics release gate, but feature priorities allow supplied-only fallback | Make supplied variants the mandatory P0; deterministic generation conditional P1. Update PRD, priorities, lyric gate, UX and M4 together. |
| A03 | F06 says original is “always available,” conflicting with legitimate missing-lyrics state | Preserve original whenever supplied; unavailable source text has an explicit missing state. |
| A04 | F08 online adapter appears among MVP acceptance rows although priorities/roadmap place it later | Mark F08 P1 and outside local MVP acceptance. |
| A05 | TuneScript is described everywhere as unlocated | Source location and cloud mechanism are now established; licence, portability and quality remain unresolved. Historical observations in reports stay intact with dated correction links. |
| A06 | Native-untested statements coexist with later native captures | Date the original scope; current authority is document 11 for Sources/lyrics/preferences. Audio, search correctness and successful lyric sync remain uncertified. |
| A07 | PRD pilot is ten listeners; document 11 suggests five | Ten-person PRD pilot is the canonical proposed release study. Five-person sessions can be formative only, not substitute evidence of retention. |
| A08 | “Predictably,” “readable,” “quality acceptable,” p95 and ≤150 ms lack complete test oracles | Use the acceptance protocol below; state fixture, sample count, hardware and operation. These are proposed gates, not measured performance. |
| A09 | Architecture promises duplicate handling and portable imports without identity rules | Exact file reimport preserves one library asset; separate copies remain distinct unless explicitly merged; intentional repeated playlist/queue items have unique item IDs. Relative references resolve only within a user-selected import root. No silent filename-only relinking. |
| A10 | M0 asks to obtain TuneScript as though it blocks every feature; licence/toolchain versions remain open | Location resolved. Direct reuse blocks only TuneScript; native toolchain blocks native builds. Recommend independently authored MIT core with audited dependencies, subject to release-owner approval before publishing. |
| A11 | Original unrestricted mainstream access objective could be mistaken for an achieved goal | Latest local-first brief defines this implementation plan. If complete free mainstream replacement is still non-negotiable, that product promise remains **NOT READY**; this narrower MVP must not be advertised as satisfying it. |

## TuneScript feasibility

| Question | Established finding / integration consequence |
|---|---|
| Current product | Manifest v3, 1.3.2; content scripts target only `music.youtube.com`. Spotify files exist but are not activated by the manifest; Apple Music is not implemented according to README. |
| Romanisation / translation | `shared/gemini.js:58–87` sends source line IDs/text to Gemini through `backgroundRequest`; English is the meaning output. Default in `shared/constants.js:93` is `gemini-3.5-flash-lite`. No offline model/runtime/fallback translation is present in inspected paths. |
| Local behavior | Parsing, source matching, caching, rendering and script comparison run locally. Previously cached completed results can be read without generating new text; fresh cloud transformations require network access. `shared/script-comparison.js` maps Tamil, Devanagari, Telugu, Malayalam, Kannada, Gujarati, Bengali and Gurmukhi for comparison. Marathi shares Devanagari, but this is not evidence of a separate validated pronunciation model. Unsupported characters can pass through. |
| Language coverage | No fixed cloud source-language allowlist; model attempts and BCP 47 labels are not verified fluency. No certified source→English pair or sung-pronunciation quality was established. |
| Interfaces | Global JS functions and browser `chrome.runtime` ports/storage; named operations `gemini`, `gemini-check`, `lrclib`, diagnostics. No published standalone library, HTTP service or Tauri API was found. `romanizeAndTranslate` requires its global helpers and extension transport. |
| Portability | Adapt pure parsing/matching ideas independently; a permitted reuse would need module boundaries, injected request/storage ports, new player clock and original app UI. Do not embed the extension or inject a third-party music site into a privileged Tauri window. |
| Runtime / hardware | Desktop browser; README says no local model download. Inference occurs remotely, so no local GPU is required by the inspected design. Exact memory/latency minima and native/WebView compatibility remain unmeasured. No npm/runtime dependency manifest was found; packaging/test tooling is separate from runtime. |
| Privacy | Source text goes to Google; metadata goes to LRCLIB. Browser sync stores the key/settings; it is not an encrypted credential vault (`popup/popup.js:123`, `docs/PRIVACY.md`). Our core must keep text local and omit credentials entirely. |
| Rights / redistribution | No licence grant established from inspected licence/notice files or README. User describes it as their extension, but authorship of every file/dependency and public/commercial reuse terms still need confirmation. No TuneScript code was copied into this project. |
| Cost | Gemini's current model pricing offers a free tier; this is a limited external allocation, not unlimited or offline use. Project-specific quotas, entitlement and billing state were not inspected. A code comment about a trial's 15 RPM is not a universal quota. |

Official [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) support only conditional zero-cash use. [Unpaid-service terms](https://ai.google.dev/gemini-api/terms) describe input/output use for improvement and possible human review, with territorial exceptions; sending copyrighted lyrics needs its own permission basis. No Gemini request, billing change or user lyric upload was performed.

**Recommendation:** do not require TuneScript in MVP. Preserve a future adapter boundary. Smallest next step for direct reuse: owner records the intended licence/permissions and third-party inventory, then a later-authorized offline fixture checks extracted pure functions and injected transport. Generated cloud text remains optional even after reuse clearance.

## Music sources and controlled test status

| Candidate | ₹0/access and documented playback route | Public-release / rights / operational assessment |
|---|---|---|
| Local files, individually authorized fixtures | No API/account/quotas; select local files and use the OS/WebView decoder | Preferred required core. Right to hold/play a file does not confer redistribution/adaptation. Advertise only formats actually tested later. |
| Jamendo | Noncommercial API use; track `audio` field documents a stream URL. Registered client ID; official ID `709fa152` is for read-API testing only | **Conditional, selected experiment candidate.** Honour track licence, creator/Jamendo credits and backlink; no offline source feature. Clause 2's nondisclosure language versus distributed client IDs needs written clarification or a permitted user-owned-credential approach. No automatic commercial-release clearance. |
| Audius | Official docs list a free key plan: 10 requests/s, 500,000/month, streaming SDK/API; frontend API key is distinct from backend bearer token | **Conditional alternative.** API contract page could not be retrieved again; OML/per-track opt-outs and gated content require review. No runtime playback or India-wide availability verified. |
| Creator-direct CC0/CC BY material | Can avoid API credentials when the rights holder supplies a permitted file/HTTPS source | Suitable per asset after identity/provenance and hosting permission checks; no large catalogue promise. CC BY adaptations need attribution/change notices; artwork/lyrics may have different grants. |

Primary sources: [Jamendo terms](https://devportal.jamendo.com/api_terms_of_use), [authentication/testing ID](https://developer.jamendo.com/v3.0/authentication), [tracks/stream fields](https://developer.jamendo.com/v3.0/tracks), [Audius SDK](https://docs.audius.co/sdk/), [unretrieved Audius API contract](https://audius.co/legal/api-terms), [CC BY deed](https://creativecommons.org/licenses/by/4.0/). No documented blanket regional entitlement was established for either catalogue; track errors/removals and territorial permissions must remain visible.

Jamendo's usage guidance says contact them above or approaching 500,000 hits, **without a stated monthly period**. No unlimited quota or availability SLA is inferred. Production credentials must not be replaced by its shared testing ID. Metadata/documentation does not prove a stream decodes or plays.

### Experiment J1 — attempted, playback unverified

Selected Jamendo because it documents streaming and a read-only testing credential, avoiding new accounts, payments or prescribed mainstream providers. One web-tool retrieval and one bounded built-in fetch attempted the one-track read endpoint with `audioformat=mp32`. The web tool could not access it; built-in fetch failed before an HTTP status was obtained. [Probe record](evidence/phase-1.5/jamendo-read-probe.json). **No track, audio URL, HTTP success, byte range, decoded media or audible output was verified.** This is an environment/path failure, not evidence of Jamendo outage or regional denial. No audio was downloaded or cached.

Smallest later experiment, with no production integration:

1. From a network path that reaches the API, use the documented testing credential for one read result. Record response status, track ID, creator, licence URL, canonical page, duration and declared audio format. Verify the chosen asset's permission before playback.
2. Use an existing browser/media player's ordinary Open URL action to play its returned HTTPS stream; retain attribution in the observation record. Confirm audible sound and advancing media time for 30 seconds, pause/resume and one seek where supported. Record redirects, codec/decoder outcome and any access error; do not save the stream or publish temporary URLs.
3. After native implementation is separately authorized, repeat that single fixture in WebView2. The minimal platform experiment contains one selected stream reference and transport controls, no search/library/backend. This experiment is **specified, not created** in this phase. Separate direct browser element access/CORS from native HTTP behavior before promising a web adapter.
4. Public-adapter gate: production credential distribution interpretation, exact licence/attribution, disabled offline save, bounded retries, refreshed terms and per-region error handling. If any gate fails, omit the adapter; the local release still functions.

## First-release lyric workflow and testable contract

**Initial reading pair: Tamil original → English supplied meaning**, with supplied Latin romanisation. This follows the user's actual Tamil lyric example and TuneScript's Tamil fixtures/maps, not a quality benchmark. Other Unicode text remains displayable but does not imply supported generation. **Optional later converter:** Tamil script → ISO 15919 Latin through Sanscript, labelled scholarly script conversion rather than familiar Tanglish or sung pronunciation. Its [README](https://github.com/indic-transliteration/sanscript.js/blob/master/README.md) documents schemes/limitations; [manifest](https://github.com/indic-transliteration/sanscript.js/blob/master/package.json) identifies version 1.3.3 and dependencies on common_maps/toml. [Sanscript licence](https://github.com/indic-transliteration/sanscript.js/blob/master/LICENSE) and [maps licence](https://github.com/indic-transliteration/common_maps/blob/master/LICENSE) are MIT. Exact release artifact, transitive notices and output quality are not yet validated; no dependency was installed or run.

Required offline workflow:

1. Attach user-authorized UTF-8/BOM TXT or LRC to an **exact local recording**. Preserve raw bytes/hash, provenance, text revision and source timestamps; no network lookup. Proposed import bounds: 1 MiB of UTF-8 file bytes, 10,000 occurrences, 8,192 Unicode code points per line; oversized input is rejected without replacing the prior document.
2. Support `[mm:ss.cc]` and `[mm:ss.mmm]`, seconds 00–59, repeated timestamp tags and metadata tags. Expand repeated occurrences into separate stable IDs; equal-time lines retain source order. Untimed text gets no fabricated timestamps. Malformed rows produce warnings and readable untimed text; a malformed row is not silently scheduled.
3. Keep file offset and user timing correction separate. **Product convention:** effective cue = source timestamp + file offset + user offset; positive means lyrics appear later. Example: 10,000 + 200 − 50 = **10,150 ms**. Last valid file-offset tag wins with a warning for multiple tags. Store unadjusted source times; never apply the offset twice. TuneScript's parser currently bakes the file offset into seconds, so direct copying would violate this proposed invariant.
4. Import supplied variants through a preview mapping to document revision and occurrence IDs. Equal row counts alone do not prove alignment. A plain variant requires user-confirmed row mapping; structured variants reject duplicate/unknown IDs and retain explicit missing values. Repeated chorus occurrences stay distinct. Every variant inherits the original interval; no translated word timing is invented.
5. Label each layer **user-provided, machine-generated (engine/version), corrected, stale or unavailable**. Missing meaning stays missing; do not copy source text and label it translated. A text edit invalidates affected generated outputs; timing-only edits preserve text outputs. Original remains recoverable.
6. Seek/click uses effective cue clamped to valid playback bounds without mutating stored times. Active equal-time rows form a group ending at the next strictly later cue. Final group ends at known media duration; if duration is unknown, do not invent an end. Pause/seek/rate changes re-evaluate the actual playback clock.

Proposed quality gate for optional generation: thirty self-authored/permission-cleared Tamil examples including combining marks, names, mixed Latin, repetition and colloquial forms; one fluent reviewer records expected spelling/scheme and each correction. Every input occurrence ID/time must survive, unsupported spans must be visible, and no critical misleading output may remain. This is a finite pilot gate, not a general language-accuracy claim. Offline machine translation remains excluded until an exact model, licence, dependency set, hardware measurements and meaning review exist.

### Acceptance protocol additions

| Gate | Objective protocol for later implementation |
|---|---|
| Core/offline | Disable networking; no keys; exercise play/pause/seek/next/restart and all three supplied text layers. Record OS/WebView2, fixture hashes and pass/fail per operation. At least MP3 and PCM WAV must pass; FLAC stays unadvertised unless tested. |
| Duplicates/session/export | Reimport the same scoped asset: one library asset, unchanged metadata corrections. Add twice to a playlist: two item IDs. Restart paused at saved position within 1 s. Export/import preserves item order and repeats; absent paths remain missing and require explicit relinking. |
| N02/N03 | Record CPU/RAM/storage and versions; 30 warm local playback trials, 30 indexed searches over a fixed 10,000-record fixture. Nearest-rank p95 is sorted sample 29 of 30. Existing targets remain ≤1 s play-to-audible and ≤200 ms search; do not substitute a play-promise resolution for audible onset. Use an authorized test impulse plus synchronized loopback instrumentation when implementing the audio measure. UI timing is input-event to rendered state, excluding OS dialogs. |
| N04/N05 | One-hour declared fixture queue: no unexplained stop/crash or duplicate completion. Twenty known lyric boundaries across pause/seek/rate/offset cases: observed active-group transition within 150 ms of effective media-time boundary. Distinguish scheduler timing from listener-verified lyric alignment; manually review three audible anchors per approved recording. |
| Privacy/failure | Missing/invalid variants, cancelled jobs, source errors and absent network cannot remove originals or interrupt local playback. Export contains no secrets, signed URLs or disallowed text. No default outbound lyric requests. |
| Pilot | Retain PRD's ten consenting listeners and proposed 8/10 task, 5/10 return and 6/10 preference thresholds. These hypotheses are not completed tests or market-demand proof. |

## Prioritized decision register

Recommendations below are recorded technical proposals, not silent human approvals or new licence grants.

| Priority / ID | Question, evidence, options and trade-off | Recommendation / ₹0 and licensing consequence | Implementation blocker? |
|---|---|---|---|
| P0 V01 / D01,D07 | Local/authorized utility versus complete mainstream replacement; no cleared universal catalogue | Follow latest local-first brief; no misleading catalogue claim | No for scoped core. Yes for original unrestricted service promise if mandatory. |
| P0 V02 / U07 | Tauri or browser-only; Build Tools 17.14.36301.6 and WebView2 155 directories exist, Rust not found in checks | Tauri/React/TS Windows first; no local server. Audit free Rust/toolchain setup later; no installation now | Rust/toolchain verification blocks native build, not parser/domain design. |
| P0 V03 / U08 | Permissive original implementation versus copyleft fork; reference-code reuse has obligations | Recommend MIT for independently authored core; no reference/TuneScript code copied, preserve third-party notices | Final owner licence approval before publishing; direct unlicensed reuse blocked. Independent implementation can proceed later. |
| P0 V04 / U03,D05 | Tamil/English versus Hindi/English versus every language; Tamil user example, documented schemes, no quality benchmark | Tamil original / supplied Latin / supplied English first. Generated Tamil→ISO 15919 conditional P1; no translation model | No for supplied-view core. Pair-specific generation blocked pending fixture/reviewer validation. |
| P1 V05 / U02,D06 | Reuse TuneScript versus independent modules; v1.3.2 cloud/key/browser coupling, no licence found | Independent offline core; future optional adapter after rights/transport review | TuneScript reuse only; not core. |
| P1 V06 / D08,U09 | Jamendo, Audius or no catalogue; incomplete public credential/API-contract clearance | No required online adapter; Jamendo selected for bounded experiment, downgraded C | Online adapter/public source claims only. No monetization assumption. |
| P1 V07 / U06 | Supplied translation, cloud free tier or local model | Supplied translation now. Cloud BYOK optional only after privacy/rights/quota checks; never rely on funded billing | Automatic translation only; no paid fallback. |
| P1 V08 / D02,U10 | Website first versus later shared shell | Windows first per current brief, browser later via shared domain/UI and file/storage ports | No unresolved delivery-order decision; browser parity remains a later gate. |

Read-only prerequisite checks are retained in [toolchain observation](evidence/phase-1.5/toolchain-observation.json). Installed component directories do not prove successful compiler linking, SDK coverage or audio compatibility. [Tauri's official prerequisites](https://v2.tauri.app/start/prerequisites/) remain the setup authority.

## Readiness and remaining gates

**READY WITH CONDITIONS** means the bounded local-core design is specific enough for a later-authorized M1/M2 implementation. It does **not** certify a build, source adapter, fluent output, release licence grant or market demand. No additional user decision is needed to continue documentation.

Before the first native build: establish usable Rust/Cargo, Windows SDK/linker and WebView2 with a pinned dependency/notice inventory; use free local tooling and no paid signing/store service. Before public distribution: release owner confirms software licence and all shipped fixtures/assets; required codec, persistence, security/accessibility and supplied-language tasks pass. Before adding optional features: clear TuneScript reuse, generation quality, model/lyrics rights, or online provider gates separately. These deferred features must not hold local playback hostage.

If the requirement remains all mainstream music without subscriptions/restrictions, the verdict for that promise is **NOT READY**. There is no verified authorized ₹0 path in this evidence. The minimum next step is a product scope decision or a documented rights-holder agreement, not another extraction tool.
