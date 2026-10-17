# UI/UX specification

Status: original Lumaire direction preserved, 17 October 2026; **Windows desktop first by latest explicit user decision**. No interface implementation/usability test performed. Keep the existing lyric focus, three-layer hierarchy, queue and persistent transport; no visual redesign in this audit. Add native file/relink, resolver-missing/disabled, timeout, expired-stream and offline states. See [14](14-desktop-transition-audit.md).

## Evidence and design implications

The parent research inspected landing pages through REA-controlled Chrome at 1440×900 and 390×844. The following observations do not establish native playback behavior; see [research report](01-research-report.md) for evidence details and limits.

- [Nuclear](https://nuclearplayer.com/): desktop installer links showed 1.51.0; mobile replaced installer choices with “Desktop only.” Header links reflowed to a second row. Astro indicators were observed. Keep our platform/support statements explicit and release links current.
- The user's Nuclear screenshot shows sidebar, large original Tamil lyrics, right queue and bottom transport. Repeated/truncated queue titles and visually dim inactive lyrics suggest readability and density opportunities. Contrast ratios were not measured; this is qualitative assessment.
- [BitChord](https://bitchord.kushagrasingh.in/): dark, artwork-centered landing with a skip link and Next assets. Mobile hero offered Download while desktop offered Open BitChord Web. Album cards resolved to the same web root rather than track destinations; mobile included TV screenshot alternative text. Our previews should either open the advertised content or clearly explain their purpose.
- BitChord web was inspected in a fresh temporary profile without its extension: Home → Search → `KR$NA` → Settings. Search retained the extension prompt; previous/play/next controls were disabled. Settings marked YouTube, Spotify and Lyric Sources Access as requiring the extension. This qualifies broader claims that lyrics work without it: the controls exist, but source-specific access is gated and lyric functionality was not verified.
- BitChord's Share Listening Activity to YouTube, AutoPlay, and public-page Apple Music artwork/animated-artwork toggles were checked; Crossfade was Off with 3/6/9/12-second options. These are observed control states, not proof of network writes or working integrations. Prefer explicit opt-in for external activity sharing in our product. REA evidence: `ev_9483c26413cc13a477f2c9e5b5ba4dae4d7da2c6141a7beb159860e4fb88a913`. Actual playback and native applications were not tested.

Borrow interaction principles independently; do not copy product artwork, branding, screenshots, proprietary assets or source code. Follow [PRD](02-prd.md) and [priorities](03-feature-prioritization.md).

## Product principles and shell

Make the first playable action local file import, with no key or account. Keep playback stable during navigation, source failure and lyric processing. Show source identity and unavailable capabilities at the point of use. Never imply every song is free, downloadable or locally available.

Wide layout: compact navigation rail, main content, optional queue, persistent transport. Lyrics focus mode expands reading space and collapses secondary panes. Use original typography, restrained surfaces and one accent; avoid mandatory glass blur, moving backgrounds or oversized unreadable dim text. Final tokens require measured accessibility validation.

Narrow layout: single content column, compact transport and explicit queue/lyrics destinations. No simultaneous three-pane layout or hover-only actions. Windows resize/reflow, file scope/relink and per-source restrictions are explained when relevant. Resolver setup is optional and separated from first local playback. Desktop/browser feasibility is defined in [architecture](04-architecture.md).

## Screen inventory

| Screen | Primary action and required states |
|---|---|
| Welcome/library empty | Choose files or desktop folder; explain local storage; optional authorized sample only if supplied with rights |
| Library | Tracks, albums, artists, favorites, recent; import progress, duplicates, missing file and unsupported format |
| Search | Scope selector for local/available providers; distinguish no result, offline, unsupported and provider error |
| Now Playing | Artwork, full title/artist access, source badge, seek, volume, repeat/shuffle; loading/buffering/error |
| Queue | Reorder, play next, remove and clear with undo; keyboard alternatives to dragging |
| Playlists | Create, rename, add/remove, import/export; preserve unavailable track entries |
| Lyrics | Original/romanisation/translation grouped by line; missing/plain/instrumental/unsupported states |
| Sources | Explain metadata versus audio; enabled adapters, permission/capability summary, status and retry |
| Settings | Audio/device capabilities, appearance/accessibility, shortcuts, lyric preferences, storage/privacy |
| Downloads/models | Only authorized downloads; opt-in model size/license, progress, cancellation and removal |
| About/help | Source attribution, software notices, actual app version, support/export diagnostics without private text |

## Essential journeys

1. **First listen:** welcome → choose a local file → indexed track appears → explicit Play → transport and queue update. Folder denial leaves file selection available. Show import errors per file; do not block the entire library.
2. **Read while listening:** open Lyrics → attach authorized LRC if needed → show supplied original → enable supplied romanisation/translation individually after confirmed line mapping. Initial reading pair: Tamil original / Latin / English. Generated conversion and translation are conditional P1 under the [Phase 1.5 revision](12-phase-1.5-validation.md). Language, scheme and provenance remain visible; missing variants stay unavailable. Later missing-model prompts never interrupt playback.
3. **Correct timing:** adjust offset → immediate preview → save per recording → reset available. Different recordings cannot silently inherit identical timing. Detailed invariants are in [lyrics specification](06-lyrics-system.md).
4. **Save a collection:** add tracks → name playlist → reopen → order persists. Removing a playlist differs from deleting files; destructive file deletion is outside baseline scope.
5. **Recover a source:** show provider-specific error and retry → keep queue and saved metadata. Offer authorized alternatives only with explicit recording selection; no silent substitution with a cover/live version. See [source matrix](05-source-feasibility.md).

## Integrated lyric experience

Each time group stacks original, optional romanisation and optional translation, all tied to original line IDs. Give each layer an independent visibility toggle and readable size. Preserve the active group when changing a view. Word highlighting applies only where valid timings/alignment exist. Translation line intervals do not imply translated-word timing.

Allow scroll-away without snapping back; expose Resume following. Clicking a timed line seeks where supported. Show transliteration scheme and target translation language explicitly. Display “unsupported language,” “model not installed” and “no lyrics” distinctly. TuneScript's cloud/browser interface has now been inspected; reuse licence and integration validation remain open. No universal translation or pronunciation-quality claim.

## Accessibility and state behavior

Target WCAG 2.2 AA, with keyboard access, visible unobscured focus, sufficient text/control contrast, reflow, meaningful labels and non-drag alternatives. These are proposed requirements, not a conformance claim. [Official WCAG reference](https://www.w3.org/WAI/WCAG22/quickref/)

Provide skip navigation, semantic headings, named icon buttons and correctly announced sliders/toggles. Dialogs restore focus. Announce track changes and failures, not every elapsed second or lyric tick. Shortcuts must not hijack text input; expose a shortcut reference. Respect reduced motion and provide an explicit override. Preserve text at zoom and custom line spacing.

Set language/direction per lyric segment; isolate mixed-script titles, numbers and controls. Direction is semantic, not visual alignment alone. [Direction reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/dir)

No autoplay on first load. Empty, loading, denied, unsupported and failed states offer a concrete recovery action. Logs/errors must not display cookies, tokens or local file paths. Permission and storage controls follow [risks](08-licensing-risks.md).

## Proposed acceptance checks — not executed

- At desktop and narrow widths, keyboard users complete first import, playback, playlist creation and lyric switching; focus remains visible above transport/overlays.
- At zoom/reflow, controls and all three lyric forms remain reachable without content loss; long titles expose full accessible names.
- Screen-reader review verifies navigation, player control values, queue operations and restrained announcements; RTL and code-switching use authorized fixtures.
- Reduced-motion behavior avoids animated auto-scroll; source/model/network failures leave local playback usable.
- Validate measured contrast, actual task completion, lyric readability and source comprehension with target listeners before claiming usability gains.

Implementation sequencing is in [roadmap](09-roadmap.md); unresolved platform and playback choices are recorded in [decisions](10-decisions.md). Return to the [package index](README.md).


## Installed Nuclear follow-up — 17 October 2026

The earlier native-untested statements describe the initial website pass. The [installed-app investigation](11-installed-nuclear-investigation.md) now adds REA executable/resource and installed-plugin evidence, native Sources/lyrics/preferences captures, static risks and a prioritized remaining test plan. Audible playback, native search correctness, playlist mutation and translation remain unverified. No implementation was started.
