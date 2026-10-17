# Installed Nuclear: REA investigation and implementation plan

**Historical investigation with subsequent review:** [Phase 1.5](12-phase-1.5-validation.md) resolves TuneScript's location/mechanism and supersedes the planning recommendations below where stated. The ten-listener PRD pilot is canonical; five-person work is formative only. Original native/REA evidence is preserved unchanged.

17 October 2026. **Research and planning only. No application implementation, dependency installation, configuration repair or deployment.** This addendum extends the earlier website/repository investigation; it does not replace those historical observations. Related: [research](01-research-report.md), [architecture](04-architecture.md), [source feasibility](05-source-feasibility.md), [lyrics](06-lyrics-system.md), [roadmap](09-roadmap.md).

## Executive finding

Your installed Nuclear separates **Spotify catalogue information from YouTube audio**, with LRCLIB lyrics, Last.fm discovery and Deezer dashboard content. It is not streaming Spotify's licensed recordings through a free Spotify playback API. Its installed YouTube adapter searches by artist/title and asks Nuclear's yt-dlp interface for a playable URL. This explains the experience without establishing permission to reproduce the service.

The useful product opportunity is reliable recording selection, understandable source failures, and a carefully tested multilingual lyrics experience. Nuclear already has substantial lyrics controls and plugin support. Adding translation alone is not a sufficiently differentiated product promise. Whether people will adopt our version remains a hypothesis requiring listener testing.

## Target and evidence

| Item | Observed identity |
|---|---|
| Installed executable | `C:\Users\ARUSH\AppData\Local\Nuclear\nuclear-music-player.exe` |
| Version | Windows version metadata: **1.51.2**; native Preferences: **v1.51.2 (4ac3be77d)** |
| Size / platform | **53,136,384 bytes**, AMD64 PE32+ |
| SHA-256 | `79a8171a6ec65e32c23271cdf9505c0f542820a14b32a533c649a694b9d0ad2f` |
| Runtime UI | Running Nuclear window, Tauri-localhost routes; Windows accessibility and screenshot observations |
| Plugin artifact root | `C:\Users\ARUSH\AppData\Roaming\com.nuclearplayer\plugins` |
| Plugin inventory digest | `3f9c12b847066de02f6534249c5f75061aaaa3eed52c46b149c9303f58daab0f` |

REA records are retained in the [installed-artifact bundle](evidence/native-nuclear/rea-installed-artifact-bundle.json). UI captures are Windows Computer Use evidence, **not REA native scenarios**.

| Evidence | Meaning and boundary |
|---|---|
| `ev_023a3405135e123787a797222dcd3a2d052a503b89d87ed71a8de56878f7a953` | REA Rust metadata inspection: exact executable identity, inferred rustc path hash; no `.dep-v0` dependency metadata. Does not recover Rust functions or prove compiler provenance. |
| `ev_5437fb1c48717656954d96406b5d555c32c8861c56a1f7ad1fd637c83c1a4772` | REA static PE resource inventory: nine resources, 22 directory entries examined. Version payload remains opaque to this parser; Windows metadata supplied the version above. |
| `ev_75823d2ea236bd95f9c2e820541357ff98e82caf29700ebe73f13e1d090342ef` | Initial REA analysis of three selected installed plugin files. |
| `ev_ab769e946df60893c818f9e9926949f54c04c1a29bec63e12f6143dac497e210` | Expanded REA analysis of 14 selected files: ten parsed JS/TS sources plus four manifests, 25,299 text bytes, zero parse failures. 29 inventoried files remain outside this selection. Both application and semantic coverage are partial. |

REA's Ghidra provider is unconfigured, Hopper is unsupported on Windows, and IDA is unconfigured. No decompiler was installed. No Rust pseudocode, complete embedded frontend recovery, native call trace or native network attribution is claimed. The REA session was exported and closed, leaving the running player open. Zero unknown-ledger entries in the export does not mean zero unresolved questions.

## How this installation obtains content

The active-provider configuration and native Sources view agree:

| Role | Installed plugin / version | Mechanism established |
|---|---|---|
| Audio | `nuclear-plugin-youtube` 0.1.2 | `src/index.ts:40` runs quoted and plain artist/title searches through `api.Ytdlp.search`, merges/deduplicates IDs, and returns candidates. At line 68, `api.Ytdlp.getStream(candidateId)` supplies URL, duration, container and codec. A local `ytdlp/yt-dlp.exe` exists. Adapter syntax and file presence do not prove a request occurred during this inspection. |
| Metadata / playlist import | `nuclear-plugin-something` 0.3.0, displayed as Spotify | `src/index.ts` registers metadata and playlist providers. `src/client.ts:26` encodes Spotify's partner Pathfinder endpoint; line 54 holds persisted-query hashes. These are web-client internals, distinct from the public Spotify Web API. No personal credentials or stored tokens were needed for this finding. |
| Lyrics | `nuclear-plugin-lrclib` 0.1.0 | Searches LRCLIB by title and first artist, chooses nearest duration, parses synchronized LRC or plain lyrics. The inspected adapter does not generate translation or romanisation. This does not establish the absence of those capabilities elsewhere in Nuclear. |
| Dashboard | `nuclear-plugin-deezer-dashboard` 0.2.0 | Installed source requests chart/editorial metadata and playlist details. Dashboard artwork does not establish Deezer full-track playback. |
| Discovery | `nuclear-plugin-lastfm` 0.2.2 | Active configuration and Sources UI show Last.fm. Recommendation quality and scrobbling were not exercised. |
| Playlist source | `nuclear-plugin-youtube-playlists` 0.1.0 | Active configuration selects this provider; Sources also lists Spotify and Deezer playlist sources. Imports were not executed. |
| Extra UI | `nuclear-mini-player` 1.8.0 | Enabled in installed registry; its panel and controls appear in the accessibility tree. An older 1.7.10 directory also exists; that alone does not mean both versions execute. |

## Native observations and potential weaknesses

| Finding | Evidence / confidence | Product improvement |
|---|---|---|
| Sources clearly distinguishes metadata, streaming, discovery, dashboard, playlists and lyrics | Native [Sources screenshot](evidence/native-nuclear/sources.png), [accessibility capture](evidence/native-nuclear/sources-state.json) | Retain separation internally; show a simple recording/source badge where listeners choose music. |
| Current Maand/Moonir selection shows “No lyrics for this track” and “LRCLIB returned no results” | Native [lyrics screenshot](evidence/native-nuclear/lyrics.png), [capture](evidence/native-nuclear/lyrics-state.json) | Add authorized local LRC/text import, editable query and explicit no-result/retry actions. This is one observed missing result, not proof LRCLIB has no Maand recordings. |
| Queue says 1:51 while transport is at 3:05, remaining 0:00, with pause icon | Same native captures; inconsistency observed before our navigation | Distinguish catalogue duration from resolved recording duration; reconcile at resolution. Cause and audible playback state remain unknown; do not claim a reproduced wrong-song bug. |
| Dashboard shows “Nothing found” under Top Albums | Initial native inspection; not retained as a separate PNG | Separate empty content, provider failure and loading states. Backend cause not established. |
| Many main transport buttons have no accessible name in the returned tree | Native captures; mini-player controls do have names | Require descriptive labels and keyboard tests. This is an AX observation, not a full accessibility conformance audit. |
| General preferences expose stream retries, verification and online verification; lyrics preferences expose header cleanup, auto-scroll, synced preference and font size | [General preferences](evidence/native-nuclear/preferences.png), [lyrics preferences](evidence/native-nuclear/lyrics-settings.png), corresponding JSON captures | Provide useful defaults and explain external verification before sharing. Settings were read, not changed. |
| Settings navigation scrolls to a section while the top heading remains General | Native lyrics-settings capture | Give the selected section a meaningful current heading. Scope: this installation and captured layout only. |
| Closest lyric record has no maximum duration-distance rejection | Installed `nuclear-plugin-lrclib/0.1.0/src/closest-record.ts:19–22`; static finding | Reject low-confidence matches and let users correct recording identity. A wrong lyric result was not reproduced. |
| Spotify pagination continues while loaded count is below total; no empty-page/progress/page-count guard | Installed `nuclear-plugin-something/0.3.0/src/client.ts:176–194`; static risk | Bound pages, detect repeated IDs/no progress, support cancellation and partial imports. An infinite loop was not executed or reproduced. |
| Deezer helper calls `response.json()` without a local HTTP-status check | Installed `nuclear-plugin-deezer-dashboard/0.2.0/src/client.ts:20–22`; static risk | Validate status and shape, classify rate limiting, retain last successful data. Host-level handling remains unverified. |
| Spotify adapter depends on internal persisted-query hashes | Installed metadata client; static dependency | Avoid making this adapter essential to startup or the local library. Upstream changes can break it independently of our UI. |

UI inputs sometimes required a later observation to see navigation results. No latency benchmark or Nuclear responsiveness defect is inferred from automation timing. A pre-existing mini-player “detached window was blocked” text was exposed in AX; we did not trigger detachment or reproduce that issue.

## Licensing and ₹0 implications

The six inspected standard-provider manifests declare **AGPL-3.0-only**. Reusing or modifying their code requires an explicit compatible release/licensing decision; the label grants no music, artwork or lyrics rights. The installed mini-player manifest has **no license field**: reuse permission was not established. We should independently implement ideas until reuse obligations are resolved.

The existing [source matrix](05-source-feasibility.md) remains authoritative for dated official service terms. This installed-app inspection changes our confidence about Nuclear's mechanism, not the permission status of third-party content. A reachable yt-dlp audio URL is not an authorized unlimited music API. A website also cannot directly call Nuclear's Rust/yt-dlp interface; an equivalent browser feature needs a different permitted playback path. A hosted extraction proxy introduces maintenance, terms and bandwidth issues that conflict with the strict initial ₹0 constraint.

Keep the core local with user-authorized music and lyric files. Treat approved catalogue integrations as optional and capability-limited. TuneScript remains conditional on inspecting its actual repository, service calls, interface and license. No paid services or packages were acquired during this investigation.

## Prioritized plan before implementation

| Stage | Work / acceptance gate | Current status |
|---|---|---|
| 1. Establish the actual reference | Hash/version the installed app; identify active plugins; separate UI, installed-code and public-source evidence | Done within the bounded scope above |
| 2. Finish controlled runtime checks | Search with known title/artist pairs; compare selected catalogue recording to candidate identity/duration; verify audible playback, pause/seek/end-of-track; test lyric offsets and no-result recovery | Still unverified. Use disposable test state and entitled recordings; do not erase the existing library or queue. |
| 3. Validate playlist/error behavior | Small import, empty/repeated pagination page fixture, offline/rate-limit/expired-stream cases; verify cancellation and preservation of user state | Planned; no mock application code or network manipulation this phase |
| 4. Inspect TuneScript | Establish repo/path, license, supported scripts/languages, local vs remote computation and achievable quality | Blocked only for TuneScript-specific decisions; source not supplied |
| 5. Validate product demand | Proposed: five target listeners, two listening sessions each; observe first-play success and use of romanisation/meaning; measure wrong-version and lyric-mismatch corrections | Proposed research, not completed evidence or a guarantee of adoption |
| 6. Review the MVP | Local playback, persistent queue/playlists, keyboard access, local synchronized lyrics, original/romanised/meaning layout, explicit recording identity; one validated language pair; optional approved source | Review-ready proposal, subject to product/source and language gates |
| 7. Implement only after a later instruction | Follow [architecture](04-architecture.md) and [roadmap](09-roadmap.md); share domain/UI logic with a later browser edition, with explicit capability differences | Not started |

Do not prioritize arbitrary plugins, automatic downloads, cloud accounts, social listening, advanced DSP or every translation language before the first-play and recording/lyrics accuracy gates pass. Preserve BitChord's browser convenience and Nuclear's source separation while making failures and corrections substantially easier.

## Coverage checklist

- Installed identity/resources: answered within REA parser coverage; deep native code unresolved.
- Active integrations and selected plugin logic: answered for the selected files; runtime requests and host internals unresolved.
- Sources, current no-lyrics outcome and preferences: directly observed and retained.
- Search result correctness, audible audio, queue mutation, playlist import, successful lyric synchronization, translation and regional availability: not certified.
- BitChord native application: not tested; earlier website/repository findings still apply.
- No settings toggles, favorites, playlist contents, authentication, plugin installs or verification submissions were changed. Preferences was closed; the running app was left on Lyrics with the original query and queue.
