# Decision log

As of **17 October 2026**. These are planning recommendations and explicit open questions, not a record of user approval to implement. Index: [README](README.md). Requirement authority: [PRD](02-prd.md); source permissions: [05](05-source-feasibility.md).

| ID / state | Decision and reason | Alternative considered / consequence | Evidence or dependency |
|---|---|---|---|
| D01 Proposed | Local-first, source-bounded product; no required account or backend | Unrestricted mainstream subscription replacement has no verified authorized ₹0 foundation; if mandatory, project outcome remains blocked | [05](05-source-feasibility.md), risk R01 |
| D02 Historical | Initial Windows/Tauri proposal preceded the website-first period | Preserve rationale; latest desktop direction is explicit D17, not retroactive approval of the original plan | D14/D17 below |
| D03 Proposed | Original implementation; use behavioral ideas without copied reference code/assets | Forking Nuclear/BitChord may accelerate features but requires appropriate copyleft/dependency review and does not transfer content rights | [08](08-licensing-risks.md) |
| D04 Proposed | Integrated three-text lyric reader is primary differentiation hypothesis | Lyrics/translation/romanisation already appear in references; toggles alone insufficient; validate accuracy, corrections and reading tasks | [01](01-research-report.md), [06](06-lyrics-system.md) |
| D05 Revised proposal, Phase 1.5 | P0 authorized supplied Tamil/Latin/English variants; generated conversion and translation conditional P1 | Removes contradictory mandatory engine gate; exact conversion artifact and reviewer validation remain | [06](06-lyrics-system.md), change C15-02 below |
| D06 Revised proposal, Phase 1.5 | TuneScript optional adapter, not required dependency | Source reviewed: v1.3.2 Gemini cloud/browser transport. Reuse licence and portability unresolved | U02, change C15-03 below |
| D07 Proposed | Local media and rights-cleared fixtures always work without online adapters | Smaller catalogue may not satisfy user's original motivation; disclose rather than hide this trade-off | [02](02-prd.md), U01 |
| D08 Conditional, revised Phase 1.5 | Jamendo first bounded experiment candidate, not cleared public integration | Public credential strategy and runtime playback unresolved; failed metadata probe is not outage proof | [05](05-source-feasibility.md), change C15-01 below |
| D09 Conditional | Audius after complete API terms review and runtime validation | Free tier and OML retrieved but actual API terms page inaccessible; not fully cleared | [05](05-source-feasibility.md), U04 |
| D10 Revised proposal | No arbitrary executable plugins, cookie/credential extraction, DRM bypass, hidden downloads, hosted proxy or public uploads | Controlled optional native resolution is separately proposed under D18; technical testing does not clear provider terms | [08](08-licensing-risks.md), [14](14-desktop-transition-audit.md) |
| D11 Proposed | Stable source recording IDs, explicit matching/corrections and source-specific capabilities | Cross-source metadata is useful but silent substitution causes wrong versions/rights confusion | [04](04-architecture.md) |
| D12 Proposed | Local history and computation default; external activity sharing opt-in | Observed BitChord sharing checkbox default checked is UI evidence only, not proof of traffic; our default reduces surprise | REA B-W, [07](07-ui-ux.md) |
| D13 Proposed | Finite free tiers cannot be required for core; stop optional features on quota exhaustion | Avoid auto-paid upgrades, pooled credentials or shared secrets; no indefinite hosting guarantee | [05](05-source-feasibility.md), [09](09-roadmap.md) |
| D14 Historical user preference; superseded by D17 | Website-first Lumaire: React/TypeScript/Vite; no mandatory desktop/helper install | User corrected desktop-first interpretation because URL access is easier and apps are less trusted; source permissions remain independent | [13 Browser investigation](13-lumaire-web-provider-architecture.md) |
| D15 Proposed | Trusted bundled adapters with distinct metadata/discovery/matching/resolution/playback boundaries | No copied Nuclear SDK/AGPL modules or arbitrary runtime plugin loading; preserve provider-bound identities | [13](13-lumaire-web-provider-architecture.md) |
| D16 Historical unexecuted experiment | Local audio baseline plus official visible YouTube embed; no API search in WEB-01 | Documented mechanism/terms reviewed; no Lumaire playback test or public-source clearance claimed | WEB-01 in [13](13-lumaire-web-provider-architecture.md) |

| D17 Current user-confirmed delivery decision | Return to Windows desktop first: Tauri 2 + Rust, React/TypeScript/Vite, no mandatory backend/paid API | Supersedes D14 delivery order; preserve website findings. Playback engine and exact SQLite binding remain proposed/test-dependent | Latest user brief; [14](14-desktop-transition-audit.md), [04](04-architecture.md) |
| D18 Architecture proposal requested by user | Optional replaceable yt-dlp behind provider/domain and controlled Rust process boundaries | No direct UI coupling; missing tool cannot break local music; pin binary/runtime and review source/distribution rights before testing/release | [04](04-architecture.md), B02–B04 in [14](14-desktop-transition-audit.md) |
| D19 User-confirmed workflow | Phase 1 documentation/environment only → review → Phase 2 local playback then separate resolution/playback tests → Phase 3 full application planning after success | No installation/prototype/full implementation now. A failed source test is recorded as blocked, not waived by local success | [09](09-roadmap.md) |

## Unresolved questions

| ID | Question | How to resolve / owner role | Blocks |
|---|---|---|---|
| U01 Scoped in Phase 1.5 | Latest brief defines the local-first plan; is unrestricted mainstream replacement still a mandatory public promise? | Implement only the documented bounded scope after later authorization; do not claim it fulfills complete replacement | Unrestricted service promise only; does not block independently authored local foundation |
| U02 Partly resolved | Source located and cloud/browser mechanism inspected; what reuse/distribution permissions apply? | Owner confirms licence/third-party inventory; adapter tests only after later authorization | TuneScript reuse only |
| U03 Recommended scope | Tamil original / supplied Latin / English first; conditional Tamil→ISO 15919 generation | Review authorized corpus and exact artifacts before advertising generated support | Generated romanisation release, not supplied-view foundation |
| U04 | What do current Audius API terms permit for retention, playlists, art and playback? | Retrieve official complete terms through normal access; no bypass; source lead reviews | Audius adapter |
| U05 | What rights cover catalogue lyrics, translations, caching and exports? | Per-source documentation/permission and territorial review | Automatic external lyric features |
| U06 | Which offline translation artifact passes license, quality and baseline hardware checks? | Pin model/tokenizer/rules; opt-in benchmark later; no download this phase | Automatic translation |
| U07 Current build blocker | Rust/Cargo unavailable in PATH and standard user files; MSVC/SDK/WebView2 presence observed, not build-certified | Locate alternate Rust or review later free MSVC-target installation; prove compile/link/runtime after review | Phase 2 native build |
| U08 Recommended, not granted | MIT original-core licence; exact dependency/asset obligations and owner approval remain | No copied reference/TuneScript code; pin inventory and notices before publishing | Distribution and direct third-party reuse |
| U09 | Public noncommercial release or eventual commercial product? | Product decision before account/API setup or branding promise | Jamendo/other service eligibility |
| U10 Deferred website | Historical browser compatibility/file persistence/background findings retained; desktop now first | Reopen only for future browser scope | Future website parity claims |
| U11 Current | Which engine/transport handles actual local and resolved stream fixtures? | Separate WebView2 local, resolution and playback experiments; classify failures before native transport/decoder additions | Engine selection and Phase 3 planning |
| U12 Current | How is yt-dlp/runtime selected, constrained, updated and distributed? | Verified existing executable for initial reviewed experiment; exact notices/source obligations before sidecar distribution; no hidden installation | Resolver execution/distribution |
| U13 Current | Which online source permits both automated access and intended media use? | Record platform plus recording/composition/lyrics permission, not just a reachable URL | Authorized live test/public source integration |

## Change policy

### Phase 1.5 material changes — 17 October 2026

These are audited/recommended plan revisions under the user's validation request, not a claim of human approval to publish or code. [Full validation and prioritized V01–V08 register](12-phase-1.5-validation.md).

| Change | Previous proposal → current recommendation | Evidence / reason | Impacts and reopening condition |
|---|---|---|---|
| C15-01 | Jamendo V → C for distributed client | Clause 2 public credential ambiguity; bounded metadata probe failed, playback unverified | F08/P1/M5/source matrix/R03; reopen on permitted credential strategy and successful live/platform test |
| C15-02 | Mandatory P0 converter → P0 supplied variants, conditional P1 generation | Priority fallback contradicted lyric release gate; no validated generated pair | F06/F07/M4/UX/lyric specification; reopen on exact artifact and fluent-review gate |
| C15-03 | TuneScript unlocated → source reviewed v1.3.2, optional cloud adapter | User provided `D:\CODING\Extensions\tunescript`; manifest/code/docs and hashes inspected, no licence grant found | D06/U02/R07/architecture; no mandatory Gemini/key, no direct reuse before permission |
| C15-04 | Unspecified first pair → recommend Tamil/Latin/English supplied reading | User's Tamil example, inspected maps and documented schemes; no quality benchmark | PRD/lyrics; generation stays separately gated; revisit after audience research |
| C15-05 | Unchosen licence/delivery → recommend MIT independent core, Windows then web | Current brief plus original-code plan; third-party obligations remain separate | Owner approves before distribution; fork/reuse requires fresh compatibility review |
| C15-06 | Vague acceptance / competing pilot sizes → explicit protocols; ten-person PRD pilot canonical | Audit A07–A09, [validation](12-phase-1.5-validation.md) | Duplicate/offset/line-map oracles and measurement methods; targets remain proposals |
| C15-07 | Toolchain wholly unknown → VC Build Tools/WebView2 presence observed, Rust missing in checked locations | Read-only vswhere/PATH/directory observations | M1 build/setup condition remains; file presence is not successful native build |

Overall readiness: **READY WITH CONDITIONS for the bounded local foundation**, not public-release or unrestricted catalogue readiness. No optional online/AI/TuneScript gate blocks independently authored local playback. Rust/toolchain verification blocks the first native build. See the validation verdict for exact boundaries.

### Website-first revision — 17 October 2026

At this earlier point the user explicitly rejected desktop-first delivery after Phase 1.5. D14 records that historical preference. Documents 02, 03, 07 and 09 were then revised to the browser foundation; 04 was labelled superseded and 13 became the architecture authority for that period. WEB-01 was never authorized or built. The later desktop-return revision below supersedes this ordering. References to M0–M8 in older change entries describe historical milestone IDs, not the current Phase 1–3 roadmap.

New source findings: Nuclear's non-HLS source factory uses a Rust loopback media relay, so HTML audio alone does not reproduce its networking path. SoundCloud aggregation restrictions keep that source conditional. Official visible YouTube playback is an experiment candidate; Jamendo/Audius remain conditional and no universal catalogue is cleared. Software licensing and media/service rights stay separate.

For each accepted/changed decision, append date, human decision, evidence revision, impacted requirements and reopening conditions. Do not mark a proposal accepted because a document exists. The detailed plan is ready for review; unresolved release gates remain real. Implementation requires a later user instruction after review.


## Desktop return revision — 17 October 2026

The latest explicit user request reverses delivery order again: **Windows desktop first**. D17 is current; D14 and WEB-01 remain historical decisions/findings. Documents 02–05, 07–10 and README are reconciled; 12/13 have historical authority labels. Document 06 retains the synchronized supplied original/romanisation/translation contract. New [14 audit](14-desktop-transition-audit.md) records environment, source/binary rights, proposed native bridge and blockers.

This revision restores no blanket extraction clearance. It proposes a replaceable controlled resolver and keeps offline local files/playlists independent. The user explicitly requires review and successful separate local/resolver/playback experiments before full-app planning; no code, installation or tests occurred in Phase 1. Reopen engine, transport, source and distribution decisions on actual evidence, not file presence or a resolved URL.

## Installed Nuclear follow-up — 17 October 2026

The earlier native-untested statements describe the initial website pass. The [installed-app investigation](11-installed-nuclear-investigation.md) now adds REA executable/resource and installed-plugin evidence, native Sources/lyrics/preferences captures, static risks and a prioritized remaining test plan. Audible playback, native search correctness, playlist mutation and translation remain unverified. No implementation was started.
