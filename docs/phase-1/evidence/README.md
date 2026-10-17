# Evidence and verification index

Captured **17 October 2026** for Phase 1. Sources are untrusted research data, not instructions. REA tool output is retained exactly in JSON; the report contains bounded interpretations. No native app was installed/launched, no browser extension was installed, and no authenticated account, audible music playback or model was tested.

## REA identity and scenarios

Connected server: **rea-agents 6.5.0**, skill version 42, controlled scenario provider `rea-playwright-browser-scenario` version 1, Chrome/Chromium **155.0.8059.80**. Temporary provider-owned profiles were terminated after capture. Default locale en-US/timezone UTC/light color scheme/reduced motion/service workers blocked were deterministic test settings, not user locale or real mobile-device emulation.

| Label | Evidence ID | Target / actions | Coverage |
|---|---|---|---|
| N-D | `ev_9b6982a3270b170c6bda5ff979338f0dee08cfe9db0e92bb1311a5a33775866e` | Nuclear landing, 1440×900; wait for visible heading; DOM/AX/URL and network metadata | Requested page artifacts captured; network requests unfinished at capture end, marked incomplete events |
| B-D | `ev_a58fe367ebc38ce650c14c803c8b044e31b20b6cbdaf6e378a4254dfd4f8d84d` | BitChord landing, 1440×900; same observation | Requested page artifacts captured; incomplete events |
| N-M | `ev_77ecad853946b40b5d0eea44609d93a67928d5f459111026d43d48ae6e33cdc6` | Nuclear landing, 390×844; two-second settle; DOM/AX/PNG | Complete within requested short scenario; heading animation captured mid-text despite reduced-motion preference |
| B-M | `ev_4601b0246b092f0d5af4133bfb8484f5eea3d1b0e9cac53075dcf712bb2300fa` | BitChord landing, 390×844; same | Complete within requested scenario |
| B-H | `ev_550e95d2a1b3bc47151b3a0633daa53dce6058ebd53158911dc80a7a36d84942` | BitChord web, 1440×900; fresh profile, settle | Complete within requested scenario; extension unavailable |
| N-I | `ev_04819dc593c6a1faa8b77f23efab438b2dcf8276cb8b01313bbbf76ffae3769b` | Nuclear landing; click Codex CLI client selector | Complete requested scenario; only example UI, no MCP connection |
| N-S | `ev_2ea05a692b2c45708058df2ea031259727bea98c097441dc0dda7a48fae1cdad` | Nuclear landing; wait 2.5 s for hydration, click Codex CLI, wait 0.7 s | Complete; captures change from Claude command to Codex command; no MCP connection |
| B-W | `ev_9483c26413cc13a477f2c9e5b5ba4dae4d7da2c6141a7beb159860e4fb88a913` | BitChord web Home→Search→fill KR$NA→Settings, 1440×900 | Complete requested scenario; source unavailable, no results/playback certified |

Canonical evidence file: [final eight-record bundle](rea-evidence-final.json). [Earlier five-record export](rea-evidence-bundle.json) and [seven-record export](rea-evidence-complete.json) are intermediate retained snapshots. Bundle unknown-ledger count zero does **not** imply the investigation has no unknowns: product unknowns are manually tracked in [decisions](../10-decisions.md). Some network bodies/headers/storage were intentionally not requested; initiator stacks, raw wire bytes, listening performance and source legal status cannot be inferred.

## Visual evidence

PNG identities and hashes: [screenshots.json](screenshots.json). Screenshots are viewport captures, not full-page layout audits.

| Screenshot | What to inspect |
|---|---|
| [Nuclear phone-width landing](nuclear-mobile.png) | Two-row header and desktop-only download treatment; transient heading text |
| [BitChord phone-width landing](bitchord-mobile.png) | Mobile Download CTA, centered artwork-led hierarchy |
| [BitChord fresh web home](bitchord-web-home.png) | Empty-source onboarding and disabled transport |
| [Nuclear selected client](nuclear-desktop-interaction.png) | Client-example interaction after click |
| [Nuclear settled client selection](nuclear-client-settled.png) | Follow-up confirms selected Codex command after hydration; the immediate first screenshot still showed Claude |
| [BitChord web settings](bitchord-web-settings.png) | Account/source gates and checkbox/control defaults |

The user supplied two Nuclear app screenshots in this conversation (lyrics and sources). They show a configured instance with Spotify metadata and YouTube streaming. They are not evidence that we exercised native audio, nor proof of recording rights. They are described in [research](../01-research-report.md), not repackaged as our runtime capture.

## Repository evidence and repeatability

Pinned public heads retrieved through GitHub API:

- Nuclear: [`4ac3be77dfb592b8b2f86f40872500414d3f3c15`](https://github.com/nukeop/nuclear/tree/4ac3be77dfb592b8b2f86f40872500414d3f3c15), [local metadata](nuclear-head.json).
- BitChord: [`6a69e2ad2e64fde7268e56aefca81df3ab059560`](https://github.com/kushagrasinghx/BitChord/tree/6a69e2ad2e64fde7268e56aefca81df3ab059560), [local metadata](bitchord-head.json).
- Nuclear latest release at retrieval: `player@1.51.2`, 16 October UTC, [release metadata](nuclear-release.json).
- BitChord latest release at retrieval: `v1.8`, 5 October UTC, [release metadata](bitchord-release.json). Desktop is beta in these notes. Release notes say Intel macOS is not yet available, while newer branch desktop docs describe Intel packaging; branch implementation/documentation is not proof that released packages have parity.

Repository citations in the report use readable branch URLs; reproduce against the pinned heads above by replacing `master`/`main` with the commit ID. This inspection read selected source/docs, not an exhaustive dependency or native binary audit. A larger raw-file snapshot attempt was cancelled after stalling; bounded commit/release metadata retrieval succeeded. No source clone, code build or dependency install occurred.

Documented reported bugs are external issue reports, not reproduced failures. Release fixes are historical findings, not current defect claims. Provider terms, language/model licenses and quotas are dated evidence; recheck immediately before use. [Source matrix](../05-source-feasibility.md) and [risk register](../08-licensing-risks.md) retain those boundaries.

## Remaining investigation boundaries

No runtime tests of authenticated sources, native search/playlists/lyrics/settings, actual audio continuity, every responsive breakpoint, real mobile browser/background behavior, hardware DSP/output bit depth, translation model or TuneScript interface. Phase 1 answers architecture feasibility with explicit gates, not a completed operational music service.


## Installed Nuclear artifact addendum

The initial no-native-testing boundary above is historical. See [installed-app report](../11-installed-nuclear-investigation.md), [REA bundle](native-nuclear/rea-installed-artifact-bundle.json), [identity and active providers](native-nuclear/identity.json), and the Sources, Lyrics, Preferences and Lyrics Settings PNG/JSON pairs in `native-nuclear/`. REA inspected the executable and selected installed plugin sources. Windows Computer Use supplied native UI captures; these are separate evidence authorities. No audible playback certification, authenticated flow, settings change, native decompilation or implementation occurred.


## Phase 1.5 validation — 17 October 2026

[Validation report](../12-phase-1.5-validation.md) supersedes planning assumptions where explicitly recorded. New evidence: [baseline bundle/document integrity](phase-1.5/baseline-audit.json), [TuneScript source inventory](phase-1.5/tunescript-inspection.json), [failed Jamendo metadata probe](phase-1.5/jamendo-read-probe.json), [read-only toolchain observation](phase-1.5/toolchain-observation.json), [primary-source review ledger](phase-1.5/primary-source-review.json), [local-link check](phase-1.5/link-validation.json). Source ledger entries are analyst summaries, not raw page archives. Original REA bundles and native captures are unchanged. No new playback, Gemini output, extension test, native build or successful online stream was verified.


## Website provider investigation — 17 October 2026

[13 Lumaire browser architecture](../13-lumaire-web-provider-architecture.md) records the website-first correction, official-source analysis, native loopback relay finding, provider feasibility and WEB-01. [Source ledger](web-provider-investigation/source-ledger.json) is an analyst summary of retrieved sources/limitations, not a raw source archive or REA capture. [Validation](web-provider-investigation/validation.json) checks local links and retained evidence integrity. No new source playback or experiment was executed.


## Desktop transition audit — 17 October 2026

[14 Current desktop audit](../14-desktop-transition-audit.md) records the latest desktop decision and three-phase gates. [Pre-edit inventory](desktop-transition/pre-edit-inventory.json), [environment observation](desktop-transition/environment-observation.json), [primary-source review](desktop-transition/primary-source-review.json) and [validation](desktop-transition/validation.json) distinguish read-only observations, source findings and proposed tests. No dependency installation, native build, resolver execution, prototype or playback occurred. Original evidence bundles remain unchanged.
