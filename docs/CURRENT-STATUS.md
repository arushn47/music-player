## 1.0.5 release preparation — 22 October 2026

- User authorized pushing and publishing 1.0.5. Updated npm/lockfile, Cargo/lockfile, Tauri version and versioned Windows shortcut icon resource; retained app identity and signing keys.
- Finalized RELEASE_NOTES.md with user-facing changes and the important bootstrap limitation: published 1.0.4-preview binaries predate the updater. Windows users must install 1.0.5 manually once without uninstalling; future signed versions use the configured update feed. Android keeps its existing signing certificate.
- Release notes render safe headings, paragraphs, lists, bold text and inline code instead of exposing Markdown hashes/asterisks. Shared rendering covers available/installed notes on Windows/Android. Untrusted HTML stays escaped. Native desktop verified both pre/post-update formatting.
- Checks: production build; 282 frontend tests; native serial run 116 passed, 10 explicit live-provider/key-dependent checks ignored; release-config validation, two manifest self-checks and actionlint passed. The default parallel native run exposed mock-server expiry behind the shared lyric request gate; serial rerun passed all enabled tests.
- Android ARM64 release APK built from final UI and signed with the existing key; v2/v3 signatures and ZIP alignment verified. Physical-device replacement not performed. Windows signing/publication is delegated to the checked-in verified release workflow; publication status is recorded after completion.
- Source-only staging excludes SettingsView-old.tsx.bak and ignored signing material, caches, fixtures and build outputs.

## Clean collapsed playlist scrolling — 22 October 2026

- Kept the existing collapsed sidebar width and centered controls. Hid the playlist scrollbar only while collapsed; explicitly clipped horizontal overflow in both modes. The expanded sidebar retains its normal scrollbar.
- Added subtle top/bottom edge fades and small clickable chevrons only where more playlists exist. Scroll/resize measurements keep cues current; reaching either end removes that cue. Wheel, trackpad and keyboard focus scrolling remain native. No playlist persistence changes.
- Validation: production build and 281 tests across 46 files passed. Added reproducible isolated Windows `scripts/sidebar-scroll-test.mjs` checking many playlists, collapsed scrollbar hiding, horizontal bounds, chevron scrolling, end detection, keyboard focus and expanded scrollbar restoration. Dark/light previews reviewed in test-results/sidebar/. No installer/APK rebuilt or released.

## Playlist covers in the desktop sidebar — 22 October 2026

- Replaced repeated playlist icons with 28px cover thumbnails using existing collection membership and cached/lazy Artwork rendering. Matches playlist-page cover selection: first four distinct covers form a collage, fewer use the first cover, no artwork keeps the playlist icon. No playlist data or persistence changes.
- Names, counts, selection and navigation remain intact; covers also fit the collapsed sidebar. Existing artwork loading/failure handling is reused.
- Verification: 281 tests across 46 files and production build passed. Added sidebar coverage for empty, one, three and four-cover playlists; isolated Windows desktop verification passed image loading, collage/single/fallback rendering, navigation, both themes and collapsed dimensions. Previews reviewed in test-results/sidebar/. No installer/APK rebuilt or published.

## Desktop sidebar width expansion — 22 October 2026

- Increased desktop sidebar grid column width from `215px` to `240px` in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) for both standard and with-queue states (`.app` and `.app.with-queue`).
- Provides +25px (~27% more label width) for playlist titles, count badges, and footer items like "Settings & sources", eliminating premature text truncation while maintaining ample layout canvas for main view content.
- Collapsed sidebar (68px), tablet (165px), and mobile/Android full-width layouts remain unaffected.
- Verification: production build and 280 tests across 45 files passed.

## Conditional accented desktop update shortcut — 22 October 2026

- Top-bar Updates now appears beside Import only when the Windows updater has identified a target version. It stays available during download, retry and restart stages, with progress/action labels; idle, checking, current, development builds and post-install notes alone no longer add a permanent top-bar section.
- Added accent background/contrasting accent text in both themes. The shortcut still opens existing release notes/download/install controls; Settings/About remains the permanent update entry point. Post-install release notes still open independently.
- Verification: production build and 280 tests across 45 files passed; added hidden-shortcut test and accent-class assertion. Isolated Windows desktop regression confirmed initial hidden state, simulated update placement, theme accents, release-notes opening, hidden state after reload/post-install and Settings update controls. No update download/install, installer rebuild or publication occurred.

## Autoplay Next feedback and faster source selection — 22 October 2026

- Starting an autoplay search pauses the current audio immediately. Loading appears on the shared Play button (including expanded player), with aria-busy and a disabled Play action while searching; the Autoplay infinity icon remains stable. Failed/cancelled searches clear loading and leave playback paused so the user can resume or retry. Repeated Next requests remain guarded.
- Source verification now races pairs of candidates (still at most five total). A playable second source can start before a slow first source finishes; unresolved/missing recordings and stale results are still rejected. Existing verified-stream reuse is preserved. At most one losing lookup can remain in flight after selection.
- Verification: production build and 279 tests across 45 files passed; added slow-source regression and normal/expanded Play spinner assertions. Controlled hook/UI regression passed in browser and isolated Windows desktop profile: immediate pause, Play loading, natural end, unavailable fallback, duplicate Next, opt-out, cancellation, failure recovery. Live-provider speed is not benchmarked; network/provider delays still apply. No installer/APK rebuilt or released.

## Visible cover colors in light-mode expanded player — 22 October 2026

- Light mode blended only 8% of the already softened artwork palette into the neutral background, washing out cover colors. Increased that blend to 32% for a visible pastel ambient gradient while retaining dark text, sharp artwork/controls, 650ms crossfades and neutral fallback. Scope remains expanded player only; dark mode is unchanged.
- Verification: production build passed; ambient browser regression passed sampling/cache, stale artwork, missing-art fallback, reduced motion, expanded-only scope and both themes. Added a light-mode blend/palette assertion. Isolated Windows desktop check confirmed the tint and sharp artwork; reviewed light-mode preview in test-results/ambient/. No installer/APK rebuilt or released.

## Artist Avatar Fallback & Lyric Size Baseline Scaling — 22 October 2026

- **Artist Avatar Fallback Icon:**
  - In [Artwork.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/Artwork.tsx), added `kind?: "track" | "album" | "artist"` prop. When rendering an artist fallback (or when `.artist` class is present), replaced the standard music note icon (`Music2`) with a centered, solid human silhouette avatar SVG (`.artist-fallback-icon`) matching modern profile styling (solid circular head and curved shoulder base).
  - Applied in [DiscoveryView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryView.tsx) artist search cards and [ArtistView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/ArtistView.tsx) header banner. Tracks and albums continue to use the standard music note fallback.
  - Added flex-centering in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) for `.search-artist .cover` and `.artist-cover.cover`.
- **Lyric Text Size Baseline (32px as New 100%):**
  - Updated default `lyricSize` from `28` to `32` in [types.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/domain/types.ts) and [session.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/domain/session.ts).
  - Re-anchored the 100% scale baseline to 32px across [LyricsSettings.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/LyricsSettings.tsx) and [SettingsView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/SettingsView.tsx), making what was previously 114% (32px) the new out-of-the-box 100% standard.
  - Reset pills and percentage steppers now reset directly to 32px (100%) while preserving full customization steps (`18px` to `46px`).
- **Validation:**
  - `npm test`: 278 unit tests passed across 45 test files.
  - `npm run build`: built in 4.36s with zero errors.

## Remove PiP Auto opacity — 22 October 2026

- Removed Auto opacity, idle/hover fading, mode persistence handling and Auto-only styles. Existing Auto preferences are ignored; the saved manual background slider value is preserved. Locked lyrics remain fully transparent, with existing corner unlock/shortcut behavior unchanged.
- Replaced the Smart opacity regression with `scripts/overlay-opacity-test.mjs`. Isolated Windows native verification passed: no Auto control, stale Auto preference ignored, manual opacity stable while idle/hovered, slider value retained after reload, lock/unlock and reduced motion preserved.
- Validation: production build and 278 frontend tests across 45 files passed. Updated draft release notes. No installer/APK rebuild, release or publication.

## Update entry point and release notes before/after installation - 22 October 2026

- Added Windows desktop Updates immediately after Import in the top bar. Its label reflects available/downloaded updates and download progress; opening/closing the dialog or navigating retains the existing updater store and verified-download state. Settings/About uses the same controls.
- Release notes are shown before download. The target version/notes are saved locally before explicit Restart & Update; only launching that exact version consumes pending notes and opens What's new. Installed notes remain readable after dismissal. Bundled RELEASE_NOTES.md covers manual/Android upgrades and first installed launch; startup reads only native version/local state, with no automatic server check.
- Added a distinct Development build state instead of reporting a configured development build as unconfigured. The existing Windows signed download/signature/install pipeline is preserved, including explicit restart confirmation and failure handling.
- Android About now opens the existing scoped GitHub releases/APK page and explains in-place system installation: same app ID/certificate and higher version code, no uninstall. It does not claim a native APK downloader/silent installer. Stable Android release signing is not configured in the checked-in Gradle release block; retaining the correct signing identity and physical upgrade verification are release-preparation requirements. No keys were read or changed.
- Added RELEASE_NOTES.md as an Unreleased draft. The Windows workflow requires its exact versioned heading before building/uploading and uses it as the release body; updater manifest validation now requires nonempty notes. Current version remains 1.0.4. No tag, workflow dispatch, binary install, push or publication occurred.
- Validation: production build, 276 frontend tests across 44 files, 2 release artifact self-checks; isolated native `scripts/updates-ui-test.mjs` confirmed Import/Updates/Connect ordering, development guard, matching-version post-update notes, retained notes after dismissal and no installer invocation. Screenshot/report in test-results/updates/.
- Deferred as requested: real signed Windows N-to-N+1 upgrade and physical Android APK replacement; no installer/APK rebuilt. Draft notes and the next version must be finalized together before release.

## Expanded Player Light Mode Theme Accent Adaptation — 22 October 2026

- **Theme Accent & Glow Synchronization in Expanded Player Light Mode:**
  - In [expanded.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/expanded.css), resolved an issue where light mode had hardcoded `#1d1d1f` (black) overrides for all primary controls instead of adapting to the active theme accent (e.g. Amber Glow, Ocean Blue, Sunset Rose, Violet, Sage).
  - **Play button:** Now dynamically uses `var(--accent)`, `var(--accent-text, #ffffff)`, and `var(--accent-glow)`, producing an identical glowing accent circular button as seen in the rest of the app.
  - **Seek bar:** Track progress gradient and draggable thumb now use `var(--accent)` and `var(--accent-glow)` instead of hardcoded black.
  - **Active action buttons (Romanization & Translation):** `.expanded-action-btn.is-active` now adopts `var(--accent)` with white icons and subtle glow instead of jet black.
  - **Lyrics toggle:** `.expanded-lyrics-toggle.is-active` updated to a clean frosted glass active state (`rgba(0, 0, 0, 0.08)`) with dark icon, eliminating solid black styling.
  - **Volume slider & Transport toggles:** Volume track/thumb and active shuffle/repeat toggles now use `var(--accent)` and `rgba(var(--accent-rgb), 0.12)`.
- **Verification:**
  - `npm test`: all 274 unit tests passed across 43 test files.
  - `npm run build`: built in 3.68s with zero warnings or errors.
  - `node scripts/expanded-lyrics-test.mjs`: all 8 checks passed.

## PiP Auto opacity with private fixed fallback - 22 October 2026

- Added a persisted Auto toggle beside the existing Background slider. Manual is still the default; its independent saved 0-85 value is preserved. Moving the slider switches back to Manual; disabling Auto restores the manual value.
- Backdrop analysis is unavailable through the current transparent WebView/native APIs without inspecting other apps. No screen capture, permissions, sampling loop, OS hooks or misleading brightness proxy was added. Auto's tooltip explains its fixed readability fallback.
- Auto glass uses 74% opacity, settling to 68% after 2.6 seconds without hover/keyboard interaction; glass transitions over 500ms, without fading the text/controls. DOM hover/keyboard activity restores normal opacity; native hover is used only in locked click-through mode. Lyrics-only lock keeps a transparent background and corner unlock. Context-line/metadata contrast is stronger in Auto; reduced motion still removes transitions.
- Validation: production build and 271 frontend tests passed. Isolated native `scripts/overlay-smart-test.mjs` checked idle/hover opacity, manual preservation, slider-to-Manual, persisted mode, lock/unlock and reduced motion; report `test-results/overlay-smart/report.json`. No background capture or paid services used by testing.
- Limit: Auto does not currently measure other applications' brightness or complexity; it uses the requested fixed fallback and interaction behavior. No installer/APK rebuild or other-platform runtime verification.

## Floating Lyric PiP Overlay Neutral White Hierarchy — 22 October 2026

- **Neutral White Lyric Hierarchy in Floating PiP Overlay:**
  - In [floating-lyrics.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/floating-lyrics.css), updated `.floating-line small, .floating-secondary` from colored accent (`var(--accent)`) to a clean, lighter white (`rgba(255, 255, 255, 0.76)`) with `font-weight: 500` and subtle dark drop shadow (`text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5)`).
  - Aligns with the Lyric room's neutral visual hierarchy (bold white primary line + muted white secondary line).
  - Prevents color clash and peripheral distraction when the floating overlay sits on top of external windows (e.g. browser tabs, code editors, videos).
- **Verification:**
  - `npm test`: all 271 unit tests passed across 43 test files.
  - `npm run build`: built in 4.31s with zero warnings or errors.

## Cover-color ambience in the expanded player ONLY - 22 October 2026

- Scope confirmed by user: desktop expanded player only. The main app, lyric room and dashboard do not mount an ambient layer. Existing layout and artwork presentation are preserved.
- Added AmbientBackground: extracts two population-dominant colors from a 32x32 thumbnail, ignores transparent pixels, favors meaningful color areas over neutral borders, desaturates toward the mean and caches up to 64 palettes. Uses Artwork's existing backend-owned cache/embedded-cover resolution; no direct renderer file access or new dependencies.
- Full expanded-window radial gradients use restrained theme-specific tints, a soft background-only blur and a neutral translucent scrim. Static layers crossfade over 650ms, retire after 700ms and remain bounded during rapid track changes; late image results are ignored. No perpetual drift/blur animation; playback ticks do not resample.
- Missing, failed, timed-out or canvas-inaccessible artwork fades to the neutral theme. Reduced motion removes the fade; reduced transparency, increased contrast and forced colors hide ambience. Covers/text/controls are outside the blurred layer. Removed the old stretched-cover blur and duplicate cover glow.
- Verified: production build, 270 unit tests across 43 files, Edge regression `scripts/ambient-test.mjs` (sampling/cache, crossfade, stale image, neutral fallback, reduced motion, expanded-only scope, light/dark layout and sharp artwork). Reviewed `test-results/ambient/dark.png` and `light.png`. Isolated Windows native app confirmed canvas palette extraction through real cached JioSaavn artwork.
- Not checked: physical Android/macOS/iOS or hardware GPU profiling. No installer/APK rebuilt.

## Expanded Player Time Toggle, Tooltip Z-Index & Translation Loading Spinners — 22 October 2026

- **Total Duration / Remaining Time Toggle (YouTube & Apple Music Pattern):**
  - Updated [PlayerBar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/PlayerBar.tsx) to default the right-hand time in expanded view to total song duration (e.g. `3:56`) instead of remaining time.
  - Made the right-hand time interactive (`.expanded-time-toggle`): clicking it toggles between total duration and remaining time (e.g. `−2:09`), matching YouTube and Apple Music behavior.
- **Seek Hover Tooltip Z-Index Fix:**
  - Resolved z-index conflict where hovering near the end of the seek bar caused the time popup tooltip to be obscured underneath the three-dots button (`.current-track-menu`).
  - Assigned `z-index: 75;` to `.expanded-transport .seek-bar-top` and `z-index: 85;` when `.current-track-menu[open]`, ensuring the hover time popup is cleanly layered above the closed three-dots button while preserving popover layering when opened.
- **In-Button Loading Spinners for Translation & Romanization:**
  - In [LyricsView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/LyricsView.tsx) and [ExpandedPlayer.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/ExpandedPlayer.tsx), replaced static icons with a subtle `<Loader2 className="spin" />` while translation or romanization is actively processing.
  - Provides instant system status feedback without shifting layouts, smoothly transitioning to the active accent pill when lines arrive.
- **Verification:**
  - `npm test`: all 269 unit tests passed across 43 test files.
  - `npm run build`: built in 4.49s with zero CSS warnings or errors.
  - `node scripts/expanded-lyrics-test.mjs`: all 8 checks passed.

## Floating Lyric PiP Overlay Dynamic Theme Sync — 22 October 2026

- **Dynamic Theme Sync for Picture-in-Picture (PiP) Lyric Overlay:**
  - Resolved root cause where the separate `lyrics-overlay` window retained hardcoded sage green (`#c4dca3`) translations/romanizations regardless of user accent settings (e.g. Amber/Yellow).
  - Initialized theme in [main.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/main.tsx) when `overlay === 'lyrics'` by loading `initializeTheme()` before rendering `FloatingLyrics`.
  - Added `--accent-glow` to `applyTheme()` in [theme.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/theme.ts) to ensure glowing text shadows on secondary lyrics dynamically match the active accent RGB channels.
  - Implemented cross-window theme synchronization: [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx) emits `lumaire:theme-change` on settings updates, and [FloatingLyrics.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/FloatingLyrics.tsx) listens to both Tauri `lumaire:theme-change` and web `storage` events, immediately applying the new accent color and glow to the HUD without requiring a window reload.
- **Verification:**
  - `npm test`: all 266 unit tests passed across 42 test files (including new `applyTheme` root variable and `--accent-glow` test).
  - `npm run build`: built in 3.84s with 0 errors.
  - `node scripts/expanded-lyrics-test.mjs`: all 8 checks passed.

## English lyric credit guard and cached paraphrases - 22 October 2026

- Reproduced the screenshot bug: whatlang classified short English rap fragments as uncertain or low-confidence French. They remained eligible for Gemini despite reliable English song context. Replaced the permissive six-word English fallback (which also misclassified Hinglish) with a bounded familiar-English-word check using English context/evidence; unknown Romanized words remain eligible. Section labels no longer make an English song appear multilingual or enter translation batches.
- Added shared `englishLyrics` document guard to automatic processing, direct/manual Gemini and keyless adapter calls, and lyric-layer display. Confirmed English documents skip remote processing and hide existing English paraphrases. Cached language labels account for non-sung section headings. Unknown/mixed songs keep translations; individual English-looking labels are not used as a blanket line-hiding rule.
- Regression coverage: screenshot English lines return from native processing before key/model validation or HTTP; mixed Hindi/English and Romanized Tamil remain eligible; cached English paraphrases disappear; adapter calls for confirmed English make no invokes.
- Verification: frontend production build, native debug build, 265 frontend tests, 4 local language tests and 11 translation/keyless tests passed (2 opt-in live tests skipped). Isolated native app using the screenshot excerpt returned `englishOnly:true`, zero translations and no displayed paraphrase with an invalid model, proving return before key access/model request (`test-results/lyrics/english-no-request.json`). No real Gemini key or paid request used.
- Limit: local language recognition is conservative, not perfect; unfamiliar English and ambiguous Latin text may still need classification. Full-song/physical Android verification and installer/APK rebuilds were not performed.

## Light Mode Green Element Contrast & Bottom Control Panel Hover Circles — 22 October 2026

- **Light Mode Pure White Text & Icons on Green / Accent Surfaces:**
  - Guaranteed `accentText` resolves to `#FFFFFF` in light mode in [theme.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/theme.ts) and added `--accent-text: #ffffff;` token under `:root[data-theme="light"]` in [tokens.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/tokens.css).
  - Fixed active mood filter pills (`.discover-mood-chip.is-active`), playlist play buttons (`.playlist-play-btn`), album hover play buttons (`.album-hover-play`), and modal action buttons (`.hub-primary-btn`, `.add-music-btn:hover`, `.lyric-float-btn.is-active`) to use pure `#ffffff` text, fill, and stroke over green accent backgrounds in light mode, eliminating dark-on-dark illegibility.
  - Replaced hardcoded `#0b0f06` SVG fills with `currentColor` in [DiscoveryHome.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryHome.tsx).
  - Updated card artwork hover play overlays (`.discover-recent-play-overlay`, `.discover-quick-play-overlay`, and `.discover-spotlight-art-badge`) to pure white (`#ffffff`) with subtle drop shadows, ensuring crisp visibility over album covers instead of muddy dark olive green.
- **Bottom Control Panel Circular Buttons & Light Mode Hover Feedback:**
  - Standardized all controls in the bottom player bar (`.transport .icon-button` and `.transport .current-track-menu summary`) to true circular buttons (`width: 32px; height: 32px; border-radius: 50% !important;`), matching the circular geometry of the center play button.
  - Added subtle Apple-style circular hover background in light mode: `background: rgba(0, 0, 0, 0.07) !important; color: #000000 !important; border-radius: 50% !important;` on hover, and `rgba(0, 0, 0, 0.12)` with `scale(0.92)` on active press.
  - Added light mode active toggle pill styling (`rgba(var(--accent-rgb), 0.14)`) and subtle volume control container hover (`rgba(0, 0, 0, 0.05)`).
- **Verification:**
  - `npm test`: all 262 unit tests passed across 42 test files (including new light mode accent text test).
  - `npm run build`: TypeScript & Vite production build completed successfully in 4.88s.
  - `node scripts/expanded-lyrics-test.mjs`: all 8 checks passed.

## Lyric Focus & Manual Browsing Behavior Update — 22 October 2026

- **State-Aware Lyric Focus & Immediate Browsing Readability:**
  - When synchronization is active (`isFollowing = lyricSynced && follow && activeIndex >= 0`), the progressive focus depth gradient applies around the active line (`data-distance="0"` to `"4"`).
  - When the user manually scrolls or browses (`follow === false`), all blur and fading are immediately disabled across all lyric lines: opacity smoothly settles to 0.92, `filter: none !important`, and `transform: scale(1)`. The currently active playback line maintains clean accent coloring so position in the song is clear without obscuring neighboring text.
  - Implemented 250ms cubic-bezier transition curves (`250ms cubic-bezier(0.2, 0, 0, 1)`) for subtle, fluid transitions between focused sync and full-text browsing modes.
- **Robust Manual Scroll Detection & Snapping Prevention:**
  - Added programmatic scroll guards (`isProgrammaticScroll`) in [LyricsView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/LyricsView.tsx) paired with active event listeners on the scroll container (`wheel`, `touchmove`, `pointerdown`, and `scroll`).
  - Distinguishes programmatic centering from user scrolling: manual gestures immediately set `follow = false`, halting auto-centering and preventing scroll snapping while browsing.
- **Subtle Resume-Sync Control:**
  - Displays a subtle, frosted "Back to sync" button with entrance animation (`sync-appear 250ms`) whenever browsing in both the Lyric room (`.lyric-float-sync`) and Expanded Player (`.expanded-action-btn[aria-label="Back to sync"]`).
  - Resuming sync (via the button or clicking any lyric line) smoothly scrolls back to the current lyric (`centerLyricLine` with `"smooth"`), reinstating the focus gradient.
- **Verification:**
  - `npm test`: all 261 unit tests passed across 42 test files.
  - `npm run build`: built in 5.58s without errors.
  - `node scripts/expanded-lyrics-test.mjs`: all 8 checks passed.

## ExpandedPlayer Hover Icon Stability & Apple Light Mode Redesign — 22 October 2026

- **Eliminated Icon Movement & Sub-pixel Jitter on Hover:**
  - Audited all controls in [expanded.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/expanded.css). Removed remaining `transform: scale(1.04)` on `:hover` across `.expanded-close`, `.expanded-fullscreen`, and `.lyric-settings-trigger`. In accordance with Apple Design guidelines, hover is strictly material luminance/opacity change (`transform: none`), while physical compression (`scale(0.92–0.93)`) is reserved for `:active` press.
  - Resolved volume button jump: removed `padding-left: 10px` on `.expanded-volume-control:hover`, set `justify-content: flex-end`, and contained horizontal expansion within `.expanded-volume-slider-wrap` so the speaker button stays anchored to the right boundary with 0px movement.
- **Overhauled ExpandedPlayer Light Mode (Authentic Apple Music System):**
  - Eliminated muddy yellow-beige ambient wash (`rgba(246, 245, 240, ...)`), replacing with luminous Apple canvas `#f5f5f7` and airy frosted gradient (`radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.6) 0%, rgba(245, 245, 247, 0.85) 100%)`).
  - Fixed dark olive play button: replaced murky adapted `--accent` circle with iconic Apple solid dark button (`#1d1d1f`, `#ffffff` icon, crisp shadow).
  - Designed Apple frosted white glass pills for all controls (`.expanded-close`, `.lyric-settings-trigger`, `.expanded-lyrics-toggle`, `.expanded-action-btn`, `.expanded-volume-control`) using `rgba(255, 255, 255, 0.72)`, 20px blur, and specular top highlight (`inset 0 1px 0 rgba(255, 255, 255, 0.9)`).
  - Configured active toggles (`.expanded-lyrics-toggle.is-active`, `.expanded-action-btn.is-active`) as high-contrast solid pills (`#1d1d1f` with `#ffffff` icons).
  - Restored seek bar and volume slider tracks in light mode using high-contrast `#1d1d1f` progress with `rgba(0, 0, 0, 0.12)` background.
- **Verification:**
  - `npm test`: all 260 tests across 42 test files passed.
  - `npm run build`: TypeScript & Vite production build completed successfully in 5.57s.
  - `node scripts/expanded-lyrics-test.mjs`: all 8 checks passed.

## Top-Right Corner Lyrics Settings Portal & Expanded Layout — 22 October 2026

- **Restored Top-Right Lyrics Settings in Expanded View:**
  - Resolved root cause of missing button: `.expanded-lyrics` has `mask-image: linear-gradient(to bottom, transparent 0, #000 36px, ...)` which clipped any fixed-position children positioned at `top: 20px` to opacity 0.
  - Implemented React Portal (`createPortal`) from [LyricsView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/LyricsView.tsx) into `#expanded-lyrics-settings-slot` situated within `<header className="expanded-top-bar">` in [ExpandedPlayer.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/ExpandedPlayer.tsx).
  - Perfectly mirrors the top-left `.expanded-close` button symmetrically across the top chrome with identical Apple styling: 38px circular frosted glass (`rgba(255, 255, 255, 0.08)`, 12px blur), smooth hover/active scaling (`scale(1.05)` / `scale(0.95)`), and top-right dropdown menu placement.
- **Improved Horizontal Space & Measure:**
  - Set `.lyric-line` and `.expanded-lyrics .lyric-lines` to `max-width: 100%`, eliminating unnatural line clipping on wide displays while maintaining Apple balanced wrapping (`text-wrap: pretty; overflow-wrap: break-word;`).
- **Verification:**
  - Production build passed in 5.36s (`npm run build`).
  - Vitest suite passed all 260 unit tests across 42 test files (`npm test`).
  - Integration suite passed all 8 checks (`node scripts/expanded-lyrics-test.mjs`).

## Non-Tech Apple Design Lyrics Settings Overhaul — 22 October 2026

- **Eliminated Technical Jargon & Model Inputs:**
  - Removed technical `Gemini model` input field and draft state entirely; the system uses its verified default configuration without exposing model strings to non-technical users.
  - Replaced technical labels with friendly everyday copy: `AI translation & cache`, `AI TRANSLATION KEY`, and `Auto-translate`.
- **Short, Compact Apple-Style Key Management:**
  - Designed an inline status row when a key is saved: shows `Google AI Key active` with compact Apple pill buttons for `Replace` and `Remove`.
  - Replaced tall mismatched buttons with 28px/34px pill actions with physical press feedback (`scale(0.95)` on active).
- **Consolidated Actions:**
  - Replaced separate "Regenerate with Gemini" and "↻ Re-transliterate song" buttons with a single unified Apple subtle button: `↻ Refresh lyrics & translation`.
  - Cleaned up cache clearing to only show when cache entries exist (`cachedCount > 0`).
- **Verification:**
  - Production build passed in 5.45s (`npm run build`).
  - Vitest suite passed all 260 unit tests across 42 test files (`npm test`).
  - Real WebView2 integration suite (`node scripts/expanded-lyrics-test.mjs`) passed all 8 checks.

## Apple Design Lyric Focus Effect, Typography Measure & Corner Settings — 22 October 2026

- **Apple Music Progressive Lyric Focus Effect:**
  - Implemented progressive focus depth based on relative line distance from the active line (`data-distance`).
  - Active line (`data-distance="0"`, `.is-active`): 100% opacity, 0px blur, `scale(1.02)`, `#ffffff` with Apple glow (`text-shadow: 0 0 20px rgba(255, 255, 255, 0.28)`).
  - Distance 1 (neighbors): 65% opacity, subtle 0.5px blur, `scale(0.99)`—maintains immediate readability while creating natural focal depth.
  - Distances 2–4: progressively recedes (42% / 1.5px, 25% / 2.5px, 14% / 3.5px).
  - Smooth fluid transitions using Apple cubic bezier `350ms cubic-bezier(0.2, 0, 0, 1)` across opacity, filter, and transform with hardware-accelerated GPU compositing (`will-change: opacity, filter, transform;`).
  - Instant direct manipulation: hovering over any inactive line sharpens it immediately (`blur(0px)`, `opacity: 0.88`, `scale(1)`) for easy reading and click-to-seek.
  - Unsynced lyrics remain uniformly crisp with 0 blur and 85% opacity.
  - Accessibility: strictly respects `@media (prefers-reduced-motion: reduce)` (0 blur, 0 scale, fast opacity cross-fade) and `@media (prefers-contrast: more)` (no blur, boosted 72% inactive opacity).
- **Lyric Horizontal Space, Line Measure & Balanced Wrapping:**
  - Bounded `.lyric-lines` and `.lyric-line` measure to `max-width: min(640px, 100%)` (and `min(680px, 100%)` in Lyric room) preventing lines from sprawling across wide desktop displays.
  - Applied Apple display typography: tighter leading (`line-height: 1.3`), negative tracking (`letter-spacing: -0.022em`), and balanced wrapping (`text-wrap: pretty; overflow-wrap: break-word; word-break: normal;`) to eliminate single-word orphan wraps.
  - Rhythmic spacing: unified `padding: 10px 16px; margin: 3px 0;` between verses.
- **Top-Right Corner Lyric Settings Button:**
  - Repositioned `.expanded-lyrics .lyric-settings-fixed-anchor` to `position: fixed; top: 20px; right: 24px; z-index: 50;`.
  - Symmetrically mirrors the top-left `.expanded-close` button (`top: 20px; left: 24px`), establishing spatial consistency across the top chrome.
  - Eliminates visual clutter where the settings button previously hovered over lyrics in the right column.
  - Popover menu drops down smoothly below the button (`top: calc(100% + 12px); right: 0;`).
- **Verification:**
  - Production build passed in 4.84s (`npm run build`).
  - All 260 unit tests across 42 test files passed (`npm test`).
  - Controlled WebView2 expanded lyrics suite (`node scripts/expanded-lyrics-test.mjs`) passed all 8 checks.

## Veezha Veera film-title lyric matching - 22 October 2026

- Root cause: punctuation is already ignored by lyric fingerprints, but the shared query-title normalizer only stripped film annotations when From was followed by a quote. LRCLIB record 39483010 uses `(From OM Chapter 1_ Udhiram - The Blood Wood) [Tamil]`, while the catalog quotes the film name and uses a colon.
- Updated shared Rust lyric identity and frontend source-title normalization to accept bracketed unquoted From annotations, retaining literal song titles such as From Me To You. Search queries and candidate comparison now agree. Existing artist, version and timing validation remains.
- Added Rust identity and provider/mock HTTP regressions for the exact Veezha Veera metadata, wrong artist, duration mismatch and title-only search. Added frontend source-title coverage for quoted/unquoted film suffixes and preserved Live editions.
- Verified: production and native debug builds; 260 frontend tests; 23 native lyric-related tests passed, 3 opt-in live tests skipped. Separate isolated native live lookup with the catalog spelling and 238-second audio returned synced LRCLIB record 39483010 (236-second record, 68 timestamps), report `test-results/lyrics/veezha-veera.json`.
- Not checked: full-song listening/timestamp alignment or physical Android runtime. Installer/APK not rebuilt.

## Lyric section labels and varied song radio - 21 October 2026

- Fixed `parseLyrics` treating every bracketed section label (`[Intro: Asfar Hussain]`, `[Chorus]`) as an invalid timestamp. Labels remain readable; actual malformed numeric timestamps and offset tags still warn. `normalizeCachedLyrics` removes obsolete section-label warnings without changing lyric IDs, timing, translation or user imports.
- Replaced autoplay's same-artist catalog search with account-free song radio via the native `recommend_catalog` command. Resolve canonical seed metadata, use provider radio ranking for style, filter to the seed's catalog language, then apply queue/title exclusions and existing playable-source verification before adding a song.
- Exclude acoustic/reprise/remix/live/slowed/other version decorations when identifying already queued songs. Cross-artist songs are allowed. Non-catalog tracks first match title and artist; Apple IDs match the same song in the radio catalog before use. No model, key, account or new dependency.
- Provider limitation: genre is inferred by its radio ranking, not a verified genre tag. Catalog language can be inaccurate (Maand is cataloged as Hindi despite Urdu lyrics). Unknown-language seeds fail clearly rather than silently selecting a different language.
- Verification: production build and native debug build passed; 259 unit tests across 42 files passed; controlled Edge autoplay hook regression passed. Isolated native app started without panic and `recommend_catalog(saavn:3xTznZdq)` returned 30 Maand radio choices including Faasle, Ik Lamha, Siyah and Kho Gaye from different artists (`test-results/autoplay/native-radio.json`). Mock HTTP radio test verifies seed language, numeric provider order, deduplication, invalid rows, Android radio context and ID validation.
- Reference inspected: https://github.com/sumitkolhe/jiosaavn-api/blob/main/src/modules/songs/use-cases/get-song-suggestions/get-song-suggestions.use-case.ts (endpoint/response behavior only; no copied dependency).
- Not checked: physical Android playback or full live audio for every radio choice. Existing verification still checks selected candidates before enqueueing. Installers/APKs not rebuilt.

## Autoplay Next and verified recommendations - 21 October 2026

- Next at queue end now requests autoplay while paused or playing, as well as on natural completion. Existing queue/repeat priority is preserved.
- Verify up to five related candidates sequentially before enqueueing; skip failed, missing and unresolved tracks. Reuse the existing prepared-stream cache. On exhaustion keep the queue and show a retry message.
- Deduplicate pending Next requests; ignore stale results after track/playback changes, opt-out or unmount. End-of-queue playback failures can continue autoplay.
- Use shared source-title normalization to exclude same-song From/album aliases.
- Passed: production build, 257 unit tests across 42 files, controlled Edge hook regression (`node scripts/autoplay-test.mjs`) for Next, natural end, unavailable fallback, repeated clicks, opt-out and cancellation.
- Not checked: live Manjal Veyil source availability or native/Android runtime playback. No installer/APK rebuilt. A verified source may still fail later during transport.

## Expanded Player Control Buttons Shape & Size Unification — 21 October 2026

- **Fixed Volume Button Shape to True Circle:**
  - Diagnosed oval/egg distortion on `.expanded-volume-control`: `style.css`'s `.icon-button` rule (`width: 32px; height: 32px; border-radius: var(--radius-md)`) was overriding `expanded.css`, resulting in a 32px wide by 40px tall container with `border-radius: 999px` (a vertical oval).
  - Removed `icon-button` from `.expanded-volume-btn` and enforced `width: 40px !important; height: 40px !important; border-radius: 50% !important;` on both the container (when collapsed) and the inner button. On hover, the control smoothly expands horizontally to reveal the volume slider while maintaining clean pill geometry.
- **Unified Action Buttons to Identical 40px Circles:**
  - Removed `icon-button` from `.expanded-action-btn` (Sync, Romanization, Translation) and `.expanded-lyrics-toggle` to eliminate squircle `border-radius: 12px` inheritance.
  - Enforced exact `40px x 40px` dimensions and `border-radius: 50% !important` across all bottom action buttons, guaranteeing identical circle geometry and spacing.
- **Verification:**
  - Production build passed in 3.80s (`npm run build`).
  - All 257 tests across 42 test files passed with `npm test`.

## Lyric Line Visibility & Text Blur Removal (Apple Clean Design) — 21 October 2026

- **Eliminated Text Blur & Frame-Rate Lag:**
  - Removed all CSS `filter: blur(...)` from `.lyric-line` in `src/style.css` and `.floating-line` in `floating-lyrics.css`.
  - Replaced text blur with crisp, legible Apple design opacity styling (`opacity: 0.42` for inactive lines, `opacity: 1` and `#ffffff` with bold `750` for the active line). This eliminates Chromium/WebView2 GPU rasterization repaints during scroll, keeping playback and scrolling buttery smooth without lag.
- **Fixed First Line Visibility in Expanded Player:**
  - Relocated the fade mask from `.expanded-lyrics .lyric-lines` (where content percentage masks scaled to >160px of occlusion) to the viewport container `.expanded-lyrics` with fixed 36px top and 60px bottom edge feathering.
  - Increased `.expanded-lyrics .lyric-lines` padding to `22vh` top and `30vh` bottom, ensuring the opening lyric lines are completely visible and never cut off by top chrome or gradient masks.
- **Fixed Auto-Scroll in Expanded Player:**
  - Added a `followTarget` change listener inside `LyricsView.tsx` to automatically trigger `centerLyricLine` as playback advances while in `ExpandedPlayer`, keeping the active line centered at all times.
  - Added a fallback on mount and track change to center the first lyric line when playback is in the instrumental intro before vocal timestamps.
- **Verification:**
  - Production build passed in 3.75s (`npm run build`).
  - All 253 tests across 42 test files passed with `npm test`.

## Nenjukkul Peidhidum: album recording and synced lyric selection — 21 October 2026

- Reproduced the exact mismatch in the screenshots: JioSaavn album metadata is 369s (6:09), while the previously accepted Sony music-video edit is about 340s (5:40). LRCLIB has plain 339/340s records and many synced full-length 366–372s records. The lyric lookup correctly refused to attach six-minute timestamps to the shorter edit; the earlier audio selection was the underlying error.
- Shared source matching now recognizes language/presentation suffixes such as `Tamil Lyric` and exact album-name prefixes, while still requiring independent artist evidence. Substantially shortened recordings (>max(5s, 2%)) are rejected as album sources. Album playback queues online catalog entries for resolution, and reuse of saved online sources revalidates their extracted duration; prepared streams are reused for playback. Existing offline files are preserved. An explicit `Try album recording` action is available in Lyric room when the loaded audio is shorter than album metadata.
- Fixed provider search to continue after incompatible-duration synced results instead of stopping at any timestamped result. Search stops after a verified compatible synced match; already-found readable results survive failure of a broader query.
- Plain provider caches now get one bounded synced-upgrade check per track/metadata/duration during the session, with an explicit `Check for synced lyrics` retry. Cached text stays visible while checking. Imported originals are never replaced; aligned pronunciation, translation, language labels and model cache are remapped to fresh line IDs, and imported variants prevent incompatible text replacement.
- Strict lyric duration compatibility (2s) and timestamp-range checks remain. An exploratory wider tolerance was removed after live validation found a properly matching source. One earlier source probe reported a discrepant decoded duration and remained plain; no claim of perfect alignment across every stream variant.
- Live Windows verification: selected SonyMusicSouthVEVO full lyric recording `sy_-_bczxJA`; playback clock advanced, decoded duration 370.102857s, LRCLIB returned synced record `34988446` at 370s with 63 timestamp occurrences. Metadata-only evidence: `test-results/playback/nenjukkul.json`; final playback/provider evidence: `test-results/playback/nenjukkul-fixed.json`. No lyric text is logged in these summaries.
- Verification: production frontend build; 253 tests across 42 frontend files; native lyric-provider suite 16 passed / 3 opt-in live tests skipped (mock suite run serially because the provider gate serializes requests); Windows debug build. New regressions cover the actual Sony title/duration pair, continued search past incompatible timing, cache-layer preservation and strict timing bounds. Full-song acoustic alignment, Android runtime and installer/APK rebuild were not performed. No version/release/push; all unrelated WIP preserved.

## Duplicate-safe playlist imports and background download feedback — 21 October 2026

- Import identity now uses normalized provider/playlist IDs, ignoring tracking parameters, YouTube versus YouTube Music host differences, and Apple storefront/title changes. Reimporting the same source adds only new songs, retains local playlist names/order/items, and reports already-imported songs. Imported identities persist through session restore. Already-saved tracks are not rewritten during import.
- Same-name imports from another source (including legacy imports without stored source identity) require Merge songs or Import separately. Explicit merge can combine existing same-name duplicates, retains each song once, recognizes resolved-source versus catalog track identity, and retains all merged source identities. No existing duplicates are removed without that explicit choice. Removed the contradictory optional repeated-song checkbox; repeated matched IDs are skipped consistently.
- Removed download-dependent Play disabling in shared catalog rows and the global busy wrapper around individual catalog downloads. Download/removal actions remain protected while playback, favorite and queue actions stay available.
- Added optional native Tauri progress events: preparing source, connecting, transferred bytes/content length/average speed, and audio validation. Album progress now advances within the current track, displays actual percent/MB/s, and retains existing track counts, failed items, pause-at-track-boundary and cancel behavior across navigation. Unknown byte totals remain indeterminate rather than fabricated. Downloads continue serially; source matching/resolution is distinct from file transfer. No claim that network throughput improved or that the reported delay was a measured connection problem.
- Android downloads now resolve audio through the bundled Android resolver instead of attempting the desktop yt-dlp executable. Scoped resolver headers are validated and used only for allowed HTTPS media hosts; existing file/redirect/size/audio validation and partial-file cleanup remain. M4A/MP4 offline containers are supported; unsupported formats fail explicitly. Android compile check passed with the project-local NDK, but physical-phone download/concurrent-playback behavior remains untested.
- Storage confirmed from Tauri/platform source and existing Windows files: Windows `%APPDATA%\app.lumaire.player\downloads` (Roaming); Android `/data/user/0/app.lumaire.player/downloads` (private app data, not public Downloads). Added this explanation under Settings > Storage & Downloads. Android uninstall/clear-data removes these app-owned copies.
- Verification: production frontend build passed; 249 tests across 41 files passed. Rust downloads tests: 4 passed, 1 opt-in live transfer test skipped. Windows debug build and Android ARM64 `cargo check` passed (one existing desktop-only download helper dead-code warning on Android). Nine Windows WebView2 checks cover real Tauri progress-channel delivery plus controlled transfer UI, playable download rows, album play, navigation, pause/resume, retry/cancel and partial failure. Three browser import checks cover repeat links, explicit separate import and merging legacy duplicates. Native mock HTTP tests verify real byte counts/progress, safe completion and cleanup; no network-speed benchmark or new live full-song download was performed.
- Reports: `test-results/album-download/report.json`, `test-results/playlist-import/report.json`, and `test-results/import-download-*.log`. No installer/APK, version change, release or push. Existing WIP preserved.

## Floating PiP Lyric Panel Apple Design Polish & Lock Opacity Fix — 21 October 2026

- **Preserved User Opacity on Lock:**
  - Fixed `FloatingLyrics.tsx` to respect the user-selected background opacity when locked (`style={{ backgroundColor: `rgb(15 17 14 / ${opacity}%)` }}`) instead of hardcoding `transparent`. When opacity is set to 0, borders and shadows are removed to support 100% borderless text floating over the desktop.
- **Apple Music Lyric Room Styling for Floating Overlay:**
  - Overhauled `.floating-line` typography and depth matching the Lyric Room: active line is bold (`#ffffff`, weight 750, `scale(1.025)`, letter-spacing `-0.024em`) with multi-layered glow (`text-shadow: 0 0 24px rgba(255, 255, 255, 0.42), 0 0 48px var(--accent-glow)`).
  - Inactive lines smoothly recede into the background with subtle opacity (0.36), 1px cinematic blur, and `scale(0.975)` with fluid bezier transitions (`cubic-bezier(0.2, 0, 0, 1)`).
  - Secondary lines (romanization / translations) use Lumaire accent styling (`#c4dca3`, weight 600, `text-shadow: 0 0 18px var(--accent-glow)`).
- **Apple Frosted Glass Materials & Physical Controls:**
  - Implemented Apple frosted glassmorphism on the PiP container (`backdrop-filter: blur(28px) saturate(190%)`, hairline border `1px solid rgba(255, 255, 255, 0.12)`, inner light rim `inset 0 1px 0 rgba(255, 255, 255, 0.16)`).
  - Refined toolbar controls into circular frosted glass pills with tactile feedback (`transform: scale(0.92)` on active press).
  - Formatted the opacity slider to Apple design standards: a smooth translucent capsule track (`height: 4px`) and centered pure white circular thumb with natural drop shadow.
  - Enhanced window title to display track title and artist hierarchy cleanly.
- **Verification:**
  - Production build passed (`npm run build`).
  - All 242 tests across 40 test files passed with `npm test`.

## Arabic Kuthu source matching and Gemini language hints — 21 October 2026

- Reproduced the reported failure with a read-only native engine probe. JioSaavn returns `Arabic Kuthu - Halamithi Habibo` (Beast, Anirudh Ravichander/Jonita Gandhi, 279s); YouTube returns official Sun TV recordings but the matcher rejected their title formatting. The official lyric video has both alternate names in separate pipe segments, Beast and the abbreviated Anirudh credit.
- Updated shared source matching to accept both catalog title parts when each matches an entire video-title segment. Album corroboration now permits abbreviated two-part artist names as well as longer names. Both alternate names, artist/album evidence, duration and recording-version checks remain required. Added regression cases rejecting wrong albums/artists, missing aliases, live and remix recordings.
- Reworded unmatched-source errors to describe a verification failure rather than suggesting the song itself is unavailable.
- Gemini language hints are validated/normalized separately from lyric content. Malformed optional hints no longer discard valid translations/pronunciation; numeric region tags are accepted, duplicates removed, count/length bounded. JSON/line alignment/pronunciation validation remains enforced. Added Rust regression test; no saved key was read or real Gemini call made.
- Verified actual native stream resolution and playback of official Sun TV lyric video `8FAUEv_E_xQ`: playing, clock >1s, duration 282.66s, no playback error. Read-only isolated session; playback stopped after the brief check. Evidence: `test-results/playback/arabic-kuthu.json` and `arabic-kuthu-fixed.json`.
- `npm run build` passed; all 242 tests across 40 frontend files passed. Rust translation suite: 10 passed, 2 opt-in live service tests skipped (mock HTTP requires unsandboxed localhost access). Windows debug build passed. No installer/APK, release, push or version change; full-song playback and live Gemini response quality were not tested.
- Files changed for this fix: `src/domain/source-matching.ts`, `src/domain/catalog-track.ts`, `src/domain/catalog-track.test.ts`, `src-tauri/src/translation.rs`, and this status document. Existing WIP preserved.

## Apple HIG Volume & Range Slider Polish — 21 October 2026

- **Eliminated Clipped Barrel Artifact Behind Slider Thumb:**
  - Diagnosed clipped green square/barrel aura behind the volume slider thumb: `::-webkit-slider-thumb` had a spread glow (`0 0 0 3px rgba(var(--accent-rgb), 0.3)`) and the `<input>` element was constrained to only `4px` height, causing Chromium in WebView2 to clip the thumb's outer glow at the top and bottom edges.
  - Applied Apple Design guidelines: replaced the colored halo with a clean, physical white disc (`#ffffff`) and natural drop shadow (`box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2)`).
  - Increased `<input type="range">` container height to `20px` in `style.css` and `expanded.css` while maintaining a sleek `4px` capsule track (`::-webkit-slider-runnable-track`), giving the thumb full unclipped rendering room.
  - Added gradient fill to expanded player volume track matching the desktop player bar.
- **Verification:**
  - Production build passed in 4.86s (`npm run build`).
  - All 241 unit tests across 40 test files passed with `npm test`.

## Player and lyric controls cleanup — 21 October 2026

- Expanded elapsed/remaining times now span the seek bar and sit directly beneath it. Current-song actions use a fixed-size Ellipsis SVG, stable hover feedback and a visible keyboard focus outline.
- Cover-only expanded mode hides romanization/translation controls. Translation toggles in both lyric views request missing translations through a shared provider selector: saved Windows Gemini key first; keyless translation only without a key. Existing results from the selected Gemini model are reused; Google caches no longer block automatic Gemini processing. Gemini failures never silently switch providers, and errors remain retryable. Confirmed English songs still skip unnecessary processing.
- Removed the duplicate Translate card and Translation display toggle from lyric settings. Restored Original first, Auto-open lyrics and correctly labeled Estimated scroll; restored advanced automatic Gemini, model selection and manual regeneration. Timing, font controls, local romanization and cache management remain.
- Removed the lyric-room processing banner and spaced its eyebrow, heading, metadata and language label. Verified the existing language aggregation includes all per-line detected languages; romanized/code-switched detection remains best-effort. No fabricated language labels.
- Verification: `npm run build`; all 241 tests in 40 files; eight isolated Windows WebView2 checks using synthetic local audio, including seek label geometry, stationary menu hover, hide/show lyric controls, restored settings, contained scrolling and live audio-clock following. Screenshots/report in `test-results/expanded-lyrics/`. Provider priority, cache reuse and failure behavior tested with mocked native responses; no real key or provider call used.
- No Rust changes for this cleanup, installer/APK rebuild, version change, release or push. Live Gemini/Google quality and Android runtime behavior were not retested.

# Lumaire Current Status

## Apple HIG Discover Page Overhaul: Unified Page Heading, Central Searchbar, Crisp Mood Pills & Circular Sync — 21 October 2026

- **Harmonized Discover Page Heading with Rest of App:**
  - Replaced the asymmetrical `.discover-top-bar` and unstyled serif bold `.discover-page-title` with the app-standard `.page-heading` layout (`<p className="eyebrow">ONLINE & CURATED</p>`, `<h1>Discover<span className="heading-dot">.</span></h1>`, and subtitle description).
  - Aligned typography and vertical structure 1:1 with `Library`, `Favorites`, and other core views.
- **Central Apple-Style Searchbar (No Double Boxes):**
  - Integrated a dedicated, centered searchbar (`.discover-search-central`) positioned directly beneath the page heading spanning `max-width: 640px` with ergonomic 44px height, full pill radius (`var(--radius-pill)`), and subtle hairline border (`var(--line-strong)`).
  - Eliminated the awkward nested box-in-a-box widget. The input remains a single clean pill, while recent searches appear as a floating Apple Spotlight sheet (`.discover-search-popover`) beneath it with frosted glass depth (`backdrop-filter: blur(32px) saturate(190%)`).
  - Suppressed default Chromium/global `input:focus-visible` outline and box-shadow on `.discover-search-bar input` (`outline: none !important; border: 0 !important; box-shadow: none !important;`), ensuring only the outer smooth pill displays the subtle accent ring on focus without an inner rectangular box.
- **Removed Muddy Box Glow Behind Active Mood Chips:**
  - Eliminated `box-shadow` on active mood chips (`.discover-mood-chip.is-active`), removing the dark rectangular blur artifact on Windows WebView2. Mood chips are now clean, crisp Apple-style translucent pills.
- **Fixed Sync/Refresh Button Shape:**
  - Explicitly constrained `.discover-refresh-btn` and `.discover-shelf-controls > button.icon-only` to `36px x 36px` with `border-radius: 50%` and removed inherited button `min-height: 40px`, ensuring it renders as a true circle.
- **Verification:**
  - Production build passed in 3.72s (`npm run build`).
  - All 238 unit tests across 39 test files passed with `npm test`.

## Album Card Tight Typography Spacing & Player Bar Status Removal — 21 October 2026

- **Diagnosed and Fixed Gap Between Album Name and Artist:**
  - In `DiscoveryHome.tsx`, `.discover-album-card` uses flex column layout with `gap: 10px`. Previously, `.album-title` and `.album-year` were individual direct children, causing flexbox to inject a 10px gap between the artwork and the title AND another 10px gap between title and artist, plus a 3px margin-bottom on `.album-title` (creating a ~13px gap).
  - Wrapped `.album-title` and `.album-year` inside `<div className="album-card-info">` across `DiscoveryHome.tsx`, `DiscoveryView.tsx`, and `LibraryView.tsx`.
  - Added `.album-card-info` in `style.css` (`display: flex; flex-direction: column; gap: 2px; min-width: 0; width: 100%;`) with `.album-card-info .album-title { margin-bottom: 0; }`. The artwork and metadata now act as the two primary components (10px separation), while the album title and artist/year form a tight, cohesive Apple Music-style text pairing (2px gap).
- **Cleaned Up Player Bar Controls (Removed Redundant Status Pill):**
  - Visually hidden `.playback-state` in `style.css` (`display: none !important;`). The play/pause button icon and its spinner already clearly indicate playback/loading states, removing visual clutter on the right side of the control panel while preserving the DOM element (`[data-testid="playback-state"]`) for integration test assertions.
- **Verification:**
  - Frontend build passed cleanly with `npm run build` in 4.26s.
  - All 238 unit tests across 39 test files passed with `npm test`.

## Contained expanded lyric scrolling and sync recovery — 21 October 2026

- Replaced all three lyric-follow `scrollIntoView` paths (shared engine, lyric mount and expanded-dialog opening) with one helper that centers the line by scrolling only its nearest `.expanded-lyrics` pane or normal `#main`. Parent dialog/document scrolling no longer moves the expanded page or exposes a bottom gap. The desktop dialog has an explicit dynamic-viewport height, non-scrollable clipped overflow, and bounded grid/lyric-pane minimum heights. Reduced-motion behavior is preserved.
- Restored an icon-only **Back to sync** control beside the bottom-right expanded player controls when the user has scrolled away from following. Wheel/touch interaction anywhere in the lyric pane suspends following; the button resumes and centers the current line. It is hidden when lyrics are hidden or timing/estimated following is unavailable. The existing normal Lyric room sync control remains unchanged.
- Verification: production frontend and desktop debug build passed; **238 frontend tests / 39 files**, including three scroll-geometry/missing-container regressions, passed. The real Windows WebView2 test passed five checks: forward/backward seeking without moving the dialog, manual scroll/sync recovery, real audio-clock advancement with smooth motion, lyric hide/show, and independent scrolling in the normal Lyric room with its playback bar still visible. The test uses original synthetic local audio and imported lyrics, including a reduced-motion pass; no live lyric provider or recordings were needed. Evidence: `test-results/expanded-lyrics/report.json`, `expanded.png`; repeat with `node scripts/expanded-lyrics-test.mjs` while the normal Vite desktop dev server is available. Test-session lyrics are seeded on a temporary setup page before App mounts so App's normal persistence cannot overwrite external fixture writes.
- No Rust behavior changes, installer/APK packaging, version bump or release. User data and unrelated concurrent UI work were preserved. Long multi-hour playback and mobile runtime were not tested for this desktop fix.

## Apple HIG Step-Wise Playlist Import Wizard Overhaul — 21 October 2026

- **Applied Apple Design Skill Guidelines (`C:\Users\ARUSH\.agents\skills\apple-design`):**
  - **Spacious 8pt Grid & Breathing Room:** Expanded modal dialog width to `min(640px, 94vw)` with generous `28px 32px` padding, frosted glass depth (`backdrop-filter: blur(40px) saturate(190%)`), and subtle double-ring borders (`border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 32px 80px rgba(0, 0, 0, 0.65)`).
  - **3-Step Focused Wizard Flow:** Replaced the cluttered single-page scroll with distinct steps (`input` -> `matching` -> `review`):
    - *Step 1 (Input):* Clean link and name inputs with platform badges and disclosure for file exports.
    - *Step 2 (Matching):* Centered loader with percentage track bar and cancel button.
    - *Step 3 (Review):* Dedicated review screen with prominent back button, summary badge chips, deduplicate checkbox, and primary action.
  - **Single-Row Horizontal Track Items (Apple Music Style):**
    - Completely replaced the bulky stacked cards with compact 50px horizontal list items.
    - Left: Tabular track index `01`, bold title with ellipsis, and subtitle artist.
    - Right: 250px native-styled Apple popup menu with custom chevron, hover states, and dark option backgrounds on Windows WebView2 to eliminate blinding white boxes.
  - **Intelligent Candidate Auto-Matching & One-Click Batch Action:**
    - Integrated candidate heuristics so tracks with film titles / suffixes (e.g. `Darshana - From "Hridayam"`) automatically match catalog tracks when artist and base title align.
  - **Separated TopBar Actions for "Import" and "Connect":**
    - Split the single TopBar button into two distinct, dedicated buttons:
      - `[ Import ]` (`<FolderInput size={14} />`): opens the Playlist Import wizard directly (`initialTab="import"`).
      - `[ Connect ]` (`<Wifi size={14} />`): opens the Devices & Listening Together panel directly (`initialTab="devices"`).
      - If Wi-Fi sharing is actively broadcasting, the button seamlessly switches to the accent pill `Sharing on Wi-Fi`.
- **Verification:**
  - All **238 unit tests across 39 test files** passed (`npx vitest run`).
  - Production build passed in 4.52s (`npm run build`).


## Support & contribute, and restored normal playback controller — 21 October 2026

- Added a Settings category with real GitHub star/supporter, feedback and contribution links, plus the owner's supplied GitHub, Instagram, LinkedIn and portfolio URLs. GitHub remains the public star counter; no database, analytics, automatic requests, in-app account, local pretend vote counter, or payment processing was added. Payments are explicitly on hold at the owner's request; no inactive donation CTA is shown.
- Added official Tauri opener 2.7.2 JavaScript/Rust bindings for browser handoff, registered on desktop/mobile. A main-window-only capability permits the specified project/profile URLs; arbitrary hosts, shell commands and file-opening permissions remain unavailable. Automatic link interception is disabled to avoid changing unrelated links. Support links retain normal anchor semantics in web builds and show a recoverable error if native browser opening fails. Updated both lockfiles and preserved manually maintained notices while adding opener/open licence notices; the old notices generator would otherwise remove manual native/Android sections.
- Fixed the missing music controller reported across the whole app: App created the shared PlayerBar element but rendered it only inside ExpandedPlayer. Restored its normal-layout mount whenever the expanded desktop dialog is closed (and always on mobile). The expanded view still has a single controller, and closing it restores the normal bar. Added a whole-App render regression for the initially visible controller.
- Verification: production frontend build, **235 frontend tests / 38 files** (including the new Support and whole-App regressions), Rust `cargo check` and native desktop debug build passed. The rebuilt real Windows app passed six checks covering visible controls across Discover/Library/Lyric room, synthetic local playback and expanded open/close restoration, support navigation and eight links, accepted native default-browser handoff, rejected unrelated-host access, and a 390px layout without horizontal overflow. Screenshots/report: `test-results/support/controller-restored.png`, `desktop.png`, `narrow.png`, `report.json`; repeat with `node scripts/support-desktop-test.mjs`. The test opens a public GitHub page, never stars/posts/pays. The currently loaded executable was preserved under a timestamped backup in the ignored build directory to permit rebuilding without terminating the user's app.
- Limits: Android runtime/new APK, installer packaging, actual third-party login/page loads and payments are not verified. No release, version bump, push, or legal-compliance certification. Explained that the existence of similar apps does not establish copyright/service-term compliance and kept the supplied socials as requested. Existing unrelated concurrent work was preserved.

## Searchbar Spotlight Unification, Crisp Category Chips, TopBar Wi-Fi Indicator & Favorite Songs Title — 21 October 2026

- **Unified Spotlight Searchbar (No More 2 Boxes):**
  - Updated [`DiscoveryView.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryView.tsx) and [`style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) so that when recent searches are active, `.discover-search-box.is-expanded` becomes a single, unified frosted Spotlight container (`border-radius: 18px; border: 1px solid var(--accent); box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.18)`).
  - The input seamlessly integrates with transparent background and no borders, and the popover becomes the lower half with a hairline divider. When not active, it remains a single sleek pill.
- **Removed Muddy Background Blur from Mood/Category Chips:**
  - Removed `backdrop-filter: blur(14px)` from `.discover-mood-chip` in [`style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), eliminating fuzzy blur halos/artifacts on Windows WebView2. Replaced with clean, crisp Apple pill styling with subtle border and solid translucent surface.
- **Relocated Wi-Fi Sharing Status to TopBar:**
  - Removed the floating `collection-tools collection-entry` element from `<main>` in [`App.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx) that previously rendered awkwardly at the top right of Discover, Library, and Favorites pages.
  - Added native `.topbar-sharing-pill` inside [`TopBar.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/TopBar.tsx) with a `<Wifi size={13} />` icon, clearly indicating Wi-Fi sharing or listening together, and allowing users to click to open the collection/device hub or stop sharing.
- **Added "Favorite songs" Section Heading:**
  - Added `<h2>Favorite songs</h2>` before the favorite tracks table in [`LibraryView.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/LibraryView.tsx), matching the visual hierarchy of "Favorite albums".
- **Album Hover Play Button Opacity Leak Fix:**
  - Diagnosed why all album play buttons glowed when playing an album: global `button:disabled { opacity: 0.42 }` was overriding `.album-hover-play { opacity: 0 }` whenever `playingAlbum` or `busy` disabled the other buttons.
  - Added strict opacity suppression (`.album-hover-play:disabled:not(:hover):not(.is-loading) { opacity: 0 !important; pointer-events: none !important; }`), ensuring only the hovered card or actively loading album (`.is-loading` with `<Loader2 />`) displays its button.
- **Verification:**
  - All **234 unit tests across 37 test files** passed (`npm test`).
  - Production build passed in 4.92s (`npm run build`).

## Apple Design Playlist Import UI Redesign — 21 October 2026

- **Apple Segmented Control & Circular Close Button (`CollectionHub.tsx` & `collections.css`):**
  - Replaced the misaligned text buttons with an Apple-style segmented pill control (`.hub-segmented` with pill slider `.hub-tab` and `.hub-tab.active`), presenting tabs "Playlist import" and "Devices & listening together".
  - Added a dedicated 30px circular glass close button (`.hub-close`) at the top right, with smooth hover transition and focus accessibility.
  - Reduced the oversized dialog from 820px down to an Apple-standard sheet width `min(580px, 94vw)`, with frosted glassmorphism (`backdrop-filter: blur(40px) saturate(190%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 22px; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.65)`).
- **Apple Typography, Visual Hierarchy & Platform Badges (`PlaylistImport.tsx`):**
  - Replaced the generic serif heading with Apple SF Pro-aligned typography (`font-size: 21px; font-weight: 700; letter-spacing: -0.025em;`).
  - Replaced dense paragraphs of text with a concise subtitle and subtle platform chips for supported sources (`YouTube Music`, `Spotify`, `Apple Music`, `YouTube`).
- **Structured Form Fields & Frosted Inputs:**
  - Encapsulated form controls into `.hub-field` with crisp uppercase labels (`font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em; color: var(--muted);`).
  - Added 42px height inputs with subtle translucent backgrounds, smooth focus rings (`box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.18)`), and integrated icons (`<Link2 size={16} />` for link and `<ListMusic size={16} />` for playlist name).
  - Redesigned the file import disclosure card (`<details className="hub-details">`) with a custom chevron toggle, rounded frosted container, and modern file picker button.
- **Aligned Footer & Primary Action Button:**
  - Pinned the primary CTA to the bottom right with Apple-style action spacing (`.hub-footer`), featuring an accent-pill action button (`Preview playlist` / `Match tracks`) with subtle shadow and glow, and a secondary `Stop matching` button when active.
  - Refined the track matching review list with clear status counters, responsive track info, and custom selects.
- **Full Light Mode Palette Support:**
  - Added complete `:root[data-theme="light"]` overrides for the dialog, segmented control, badges, inputs, details accordion, and preview card.
- **Verification:**
  - All **233 unit tests across 37 test files** passed (`npm test`).
  - Full TypeScript and Vite production build passed cleanly (`npm run build`).

## Favorites Online Add Music Flow & Apple Design Modal UI — 21 October 2026

- **Favorites Online Add Music Support:**
  - Updated [`LibraryView.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/LibraryView.tsx) so clicking `+ Add music` in "Your favorites" (both in the hero action bar and in empty states) invokes `onOpenAddMusic` with target `{ id: "favorites", name: "Your favorites" }` instead of exclusively falling back to the local file picker.
  - Added support in [`useLibraryManager.ts`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/hooks/useLibraryManager.ts#L525-L545) for `playlistId === "favorites"`: online search results added through this flow automatically save to the user's library and are immediately saved into `session.favorites`.
  - Added the `•••` action menu to "Your favorites" with an explicit "Import local files" entry so local file additions remain accessible.
- **Apple Design Add to Playlist / Favorites Modal (`AddMusicModal.tsx` & `style.css`):**
  - **Eliminated Doubled Outline:** Diagnosed and fixed the nested green focus ring caused by global `dialog input:focus` leaking into `.add-music-search-input`. Applied a strict CSS reset (`all: unset !important;`) on the search input and elevated the parent search container to a 44px rounded Apple search field with subtle frosted glass background and smooth accent glow on focus.
  - **Removed Nested Box Inside Modal:** Stripped the harsh 1px bordered dark box wrapper around `.add-music-results-container`. Content now flows naturally inside the modal sheet with fluid padding and typography.
  - **Elevated Modal Surface:** Updated `dialog.save-playlist-modal` to Apple-grade frosted glass (`background: rgba(26, 27, 30, 0.92); backdrop-filter: blur(40px) saturate(190%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);`). Added full light-theme pairing for `:root[data-theme="light"]`.
  - **Apple-Style Quick Search Chips & Row Actions:** Refined genre suggestion chips (`Top Hits`, `Indie Pop`, `Bollywood`, `Hip Hop`, `Synthwave`, `Lofi Beats`, `Acoustic`, `Chill`) with sleek pill styling. Upgraded search result track rows with rounded artwork drop shadows, responsive metadata, and Apple Music-style pill `+ Add` / `✓ Added` badges.
- **Verification:** Full Vitest suite passed **231 tests / 36 files** (`npm test`). Production build passed cleanly in 3.66s (`npm run build`).


- Removed the derived **Saved online** library card and its unused placeholder icon. This changes presentation only: persisted online tracks, playlist membership, favorites, source resolution and download storage are untouched. Local, Downloads and user playlists remain.
- Added a shared accessible small downloaded icon beside available offline tracks in library/playlist/favorites rows, catalog album/artist/search rows, queue, Discover recent tracks and quick picks. Fully downloaded playlist/collection cards and complete album metadata also show the icon. Mixed/empty/unresolved playlists and missing files do not get a misleading full-download badge; long playlist names truncate while preserving their icon. Status updates from current saved-track state, so deleting an offline copy removes the badge.
- Corrected catalog rows treating any download status string as active: completed, cancelled or failed jobs no longer leave permanent spinners/disabled play buttons. Active jobs are matched by catalog or resolved source identity.
- Verification: production frontend build and **231 tests / 36 files** passed, including four new badge/status/collection regressions and updated collection expectations. An isolated Windows WebView2 fixture passed six checks covering removed card, full/mixed playlist indicators, available/missing track indicators, completed-track playability and live removal of badges after offline state changes. Inspected `test-results/downloaded-badges/before.png`; report is `report.json` in the same folder. Native fixtures use metadata, not real download/delete operations. No Rust changes, installer/APK rebuild, release or version bump. Preserved concurrent unrelated work.

## Expanded Player Light Mode, Settings Icon, Single-Line Bottom Controls & Volume Circle — 21 October 2026

- **Clean Settings Icon & Blur/Mask Fix:** Replaced the letter 'T' typography icon in [`LyricsView.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/LyricsView.tsx) with a modern `<Settings2 size={18} />` sliders icon. Relocated the fade/blur `mask-image` from `.expanded-lyrics` to `.expanded-lyrics .lyric-lines`, preventing the top-right settings trigger from becoming faded or blurred.
- **Single-Line Bottom-Right Controls:** Moved Romanize (`<Languages size={17} />`) and Translate (`<Subtitles size={17} />`) toggles directly into `.expanded-bottom-right` in [`ExpandedPlayer.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/ExpandedPlayer.tsx), keeping them on the exact same horizontal baseline as the volume control. Guarded `.lyric-room-floating-bar` with `{!embedded && ...}` in [`LyricsView.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/LyricsView.tsx) so secondary floating controls do not duplicate or misalign inside the expanded modal.
- **True Circular Volume Button & Borderless Hover Slider:**
  - Removed container padding asymmetry from `.expanded-volume-control` so the volume button is a perfect 40px circle when idle (`width: 40px; height: 40px; border-radius: 999px; padding: 0;`).
  - Removed outer borders and capsule track outlines around the volume slider on hover; the native track is completely borderless with a clean accent progress bar.
- **Centered Instrumental State & Clear Copy:** Updated [`LyricsView.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/LyricsView.tsx) to display "This track is an instrumental." rather than claiming the user marked it manually. Styled `.lyric-empty-instrumental` with flex centering vertically and horizontally.
- **Comprehensive Light Mode Overrides for Expanded Player:**
  - Overhauled [`expanded.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/expanded.css) and [`style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) for `:root[data-theme="light"]`.
  - Replaced the dark black gradients with luminous, frosted Apple-style ambient backdrops so artwork colors glow softly without turning into a muddy grey.
  - Fixed font and button contrast: now playing title and subtitle use `#1a1d16` and `#4a5144`; transport buttons (shuffle, prev, next, repeat, close, lyrics) use crisp dark text and subtle translucent glass buttons (`rgba(0, 0, 0, 0.05)`) instead of washed out white opacity.
  - Eliminated blur and fuzzy smudge on inactive lyric lines in light mode (`filter: none; opacity: 0.44;`), ensuring clear legibility across both themes.
  - Zeroed out subpixel bottom gaps in `dialog.expanded-player` (`top: 0; left: 0; right: 0; bottom: 0; min-width: 100vw; min-height: 100vh;`).
- **Verification:** 227/227 Vitest unit tests passed (`npm test`). Full production build (`npm run build`) succeeded in 5.90s.


- Traced the existing album action through catalog source resolution, `useLibraryManager.downloadTrack`, and the native managed-download handler. The existing native path resolves an accessible source, transfers and validates audio, and only then marks the persisted track offline. Previously the album counter changed only after a complete track; it gave little information during the first source search/transfer.
- Added immediate current-song/source-search/saving feedback, an accessible completed-track progress bar, disabled duplicate starts, and accurate completed/failed/cancelled summaries with failed-song details and retry. Progress counts processed tracks, not fabricated byte percentages. One rejected/thrown track does not strand the rest of the batch.
- Moved job ownership to `useAlbumDownloads` in App. Leaving/unmounting an album page or switching tabs does not stop its work; returning restores active/paused/completed progress. Icon-only controls have accessible labels/tooltips: pause finishes the current track before holding the next, resume continues, and cancel aborts the batch and signals the existing native cancellation command. Already completed files remain saved. Source searches may finish before cancellation settles; the UI shows Cancelling rather than claiming immediate completion. Jobs are session-only; app exit/restart does not resume them.
- Verification: production frontend build and **227 Vitest tests / 35 files** passed. The isolated Windows WebView2 harness passed **eight interaction checks**, including active-page unmount/remount, pause/resume, partial failure/retry, cancellation during source search/transfer and while paused, completed-file counts and duplicate prevention. Screenshot/report: `test-results/album-download/saving.png` and `report.json`. Run against the existing dev server with `$env:LUMAIRE_TEST_URL='http://127.0.0.1:1420'; $env:LUMAIRE_NATIVE_TEST='1'; node scripts/album-download-test.mjs` (or omit native flag for Edge). The harness uses controlled callbacks and real current React source in a native window; it does not establish live audio availability for the pictured album or exercise native audio transfer/cancellation end to end. No Rust changes, installer/APK rebuild, release, or version bump. Concurrent unrelated WIP was preserved.

## Player Controls Restoration, BitChord Hover Volume & Human Lyrics Settings — 21 October 2026

- **Removed Non-Functional Fullscreen Button:** Removed the non-functional fullscreen button from `ExpandedPlayer.tsx`, keeping only the close button in the top bar.
- **Synced Lyrics Icon:** Replaced the disparate `MessageSquareQuote` icon in `ExpandedPlayer.tsx` with the unified `FileText` icon used across `PlayerBar.tsx` and `Sidebar.tsx`.
- **Restored Expanded Player Transport Layout & Accent Play Button:**
  - Reordered the expanded transport in `src/components/player/expanded.css`: Title and artist are placed directly below the cover art with the `•••` action menu on the right.
  - The seek progress bar and elapsed/remaining timestamps (`0:12` / `-3:15`) are placed cleanly under the title row.
  - Playback buttons are restored with the prominent green accent play button (`var(--accent)` background with dark `#0b0f06` icon) matching the original design.
- **BitChord-Style Hover Volume Control:**
  - Added a compact speaker button in the bottom right of `ExpandedPlayer.tsx` and `.player-volume-container` in `PlayerBar.tsx`.
  - The volume slider stays hidden until hovered or focused, smoothly expanding to adjust volume.
- **Eliminated Lyric Tab Scrollbars:** Removed visible scrollbars from `.expanded-lyrics`, `.lyric-room`, and the main workspace container (`scrollbar-width: none;`).
- **Sticky Lyric Room Floating Icon Buttons:** Corrected positioning of the bottom-right floating bar in [`LyricsView.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/LyricsView.tsx) to `position: sticky; bottom: 24px; align-self: flex-end; margin-top: auto;`. It remains strictly inside the lyric room viewport above the bottom playback transport bar. Removed all text labels ("Romanize", "Translate", "Back to sync") so only sleek 38px circular glass icon buttons (`Languages`, `Subtitles`, and `RefreshCw`) render.
- **Verification:** 227/227 Vitest unit tests passed (`npm test`). Full production build (`npm run build`) succeeded in 5.81s.


- **Eliminated Above-the-Fold Text Wall:** Removed the bulky 4-line `.page-heading` text banner ("YOUR NEXT LISTEN / Discover new music / Find a favourite..."), redundant "Add local music" / "Open library" buttons, and the greeting banner that pushed album artwork and songs down off-screen.
- **Inline Sleek Search & Focus-Only Recent Searches:** Integrated a modern pill search bar into a compact `.discover-top-bar` alongside the `Discover` heading. The static "Recent searches" section has been removed from the main page flow; recent searches now appear dynamically in a floating popover *only* when the search input is focused/clicked and the query is empty.
- **Front-Loaded Artwork & Tracks:** `Jump back in` (recently played tracks with cover artwork and quick-play overlays) and `Explore albums` (vibrant trending album cards grid) now render directly at the top of the viewport immediately underneath a compact mood/vibe filter bar (`All`, `Top Hits`, `Chill`, `Workout`, `Focus`, `Party`, `Romance`, `Acoustic`).
- **Verification:** 227/227 Vitest unit tests passed (`npm test`). Full production build (`npm run build`) succeeded in 3.69s.


- Lock now hides the background, header, transport, opacity control and resize handles immediately, including when the lock button retains focus. Only lyric text remains. Native cursor tracking reveals a small corner unlock button on hover; only that corner accepts pointer input, while the lyric area remains click-through. Unlocking restores the saved background opacity and controls. Main-player unlock remains a fallback. Status notifications read the current native lock state so a delayed hover event cannot restore stale UI state.
- Added a Windows **Ctrl+Alt+L** global toggle, registered only while the lyric window exists and released on close. Registration uses the existing Windows dependency, no keyboard hook or new package. Shortcut conflicts show an unavailable hint instead of replacing another application's binding. Closing/reopening retries registration safely. Hover/corner hit-testing accounts for display scale and negative monitor coordinates. Controls retain keyboard accessibility and reduced-motion behavior.
- Verification: native isolated lock test passed four checks covering lyrics-only rendering, real cursor-hover reveal/corner unlock, successful native shortcut registration/main-player fallback, and rapid close/reopen registration. Inspected `test-results/overlay-lock/locked-lyrics-only.png` and `hover-unlock.png`; report is `test-results/overlay-lock/report.json`. Full Rust suite passed **107 tests / 10 opt-in ignored**; the final overlay-focused tests passed **2/2**. Final frontend suite passed **227 tests / 35 files**, and production frontend / normal desktop debug builds passed. Logs are `test-results/overlay-lock-*.log`. Test-only cursor permissions live in an ignored config and are excluded from the normal build. Concurrently running debug executables were preserved under backup names in the ignored build directory to avoid interrupting the other development instance; tests used a separate executable copy.
- Limit: the actual global keypress could not be exercised because Computer Use app approval timed out; registration and recovery paths were verified, not physical key delivery. No installer/APK packaging, release, version change or unrelated UI refactor. Concurrent playlist UI work was preserved.

## Playlist Hero Apple Design & Online Add Music Flow — 21 October 2026

- **Clean Apple-Design Hero Cover:** Removed the awkwardly positioned hover play overlay (`.playlist-hero-play-overlay`) from the playlist collage cover. In Apple Music, album/playlist hero artwork remains clean and pristine, leaving playback initiation exclusively to the action row. Obsolete and conflicting CSS rules in `src/style.css` were cleaned up.
- **Refined Action Button Labels & Shapes:**
  - Simplified the primary button from `"Play playlist"` / `"Play favorites"` to simply `"Play"`, eliminating redundant wording.
  - Converted the Shuffle button into an Apple-inspired circular 36px icon-only button (`<Shuffle size={17} />`), matching the action bar height and pill geometry.
  - Styled the `•••` options button into a matching 36px circular button.
- **Online Music Default for Playlists:** Clicking `"Add music"` on an online playlist now defaults to an online catalog search and add flow (`AddMusicModal`) rather than launching the native Windows local file picker:
  - Users can search online tracks in real-time or pick from suggested quick-search chips.
  - Adding a song via `+ Add` immediately saves and links the catalog track to the playlist with an inline `"Added"` badge.
  - Local file import is preserved as an explicit secondary option at the bottom of the modal ("Import local files") and in the playlist's `•••` options menu.
  - Empty playlist state now features `"Add online music"` as the primary action and `"Import local files"` as secondary.
- **Verification:** 227/227 Vitest unit tests passed (`npm test`), including new unit tests in `src/components/modals/AddMusicModal.test.tsx`. Full production frontend build (`npm run build`) succeeded without warnings or errors.

## BitChord-aligned Expanded Player UI Redesign — 21 October 2026

- **Clean Transport Structure:** Removed bottom clutter from the expanded player controls—playback state badge ("PAUSED"), volume slider, queue button, autoplay, floating lyrics, and the duplicate lyrics document button that previously called `setView("lyrics")` and exited the expanded player.
- **Dedicated In-Player Lyrics Toggle:** Added a bottom-left speech-bubble button (`MessageSquareQuote`), reverse-engineered from BitChord. Clicking it toggles lyrics visibility within the expanded player dialog without closing the modal or opening the main lyric room. When lyrics are hidden, the cover art and transport smoothly center in a single-column layout; when open, it presents the two-column split.
- **TopBar Compact Import Button:** Relocated the playlist import / device connection entry point from floating banners at the top of main views into a compact pill button (`FolderInput` + "Import") within the desktop `TopBar` next to the queue toggle. The page header clutter is removed, keeping active Wi-Fi sharing indicators intact.
- **Refined Header & Artwork Micro-Interactions:** Added a top-right fullscreen toggle (`Maximize2` / `Minimize2`) alongside the top-left close button (`X`). The album art now features a soft ambient glow underneath and a subtle pause scale animation (`scale(0.92)` when paused, `scale(1)` when playing) with cubic-bezier transition.
- **Verification:** 226/226 Vitest unit tests passed (`npm test`), including new unit tests for `TopBar` import button rendering and omission. Production frontend build (`npm run build`) succeeded without errors.

## Windows floating lyrics, link imports and Autoplay — 21 October 2026


- Added a separate Windows-only transparent, borderless, resizable, always-on-top lyric window, opened by the picture-in-picture button on the playback bar. It reuses the main player and active lyric layers; its isolated entry point mounts no second audio owner, library manager or translator. Only bounded current/adjacent text and playback state cross scoped window events. Controls fade when unused; background opacity can be zero and is remembered. Pointer/keyboard move and resize, previous/play/pause/next, close, and click-through with a main-player **Unlock floating lyrics** recovery path are implemented. Closing Lumaire destroys the overlay. Untimed/unavailable/instrumental lyrics have explicit states. No dependency or cloud service was added.
- Replaced the dashboard's **Made for your listening** section with opt-in, persisted **Autoplay (∞)** on the playback bar. After the explicit queue ends, the existing catalog supplies one fresh artist-related recording at a time, excluding queued identities and normalized titles while preserving Indic vowel marks. Repeat/explicit queue order win. Resolution uses the existing player; disabling Autoplay, changing tracks or pausing cancels stale requests. Loading and failure feedback are visible. Fixed the React queue-update/selection race discovered during native verification by handing the new selected entry directly to the existing loader. This is basic artist-based continuation, not a Spotify-grade recommendation model.
- Playlist import now starts with **shared public URLs** for YouTube Music/YouTube, Spotify and Apple Music. Original YouTube identities and Apple catalog IDs survive import; Spotify public credits use the existing explicit catalog-match preview. CSV/TSV/M3U are optional under a disclosure. Fixed HTTPS hosts, no credentials/cookies/login, no HTTP redirects, request/page/output limits, at most 500 entries, partial/blocked/private errors and cancellation of stale previews. The shared engine runner now bounds stdout/stderr. A metadata entry is not proof of accessible audio. Spotify access/preview completeness varies; shortened URLs must be opened and copied as full links.
- Simplified playlist/favorites headers to reuse the album layout, typography and buttons, removing the large card, badge and glow. Rename/delete remain in the existing overflow menu. The album/artist page implementations were not changed. Added an explanation beneath the updater's unconfigured state: the public `releases/latest/download/latest.json` endpoint returned **404** when checked. A newer signed stable release, matching manifest and assets must be published before manual **Check for updates** can offer it; no publishing or version increment was performed.
- Verification: **223 frontend tests / 33 files**, production frontend build, **106 Rust tests passed / 10 opt-in ignored**, and native desktop debug build. Android ARM64 compile check passed. The isolated real WebView2 harness passed **nine checks**, including audio-clock lyrics while the main window was actually minimized for ten seconds, native move/resize, click-through recovery, pause/skip/close, album-style playlist layout, public Apple Music link preview/SQLite import of **50 ordered tracks**, public Spotify metadata (**50 entries**) or explicit refusal, rejected unsafe hosts, explicit queue-before-Autoplay playback and disabling continuation at queue end. Autoplay used live catalog metadata paired with original synthetic local audio, not live copyrighted recording streams. A separate native command probe reused the installed engine and imported a public YouTube playlist with its original video identity, without downloading audio.
- Evidence: `test-results/overlay-desktop/report.json`, `youtube-report.json`, `overlay.png`, `minimized-overlay.png`, `playlist.png`, `link-preview.png`; build/test logs are `test-results/overlay-*.log`. Run `node scripts/overlay-desktop-test.mjs` for normal checks. The minimized-window assertion was run with `LUMAIRE_TEST_MINIMIZE=1` and a temporary ignored test configuration granting minimize/unminimize to the test harness; the normal desktop build excludes those permissions. The final normal build additionally passed **three smoke checks**: test permissions rejected, correct empty-player overlay and process exit/overlay teardown when the main window closes (`final-smoke.json`). The Windows native app was used, not just a browser mock.
- Limits: mobile overlay/installed-APK testing, exclusive-fullscreen games, long minimized sessions, multi-monitor pointer interaction and a signed installed-app upgrade remain unverified. Android YouTube playlist reading still needs platform work; its executable-based reader is Windows-only in practice. Public playlist page formats and service availability can change. No installer/APK packaging, version bump, commit, push or release. Existing unrelated work and the Settings backup were preserved.

## Separate ampersand collaboration links — 21 October 2026

- Fixed the shared legacy artist-credit parser, which previously split only commas and treated `Hasan Raheem & Rovalio` as one clickable name. Commas and spaced ampersands now produce independent artist links across tracker, playlists and other shared ArtistLinks callers. Structured artist credits remain authoritative; a group name containing an ampersand stays intact, and missing provider IDs reference that complete group name rather than its first fragment.
- Regression coverage checks three separate buttons for `Bayaan, Hasan Raheem & Rovalio`, structured group-name preservation and an unspaced `R&B` name. Production frontend build and 218 frontend tests / 31 files passed. No native/installer rebuild or manual desktop check for this small parser/rendering fix. Legacy flattened credits remain inherently ambiguous for group names; structured credits avoid that limitation.

## Account-free collections, nearby sessions and PC expanded player — 21 October 2026

- Added a playlist import/device hub reachable from Discover, Library/collections/playlists and active nearby sessions. CSV/TSV and extended-M3U imports have bounded parsing, explicit match preview, manual selection for ambiguous candidates, duplicate control and ordered, non-destructive playlist creation. Native file selection is desktop-only; Android can paste an export. Catalog metadata saves atomically without claiming audio availability; fixed SQLite snapshot classification so these entries are not mislabelled missing local files. Existing queue resolution handles playback. No service sign-in, extension or cookie access.
- Added on-demand personal discovery using explicit favorites and meaningful local listening. Real catalog candidates are ranked locally with duplicate/recent-song exclusion, per-artist diversity and reasons. Artist queries are disclosed; history stays local. No Gemini/LLM call, account or model download for recommendations.
- Added opt-in native private-network sharing: two-hour random pairing links, fixed read-only endpoint, private-IP/peer restrictions, request/response bounds, no redirects/proxies and explicit revocation. Playlist sync is a manual host-to-guest snapshot; repeat syncs are idempotent, untouched copies update, and local conflicts create a device copy. Local files/history/lyrics/keys are excluded. Nearby HTTP is not encrypted: trusted private networks only. Limit: 50 playlists / 500 portable tracks. Default-route VPN/firewall issues are surfaced; no Internet relay or automatic discovery.
- Listening together resolves audio independently on each device, follows host play/pause/position and corrects approximate drift. Pending-resolution cancellation, same-source metadata retention and connection failures are handled; three connection failures pause/stop the guest. No sample-accurate multi-speaker guarantee. Closing the hub keeps a session running; explicit Disconnect revokes it.
- Added **PC-only** cover expansion with anchored motion, ambient cached artwork, existing transport and shared lyric renderer/processor. One audio owner; opening/closing does not restart music. Lyric seeking, Escape, focus restoration and reduced-motion/transparency are supported. Android keeps its existing mini-player with no expand button, covered by a regression test.
- Verification: **216 frontend tests / 30 files**, production frontend build and desktop debug build; **101 Rust tests passed / 10 opt-in ignored**; Android ARM64 native compile check passed (no installed-phone runtime check). The native two-profile harness passed **seven checks**: expanded-player audio continuity/lyric seek/Escape/focus, live catalog CSV preview/duplicates/SQLite reload, real TCP playlist transfer/idempotence, wrong-token refusal, live personal picks, independently cached synthetic audio clock alignment/host pause, and host link revocation. Inspected expanded-player, personal-discovery and pairing screenshots. Run `node scripts/connected-desktop-test.mjs`; evidence is in `test-results/connected-desktop/` and `test-results/connected-*-tests.log`.
- Limits: the runner's virtual-network address was unreachable, so native pairing tests used **two processes on one machine over loopback TCP**, not two physical devices. Playback synchronization used each profile's own synthetic cached audio, not live extraction of an arbitrary service track. Real Wi-Fi/firewall, Android foreground/background behavior, source availability and long sessions remain unverified. The frontend build has a non-fatal >500 kB chunk advisory. No APK/installer release, version bump, commit, push or publishing. Existing unrelated work and the Settings backup are preserved.
- BitChord research confirmed its extension uses signed-in YouTube cookies and Spotify session-derived tokens for private libraries; authentication is inherited from the browser. No extension was installed or source copied. The supplied deployment could not be fetched, so its exact build identity was not established. Usage, source links and scope are documented in `docs/connected-features.md`.

## Album controls and complete collection playback — 21 October 2026

- Added album-header Play, Shuffle, Download and Favorite controls using the existing interface styles. Favorite albums persist in the session and appear as navigable cards in Favorites. Bulk download reuses offline tracks, shows track-count progress, continues after failures and reports partial completion with retry guidance.
- Fixed the shared first-track-only behavior: Discover spotlight/card Play Album now fetches and queues the complete available album tracklist. Album-header playback uses the same path. Playlist/collection Play and Shuffle use the full collection regardless of the search filter, preserving duplicate playlist occurrences.
- Catalog entries remain metadata until selected for playback; the whole queue appears immediately without extracting every source upfront. Source resolution replaces the selected logical track while preserving queue occurrence IDs/order. Pending catalog entries survive session restore. Existing source lookup excludes these placeholders so metadata cannot masquerade as resolved audio. Desktop and Android loading/error states allow the existing queue-skip logic to continue after an unavailable source; stale resolution callbacks are ignored. Explicit autoplay can supersede a paused startup preload.
- Verification: **209 frontend tests / 26 files**, production frontend build and final desktop debug build passed. Four isolated real WebView2 checks used a live 13-track catalog album: header controls, complete ordered queue, shuffle retaining every occurrence, and SQLite reload retaining the queue/favorite. Seven controlled production-browser checks covered both Discover Play Album entry points, actual synthetic WAV end-to-next playback, failed-source skipping, favorite navigation, partial downloads, shuffle/order reset and session reload. Inspected desktop screenshots and a 390px layout without horizontal overflow. Evidence: `test-results/album-native/report.json`, `test-results/album-native/album-queue.png`, `test-results/album-collection/report.json` and its desktop/narrow screenshots.
- Limits: controlled audio/download checks use a synthetic WAV and mocked native bridge; they do not establish live playback/download availability for every catalog track. The native checks used isolated SQLite and real catalog data. No physical Android test, APK/installer packaging, version change, commit, push or release for this task. Existing unrelated work is preserved.

## Unsynced Lyrics: Removed All Blur & Maintained Uniform Normal Styling — 21 October 2026

- **Normalized Unsynced & Estimated Autoscroll Lyrics:**
  - Enforced `filter: none !important`, `opacity: 1 !important`, `transform: none !important`, and `color: var(--text) !important` on `.lyric-lines.unsynced .lyric-line`.
  - Removed all blur and washed-out opacity from unsynced and estimated autoscroll lyrics so the entire song reads cleanly like a natural lyric sheet.
  - Kept `active` line set strictly to `null` when lyrics are unsynced (`!lyricSynced`), ensuring no single line is highlighted or illuminated.
  - Preserved gentle auto-scrolling with `followTarget` during estimated autoscroll without distorting text styles. Real LRC time-synced lyrics retain Apple Music active line highlighting and depth-of-field optics.
- **Verification:**
  - 205/205 Vitest unit tests passed (`npm test`).
  - Standalone production build (`npm run build`) succeeded without warnings or errors.

## Table Column Neutralization & Line Clamping for Artists and Albums — 21 October 2026

- **Artist Names Clamped to 2 Lines:**
  - Added `-webkit-line-clamp: 2`, `display: -webkit-box`, `-webkit-box-orient: vertical`, and `overflow: hidden` to `.search-artist span` in search results. Long credits/names (e.g. multi-line lyricist/composer attributions) now truncate cleanly to 2 lines with an ellipsis instead of wrapping to 5–6 lines and misaligning the artist row.
- **Album Names Restricted to 1 Line:**
  - Separated `.album-title` from `.album-year` in `src/style.css`.
  - `.album-title` is now strictly single-line (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`).
  - `.album-year` (displaying the artist and release year for the album) retains 2-line clamping.
- **Neutralized TRACK / ARTIST Table Area:**
  - Rebalanced `grid-template-columns` on `.track-header, .track-row` from `32px minmax(140px, 1.9fr) minmax(65px, 1fr) 46px 77px;` to `32px minmax(140px, 1.25fr) minmax(90px, 1fr) 46px 77px;`.
  - Reduced excessive void between track title/artists and the `ALBUM` column, pulling the album column closer to ~50% across the table for a balanced, harmonious Spotify/Apple Music-grade layout.
- **Verification:**
  - 205/205 Vitest unit tests passed (`npm test`).
  - Standalone production build (`npm run build`) succeeded without errors or warnings.

## Experimental keyless translation and duplicate-display fix — 21 October 2026

- Added an on-demand “Translate without a key” control in Lyric room, backed by shared Rust networking on Windows/Android. Fixed Google Translate/Input Tools endpoints, bounded requests/responses, two lines in flight, a 90-second deadline, duplicate-line reuse and visible partial/errors. No model download, new dependency, API key, account or automatic Google requests. The source-language selector supports romanized-script recovery; detection remains imperfect. The UI discloses that lyrics are sent to Google.
- Gemini remains available with its existing Windows key management. Android's Gemini path was explicitly disabled by the existing frontend; this new command avoids that restriction without adding mobile key storage. Results retain provider/language provenance in the existing lyric document and protect imported text, concurrent edits, line IDs and timing. Same-language retries reuse completed translations. No user keys or live Gemini calls were used.
- Fixed the mixed-language display report: hide only duplicate full sentences after case/punctuation/whitespace normalization. Different translations remain visible even with an incorrect English label. Added a regression for a mixed sentence falsely labelled English; keyless processing rechecks such hints instead of dropping lines solely on the label. Unchanged unresolved romanized text becomes a visible failure, not a translated-success claim.
- Verification: **205 frontend tests / 26 files**, production frontend build, **96 Rust tests / 10 opt-in ignored**, desktop debug build and **Android ARM64 native compile check** passed. Real isolated WebView2 passed **5 checks**: false-English-label display versus duplicate hiding, immediate pending feedback, actual Google recovery/translation with unchanged timing/existing text, saved results after reload, 390px layout without overflow. Inspected `test-results/keyless-desktop/desktop.png` and `narrow.png`; report/generated harness are under `test-results/`. Synthetic text only; expected missing-engine notice in the isolated profile is unrelated to translation; playback was not attempted.
- Apple Design guidance informed the existing controls, immediate feedback and narrow wrapping. No phone was connected: Android compilation is verified, installed-APK translation is not. No APK/installer packaging, version bump, commit, push or release. Gemini equivalence, full-song quality and unofficial endpoint reliability remain unproven.

## Discover Page Emoji Removal & Hover Fixes — 21 October 2026

- **Removed Emojis for Mature, Elegant Aesthetic:**
  - Replaced cartoon time-of-day emojis (`🌅`, `☀️`, `🌆`, `🌙`) with pure, clean typography (`"Good morning"`, `"Good afternoon"`, `"Good evening"`, `"Good night"`), echoing Apple Music / Spotify's minimalist desktop design.
  - Replaced cartoon mood emojis (`✨`, `🔥`, `☕`, `⚡`, `🎧`, `🎉`, `❤️`, `🌱`) with clean, concise Apple-style typographic pills: `"All"`, `"Top Hits"`, `"Chill"`, `"Workout"`, `"Focus"`, `"Party"`, `"Romance"`, and `"Acoustic"`.
- **Fixed Button & Album Hover Visual Bugs:**
  - **Root Cause:** A global stylesheet rule `button:hover:not(:disabled) { color: var(--accent); }` had a high specificity (`0-2-1`) that hijacked button text/SVG colors on hover.
    - When hovering over the active mood chip, its text turned into `var(--accent)` on top of `var(--accent)` background, making the text invisible.
    - When hovering over the album card's floating play button (`.album-hover-play`), the play icon filled with `currentColor` turned into `var(--accent)` on top of `var(--accent)` background, causing the play triangle to vanish into a solid lime circle.
  - **Fix:**
    - Scoped `.discover-mood-chip:hover:not(.is-active)` with `color: var(--text-strong) !important` and `.discover-mood-chip.is-active:hover` with `color: #0b0f06 !important`.
    - Explicitly locked `.album-hover-play svg` and `.album-hover-play:hover svg` with `color: #0b0f06 !important`, `fill: #0b0f06 !important`, and `stroke: #0b0f06 !important` with optical `margin-left: 2px` centering.
    - Removed disruptive card translation jumps (`translateY(-4px)`), replacing them with smooth ambient shadows and cover zooms for calm, elegant desktop feedback.
- **Verification:**
  - 205/205 Vitest unit tests passed (`npm test`).
  - Standalone production build (`npm run build`) succeeded without warnings or errors.

## Lyric Font Size Fix for Romanized / Transliterated Native Lyrics — 21 October 2026

- **Root Cause:**
  - For songs with non-Latin scripts (e.g., Tamil, Hindi, Japanese), Lumaire generates a transliteration/romanisation layer (`roman`). When transliteration is shown as the primary readable line (`index === 0`), the element receives both `.lyric-roman` and `.lyric-primary`.
  - In `src/style.css`, `.lyric-roman` was written without `:not(.lyric-primary)`. Because it was declared after `.lyric-primary` in the stylesheet, it overrode the primary sizing and shrunk the main lyric line to `calc(var(--lyric-size) * 0.58)` (58% of normal size) and lowered its weight to 550.
  - In contrast, songs already written in Latin script (like English or Latin-transcribed Hindi rap) only had `.lyric-original` at index 0, where `.lyric-original:not(.lyric-primary)` correctly did not match, leaving them at full font size.
- **Fix:**
  - Scoped `.lyric-roman` and `.lyric-translation` rules with `:not(.lyric-primary)`.
  - Now, whichever layer is primary (`index === 0`) always receives full display typography (`var(--lyric-size)`, `font-weight: 700/750`, full text illumination on active lines), while only secondary and tertiary subtitle layers are rendered at 58% and 52% sizes respectively.
- **Verification:**
  - 204/204 Vitest unit tests passed (`npm test`).
  - Production build (`npm run build`) succeeded without warnings or errors.

## Playlist Page UI/UX Redesign (Spotify & Apple Music) — 21 October 2026

- **Dynamic Mosaic Cover Artwork & Playlist Hero:**
  - Upgraded the bare playlist header into a Spotify/Apple Music widescreen `.playlist-hero` layout with ambient theme glow.
  - Dynamically constructs a 2x2 mosaic collage grid from the artwork of the first four distinct tracks in the playlist (or single large artwork for 1–3 tracks, or a stylized gradient for empty playlists).
  - Added a floating circular play overlay on the playlist cover to immediately start playback on hover.
  - Added prominent display typography (`font-weight: 850`, `letter-spacing: -0.03em`), playlist badge, description, track count, and calculated total running duration (`X min Y sec` or `X hr Y min`).
  - Added prominent primary **"Play All"** and **"Shuffle"** action buttons alongside Rename, Delete, and Add Music actions.
- **Tracklist, Empty State & Polish:**
  - Contextualized search/filter bar for playlists (`Find in {playlistName}…`), removing the irrelevant "Add folder" button for playlists.
  - Refined context menu label to "Remove from this playlist" instead of "Remove one from collection".
  - Polished empty state with a dashed card and quick-action buttons ("Explore Discover" and "Add music").
  - Replaced the generic "Your saved sources and files, organized here" footer with an elegant running track & duration summary.
  - Complete responsive and light-mode CSS support.
- **Verification:**
  - 204/204 Vitest unit tests passed (`npm test`).
  - Production build (`npm run build`) succeeded without warnings or errors.

- **Removed Redundant "Online playback is ready" Card:**
  - In `SettingsView.tsx`, the `YouTube Engine (yt-dlp)` row already displays a green `[Installed]` badge on the right when the component is ready.
  - Removed the redundant separate setup card ("Online playback is ready / Ready to listen. No restart needed. / ✓ Installed") by conditionally rendering `EngineSetupCard` only when setup is actually needed (`!engineInstalled`).
  - During setup, installation progress, and error states, the card remains fully active to guide downloads and retries.
- **Verification:**
  - 204/204 Vitest unit tests passed (`npm test`).
  - Production build (`npm run build`) passed with zero errors or warnings.

- **Multi-Platform Synthesized Discover Experience:**
  - **Dynamic Time Greeting (Spotify):** Added contextual time-of-day greeting ("Good morning", "Good afternoon", "Good evening", "Good night") with visual celestial icon.
  - **Mood & Vibe Chips Filter Bar (YouTube Music / Apple Music):** Added horizontal interactive filter chips (`All`, `Top Trending`, `Chill & Lofi`, `Workout & Energy`, `Focus & Study`, `Party & Dance`, `Romantic`, `Indie & Acoustic`). Selecting any mood dynamically queries and displays curated vibe tracks ready for 1-click playback.
  - **Featured Spotlight Hero Card (Apple Music / Nuclear):** Added an Apple Music-style widescreen hero card for the #1 trending album featuring high-res artwork, ambient blurred backdrop, typography, and direct "Play Album" and "Explore Tracklist" buttons.
  - **Quick Picks / Top Tracks Row (YouTube Music / Spotify):** Added direct 1-tap playback tracks from trending releases, showing rank numbers, duration, and full `CatalogTrackActions` without requiring users to navigate into an album.
  - **Spotify-Style Jump Back In Overlay:** Enhanced recently played cards with circular play button overlays that smoothly fade and scale in on hover for instant track replay.
  - **Apple Music Style Album Cards:** Enhanced album grid cards with 1:1 rounded covers, subtle ambient drop shadows, hover lift, cover zoom, and floating circular play buttons to start albums directly from the Discover page.
- **Verification:**
  - 204/204 Vitest unit tests passed (`npm test`).
  - Production build (`npm run build`) succeeded without errors or warnings.

- **Apple Music Lyric UI/UX Redesign:**
  - Removed rectangular box highlight and harsh left border lines on active lyric lines (`border: none; background: transparent;`).
  - Added cinematic optical depth-of-field blur (`filter: blur(1.3px); opacity: 0.32; transform: scale(0.975);`) to inactive lines, focusing the active line (`filter: blur(0px); opacity: 1; transform: scale(1.025);`) with high-contrast text (`#ffffff` / `#111113`) and luminescent glow (`text-shadow: 0 0 28px rgba(255, 255, 255, 0.32), 0 0 56px var(--accent-glow);`).
  - Implemented Apple SF system display typography (`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text"`, tighter tracking `-0.022em`, `font-weight: 750`), rounded line hover targets (`border-radius: 18px;`), smooth bezier cubic transitions (`cubic-bezier(0.2, 0, 0, 1)`), and frosted glass card treatment for the experimental translation card.
  - Replaced jarring `instant` scroll jumps with silky smooth auto-scroll glide (`behavior: "smooth"`).
- **New Track Scroll-to-Top Reset:**
  - Fixed scroll persistence bug where `scrollPositions.current` retained the previous track's scrolled offset.
  - Added track change effects in `App.tsx`, `LyricsView.tsx`, and `useLyricsEngine.ts` to immediately reset the lyrics tab scroll position to `top: 0` and re-enable `follow: true` whenever `track?.id` changes. This ensures the title, artist, and initial lyrics are immediately visible at the top before the first synced line starts.
  - Tapping any lyric line immediately seeks and re-engages synchronized auto-follow.
- **Verification:**
  - 204/204 Vitest unit tests passed (`npm test`).
  - Production build (`npm run build`) succeeded without warnings or errors.

- Corrected inverted Backup & Restore icons in `SettingsView.tsx`: Export library now uses the outgoing `Upload` icon (arrow up) and Import backup now uses the incoming `Download` icon (arrow down).
- Moved "Add local music" and "Open library" action buttons to the page heading actions on the side in `DiscoveryView.tsx`, removing the centrally placed `.discover-shortcuts` block from `DiscoveryHome.tsx`.
- Removed "Open music · Wikimedia Commons" section (`<CommonsDiscovery />`) from `DiscoveryView.tsx`.
- Removed redundant "Playback" tab and shuffle/repeat settings from `SettingsView.tsx` as playback controls are already accessible directly in the player bar controller.
- Clarified recommendation logic: Explore albums does not use device geolocation (respecting local-first privacy), but fetches trending albums from JioSaavn (`content.getTrending`) filtered by the user-selected language in the dropdown.
- Verification: 204/204 Vitest unit tests passed and production build (`npm run build`) succeeded without errors.

## Discover Navigation Reset from Artist & Album Views — 21 October 2026

- Updated `selectView` in `App.tsx` so clicking on the "Discover" navigation tab when an album or artist view is open (`typeof view === "object"`) immediately resets the view to the main Discover page (`"discover"`), resets `discoverRoute` to `"discover"`, and clears `catalogHistory`.
- Updated `onHome` in `App.tsx` to clear `catalogHistory` when clicking the brand home logo.
- Verification: 204/204 Vitest unit tests passed and production build (`npm run build`) succeeded without errors.

## Lyric Attachment & Replacement Removal — 21 October 2026

- Removed manual lyric attachment and replacement UI ("Attach lyrics", "Replace original", "Attach/Replace supplied Latin", "Attach/Replace supplied English") from `LyricsSettings.tsx` and `LyricsView.tsx`.
- Removed manual file upload prompt copy and empty state buttons ("Attach lyrics manually instead", "Attach original lyrics") across not-found, error, and initial empty states in `LyricsView.tsx`, prioritizing automated lookup retries and instrumental tagging.
- Cleaned up unused props (`attach`) from `LyricsViewProps`, `LyricsSettingsProps`, and `App.tsx`.
- Verification: 204/204 Vitest unit tests passed and production build (`npm run build`) succeeded without errors.

## Desktop Queue, Buffering State & Independent Scroll Positions — 21 October 2026

- Removed redundant Queue buttons from the desktop sidebar (`Sidebar.tsx`) and the desktop player bar (`PlayerBar.tsx`), keeping the primary desktop Queue toggle in the top bar (`TopBar.tsx`) while preserving Queue buttons for mobile devices (`mobile`).
- Cleaned up redundant visual labels: removed "On your device / Private by default" from the bottom of `Sidebar.tsx` and the "LOCAL FIRST" badge from `TopBar.tsx`.
- Improved player bar buffering/loading animation: replaced static disabled play button with a smooth rotating Apple-style ring loader (`.player-spinner`), pulsing ambient accent glow (`play-pulse`), and animated loading pill in `.playback-state`.
- Resolved synchronized scroll bug across views: replaced single shared scroll offset in `<main id="main">` with per-view scroll tracking and restoration in `App.tsx`. Switching between Discover, Tracker, Library, Favorites, etc., now preserves each view's individual scroll position.
- Verification: 204/204 Vitest unit tests passed and production build (`npm run build`) succeeded without errors.

## Lightweight translation trial — 21 October 2026

- Expanded the approved alternative research with eight synthetic samples: romanized Tamil/Malayalam/Telugu/Hindi/Japanese/Korean, mixed native Hindi/English and an English control. Direct Google translation failed unchanged on four romanized samples; native-script recovery produced useful Tamil/Malayalam/Japanese output, preserved working Hindi, but Telugu lost a conditional nuance. Korean was misdetected and had no recovery candidate. English was preserved. Informal intended-meaning checks do not establish native-language lyric quality or Gemini equivalence.
- Verified the published IndicTrans2 200M Indic→English checkpoint is 913 MB before runtime/tokenizers and access is gated. Did not download/run weights or add dependencies. Favor further small network-provider experiments over a bundled model; Gemini and app defaults remain intact. No user lyrics/keys were accessed or Gemini quota spent.
- Research evidence: generated `test-results/translation-lightweight-probe.mjs` and `translation-lightweight-results.json`; findings/limits in `docs/lyrics-alternatives-research.md`. The probe completed successfully with bounded live requests after sandbox network restrictions were lifted. No application code changed, so no app rebuild/test rerun was needed. Real lyric review, language detection, line mapping and installed-app integration remain unverified.

## Recently played artwork repair — 21 October 2026

- Found the root cause: native listening-history validation omitted `c.saavncdn.com` from its stable artwork host allowlist, stripping catalogue covers during checkpoints. Added the exact host while retaining HTTPS, no credentials/query/fragment and lookalike-host rejection; covered retention and unsafe URL rejection in the SQLite regression.
- Discover now uses current saved/queued artwork when available. Old records whose artwork was already discarded recover a YouTube thumbnail only from a valid video ID matching their stored provider/track identity. The shared history replay helper also retains that fallback. Existing lazy-loading and disk/in-memory Artwork caches are reused, without additional metadata requests or history migration. Original discarded catalogue covers cannot be reconstructed by this change; legacy rows use video thumbnails until newer catalogue artwork is available.
- Verification: **202 frontend tests / 26 files**, **6 native listening-history tests**, frontend production build and native desktop debug build passed. Isolated real WebView2 check confirmed a real JioSaavn cover survives native checkpoint/read and that both it and a legacy YouTube thumbnail load with nonzero image dimensions in Recently played. Inspected `test-results/recent-artwork/covers.png`; report and generated harness are alongside it. No user history was edited during verification.
- No installer/APK was packaged or published. Physical Android and availability on another network remain unchecked.

## LRCLIB-first lyric fallback — 21 October 2026

- Implemented the approved provider order: keep verified LRCLIB synchronized/instrumental results; try lrc.red after misses/errors or to improve plain text. Preserve LRCLIB plain text if the fallback fails. Outages and malformed data remain retryable errors instead of cached no-source claims. Existing Gemini processing, supplied lyric files, pages, navigation and playback logic were not changed.
- lrc.red uses bounded metadata search and LRC downloads, reusing the existing line parser. Requires title/artist evidence plus recording duration within two seconds, rejects live/remix/cover mismatches through existing identity rules, validates ISRC path characters, ignores malformed candidates and tries up to three verified distinct recordings. Downloads are capped at 512 KiB; primary/fallback lookups have 30/18-second outer deadlines. No key or new dependency.
- Extended provenance to retain lrc.red ISRCs alongside existing numeric LRCLIB IDs. Lyric room/settings display validated provider links; legacy cached LRCLIB documents remain compatible. Updated loading/provider copy. Visual verification caught enhanced-LRC word tags leaking into the reader; the fallback now removes those markers while retaining line timing and lyric text, with a regression assertion. Blank/timing-invalid results are rejected.
- Verification: frontend production build and **201 frontend tests / 26 files** passed. Full Rust suite passed **92 tests / 9 opt-in ignored**; after the final enhanced-LRC correction, all **15 non-live lyric-provider tests** passed again. Explicit native lrc.red live check passed six recordings across Tamil, Malayalam, Telugu, Hindi, Spanish and Korean. Final desktop debug build with production assets embedded passed.
- Real WebView2 verification passed **3 checks**: controlled LRCLIB outage through a child-process-only proxy with real lrc.red HTTPS responses; actual native command → frontend LRC parser → clean synced display/source attribution; saved lyrics/provenance restored without a repeated fallback request. Inspected the final screenshot. Evidence: `test-results/lrc-red-desktop/report.json`, `fallback.png`; generated harness `test-results/lrc-red-desktop-test.mjs`. The synthetic queue recording had no playable audio/engine in its isolated profile; this verifies lyric retrieval/rendering/cache, not listening alignment or playback. No Gemini requests were made.
- This change uses line-timed LRC, not TTML word-by-word rendering. Physical Android and provider availability on another network remain unverified. Version stays 1.0.4; no installer/APK packaging, commit, push or release. The previously open development copy was closed normally to release the build lock; verification used an isolated library.

## Lyric alternatives research — 21 October 2026

- Also sampled lrc.red versus LRCLIB for ten Indian/international recordings, plus a Korean-language control. lrc.red returned rich timed files for several Indian songs; LRCLIB timed out on eight requests, preventing a fair coverage verdict. Found inaccurate language tags, Latin-script variants and live/remix ambiguity. Retain LRCLIB; lrc.red is a candidate supplementary source, not a demonstrated universal replacement. Details and counts are in the research document; no provider change was made.

- User requires Gemini to remain until an alternative demonstrates comparable quality. No lyric-processing behavior, provider or default changed. Findings and sources are recorded in `docs/lyrics-alternatives-research.md`.
- Inspected BitChord's shared implementation and tested keyless Google translation/romanization plus its Input Tools retry on synthetic text. Direct romanized Tamil translation returned unchanged input; native-script recovery repaired this example. Unison translated native Tamil and correctly marked the English control as no-op, but also incorrectly treated untranslated romanized Tamil as no-op and returned no romanization in this sample.
- No Gemini calls, key access, installer rebuilds or product tests were needed for this research. These bounded checks do not establish equivalence, long-term reliability or multilingual lyric quality. Further comparisons and language review remain necessary before recommending replacement.

## Discover home and onboarding — 21 October 2026

- Completed milestone 2 from `docs/implementation-plan.md`, preserving the locally verified setup repair and other uncommitted work. Startup now opens Discover. Discover is first in desktop/mobile navigation, and the brand returns to Discover. Deliberate tab switches still retain open artist/album routes and playback/session state.
- Search appears before setup notices. Added real language-filtered album selections through the existing native JioSaavn metadata connection (up to 12 albums; nine language choices), with provider attribution, manual refresh, bounded native validation and deduplication. Verified the live feed, including its distinct `artistMap.artists` credit format. These are provider selections, not invented recommendations or claims of new releases. Artist/album page implementations and playback pipeline were not refactored.
- Album shelves cache on the device for six hours, share pending requests and retain older results after refresh failure. Malformed cache IDs/artwork/timestamps are rejected. Empty/error states keep search and local-library actions accessible. No account, paid service, telemetry or background polling was added.
- Recent submitted searches are bounded to six, deduplicated, reopenable and clearable. They are not recorded when listening history is disabled and are cleared when it is disabled. Recently played uses the existing local listening records, deduplicates recordings, replays available tracks through the existing handler and disables missing local files/online tracks needing setup. Add local music uses the existing picker and opens the local collection after import; playlist-service import remains a later milestone.
- Apple Design guidance informed the restrained section hierarchy, existing primary/subtle controls, equal-height album captions and responsive two-column narrow layout. Reused Artwork caching/lazy loading and the existing Select control; no new dependency.
- Verification: **199 frontend tests / 26 files** and production build passed; the new native feed regression passed (identity, language, credits, dates, duplicate editions and malformed responses); native desktop debug build with production assets embedded passed. Expanded live WebView2 catalog suite passed **15/15**, including home feed/language → album → Back, artist/album route preservation, real advancing audio, favorites/menus/queue and light/dark themes. Existing UI suite passed **11 scenarios**, including recent local replay, missing-file disablement, cache refresh failure, search replay/clearing, language persistence, disabled-history privacy and 390px viewport without horizontal overflow. Offline behavior uses a controlled provider failure in the browser harness; the native catalog suite uses real providers.
- Evidence: `test-results/catalog/report.json`, `discover-home.png`; `test-results/engine-regression/report.json`, `discover-offline.png`, `discover-narrow.png`. Inspected all three screenshots. Updated existing script startup waits to navigate explicitly to Library when that is what a test needs; no broad playback matrix was rerun unnecessarily.
- Version remains 1.0.4. No new release installer/APK was packaged or published and no source was committed/pushed. The development copy was closed through its normal save-on-close handler to release the build lock; native acceptance ran in an isolated library. Physical Android testing, another-machine setup and a signed updater upgrade remain unverified. Next planned milestone: simple Romanize/Translate lyric controls.

## Windows online-playback setup repair — 21 October 2026

- Implementation order and acceptance gates are recorded in `docs/implementation-plan.md`. Milestone 1 is implemented and locally verified; Discover home, simpler lyric controls, imports, recommendations and connected features remain later milestones. No artist/album refactor or automatic component download was introduced.
- Found shared defects: Discover still instructed users to manage yt-dlp/PATH manually; installation exposed no download events or cancellation, used a single 180-second total timeout and checked hashes without testing executables. Availability used a synchronous native command and only checked file presence. These explain poor feedback and some reliability gaps, but do not establish the exact failure on a friend's machine without its logs.
- Added one setup card in the empty desktop library, Discover and Online Sources. It provides an explicit Enable online playback action, real bytes/per-file percentages when known, connecting/retrying/verifying/testing/activating stages, a moving indicator, Cancel and Retry. State remains in the library manager across navigation. Search and local music remain available while setup runs. Apple Design guidance informed immediate feedback, clear action hierarchy and reduced-motion behavior.
- Native download now bounds connection/header/idle waits, allows active downloads up to ten minutes per request, and makes up to three attempts for transient network/429/5xx failures. HTTP, checksum, file-write and executable-start failures have distinct recoverable messages. Cancellation drops network work and cleans staging; verification and bounded executable checks run before atomic activation. Both yt-dlp and QuickJS are tested; the prior managed set remains recoverable. Pinned official URLs/hashes, HTTPS and size limits remain in force. No new dependency, key, administrator access, PATH modification or security-software bypass.
- Availability checks now run on a worker and test executable startup; PATH discovery no longer launches `where`. Android still uses its bundled resolver and does not show the Windows setup card.
- Verification passed: **195 frontend tests / 25 files**, production frontend build, **87 Rust tests / 8 opt-in ignored**, and native desktop build with embedded production assets. `scripts/component-install-test.mjs` passed **6 real WebView2 checks** using an isolated empty profile and official downloads: first-use entry, native Cancel/cleanup, Retry, actual visible download percentage, duplicate-action prevention/navigation retention, both pinned SHA-256 values and executable startup, persistence after reload and reuse without download. `scripts/engine-regression-test.mjs` passed **10 UI regression scenarios**, including controlled failure/retry, setup state across navigation/restart, local playback/queue, lyrics and themes. Inspected first-use/progress screenshots; the main setup action uses the existing primary button style.
- Evidence: `test-results/component-install/report.json`, `first-use.png`, `progress.png`, `installed.png`; `test-results/engine-regression/report.json`. Initial dev-server runs stalled at a blank WebView; final native acceptance used embedded production assets and succeeded. The UI failure simulation runs in the separate browser harness; real native installation tests do not fabricate failures or success.
- Not yet distributed: changes are local, version remains 1.0.4 and the published preview files are unchanged. A new installer/package and testing on the friend's failing laptop are still needed before claiming that machine's failure is resolved. No broad streaming-provider or physical Android check was repeated for this setup-only change.

## Public README and release presentation — 20 October 2026

- Replaced the historical developer-facing README with a product page: Lumaire logo, GitHub download/issue links, Windows/Android download table, installation/checksum guidance, current features, privacy/provider behavior, source-build commands and honest preview/updater verification limits. Preserved the earlier README in `docs/development-history.md`; no BitChord code, copy or branding was reused.
- Added `.github/RELEASE_TEMPLATE.md` and prepared `release/README.md`, `release/RELEASE-NOTES.md`, `release/SHA256SUMS.txt` for the two existing 1.0.4 preview installers. Both hashes were recalculated and compared successfully. The notes explicitly distinguish these older builds from newer updater source; they must not be paired with a fabricated updater manifest. Source provenance must be established or binaries rebuilt from a reviewed commit before publication.
- Binary assets/checksums/preview notes remain local release material rather than Git source blobs; `.gitignore` allows only `release/README.md` from that folder and the preserved historical document. No application/playback code or signing keys changed.
- Public GitHub lookup returned 404; the authenticated connector confirmed `arushn47/music-player` is private and the user has admin access. The user explicitly authorized making it public. That action remains blocked by tool availability: connector has no visibility-setting command, GitHub CLI is absent, and browser discovery exposes only MCP Apps (no navigable browser). Explained the manual GitHub settings path. No visibility change, source push or binary upload is claimed.
- Validation: exact installer SHA-256 checks passed and changed README/ignore whitespace check passed. No app tests/build rerun for documentation-only edits. Remaining: public visibility, review/commit the current source, rebuild traceable release binaries and publish both platform assets with checksums; an actual installed-app updater test and an original-code distribution license decision remain outstanding.

## GitHub Actions Windows release setup — 20 October 2026

- Added `.github/workflows/windows-release.yml` for stable version tag pushes or manual dispatch with an existing tag. It uses Windows 2022, Node 24, stable Rust/MSVC, locked npm/Cargo dependencies and the inspected official Tauri action pinned to `84b9d35b5fc46c1e45415bdb6144030364f7ebc5`. The existing CLI wrapper forwards arguments unchanged; no wrapper/app/playback changes were needed.
- Confirmed installed/locked CLI **2.12.3** and v2 `createUpdaterArtifacts: true` format: NSIS `.exe` is both installer and updater payload; `.exe.sig` is its updater signature. `.nsis.zip`/`.nsis.zip.sig` are only for `v1Compatible` and are intentionally not requested. Added a release-only config overlay, preserving ordinary builds and the user's configured public key/endpoint.
- Workflow requires signing secrets without printing them, checks tag/versions and checked-out commit, rejects existing releases, builds into a draft, downloads and validates the uploaded EXE/signature/manifest (including exact URL and signature key identity), and publishes only after validation. Only the release job has `contents: write`; no publishing occurs on pull requests or ordinary branch pushes.
- Local verification passed: official actionlint **1.7.12** workflow/YAML validation (download checksum checked), release preflight for `v1.0.4`, **2 Node self-check tests**, **192 frontend tests / 24 files**, production frontend build and native release/NSIS packaging using the real overlay with `--no-sign -- --locked`. The unsigned packaging check generated `Lumaire_1.0.4_x64-setup.exe`; its output explicitly confirmed updater signing was skipped. Signed outputs are verified from CLI source/schema, not claimed as locally generated.
- No private key was read, no key was generated, no version changed, and no release/tag/workflow run was triggered. GitHub-hosted signing/secrets, draft uploads/manifest/publication, and an actual installed-app signed upgrade remain unverified; this is not yet production-verified.
- Exact first-release commands and action/CLI sources are in `docs/windows-release-publishing.md`; `docs/windows-updates.md` links to them. `.gitignore` now allows just these release/status documents so they can accompany the workflow commit; other docs remain ignored. Existing shareable files in `release/` were not replaced.

## Manual Windows updater — 20 October 2026

- Added the official Tauri 2 updater Rust/JavaScript plugins, Windows-only registration and capability, and GitHub Releases endpoint for `arushn47/music-player`. Existing WIP was preserved.
- Settings → About now has a Windows-only updater card with on-demand checks, release notes/date, chunk progress, separate Download update and Restart & Update actions, and a playback interruption warning. State/downloads survive navigating away from Settings. No startup checks, background polling or telemetry.
- Public key is intentionally empty: the card reports "Updates aren't configured" until configured. Missing release manifests/404 cannot report up to date; offline checks and failed downloads/installations remain recoverable. Download completion is not reported until signature verification succeeds.
- Verification: `npm run build` passed; `npm test` passed **192 tests / 24 files**, including 8 updater regressions. Windows `cargo check` and native debug build passed. A real signed upgrade has not been exercised: it needs the retained updater signing key, signed release assets and a published manifest. Existing shareable 1.0.4 EXE/APK files have not been rebuilt for this change.
- Release signing, GitHub Actions secrets, manifest format and real-upgrade checklist are documented in `docs/windows-updates.md`.
- Native desktop smoke check passed in an isolated library: About shows the unconfigured status before and after a manual check, with no false up-to-date message or download/restart controls. The test waits for native WebView navigation before interacting.

## Shareable 1.0.4 release artifacts — 20 October 2026

- Built the current Windows x64 NSIS release installer and copied it to `release/Lumaire-1.0.4-Windows-x64-Setup.exe` (4,828,187 bytes; SHA-256 `95E3C2C322DF524B08283FC043E278FD3EE51991FA7B57C9F22BC8CCF904DECC`). This is the single shareable Windows file and includes install/uninstall handling plus the configured WebView2 bootstrapper. It is not code-signed, so Windows may show an unknown-publisher warning.
- Built the current Android ARM64 release, signed it with Lumaire's retained private release key, verified APK Signature Scheme v2/v3 and zip alignment, and copied it to `release/Lumaire-1.0.4-Android-arm64.apk` (25,299,399 bytes; SHA-256 `06CA13F66610597D8FF4C353F43DF994F7A76DEFFFDC90EEA8A6B09796C24E82`). Package identity is `app.lumaire.player`, version `1.0.4`, minimum Android SDK 26, target SDK 36.
- Installed and launched the signed release on a connected Motorola Edge 50 Pro. The apparent post-uninstall signature conflict was an older `1.0.3` development build still installed inside Android's Vault Profile (user 10); removing that profile copy cleared the package record. Device verification confirms `app.lumaire.player` version `1.0.4` is installed for the primary user and running (PID observed after launch).
- The final frontend production build passed as part of both release builds. The immediately preceding verification passed 184 frontend tests and 82 native tests with 8 explicit network/manual checks ignored.

## Third-party software & licences Apple Design UI — 20 October 2026

- Replaced raw markdown dump in `<details><summary><pre>` with a dedicated, Apple-designed `SoftwareLicencesSection` component in Settings > About.
- Applied Apple Design principles: grouped card panel with squircle icon and count badge, Apple-style segmented control (`Overview`, `Packages`, `Full Licences`), expandable wide/sheet view, live search bar with instant filtering across 175 packages, license category pills (`MIT`, `Apache-2.0`, `GPLv3+`), clickable external links, package license selector, copy button, and high-contrast monospace viewer.
- Preserved full test and locator compatibility (`.software-notices summary`, `.software-notices pre` with MIT license text for `scripts/engine-regression-test.mjs`). Frontend unit test suite passed (179/179) and production build passed.

## Shared playback pipeline repair — 20 October 2026

- Completed the user's systemic playback request without refactoring artist/album pages or navigation. Full provider trace, root causes, implementation and limitations are in `docs/playback-reliability.md`.
- Fixed catalog query/credit parsing, premature browsing filters, candidate extraction fallthrough, short-lived URL handling, bounded media recovery, queue progression and misleading pre-playback success messages. Added local stage/rejection diagnostics and provider-ID validation. No title-specific resolver branches.
- Final frontend suite: **179 passed / 22 files**. Full Rust suite: **80 passed / 8 opt-in ignored**. Production frontend and Windows executable builds passed. Existing desktop catalog/theme/navigation suite: **14/14 passed**.
- Real desktop matrix: **15 catalog recordings played** (11 Saavn, 4 iTunes), plus local WAV and licensed Commons audio. Supplemental **7/7** verified actual unavailable-source extraction, next-candidate fallthrough and UI-owned queue recovery. Combined evidence: `test-results/playback/combined.json` (21 passing scenarios, one Japanese Apple lookup blocked by HTTP 403; no fabricated success). Raw measurement runs and initial failure evidence are preserved.
- Next authorized work: inspect TuneScript source for English-only Gemini avoidance, per-line English translation suppression, and lyric-room source-language labels. Android APK/Windows installer from earlier turns do not include this latest pipeline repair yet.

## Android debug APK build — 20 October 2026

- Android SDK/NDK check passed when the SDK was supplied explicitly as `C:\Users\ARUSH\AppData\Local\Android\Sdk`; no Android device was connected.
- ARM64 debug APK built successfully. Path: `src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk` (SHA-256 `A2D671D34391F3A8A53A0504347ECC0D41DF010A279E60AE436658A3C95F281D`). The Windows no-symlink fallback copied the freshly compiled native library before Gradle packaging.
- This is a debug APK and has not yet been installed or exercised on a physical Android device. Test playback, background behavior, permissions, portrait/landscape layout, artwork caching, lyrics, and offline flows before sharing it widely. Release signing is not configured yet.

## Shareable Windows installer — 20 October 2026

- Built the current NSIS installer successfully: `src-tauri/target/release/bundle/nsis/Lumaire_1.0.4_x64-setup.exe` (4.54 MiB). It is configured for per-user installation with uninstall support and WebView2 bootstrapper handling.
- The installer was generated successfully but not installed on a separate clean Windows machine. It is unsigned, so Windows SmartScreen may show the standard publisher warning.

## Discover album-card alignment — 20 October 2026

- Discover album titles and artist/year metadata are capped at two lines with reserved equal-height slots, keeping cards aligned when releases have many credited artists. Full text remains available through the native hover tooltip and the existing accessible album button label.
- This is a presentation-only change; catalog credits and album data are not truncated or rewritten. Mobile remains deferred.

## Machayenge / Firse Machayenge playback matching — 20 October 2026

- Reproduced live: original Machayenge (`7tNPxY_ntEA`, 181s versus catalog 152s) was excluded by native music classification because its title uses a producer credit, not an official-video label. Its `EMIWAY- MACHAYENGE (PROD BY.TONY JAMES)` punctuation also prevented the previous title parser from matching it. Firse Machayenge (`zaCbuB3w0kg`, 243s versus catalog 207s) exceeded the previous 31s duration tolerance.
- Native music filter now recognizes artist/song titles with parenthesized producer credits while retaining nonmusic exclusions. Online title parsing handles separators with whitespace on only one side and removes parenthesized producer annotations. A bounded extra video-duration allowance (25%, capped at 60s, longer videos only) applies to official-video titles with a matching artist channel; title/credit/version validation still applies. Other uploads retain the original tolerance. Channel-name matching is supporting evidence, not a verification badge or proof of uploader identity.
- Added regressions for both real titles and rejection of unrelated channels, excessive duration, remixes and sequels. Frontend build and **157/157 unit tests** passed; all **3 native ytdlp tests** passed. Windows debug and release builds passed.
- Live isolated WebView2 suite passed **14/14**, including both reported songs playing from Emiway Bantai's artist page with advancing playback clocks. Evidence: `test-results/catalog/report.json`, `machayenge-playing.png`, `firse-machayenge-playing.png`. First attempted run hit a duplicate-name test selector; corrected selector and full rerun passed.
- Mobile remains deferred. Other unavailable or differently labeled recordings can still fail matching; no broad fuzzy-title acceptance was added.

## Emiway Bantai legacy credit correction — 20 October 2026

- Root cause: legacy online metadata retained the short credit `Emiway`; artist name lookup required an exact catalog credit, while Saavn credits `Emiway Bantai`. Earlier profile-only reconciliation did not cover that legacy alias reliably.
- Added the user-requested exact alias correction for `Emiway`/case variants of `Emiway Bantai` to the full name. Shared artist links, new YouTube source metadata, canonical catalog tracks and profile enrichment use it. Existing saved YouTube tracks repair through the existing startup persistence path even with catalog provenance. Local tags remain untouched; collaboration credits and IDs remain intact. This explicit correction supersedes the earlier no-alias-table description for this artist only; unrelated names such as `Emiway Tribute` are unchanged.
- Backend accepts old `saavn:artist:name:Emiway` links and searches the full credit without fuzzy prefix matching.
- Frontend build passed; **155/155 unit tests** passed. Native alias regression passed. Rebuilt debug desktop and live isolated acceptance suite passed **13/13**, including a real legacy-name lookup returning Emiway Bantai with tracks and a persisted short credit repairing after reload. Existing portrait comparison also passed.
- Windows release rebuild passed and the rebuilt app was reopened with the normal library. Mobile remains deferred. The exact alias correction intentionally does not infer expansions for other artist names.

## Desktop verification and Windows rebuild — 20 October 2026

- User authorized desktop verification/rebuild and deferred mobile. Approval service is working again; the earlier quota blocker below is historical.
- `npm run desktop:build` passed, producing `src-tauri/target/release/lumaire.exe` (Windows standalone release, no installer). Debug desktop build also passed after gracefully closing the running development app that locked its executable.
- Native WebView2 acceptance suite passed **12/12 checks**, with no uncaught renderer errors, in an isolated test library using live providers. Verified search-only entity sections, custom artist portrait, all 15 ordered album tracks, tab/scroll retention, audio clock progression, Favorite/full menus, queue persistence, artist/collaborator navigation, recoverable ID errors, Light/Dark themes, clearing search, and Favorites/Tracker Back-to-origin navigation.
- Added a loaded-image comparison: Tracker KR$NA portrait and the opened artist page have identical image URLs; it passed. Inspected fresh artist-dark, album-light and Tracker portrait screenshots. Theme testing now uses actual Settings controls instead of a development-only module import.
- Current evidence: `test-results/catalog/report.json` and PNGs from this 20 October run supersede the older report. Previous frontend build and **153/153 unit tests** remain valid; this turn changed only the desktop verification script and this status document.
- Mobile, installer packaging, and narrow-window layout verification remain deferred/unverified. Source outages may still leave missing artwork where neither provider has a portrait.

## Consistent Catalog UI, Global Navigation and Artwork — 20 October 2026 (desktop recheck completed above)

This section supersedes the 19 October verification for the files changed below. The user subsequently authorized global artist/album links, metadata consistency, Tracker portraits, removing Similar artists, and replacing catalog queue shortcuts with Favorite plus the existing full action menu.

### Changes

- Applied the explicitly requested apple-design skill (C:/Users/ARUSH/.agents/skills/apple-design/SKILL.md). Artist/album pages now use Lumaire's existing heading scale, main-page spacing, pill buttons, IconButton, track rows, and collection cards. Removed duplicate global typography/table/button rules that were causing the pages to differ from Library/Discover. Retained keyboard focus, reduced motion/transparency preferences, Light/Dark tokens, and page retention across tabs.
- Removed Similar artists from ArtistView; no replacement recommendation section.
- Added shared CatalogTrackList and CatalogTrackActions. Discover/artist/album rows use Favorite plus the three-dot disclosure, with save/remove from library, download/delete offline copy, Play next, Add to queue, Refresh metadata, and Save to playlist. These call the existing library/playback/confirmation flows; favorite/offline state follows the saved source's catalog provenance.
- Added tested catalog name-search references and shared AlbumLink. ArtistLinks supports older unstructured credits and individual collaborators. Library/playlist/favorite rows, queue, player, Lyrics, Commons results, and Tracker credits now navigate to Lumaire artist pages. Library albums and Tracker album rankings navigate to album pages. Tracker rankings open the appropriate artist/album; top tracks still replay. Back returns to the originating tab/playlist, and unknown metadata does not generate misleading links.
- Legacy credit fallback assumes commas separate collaborators. Provider-specific entity IDs are used where supplied; otherwise explicit search locators are used, not invented numeric entity IDs.
- Online saved tracks reconcile catalog metadata once in the background after startup. Artist names come from matching provider artist IDs/profile names, not a hardcoded alias table. Failed or mismatched identity lookups retain the existing credits, collaborations remain intact, local file tags remain untouched, and known catalog sources retain their saved artist spelling when reused. Tracker already overlays current saved metadata on historical rows; listening durations/play counts are not rewritten. Verified public references show Emiway Bantai and KR$NA as the artist-profile spellings.
- Artist profile requests share a bounded session cache and allow retry after failure. Tracker artwork requests are viewport-gated. Follow-up on 20 October: Tracker now requests the same catalog profile portrait as artist-page navigation first, fixing the previous Commons-first priority that could show different pictures. Commons is the fallback when the profile has no portrait or its lookup fails, retaining attribution. Missing portraits remain placeholders rather than unrelated album artwork.
- Artwork continues to use native disk caching, browser lazy loading, and async decode. A small resolved-path cache avoids remount placeholder flashes. New cache misses request AVIF/WebP where supported; cached bytes retain their actual source format (no blanket WebP conversion or new codec dependency). Native downloads are bounded to four at a time, with serialized cache writes/pruning; host/redirect/MIME/size/path validation and the existing cache budget remain in place.

### Verification completed for this revision

- Final npm run build passed.
- Final npm test passed: **153/153 tests across 20 files** after the Tracker portrait follow-up. Added checks for portrait priority, missing-profile-image and failed-request fallback, unchanged album lookup, catalog name locators, unknown metadata, artist ID/name matching and failed lookups, shared profile request retry/caching, full menu states, favorites/offline labels, and legacy collaboration links.
- Native cache regression test passed: artwork_cache::tests::artwork_locations_and_eviction_stay_in_the_managed_cache. The native test target compiled successfully with the new semaphore/header/write-lock changes. No full native network suite rerun for this revision.
- git diff --check passed for touched tracked files.
- Updated scripts/catalog-desktop-test.mjs for shared row selectors, the menu's queue action, Favorite/full-menu state, and Favorites/Tracker redirects with Back to origin. These new desktop checks have **not run**.

### Blocker / next action

- Automatic approval review failed before the desktop test could execute, reporting the approval service's account usage limit (retry time reported as 25 October 2026, 06:45). This was an infrastructure review failure, not an unsafe-action determination. Do not bypass the failed approval gate.
- The earlier test-results/catalog/report.json and PNGs describe the previous 19 October run, not these latest changes. Do not cite their 10/10 result as verification of this revision.
- Once approval access is restored, rebuild/start the debug desktop app and run node scripts/catalog-desktop-test.mjs with the dev server available. Visually inspect artist/album pages in Light/Dark and narrow layouts; exercise Favorite/full menus, playlist/Tracker/player/queue/Lyrics links, canonical-name reconciliation, and portrait loading. Android and packaged installer validation are still outstanding.
- Source/provider outages can leave original unverified names and missing portraits. Images are not guaranteed WebP or universally smallest; no claim of all-WebP assets or measured transfer-size savings.

## Artist/Album Reliability and Discover Search — 19 October 2026 (verified in desktop)

This section supersedes the older artist/album implementation notes below. Global artist-link expansion remains deferred.

### Root causes reproduced

- The previous debug executable returned **Invalid artist data** from **album lookup**. The parser required top-level primary_artists, but the real response supplies more_info.artistMap credits. It also expected songs instead of the actual list track array. URL encoding was not the cause of this error.
- Numeric Saavn artist IDs were interpreted as artist names and searched as numbers. Names, real provider IDs, and search references were mixed together; substring credit matching could also admit unrelated artists.
- ArtistView/AlbumView passed an empty play callback to saveDiscovery, producing a Playing notice without invoking playback.
- A single top-level view value discarded the open artist/album route when switching to Lyrics or another tab.

### Implementation

- src-tauri/src/catalog.rs: normalize real provider artist/album IDs, resolve numeric artists with artist.getArtistPageDetails, retain older encoded-name links explicitly, use exact credited identity, preserve collaborations, deduplicate releases and tracks, parse nested album credits/list, preserve provider ordering, validate returned entity identity, and use existing bounded HTTP retries.
- Missing album IDs use an explicit title-and-artist search reference. Exact matches resolve to the real album endpoint when possible; ambiguous releases are rejected. Search-only track lists are marked partial. Older unknown:title links without an artist return a specific recovery instruction rather than unrelated tracks.
- src-tauri/src/itunes_metadata.rs: retain album artist credits, reject unavailable entities, and order album tracks by disc/track number rather than track ID; add a focused ordering regression test.
- src-tauri/src/lib.rs and src/adapters/native.ts: register/expose separate artist-and-album entity search and share the normalized album/credit contract.
- src/components/views/DiscoveryView.tsx: Artists and Albums sections appear only after an explicit search; results use the provider's actual entity searches. Clear Search removes them. Partial service failures preserve the other results. Artist credit buttons are no longer nested inside a playback button.
- src/components/views/ArtistView.tsx and AlbumView.tsx: Lumaire-rendered pages use shared Artwork, structured artist links, keyboard-operable release cards, working per-track play/queue actions, retry/empty states, and cancellation guards. Artist artwork uses an available portrait rather than a song cover.
- src/App.tsx: shared catalog playback handler, artist/album Back history, and a retained Discover route/page when visiting other tabs. Returning to Discover restores the album immediately, including its scroll position.
- src/style.css: scoped, compact search cards and page styles use existing theme tokens; undefined page color/radius/shadow references were corrected. No replacement branding, embedded provider website, or new dependency.

### Verification completed

- npm run build: passed on final source.
- npm test: **142/142** frontend tests passed.
- Native library suite: **78 passed, 8 existing live/provider-key tests ignored, 0 failures**. Includes 11 catalog tests and the Apple album ordering test.
- Native debug executable rebuilt successfully; real WebView2 started without a panic.
- node scripts/catalog-desktop-test.mjs: **10/10 passed** against the real public catalog and streaming engine, using a separate SQLite/session directory. No mocked provider responses in this desktop suite and no changes to the user's library.
- Desktop flows actually exercised: explicit KR$NA search; artist portrait/popular tracks; Yours Truly with all 15 tracks and the first four in provider order; Sensitive playback with advancing media clock; Knock Knock queued and confirmed in native session persistence; album artist link and Back history; Dhanda Nyoliwala via Boom Shaka collaboration; unsupported artist/album IDs; older encoded-name artist lookup; Light/Dark screenshots; Lyrics/Library tab round-trips without album reload and with restored scroll; direct Discover album card lookup; Clear Search removing entity sections.
- Visually inspected real desktop album screenshots in Light/Dark and search/artist artwork. Reports/screenshots: test-results/catalog/report.json and adjacent PNGs. Initial isolated attempts exposed transient catalog connection failures; the final complete run passes with the existing bounded HTTP retry path.

### Remaining limitations / not checked

- Search/provider lists represent available releases, not a guaranteed complete discography. Optional portraits, biography, related artists, and years remain source-dependent. No biography is fabricated.
- Catalog and online playback still require an internet connection; service/stream availability can change. Partial or ambiguous album searches are identified rather than presented as complete releases.
- Page retention is within the current app session, not across an app restart.
- No new bulk Play/Shuffle workflow, global artist-link expansion, Android device run, packaged installer rebuild, audible-output confirmation, or screen-reader audit in this task.

## Playlist Cover Grid Layout (YouTube Music style) — 19 October 2026 (complete)

Updated playlist collection artwork in `src/components/views/Collections.tsx` to match YouTube Music's 2x2 quad mosaic rules:
- **1 song:** 1 full cover filling the whole card.
- **2 songs:** Alternating diagonal pattern `[A, B, B, A]` filling all 4 quadrants symmetrically.
- **3 songs:** First song repeated in 4th quadrant `[A, B, C, A]` to complete the 2x2 square.
- **4+ songs:** Standard 4-cover quad mosaic `[A, B, C, D]`.
Verified with `npm run build` and `npm test` (all 142/142 tests passing).

## Multi-Artist Navigation — 19 October 2026 (complete, restart required)

**Issue:** Multi-artist tracks like "Emiway Bantai, KR$NA" displayed combined artist names as a single link, preventing navigation to individual artist pages.

**Fix implemented:**
1. Extended `CatalogTrack` with `artists: CatalogArtistCredit[]` array containing individual artist objects with names and IDs
2. Saavn `track()` extracts all `primary_artists` with individual IDs from API response
3. iTunes `catalog_track()` populates single-element array for consistency
4. DiscoveryView renders each artist as separate clickable link with comma separators
5. Artists without IDs display as plain text; those with IDs become clickable

**Example:** "Emiway Bantai, KR$NA" → [Emiway Bantai](#) , [KR$NA](#) (each individually clickable)

**Verification:**
- ✅ TypeScript build passed
- ✅ All 142 frontend tests passed
- ✅ Rust compilation successful

**Manual testing required:**
1. **Close and restart** `npm run desktop` (Rust backend must reload)
2. Search "Boom Shaka" or "Hola Amigo" (multi-artist tracks)
3. Verify each artist name is individually clickable
4. Click different artist names to confirm separate navigation
5. Test album links still work
6. Test single-artist iTunes results (e.g., "Jack Johnson")

**Limitation:** Saavn artist pages still show "not yet implemented" error (API has no artist detail endpoint).

## Artist & Album Navigation Fix — 19 October 2026 (implementation complete, manual UI testing needed)

**Root cause diagnosed:** The previous implementation added clickable artist/album links that only worked for iTunes catalog results. Saavn results (like KR$NA searches) had `artist_id: None` and `album_id: None`, so no links were rendered.

**Investigation revealed:** The JioSaavn API **does** return artist and album IDs in the `more_info.artistMap.primary_artists[].id` and `more_info.album_id` fields, but the catalog.rs code wasn't extracting them.

**Fix implemented:**
- Extended Saavn `track()` function to extract artist ID (first primary artist) and album_id from API response
- IDs prefixed as `saavn:artist:{id}` and `saavn:album:{id}` to distinguish from iTunes IDs
- Implemented Saavn album lookup using `content.getAlbumDetails` API endpoint
- Saavn artist lookups return clear error (API doesn't expose dedicated artist endpoint)
- Both iTunes and Saavn album pages now work; only iTunes artist pages work
- Clickable links now appear for both Saavn and iTunes results where IDs are available

**Verification completed:**
- ✅ TypeScript build passed
- ✅ All 142 frontend tests passed
- ✅ Rust library compilation passed
- ✅ Album ID and artist ID extraction tested with modified test data

**Manual testing required** (cannot be automated):
1. Close and restart `npm run desktop`
2. Search for "KR$NA" or "Sensitive"
3. Verify artist names and album titles are now clickable buttons
4. Click album title → should open Saavn album page with tracklist
5. Click artist name → should show clear "not yet implemented" error for Saavn artists
6. Search for "Jack Johnson" (iTunes result)
7. Click artist name → should open iTunes artist page with top tracks and albums
8. Click album title → should open iTunes album page
9. Verify playback, queue actions, back navigation, and theme consistency

**Known limitations:**
- Saavn artist pages not implemented (API doesn't provide artist detail endpoint)
- Only first primary artist gets navigation link (multi-artist tracks link to first)
- Album lookup requires valid ID; ambiguous names don't have fallback search

## iTunes metadata compile repair - 19 October 2026

Fixed artist and album catalog lookups after `request` became typed as `Vec<Song>`: album fields are deserialized on `Song`, and lookups no longer call raw JSON methods on typed values. Focused native validation passes (10 iTunes metadata tests).

## Catalogue-first metadata — 19 October 2026 (in progress)

User reported the progressive verification list visibly changing. Installed Nuclear plugin analysis confirms separate catalogue track search and lazy YouTube source/stream resolution. Lumaire now adopts that separation with the public Apple music catalogue, preserving existing YouTube IDs and explicit library membership. Canonical metadata identity persists through queue/session and native saves; automatic source enrichment cannot overwrite it. REA evidence is retained in `nuclear-metadata-rea-evidence.json`. Verification and updated release builds are in progress.

## Release repair and metadata verification — 19 October 2026 (complete)

The reported APK rejection was reproduced: 1.0.0 is a downgrade from the phone's retained 1.0.1 package, and the release certificate also conflicts with its development certificate. A non-debuggable 1.0.2 build signed with that existing development key installed successfully in main Android user 0 after explicit user approval. User 10 remains installed; no uninstall/data clear/downgrade override was used. The public share APK keeps the separate release certificate.

Windows missing online covers came from rendering remote artwork before the native cache resolved and retaining its failure state. Native cache is now tried first, transient failed cache requests can retry, and supported Last.fm/Wikimedia thumbnail hosts are allowed. Actual installed-app verification shows all eleven online collection images load. The linked local Snowman file has no available embedded cover and retains a placeholder.

Windows Search shortcuts created from a packaged launcher were resolving redirected AppData files through their original paths. Installer hooks now resolve the physical installation directory and use a versioned icon. The user confirmed the headphones logo appears in Search.

Follow-up: discovery now progressively verifies catalogue metadata before playback while retaining source identities/durations and usable results during outages. Tracker separately requests verified album covers and licensed artist photos with Commons credit links; successful entity lookups are cached in SQLite. Public live checks find Emiway and KR$NA portraits; Sai Abhyankkar has no verified image in the checked records. The exact live `sensitive` query now displays Sensitive / KR$NA, Seedhe Maut / Yours Truly before playback. Actual Tracker checks load two artist portraits, catalogue album covers and existing track art.

Final Windows setup/standalone EXE and release-signed ARM64 APK are in `releases/Lumaire-v1.0.2/`; share `releases/Lumaire-v1.0.2-friend-test.zip`. The development-key-compatible personal APK is outside that share folder and was installed in approved main Android user 0. Windows library and both Android profile registrations remain intact. Verification: production build, 97 frontend tests, 58 native tests, the explicit live portrait test, 24 rendered flow checks, ten engine/settings regressions and four focused artwork checks pass. Final APK signature/ZIP integrity/alignment, all 71 ELF alignment checks, native-library identity, shared/personal payload identity and share hashes pass. Seven older optional live checks remain unrun; the separately executed portrait check is ignored by the default native suite. Fresh installation of the shared certificate on a clean phone remains unverified. Full evidence and limits: [release-repair-1.0.2.md](release-repair-1.0.2.md). Existing WIP is preserved.

## Windows installation, phone update and component states — 19 October 2026

Version 1.0.1 adds a per-user Windows setup with Start/Search, desktop and Installed Apps registration. The user confirmed Search now finds Lumaire; the shortcut logo now uses an explicit installed icon, also included by the installer hook. Windows component installation lives in Settings > Online Sources, downloads/verifies the official pinned yt-dlp + QuickJS pair, and uses shared Checking/Missing/Installing/Installed/Error state. Installed is a disabled checkmark, not another download/repair prompt. State survives navigation, rechecks on startup/focus/Online Sources entry, and deduplicates concurrent requests.

The connected Motorola phone was updated in place to optimized, non-debuggable 1.0.1 code with its existing development certificate, retaining song/position/lyrics. No uninstall/data clear was performed. The shared APK retains the separate release certificate. Final native component tests (three checks) and ten rendered regressions pass, including the synchronized Installed state. Windows was updated with the final state-aware build. New share folder: `releases/Lumaire-v1.0.1/` and archive `releases/Lumaire-v1.0.1-friend-test.zip`; the 1.0.0 artifacts remain unchanged.

Build, 94 frontend tests, 55 native tests (seven opt-in live checks skipped), ten rendered regressions and final artifact verification are recorded in [release-1.0.1.md](release-1.0.1.md). Windows remains unsigned; Android Gemini and broad device/background certification remain unimplemented/unverified. Search-logo refresh after the explicit shortcut repair is not yet user-confirmed.

## Release packaging — 19 October 2026

Version metadata is now 1.0.0. Production-compiled Windows x64 EXE and release-signed Android ARM64 APK are packaged in `releases/Lumaire-v1.0.0/`, with tester instructions, third-party notices and SHA-256 checksums. Windows release build, Android R8 release assembly/vital lint, APK signature/ZIP alignment, all 71 ELF 16KB alignment checks, native-library identity and private-file exclusions passed. A shareable archive is `releases/Lumaire-v1.0.0-friend-test.zip`.

These are private friend-testing builds, not full production/device certification. Exact release artifacts were not installed/launched against the user's live profiles. Windows is unsigned and optional YouTube needs external yt-dlp; Android Gemini remains unavailable. Private release key/password are retained in ignored, ACL-restricted `.tools/release-signing/` and must be backed up, never shared. Full build/signing evidence and limits: [release-packaging.md](release-packaging.md).

## Latest verified work — 19 October 2026

Lyrics matching, automatic Gemini pronunciation/translation, local Roman spelling, and shuffle/repeat fixes are implemented. GUESS / Emiway now resolves live to LRCLIB synced record 6555308. TuneScript's earlier offline code was located through read-only Git history and its familiar spelling conventions adapted without editing that project.

Verification: 92 frontend tests, 53 Rust tests (seven opt-in live tests skipped), 22 existing browser checks, 20 native desktop checks, nine new rendered engine checks, and two live/native restart probes passed. The TypeScript/Vite production build passed. Existing uncommitted UI work was preserved.

Full findings, changed files, evidence boundaries and deferred settings: [settings-and-engine-verification.md](settings-and-engine-verification.md).

Known limits: new combined Gemini requests were tested with HTTP fixtures and synthetic UI responses, not the user's live private key. Android device/background behavior and a new APK were not tested. No Connect/crossfade or other unsupported settings were added.

The notes below record earlier work; the verified status above supersedes their pending-verification entries.

## Playlist Modal Theme Fix — 19 October 2026 (complete)

Fixed hardcoded dark backgrounds (`rgba(22, 27, 20, 0.95)`, `rgba(255, 255, 255, 0.035)`, etc.) on `dialog.save-playlist-modal`, playlist cards, badges, and "+ New playlist" buttons in `src/style.css`. They now use semantic CSS variables (`var(--bg-dialog)`, `var(--bg-subtle-button)`, `var(--line-accent)`, `var(--accent-subtle)`, `var(--shadow-popover)`) that automatically adapt to light and dark modes. Tested with `npm run build`, `npm test` (142/142 passed), and updated Windows `Lumaire.exe` in `releases/Lumaire-v1.0.0/`.

---

**Last Updated:** 19 October 2026, 16:50 Asia/Kolkata  
**Updated By:** Playlist Modal Light/Dark Theme Adaptation & Windows Binary Refresh

## Active Work in Progress

### v1.0.0 Release Packaging Update (COMPLETE)

**Status:** ✅ Both Windows `Lumaire.exe` and Android `Lumaire-v1.0.0-arm64.apk` updated in `releases/Lumaire-v1.0.0/` and `releases/Lumaire-v1.0.0-friend-test.zip`

- ✅ **Windows Release Binary:**
  - Compiled optimized release `lumaire.exe` (18,560,000 bytes) with version 1.0.0.
  - Copied into `releases/Lumaire-v1.0.0/Windows/Lumaire.exe`.
- ✅ **Android Release APK:**
  - Built optimized R8-minified ARM64 release APK (`app-arm64-release-unsigned.apk`) incorporating all recent fixes: safe-zone adaptive icons, monochrome notification vector, centered search clear cross, and theme-aware now-playing metadata.
  - Signed with the official Lumaire release certificate (RSA 3072, SHA-256 `0327533b...`) and verified with APK signature schemes v2/v3 and 16KB zipalign alignment.
  - Copied into `releases/Lumaire-v1.0.0/Android/Lumaire-v1.0.0-arm64.apk`.
- ✅ **Checksums & Archive:**
  - Recomputed fresh SHA-256 hashes in `releases/Lumaire-v1.0.0/SHA256SUMS.txt`.
  - Re-packaged clean archive `releases/Lumaire-v1.0.0-friend-test.zip` (30,737,017 bytes).

### Android Adaptive Icon Safe Zone & Volume Panel Media Icon (COMPLETE)

**Status:** ✅ Implementation complete, Android APK compiled cleanly (`BUILD SUCCESSFUL`), tests passing (94/94)

- ✅ **Fixed Zoomed-in Mobile Launcher Icon:**
  - Android adaptive icons require the foreground graphic to sit within the 72dp center safe zone circle of a 108dp canvas (~66% of canvas). Previously `ic_launcher_foreground.png` had a duplicate squircle background card filling 100% of the canvas, causing Android launchers to zoom in and clip the headphones.
  - Extracted the clean Lumaire green headphones logo onto a transparent canvas scaled to ~58% and centered with comfortable margins across all mipmap densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`).
- ✅ **Fixed Old Robot Logo in Volume Slider & Notifications:**
  - `src-tauri/gen/android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml` and `drawable/ic_launcher_background.xml` were leftover default Tauri/Android robot vector files from template initialization.
  - Replaced `drawable-v24/ic_launcher_foreground.xml` with our Lumaire headphones vector, and replaced `drawable/ic_launcher_background.xml` with the dark Lumaire background `#151812`.
  - Added `drawable/ic_notification.xml` (clean white monochrome Lumaire headphones vector) and configured `PlaybackService.kt` with `DefaultMediaNotificationProvider(this).apply { setSmallIcon(R.drawable.ic_notification) }`. Android system volume panel and MediaSession notifications now show the Lumaire headphones logo.
- ✅ **Added Android 13+ Themed Icons (Material You):**
  - Added `<monochrome android:drawable="@drawable/ic_notification" />` to `ic_launcher.xml` and `ic_launcher_round.xml`.

### Search Bar Clear Button Centering & Player Bar Song Title Visibility (COMPLETE)

**Status:** ✅ Implementation complete, frontend tests passing (94/94), build passing

- ✅ **Vertically Centered Search Bar Cross Button:**
  - Configured `.search button` with `display: inline-flex; align-items: center; justify-content: center; align-self: center; width: 22px; height: 22px; border-radius: var(--radius-pill); flex-shrink: 0;` so it is vertically and horizontally centered with the input and search magnifying glass.
  - Constrained `.search input` to `flex: 1 1 0%; min-width: 0; height: 100%;` and gave clear buttons `type="button"` and `className="search-clear-button"` in both `DiscoveryView.tsx` and `LibraryView.tsx`.
- ✅ **Player Bar Song Title Visibility:**
  - Removed hardcoded white text colors (`#f3f6ee` / `#ffffff`) in favor of dynamic theme tokens (`var(--text)`), resolving the issue where the song title was white text on an off-white background in light theme.
  - Added robust fallback and trimming in `PlayerBar.tsx` for `rawTitle` and `rawArtist` (`track?.title` -> `track?.fileName` -> `"Room for a little music"`).
  - Explicitly specified `line-height: 1.25 !important; margin: 0 !important; padding: 0 !important;` on `.now-playing-meta strong` and `.now-playing-artist`.

- ✅ **Sticky Lyric Settings Trigger:**
  - Restored `<div className="lyric-settings-fixed-anchor">` right inside `<section className="lyric-room">` so the options button pins to the top right while scrolling long lyrics.
  - Added dedicated desktop and mobile sticky offset rules.
- ✅ **Mobile Layout Polish:**
  - Fixed mobile bottom navigation height and padding to `52px` and removed `calc(52px + env(...))` so no excessive dead padding appears below the tab bar in Android WebView.
  - Positioned `.queue-pane` as a compact floating dialog (`position: fixed; top: 54px; right: 8px; z-index: 100`) so background elements don't peek through and it stays cleanly sized.
  - Guaranteed `width: 100%; min-width: 0;` on `.now-playing-title-wrap` and `.now-playing-artist-wrap` with theme text color variables so song and artist names render reliably.

### Android Cover Art Fetching & Asset Protocol Fix (COMPLETE)

**Status:** ✅ Implementation complete, frontend tests passing (94/94), backend tests passing (56/56), build passing

- ✅ **Free Online Cover Art Fetching (Apple iTunes API):**
  - Updated `itunes_metadata.rs` to extract `artworkUrl100` and automatically upgrade it to crystal-clear 600x600 resolution (`600x600bb.jpg`).
  - Added `.mzstatic.com` to allowed artwork hosts in `artwork_cache.rs`, `lib.rs` (`save_online_track`), and `tauri.conf.json` CSP.
  - Songs without embedded artwork (or tagged "Unknown artist") can now automatically query iTunes for official cover art upon playback or via "Refresh online info".
- ✅ **Android Asset Protocol & Scope Configuration:**
  - Configured `"scope": ["$CACHE/**", "$APPDATA/**"]` in `tauri.conf.json` so Android WebView can access extracted embedded ID3 artwork from the app cache.
  - Added `https://asset.localhost` and `https://*.mzstatic.com` to `img-src` in `tauri.conf.json` CSP.
- ✅ **Resilient Artwork Rendering & Fallback:**
  - Updated `Artwork.tsx` to immediately render online HTTPS images while caching in the background, and added fallback to direct HTTPS URLs if Android WebView encounters asset protocol issues.

### Lyrics Settings Positioning, Theme & Mobile Modal Sheet Fix (COMPLETE)

**Status:** ✅ Implementation complete, frontend tests passing (94/94), build passing, installed on phone

- ✅ **Desktop & Mobile Responsive Lyrics Settings UX:**
  - **PC Layout:** Popover opens to the **left** of the settings button (`top: 0; right: calc(100% + 10px)`), with zero background blur/dimming. Duplicate inner close cross hidden on desktop (`.lyric-settings-close-btn { display: none !important }`) so only the single trigger cross is visible.
  - **Mobile Layout:** Centered modal sheet with `.lyric-settings-close-btn` visible inside the header (`display: inline-flex !important`), backed by a touch-dismissing scrim.
  - **Theme Integration:** Strictly uses CSS theme variables (`var(--bg-popover)`, `var(--text)`, `var(--line-strong)`) so both light and dark modes render with high contrast and readable text.
  - **Phone Installation:** Built ARM64 debug APK and installed in-place via ADB onto connected Motorola Edge 50 Pro (`ZD222LVFWT`) without data loss.

### Mobile Music Player Controller Height Reduction (COMPLETE)

**Status:** ✅ Implementation complete, frontend tests passing (94/94), build passing

- ✅ **Compact Apple Music Mini-Player (~56px vs ~135px):**
  - Redesigned `.transport` on mobile (`@media (max-width: 768px)` and `.app.android`) into a sleek single-row mini-player.
  - Reduced controller height by over 60% (~135px down to 56px), freeing >75px of vertical screen real estate for track lists, library content, and lyrics.
  - **Seek Bar:** Pinned hairline 2px progress bar at the very top edge of the mini-player with an 8px circular thumb.
  - **Left Section (`.now-playing`):** Compact 38x38px cover art, single-line truncated title (13px bold) & artist (11px muted), and compact track action menu (`•••`).
  - **Right Section (`.player-center`):** Apple-style playback controls (Previous, 38px circular Play/Pause button with subtle glow and spring feedback, Next).
  - **Hidden Redundant Controls on Mobile Bar:** Shuffle, Repeat (accessible in queue/track menu), Volume slider (controlled via hardware volume keys), inline timestamps, and duplicate action buttons.
  - Preserved standard 3-column desktop layout on larger viewports.

### Mobile Phone Navigation & Bottom Tab Bar (COMPLETE)

**Status:** ✅ Implementation complete, tests passing (94/94), build passing

- ✅ **Fixed Phone Navigation Layout (Root Cause: Desktop column stacking in 54px header):**
  - Replaced the cramped desktop sidebar in mobile viewport with an authentic Apple Music iOS navigation architecture.
  - **Top Bar (`.mobile-header`):** 50px frosted glass header containing brand logo on the left and quick utility icons (Queue toggle & Settings) on the right.
  - **Bottom Tab Bar (`.mobile-tab-bar` / `MobileTabBar.tsx`):** 5-tab Apple iOS bottom bar with Library, Discover, Favorites, Lyrics (with sync dot), and Tracker.
  - **Single-Column 4-Row Grid:** Grid rows configured cleanly as `50px minmax(0, 1fr) auto calc(52px + env(safe-area-inset-bottom, 0px))` across `@media (max-width: 768px)` and `.app.android`.
  - Zero button column overflow over scrolling lyrics. Desktop sidebar layout preserved completely on desktop viewports.

**Status:** ✅ Implementation complete, tests passing (86/86), build passing

- ✅ **Added Track Row Spacing:**
  - Added `.track-list { display: flex; flex-direction: column; gap: 4px; }` and `.listening-days ul { gap: 4px; }` in `style.css` so playlist, library, discovery, and tracker rows have 4px vertical breathing room between squircle backgrounds.
- ✅ **Resolved Lyrics Settings & Attach Lyrics Collision:**
  - Removed the fragile sticky anchor with negative margin hack (`margin-bottom: -44px; height: 0`) that caused the circular settings button to render on top of the "Attach lyrics" button.
  - Integrated both controls into `.lyric-header-actions` within `.page-heading` with clean 10px flex spacing and Apple glass styling.
- ✅ **Replaced Hardcoded Green Playlist/Track Artwork Placeholders:**
  - Replaced legacy `.color-0` hardcoded `#3e523b` green gradient with clean, neutral Apple glass placeholders (`linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))` with subtle borders).
  - Hovering tracks now lights up the icon with the user's active theme accent instead of staying hardcoded green.
- ✅ **Apple Capsule HUD Toast (Dynamic Island / macOS Style):**
  - Replaced the distorted notice banner with a clean, standalone Apple Capsule HUD (`.apple-toast`).
  - True pill shape (`border-radius: 9999px`), 38px height, neutral frosted glass backdrop (`rgba(28, 28, 30, 0.92)` with `backdrop-filter: blur(28px)`), hair-thin border, and natural elevation shadow without fake colored halos.
  - Fixed 20x20 circular badge with Apple system green `#30d158` checkmark, crisp 13px SF-style text, and subtle dismiss icon.
- ✅ **Fixed Track Context Menu Overflow:**
  - Added smart viewport collision detection on menu toggle in `useClickOutsideMenus.ts`: automatically opens upwards (`.open-up`) when clicked near the bottom of the window/player bar.
  - Added strict scroll bounding (`max-height: min(340px, calc(100vh - 120px))` with smooth scroll) so actions never clip beneath the player bar.
  - Automatically collapses any other open track menu when another is opened.
- ✅ **Subtle Apple Theme System (Eliminated Muddy Tinting):**
  - Updated `theme.ts` to keep application surfaces (`--bg`, `--bg-sidebar`, `--bg-panel`, `--bg-transport`) clean, neutral Apple dark/light materials instead of washing the window in a heavy tint.
  - Accent colors are reserved for actionable highlights (play button, selection, active dots) as intended by Apple HIG.
- ✅ **Clean Apple Music Collection Cards:**
  - Removed decorative dashed rings and stamped badge pills in `Collections.tsx` and `style.css`.
  - Implemented clean, minimalist Apple Music playlist artwork placeholders with subtle gradient tiles and centered Lucide icons.
- ✅ **Eliminated Plain HTML `<select>` Dropdowns & Redundant Navigation:**
  - Built bespoke Apple-styled `<Select>` component with glassmorphic popover (`var(--bg-popover)`, `backdrop-filter: blur(24px)`), automatic flip direction (`openUpwards`), checkmark selection state, and keyboard navigation.
  - Replaced native Windows grey select boxes in Tracker (`HistoryView.tsx`) for date range and pagination rows-per-page.
  - Removed redundant `compact-navigation` view-switcher dropdown in `TopBar.tsx`—the persistent sidebar navigation already serves this purpose cleanly on desktop.
- ✅ **Verification:** `npm run build` and `npm test` clean (86/86 unit tests passing).

**Files Modified (Uncommitted):**
```
modified:   index.html                        # Early theme script (FOUC prevention)
modified:   src/App.tsx                       # Theme application effect
modified:   src/domain/session.ts            # Theme persistence
modified:   src/domain/types.ts              # Preferences extended
modified:   src/main.tsx                     # Theme initialization
modified:   src/tokens.css                   # Light/dark mode tokens
modified:   src/style.css                    # Settings redesign CSS (+450 lines)
new:        src/components/views/SettingsView.tsx  # Redesigned Settings
new:        src/theme.ts                     # Theme logic
new:        src/theme.test.ts                # Theme tests
backup:     src/components/views/SettingsView-old.tsx.bak  # Original preserved
```

**Verification Results:**
- ✅ TypeScript build: PASSED (4.58s, no errors)
- ✅ All tests: 86/86 passing, 14 test files
- ✅ Theme tests: 3/3 passing
- ✅ **Theme-responsive elements fixed:**
  - Logo SVG (uses currentColor, adapts to theme)
  - Album/track cover placeholders (use var(--bg-panel))
  - Error banners (use theme tokens)
  - Toggle switches (theme-aware)
  - Range slider elements (both WebKit and Firefox)
  - Playlist/collection cards (warm sage-tinted surfaces)
  - Primary/play buttons (gradient with accent tokens)
  - Subtle buttons (theme-specific backgrounds for light mode contrast)
  - Transport bar (softer shadow in light mode, uses var(--line))
  - Seek hover tooltip (uses var(--bg-popover) and theme tokens)
- ✅ **Light mode polish applied:**
  - Warm sage-tinted backgrounds (#f7f6ee page, #f2f1e8 sidebar, rgba(252,251,245,0.85) panels)
  - Theme-specific shadows (lighter in light mode, darker in dark mode)
  - Subtle button backgrounds (rgba(0,0,0,0.04) → rgba(0,0,0,0.08) on hover in light)
  - Transport shadow reduced (0 -2px 12px in light vs 0 -4px 24px in dark)
  - Border tokens used throughout (var(--line), var(--line-strong))
- ⚠️ **Manual UI verification pending:** `npm run desktop`
  - Switch Dark ↔ Light modes
  - Test all 5 accent palettes + custom HEX
  - Check logo visibility in both themes
  - Verify cover/card backgrounds in both modes
  - Test "Add folder" button contrast in light mode
  - Verify transport bar appearance in light mode
  - Test all major screens (Library, Discover, Queue, Lyrics, Settings)
- ⚠️ **Intentionally preserved:**
  - Album color badges (varied gradients, decorative)
  - Record/vinyl visualization colors
  - Semantic error/warning colors (red tones)

**Next Steps:**
1. Manual verification: `npm run desktop`
   - Test theme mode toggle (dark/light switching)
   - Test accent palette selection
   - Test custom HEX color input
   - Verify live preview updates
   - Check all Settings categories display correctly
   - Verify responsive layout on narrow windows
2. Visual inspection of light mode across all views
3. Accessibility check: keyboard navigation, focus states
4. Optional: Commit completed work

**Blockers:** None

---

## Recent Completions

### Phase 4: Desktop Packaging & Offline Playback
**Completed:** 18 October 2026  
**Verification:** 59 frontend + 35 Rust + 18 browser + 21 native tests passing  
**Details:** See `docs/implementation-status.md` and `docs/phase-4/status.md`

### Phase 3: Wikimedia Commons Integration
**Completed:** 18 October 2026  
**Verification:** TypeScript build clean, 9 unit tests passing, integration ready  
**Details:** See `docs/phase-3-completion.md` and `docs/implementation-status.md`

---

## Build & Test Status

**Last Build Check:** 19 October 2026, 04:37 — ✅ PASSED  
**Last Test Run:** 19 October 2026, 04:35 — ✅ PASSED (86 tests, 14 test files)

```
TypeScript compilation: ✅ Clean, no errors
Vite production build: ✅ Success (4.21s)
Unit tests: ✅ 86/86 passing (including 3 theme tests)
Bundle size: 86.20 kB CSS, 375.04 kB JS
```

**Status:** Application-wide theme system complete, ready for visual verification

---

## Known Issues & Limitations

### Settings & Theme (Pending Manual Verification)
- Light mode implemented but not visually verified
- Mobile responsive layout implemented but not tested on small screens
- Accent color transitions may need fine-tuning
- No cross-device theme sync (by design, local-first)

### General Project Status
- Gemini API integration deferred pending user API key configuration
- Private lyrics settings use synthetic credentials only
- No public distribution/signing yet performed

---

## Development Environment

- **Node:** v24.15.0
- **Rust:** Cargo 1.99.1 at `D:\Rust`
- **MSVC Build Tools:** Installed
- **Windows SDK:** Installed
- **WebView2:** Available

---

## Git Status Summary

Branch: `main`  
Tracking: `origin/main` (up to date)

**Uncommitted Changes:** 5 modified files, 2 untracked files (theme implementation)

**Action Required:** Review, test, and commit when ready

---

## Handoff Checklist

When switching agents or resuming work:

1. ✅ Read this file completely
2. ✅ Run `git status` and `git diff` to see actual changes
3. ⚠️ Check `npm run build` passes before making new changes
4. ⚠️ Run `npm test` to verify tests still pass
5. ⚠️ Update this file after completing tasks or before ending session
6. ⚠️ Commit completed work before switching contexts

---

## Session Memory

**Previous Session Focus:** Agent workflow and memory setup (✅ complete)  
**Current Session Focus:** Settings & theme redesign (✅ complete)  
**Next Session Focus:** Manual verification, visual QA, or new features

### Workflow Setup Completed

**New files created:**
- `AGENTS.md` — Root instructions + Ponytail rules
- `.kiro/steering/architecture.md` — Architecture guide
- `.kiro/steering/conventions.md` — Code conventions  
- `.kiro/steering/handoff-protocol.md` — Session checklist
- `docs/MEMORY-OPTIONS.md` — Memory systems analysis
- `docs/SETUP-COMPLETE.md` — Setup summary and usage guide

**Workflow established:**
- File-based status tracking (zero cost, zero setup)
- Kiro steering for auto-loaded context
- Handoff protocol for agent switching
- Ponytail rules for minimal, lazy coding

See `docs/SETUP-COMPLETE.md` for complete details and usage instructions.

---

*This file is the source of truth for current work. Update it instead of relying on conversation history.*
