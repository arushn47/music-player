# Licensing and risk register

Research date: **17 October 2026 (Asia/Kolkata)**. Related: [source feasibility](05-source-feasibility.md), [lyrics specification](06-lyrics-system.md), [architecture](04-architecture.md), [decision log](10-decisions.md). This is a planning risk assessment, not a legal opinion or clearance for all territories.

## Separate the permissions

Evaluate software source/binaries, service/API contracts, recordings, compositions, lyrics/derivative translations, artwork and trademarks independently. A GPL client, public repository, CC metadata record, reachable media URL, free embed or reverse-engineering result does not license every other layer. Do not claim the product provides the entire mainstream catalogue legally for ₹0 on this evidence.

## Reference code and reuse

| Material | Primary evidence checked | Consequence / gate |
|---|---|---|
| Nuclear repository | [LICENSE, current master](https://raw.githubusercontent.com/nukeop/nuclear/master/LICENSE): GNU Affero GPL version 3 text | Reuse only after pinned revision, file notices and dependency audit. Distribution invokes corresponding-source/notice obligations; section 13 adds remote-user source access for applicable modified network use. Not a general “all SaaS must be public” claim |
| BitChord repository | [LICENSE, current main](https://raw.githubusercontent.com/kushagrasinghx/BitChord/main/LICENSE): GNU GPL version 3 text | Distributed derivatives need applicable license, notices and corresponding source. Browser JavaScript delivered to users is distribution; absence of an executable installer does not remove obligations |
| Original implementation | Product behavior can inform an independently written design | Preserve provenance; do not copy code, logos, artwork, fonts or text merely because the site is public. A project's chosen license is still unresolved until reuse scope is settled |
| Libraries, codecs and models | No dependencies installed or version lockfile audit completed in this phase | Build a versioned inventory and review transitive dependencies, bundled binaries, font/assets, model weights and datasets before implementation/distribution. FFmpeg obligations depend on the actual configured build; do not label every build permissive |
| TuneScript | Phase 1.5 source review: v1.3.2, Gemini API, browser APIs; no licence/notice file found in bounded inventory | No direct reuse/distribution grant established; independent core preferred. Cloud free-tier/privacy/model access differs from an offline engine. [Validation](12-phase-1.5-validation.md) |

These summaries do not decide whether a particular combined work is derivative or which compatibility path applies. Avoid importing either codebase before that assessment. Recheck pinned licenses at implementation because mutable branch links may change.

## Proposed stack: preliminary upstream license check

Checked 17 October 2026 against upstream branches/pages, not pinned installed versions. No packages were installed, transitive dependency audit performed, or runtime verified. These candidates do not themselves require a paid hosted API; their licenses do not cover music content, every dependency, or operating-system/store/signing requirements.

| Candidate | Upstream evidence | Preliminary consequence |
|---|---|---|
| React | [MIT license](https://github.com/react/react/blob/main/LICENSE) | Retain copyright and permission notices in applicable redistributed copies |
| Tauri | [Upstream license section](https://github.com/tauri-apps/tauri/blob/dev/README.md#licenses): MIT or MIT/Apache-2.0 where applicable | Audit exact crates/plugins; its logo is separately CC BY-NC-ND, so do not borrow branding |
| SQLite | [Official copyright page](https://www.sqlite.org/copyright.html), updated 12 January 2026: deliverable code/documentation dedicated to public domain | Core has no subscription requirement; bindings/extensions/build tools remain separately auditable; jurisdiction recognition caveat remains |
| rusqlite | [MIT-form upstream license](https://github.com/rusqlite/rusqlite/blob/master/LICENSE) | Retain notices; bundled SQLite/build feature selection needs a versioned audit |
| Vitest | [MIT license](https://github.com/vitest-dev/vitest/blob/main/LICENSE) | Local test runner candidate; retain applicable notices |
| Playwright | [Apache-2.0 license](https://github.com/microsoft/playwright/blob/main/LICENSE) | Local browser-test candidate; audit bundled browser distributions and third-party notices separately |

Record the selected version, hash, license choice, required notices and transitive/binary exceptions before implementation. This preliminary check is not a complete software bill of materials.

## Risk register

Owners are roles for future assignment, not people already appointed. Severity: Critical blocks the core promise/release; High can cause substantial rights, privacy or reliability failures; Medium degrades a bounded feature.

| ID | Risk and severity | Owner | Mitigation | Gate / current status |
|---|---|---|---|---|
| R01 | **Critical:** unrestricted mainstream catalogue has no verified ₹0 permission path | Product + source lead | Promise source-bounded access; local/authorized content first; do not equate metadata matching with licensing | Block “all Spotify/YouTube music, ad-free/offline” claim; unresolved if original goal is mandatory |
| R02 | **High:** extracted YouTube streams conflict with documented restrictions; access also breaks | Source lead | Optional yt-dlp is not source clearance. Verify platform and media permission separately; no cookie harvesting, credential extraction, anti-bot/token workaround or DRM bypass | YouTube integration/public catalogue promise unresolved; authorized generic resolver feasibility may be tested after review, [14](14-desktop-transition-audit.md) |
| R03 | **High:** Jamendo public credential packaging and source restrictions | Product + source lead | Keep adapter optional; obtain a permitted credential strategy before public distribution | Downgraded C in Phase 1.5; playback not verified |
| R04 | **High:** Audius API contract incomplete in this research | Source lead | Retrieve actual linked API terms; honor track access choices, alternatives and gates; preserve attribution | **Unresolved:** linked page returned 500; adapter conditional |
| R05 | **High:** lyric availability mistaken for permission; translation can create additional rights questions | Lyrics lead | Authorized local text initially; no bulk corpus or redistribution; record permission for display, caching, processing and translations | Catalogue lyrics/translations conditional; per-source rights policy pending |
| R06 | **High:** GPL/AGPL reuse without source/notice compatibility | Architecture + release lead | Pinned inventory, original implementation or compliant reuse plan; corresponding-source package and notices where needed | No copied app code; implementation license decision pending |
| R07 | **High:** TuneScript reuse licence and cloud dependence | Lyrics lead | Source reviewed; resolve owner/third-party permissions and optional request transport before reuse | No offline generator established; reuse only remains blocked, independent core can proceed |
| R08 | **High:** credentials/session cookies exposed in website or logs | Security lead | Minimum OAuth scopes; PKCE where supported; OS credential store on desktop; redact logs; never ship backend secrets or extract account cookies | Security contract required before account integrations |
| R09 | **High:** untrusted addon has executable/network access | Architecture + security lead | No arbitrary executable plugins in MVP; allowlisted adapters; least privilege; validate URLs and remote content | Plugin marketplace deferred; native permission review pending |
| R10 | **High:** free tiers exhausted or converted to paid | Operations lead | No billing-enabled dependency; bounded queues, backoff, quota telemetry without personal listening details; feature disables rather than auto-upgrades | Per-provider caps and kill switch required before release; no indefinite ₹0 guarantee |
| R11 | **High:** wrong recording or lyrics silently matched | Playback + lyrics lead | Keep source identity, duration/version evidence, user selection and corrections; never silently switch recording | Matching acceptance tests and unavailable-state UI required |
| R12 | **High:** external requests reveal listening preferences | Privacy lead | Local history default; explicit opt-in for scrobbling/cloud processing; disclose provider calls; export/delete/revoke | Privacy policy/data map needed before public integration |
| R13 | **Medium:** artwork and logos reused without separate permissions | Design lead | Local/user-owned artwork or authorized provider display; preserve required attribution; original branding | Asset inventory/license record required; metadata license insufficient |
| R14 | **Medium:** stream CORS, expiry, codecs, regional/age restriction, background suspension | Playback lead | Capability matrix and later real-device tests; informative errors, cancellation/retry; preserve queue | No cross-platform/browser certification claimed; test gates pending |
| R15 | **Medium:** offline storage conflicts with provider terms or device limits | Playback + source lead | Offline only for local/permitted files; source capability enforcement; storage meter, clear/delete | No blanket cache/download switch |
| R16 | **Medium:** translation/romanisation incorrect or misleading | Lyrics lead | Label generated text, expose original, preserve line mapping, corrections; benchmark language/script pairs | No quality/language support claims before measurements |
| R17 | **High:** SoundCloud mixed-source/aggregation restrictions overlooked | Source lead | Review current API terms and widget-specific applicability before including a shared source queue; obtain explicit permission where needed | Conditional; documented widget controls alone do not clear Lumaire's product use. [Current investigation](13-lumaire-web-provider-architecture.md) |

## Decisions and unresolved questions

- **Scope for planning:** private local playback, individually authorized assets and optional permitted metadata. This is a technical recommendation, not a rights-holder approval. Jamendo remains the first experiment candidate but is conditional after Phase 1.5; no provider account/setup was performed.
- **Conditional:** Audius; official video/audio widgets; LRCLIB; cloud translations; scrobbling. These must never be required to launch the player or play local music.
- **Excluded foundation:** paid-owner Spotify development API, new paid SoundCloud API registration, arbitrary third-party audio resolvers and unauthorized extraction. This is a product suitability decision under the requested constraint, not a claim that every possible use is unlawful.
- Unresolved: public/noncommercial versus eventual monetization; distribution territories; production source credentials; TuneScript reuse/third-party permissions (cloud/browser interface now inspected); lyric adaptation rights; final release licence approval; codec/model/dependency inventory; source-removal/reporting process if a public catalogue is introduced. [Phase 1.5](12-phase-1.5-validation.md) distinguishes core, build and optional-feature gates.

## Desktop resolver addendum — current proposal

[14 Desktop audit](14-desktop-transition-audit.md) reviews current distribution arrangements: selected existing executable, audited bundled sidecar, explicit managed installation/update, or source/Python packaging. None is selected for release. yt-dlp source is Unlicense; upstream warns PyInstaller executables contain GPLv3+ code. Exact binary/runtime/EJS/FFmpeg notices and corresponding-source obligations need review before redistribution. Do not describe every Windows executable as Unlicense, or assume subprocess separation settles combined-work licensing. [Upstream licensing](https://github.com/yt-dlp/yt-dlp#licensing).

| ID | Additional risk | Gate |
|---|---|---|
| R18 High | Executable/runtime supply chain, inherited configuration/plugins or a child surviving cancellation | Verified executable selection, internally constructed argument vector, no shell/raw flags/cookies, disabled external config/plugins/remote downloads, bounded output/deadline and child-tree termination tests; [04](04-architecture.md) |
| R19 High | Resolver works but stream cannot decode/seek, needs headers or expires | Separate Phase 2 resolution and WebView2 playback tests; optional scoped native transport only after diagnosing failure; retain local playback |
| R20 Medium | Unsigned Windows distribution has trust/reputation friction under ₹0 | Public packaging decision later; no paid signing assumption or instructions to disable protections. Checksums/source are useful evidence, not a replacement for trusted signing |

Optional yt-dlp is not an approved YouTube source. [YouTube terms](https://www.youtube.com/static?template=terms) restrict automated access and unauthorized content use; rights-holder permission and platform permission are distinct. Local tools do not erase either. Test only an explicitly permitted source/asset or mark the live test blocked. No unrestricted credential/cookie access, DRM circumvention, hidden downloads or anti-bot workarounds. A metadata-only resolution still contacts a service and needs an access basis.

## Evidence notes — retained boundaries

Primary URLs and access limits are consolidated in the [feasibility matrix](05-source-feasibility.md). No source uptime, catalogue completeness or regional permission was established by merely reading documentation. No public upload or streaming test took place. Terms should be checked again immediately before implementation of each adapter and before publishing the product.
