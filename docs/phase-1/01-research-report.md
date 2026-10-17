# Research report

**Current authority:** [14 Desktop transition audit](14-desktop-transition-audit.md), [04 Architecture](04-architecture.md) and [09 Roadmap](09-roadmap.md) reflect the latest desktop return. This report remains historical reference evidence.

**Phase 1.5 review:** this file retains the original reference observations and historical scope. TuneScript has since been located and inspected; the current MVP/source recommendations and remaining gates are in [12 Validation](12-phase-1.5-validation.md), with material revisions recorded in [decisions](10-decisions.md). In particular, Jamendo is conditional and generated conversion is outside required P0.

Date: **17 October 2026**. Related: [source feasibility](05-source-feasibility.md), [evidence](evidence/README.md), [decisions](10-decisions.md).

## Conclusion

The viable differentiated direction is an original local-first player with a single synchronized view of original lyrics, romanisation and meaning, plus transparent optional music sources. Nuclear already supports multilingual lyrics and recording correction; BitChord already offers translation, polished motion and source fallback. Merely combining their advertised features is insufficient differentiation. Language accuracy, trustworthy recording identity, frictionless first playback, portable libraries and understandable failures are stronger hypotheses to test.

The original ambition to replace mainstream music subscriptions is a separate, unresolved product constraint. Existing clients demonstrate that extraction can work. They do not establish that all commercial recordings can be offered through a compliant, reliable, unlimited ₹0 service. [05](05-source-feasibility.md) records bounded options instead of silently treating unofficial endpoints as authorized APIs.

## Method and scope

Evidence labels: **OBS** = our controlled browser observation; **REPO** = inspected public source/docs; **REPORT** = user-reported issue; **INFERENCE** = our design assessment; **UNKNOWN** = not established. REA 6.5.0 launched isolated headless Chrome 155 profiles, with empty storage, reduced-motion preference, desktop 1440×900 and phone-width 390×844 viewports. Mobile viewport is not a real mobile device, touch test or mobile user agent. The [retained bundle](evidence/rea-evidence-final.json) contains exact scenarios and limitations; [index](evidence/README.md) maps IDs.

Scope included both landing pages; Nuclear's client-example switch; BitChord web Home, Search, a typed query and Settings; source code for playback/providers/integrations; public issues, releases and licenses. No native product installation, extension installation, authenticated flow, audible playback, playlist mutation, translated lyric generation, mobile runtime, performance benchmark or regional catalogue test occurred. The user's Nuclear screenshots are user-supplied evidence, not REA-native captures.

## Comparison

| Dimension | Nuclear | BitChord | Evidence type |
|---|---|---|---|
| Position | Configurable desktop player/provider framework | Broad listening experience with visual emphasis | REPO + landing OBS |
| Desktop architecture | Tauri/Rust, React/TypeScript monorepo; provider SDK and separate HTML audio engine | Kotlin shared modules, Compose desktop/JVM Java 21 | REPO |
| Browser | Marketing site plus LAN remote; not the full native player | Separate React/Vite web client with extension bridge | REPO + web OBS |
| Content | Separate metadata/streaming/discovery providers; plugins required | YouTube resolver, JioSaavn, local files and HTTP addons | REPO |
| Lyrics | Plain/line/word sync, translation, romanisation/furigana via providers | Word/syllable animation, multiple providers and translation | REPO; native behavior UNKNOWN |
| Library/control | Favorites, playlists, persistent queue/history; Jam, MCP, MPD | Local library, downloads, sleep/speed/quality, crossfade/Automix, Listen Together | REPO; platform parity UNKNOWN |
| Extension trust | Installed JavaScript plugin execution | Remote addons return JSON; web browser extension supplies additional capabilities | REPO |

Sources: [Nuclear README](https://github.com/nukeop/nuclear/blob/master/README.md), [Nuclear architecture](https://docs.nuclearplayer.com/nuclear), [BitChord README](https://github.com/kushagrasinghx/BitChord/blob/main/README.md), [desktop docs](https://github.com/kushagrasinghx/BitChord/blob/main/DESKTOP.md), [web README](https://github.com/kushagrasinghx/BitChord/blob/main/web/README.md). Features are documented, not independently certified across platforms.

## Direct observations

| Finding | Evidence | Implication / limit |
|---|---|---|
| Nuclear desktop landing exposes platform/package-manager downloads; phone width replaces them with a desktop-only message | OBS N-D, N-M | Responsive marketing adaptation; standalone mobile player not observed |
| Installer URLs and structured metadata identify 1.51.0 in landing capture; release page inspected earlier identifies 1.51.2 | OBS + REPO release | Landing/release lag; compare timestamps rather than assuming app updater lag |
| Initial Nuclear selector capture retained the old command; a second scenario waits for hydration, then captures the Codex command after clicking | OBS N-I/N-S | UI result verified only in the settled follow-up; MCP connection not tested |
| Nuclear DOM/assets carry Astro markers; BitChord landing loads Next chunks and image routes | OBS N-D/B-D | Website technology, not proof of native implementation technology |
| Nuclear page requests an Umami script; BitChord page includes Cloudflare instrumentation and a live-stats request | OBS network | Website requests exist; no conclusion about native telemetry, payload or tracking consent from names alone |
| BitChord mobile hero uses Download while desktop offers Open BitChord Web; catalogue links point to web root | OBS B-M/B-D | Selection context is not encoded in those links; user may need to search again |
| Fresh BitChord web Home and Search show extension prompts; previous/play/next are disabled | OBS B-H/B-W | Clear onboarding cost; addon playback without an extension was not tested |
| Search accepts KR$NA while the source prompt remains; Settings navigation completes | OBS B-W | Text entry and route work; no successful search result or stream claimed |
| Settings shows sharing to YouTube checked, AutoPlay checked, crossfade Off with choices, and extension-gated accounts/source access | OBS B-W | Defaults/control existence only; no account history write or crossfade execution observed |

Nuclear's bold compact layout and strong source controls suit enthusiasts. BitChord's artwork-led presentation and focused player reduce visual complexity. The user's Nuclear screenshot has three competing panes and truncated queue text; inactive lyric contrast looks weak qualitatively, but contrast ratios were not measured. Accessibility trees reveal unlabeled buttons in some Nuclear marketing demos and repeated labels in BitChord's TV tabs; these are bounded website observations, not a complete WCAG audit. Screenshots are in the [evidence index](evidence/README.md).

## How music and lyrics are resolved

**Nuclear (REPO):** installed metadata providers identify a recording; a streaming provider finds audio. The registry's YouTube plugin uses yt-dlp. Other entries include Bandcamp, SoundCloud, NetEase and multi-source search. Spotify/Deezer listings are not Spotify/Deezer audio licenses. The player offers candidate correction and local/community verification because title/artist matching can select the wrong version. Fresh installs require plugin selection. Optional online verification sends track/source information and a random identifier; privacy needs to be described per feature. [Provider model](https://docs.nuclearplayer.com/nuclear/core-concepts/how-nuclear-works), [registry](https://github.com/NuclearPlayer/plugin-registry/blob/master/plugins.json), [verification](https://docs.nuclearplayer.com/nuclear/core-concepts/stream-verification).

**BitChord (REPO):** the shared resolver tries InnerTubeX and then NewPipe, and probes returned URLs. JioSaavn service code uses internal endpoints and media-URL decoding. HTTP addons expose manifest/search/stream responses rather than executing addon code; ordered fallback and declared format metadata improve diagnosis. Download allowance defaults to enabled, which is an application policy, not copyright clearance. Website Spotify integration relies on session/web-client internals and matches listings to YouTube; translation documentation identifies an unversioned Google endpoint. These are maintenance and permission risks. [Resolver](https://github.com/kushagrasinghx/BitChord/blob/main/shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/innertube/StreamResolver.kt), [JioSaavn service](https://github.com/kushagrasinghx/BitChord/blob/main/app/src/main/java/com/music/bitchord/data/jiosaavn/JioSaavnService.kt), [addon contract](https://bitchord.kushagrasingh.in/docs), [web integrations](https://github.com/kushagrasinghx/BitChord/blob/main/web/docs/spotify-and-discord.md), [translation](https://github.com/kushagrasinghx/BitChord/blob/main/docs/LYRICS_TRANSLATION.md).

## Problems and opportunities

| Problem / gap | Status | Product response |
|---|---|---|
| New user needs plugins or an extension before familiar online music works | REPO + OBS | Start immediately with local file selection and a rights-cleared demonstration, then explain online sources |
| Correct title can map to wrong recording or lyric timing | Nuclear docs; runtime UNKNOWN | Canonical source IDs, version/duration evidence, confirmation and persistent corrections |
| Feature lists hide platform/source requirements | INFERENCE from docs/UI | Capability badges, permission explanation, honest disabled states |
| Native playlist removal discoverability, settings bar behavior, cookie sign-in, party autoplay | REPORT [868](https://github.com/kushagrasinghx/BitChord/issues/868), [850](https://github.com/kushagrasinghx/BitChord/issues/850), [826](https://github.com/kushagrasinghx/BitChord/issues/826), [828](https://github.com/kushagrasinghx/BitChord/issues/828) | Task-based tests; do not report these as reproduced defects |
| Linux silent YouTube playback and double history recording | Fixed in Nuclear 1.51.2 release notes | Include codec/queue-boundary checks; do not call fixed defects current |
| Romanisation/translation toggles alone already exist elsewhere | REPO | Persistent three-text alignment, correction, readability, honest generated labels and local privacy |
| Free access, offline permission and full quality are conflated | Docs + INFERENCE | Per-source rights, actual codec and output-path distinction; no universal download button |

[Nuclear releases](https://github.com/nukeop/nuclear/releases), [BitChord issues](https://github.com/kushagrasinghx/BitChord/issues). Counts of stars/issues/downloads do not establish retention, quality or demand. A ten-person language-focused pilot is proposed in the [PRD](02-prd.md); no user validation has yet occurred.

## Review boundary

Retain the useful separation of source and library, and the deliberate listening interface. Independently implement behavior rather than copy either application's code/assets. Defer arbitrary plugins, party servers, AI recommendations, cloud sync and advanced DJ processing. TuneScript's code and API are not supplied: it is a candidate integration, not a verified dependency. Full multilingual translation and unrestricted catalogue coverage remain unresolved, visibly tracked in [10](10-decisions.md).


## Installed Nuclear follow-up — 17 October 2026

The earlier native-untested statements describe the initial website pass. The [installed-app investigation](11-installed-nuclear-investigation.md) now adds REA executable/resource and installed-plugin evidence, native Sources/lyrics/preferences captures, static risks and a prioritized remaining test plan. Audible playback, native search correctness, playlist mutation and translation remain unverified. No implementation was started.
