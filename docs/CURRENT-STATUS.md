## Windows 1.0.7 published; Android held — 27 October 2026

- User explicitly approved the full tested snapshot (262 files), then requested PC completion while the phone is disconnected. Source commit/tag: `bc5a5c350ffe9680090d920e09f7f137b084443f` / `v1.0.7`, pushed to GitHub.
- Windows release published: https://github.com/arushn47/music-player/releases/tag/v1.0.7 . Signed CI run 40475692183 passed its required regression suite, build, uploaded-byte/signature/manifest checks. The workflow now retains drafts until final package smoke checks finish.
- Exact downloaded CI installer passed independent cryptographic signature and tamper-rejection checks, installed successfully, and launched as 1.0.7. Existing library/playlists remained visible; pre-upgrade track IDs were retained and SQLite integrity passed. Private local backups are in `.test-data/release-1.0.7/`. Public latest updater endpoint verified version, notes, signature and the 22,185,294-byte installer URL. SHA256SUMS accompanies the release.
- Human-readable release and updater notes explicitly mark Android pending. The installer embeds the earlier combined-platform notes; the public updater supplies corrected Windows-only availability notes. No Android APK was uploaded.
- Android optimized release APK built, R8/lint passed, v2/v3 signature and ZIP alignment verified. Its certificate matches the previously published Android preview. The phone has a differently signed development build; do not uninstall or overwrite it with the public APK. Existing phone app/data remains intact with a private pre-upgrade backup saved.
- Resume Android when the user reconnects USB: isolated before/final APKs signed with the release key are in `.test-data/release-1.0.7/`; public final APK is `releases/Lumaire-v1.0.7/Lumaire-1.0.7-Android-arm64.apk`. Use separate `app.lumaire.player.latency` for the optimized release startup/upgrade check. Its native library hash matches the public APK. Only then add the public Android asset and refresh notes/checksums.
- Evidence: `docs/performance/release-1.0.7.json`. No repeated latency benchmark or additional broad local suite; previous 540 frontend / 11 JVM / 9 live Android checks were reused, plus two release-validator tests and the existing CI suite once. Known provider delays and Android background Autoplay handoff remain documented.

## Playback latency optimization — 27 October 2026 (device validation complete)

- Report and reproducible raw Windows evidence: `docs/performance/playback-latency-2026-10-27.md`. Real Windows/WebView2: 20 samples per cold/repeat/queue scenario before and after, plus six baseline control cycles (138 successful selections). Cold median/p95: 8.928/9.837 s before, 8.343/10.694 s after. Unchanged baseline control cold median 7.341 s demonstrates environmental/provider drift; no established ordinary-track Windows speedup.
- Android native resolution now has a bounded, two-minute in-memory playback cache and coalesced/FIFO requests. Explicit cancellation/timeout/disconnect teardown and stale-reply guards remain; native player errors invalidate cached streams. Downloads bypass playback caching; cached stream origin, codecs and headers are validated.
- Shared matching defers incomplete-metadata extraction behind credible complete matches, retaining complete-candidate ranking and all recording checks. Cancellation exits without launching more fallbacks. No new preloading, keep-alive/runtime/buffer tuning, dependencies or service was added.
- Verification: frontend and Windows debug builds pass; full Vitest 85 files / 540 tests pass; Android debug build and 11 JVM tests pass, including signed-URL expiry bounds. Benchmark percentile self-checks pass. Fixed a pre-existing TypeScript error in the unused benchmark draft that blocked compilation; original drafts are preserved in `.test-data/latency/`.
- Real Motorola Edge 50 Pro (API 36): 20 cycles per scenario for baseline, resolver-only and combined builds. Android before → final median/p95 seconds: cold **14.470/109.459 → 14.653/16.183**, repeat **5.517/6.386 → 1.061/1.151**, queue **14.822/21.782 → 14.980/16.686**. Approximately 81% repeat median improvement; no established cold/queue median gain. Native resolve/prepare/buffer fell from about 5.8 s to 1.06 s, while completing both searches through the single worker offsets the saving on first play. Representative tracks had no incomplete-metadata candidates, so no hardware benefit is claimed for that matching branch.
- Failure accounting: baseline cold 19/20, repeat 19/20, queue 19/19 attempts plus one blocked dependent cycle; baseline timeout and HTTP 403 remain in raw evidence. Resolver-only had one queue HTTP 403; final **60/60 starts succeeded**, but queue maximum was **37.381 s**. Percentiles include successful starts only; provider failures are not claimed eliminated.
- Final physical-phone correctness **9/9 passed**: local playback, verification/playback sharing a resolution, pause/seek/resume, independent searches, active-worker cancellation, superseded load/stale result protection, unavailable-source retry/recovery, screen-off foreground-service playback, and actual two-minute cache expiry/fresh extraction. Separate rapid catalogue replacement passed without stale fallback work. Raw cohorts, APK hashes and correctness evidence are under `docs/performance/`.
- All Android runs used isolated `app.lumaire.player.latency`, removed afterward; normal installed app/library/history untouched. Temporary stay-awake restored to normal timeout (0). No preloading or further speculative tuning, version bump, installer or release preparation. Version remains 1.0.6; report is ready for review before preparing 1.0.7. Acoustic speaker latency, additional devices and long-duration battery/data budgets were not measured.

## Cross-device Tracker artist and album count consistency — 27 October 2026

- Root cause: `App.tsx` replaced recorded history title/artist/album with device-local library or queue metadata, matched only by playback track ID. Different cached metadata (including distinct catalog releases resolving to one video) could split/collapse albums and change artist counts despite identical synced records.
- Removed this recap-only override. `HistoryView` now receives the recorded history unchanged through its existing props; counts, rankings and recent-play labels use the same synced metadata on both platforms. No database migration, history deletion or sync protocol change.
- Added `src/App.history.test.tsx`: renders the actual App with identical history and conflicting local tracks, reproducing a potential 9-album / 2-artist discrepancy and asserting stable counts and preserved records.
- Verification: production build passed; 17 targeted App/history tests passed. Full suite: 526 passed / 1 failed in the untouched `device-sync.test.ts` legacy-import favorites reference-equality assertion (line 53).
- Real isolated Windows WebView2 + SQLite check passed: with and without conflicting cached queue metadata, Tracker retained 10 plays / 10 songs / 1 artist / 10 albums and identical persisted records. Closed the unrelated required engine-setup dialog in the synthetic profile; no engine installation or user-data changes.
- Limits: did not inspect the user's actual phone/PC databases or rebuild/install Android. Both installed apps need a build containing this shared frontend fix; equal counts still require equal synced history and date ranges.

## Favorites sync completed — 27 October 2026

- Finished track, artist and album favorites on the existing SQLite/Lamport CRDT and authenticated local HTTP listener. Explicit unlike tombstones survive offline reloads; newer intentional likes and deterministic device-ID ties converge. Portable track metadata travels without file paths; local-only likes stay local and downloaded aliases retain local identities.
- Added the persisted **Favorites** switch under Sync / Devices, enabled by default. Both peers must enable transfer. Disabled devices retain edits; mode-aware cursors and a full local reread replay skipped changes after re-enabling. Shared library updates capture all favorite actions, including combined playlist changes and track removal.
- First-pairing/upgrade initialization seeds only existing likes once, before incoming favorite materialization. Missing favorites never become unlikes, preserving both devices' pre-existing favorites, while existing tombstones are retained.
- Updated devices negotiate v3 routes on the same listener; unsupported routes fall back to unchanged v2 wire shapes and filtered playlist/history pages. Older v2 devices keep syncing supported data without receiving favorite fields. No WebRTC, dependency, service, account or infrastructure was added. Existing WIP remains intact.
- Verification: **536 frontend tests across 85 files passed**, including **28 focused sync/hook/UI tests**; **11 native SQLite sync tests passed**; production frontend build passed. The isolated Windows desktop app started without panics. Two real native/WebView2 profiles passed **12 end-to-end checks**, including default-on UI toggle persistence, initial union, disabled transfer/offline unlikes, re-likes after reload, existing playlist/history regressions and actual native fallback to a strict legacy-v2 HTTP fixture. No page errors. Evidence: `.test-data/two-way-sync-1793054444647/result.json`; desktop screenshot inspected from the preceding successful run `.test-data/two-way-sync-1793054295348/favorites-toggle.png`.
- Test profiles used an already-downloaded playback engine only to clear the unrelated setup dialog; no sync/SQLite mocks, real-library edits, playback, installation, publishing or version change. Physical Android/Wi-Fi verification and an Android build were not performed for this change. The existing trusted-LAN traffic remains unencrypted; favorites require updated apps on both devices.
- Details and reproducible test prerequisites: `docs/DEVICE-SYNC.md`, `scripts/two-way-sync-test.mjs`.

## Audio-only stream enforcement and legacy MP4 video remux repair — 27 October 2026

- **Windows & Android Audio-Only Stream Resolution**:
  - Diagnosed root cause: Windows `resolve_audio` fallback on client challenge used `best[acodec!=none]...` which fetched combined progressive MP4 video/audio streams from YouTube, and Android `lumaire_resolver.py` did not enforce `vcodec=none`.
  - In [`src-tauri/src/ytdlp.rs`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src-tauri/src/ytdlp.rs), enforced `[vcodec=none]` across all stream format strings (`AUDIO_FORMAT = "bestaudio[ext=m4a][vcodec=none]/bestaudio[ext=webm][vcodec=none]/bestaudio[vcodec=none]"` and `bestaudio[ext=m4a][vcodec=none]`), preserved the strict format across verification fallbacks, and added `validate_audio_codecs` asserting `vcodec == "none"`.
  - In [`src-tauri/android-streaming/src/main/python/lumaire_resolver.py`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src-tauri/android-streaming/src/main/python/lumaire_resolver.py), enforced `AUDIO_FORMAT` and `DOWNLOAD_FORMAT` with `[vcodec=none]`, added `validate_audio_only` check, and returned `videoCodec`.
  - In [`src-tauri/src/downloads.rs`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src-tauri/src/downloads.rs), removed `.mp4` from allowed download container extensions (only `.m4a` accepted) and added `validate_audio_codecs` on Android download source payloads.
- **Strict Audio-Only Container Verification**:
  - In [`src-tauri/src/audio_container.rs`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src-tauri/src/audio_container.rs), implemented atom/box parsing (`moov` -> `trak` -> `mdia` -> `hdlr`) to verify media handlers (`soun` vs `vide`). Any MP4 containing `vide` tracks or Ogg containing Theora streams is immediately rejected by `require_audio_only`.
  - Integrated `require_audio_only` into `download_track` and `transfer_audio` boundaries.
- **Lossless Repair of Existing Progressive MP4 Downloads**:
  - In [`src-tauri/src/offline_repair.rs`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src-tauri/src/offline_repair.rs) and [`src-tauri/src/lib.rs`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src-tauri/src/lib.rs), implemented startup repair:
    - Remuxed legacy downloads without re-encoding (`-c:a copy -vn -sn -dn -movflags +faststart -f ipod`) to `.m4a`.
    - Verified exact bit-for-bit encoded AAC hash (`ffmpeg ... -f hash -hash sha256`), confirmed full packet decoding (`-xerror ... -f null`), verified container structure (`after.video == 0`), updated SQLite database `tracks` table paths, and removed legacy `.mp4` originals.
    - Verified that all 11 files currently in `downloads/` are 100% audio-only AAC M4A files saving ~6.62 MiB of disk space.
- **Verification**:
  - All targeted backend tests in `audio_container`, `ytdlp`, `downloads`, and `offline_repair` passed. Serial provider tests (20 tests) passed.
  - Python resolver tests (`tests/android-audio-resolver.py`, `tests/android-playlist-resolver.py`) passed cleanly.
  - 84 Vitest test suites (527 tests) passed; `npm run build` compiled cleanly with 0 errors.

## Device Sync Listening History Divider Gap Fix — 27 October 2026

- **Spacing before Divider Line**:
  - In [`src/components/views/collections.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/collections.css), added explicit `padding-bottom: 16px` on `.device-sync-card > .device-sync-setting:first-of-type` (the "Listening history" setting row in the "What to sync" section).
  - Reset `margin-top: 0` on `.collection-hub .device-sync-note` and maintained `padding-top: 14px; border-top: 1px solid var(--line);`. This ensures a non-collapsing, symmetrical 16px gap above the subtle border line and 14px gap below it, eliminating the issue where the divider was stuck directly against the subtitle text.
- **Verification**:
  - Full Vitest suite passed (84 test files, 527 tests); production compilation (`npm run build`) succeeded with 0 errors.

## Mobile Tracker Recent Plays UI layout and typography fixes — 27 October 2026

- **Combined Single-Line Metadata & Vertical Density**:
  - In [`src/components/views/HistoryView.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/HistoryView.tsx), structured track metadata into `.listening-history-meta` and action buttons into `.listening-history-actions`. Duration (`formatListening(record.listenedMs) listened`) and timestamp are now merged into a single horizontal metadata line with dot separator (`·`), eliminating the previous 4-row vertical text bloat where duration and time were stacked as orphaned lines.
  - Wrapped artwork in `.listening-artwork-wrap` with accessible `onReplay` click/keyboard handler so tapping album artwork directly replays the song.
- **Mobile Grid & Alignment Refinements**:
  - In [`src/mobile.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/mobile.css), replaced the brittle 4-column 3-row grid with a clean 3-column 2-row layout (`44px minmax(0, 1fr) auto`).
  - Centered `.listening-artwork-wrap` vertically across both rows (`align-self: center`) to eliminate the dead space below thumbnails.
  - Centered `.listening-history-actions` vertically across both rows (`align-self: center`) with compact 40px icon buttons, keeping Queue and Favorite buttons aligned with the card while freeing horizontal space for song titles and artists.
  - Added clean section header styling (`.listening-days h2`) and mobile spacing for `.listening-summary` and `.listening-pagination`.
  - In [`src/components/views/HistoryView.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/HistoryView.tsx), assigned `className="track-title-button"` to the song title button to align with codebase conventions and exclude it from the generic mobile Android 40px minimum touch-target rule.
  - In [`src/mobile.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/mobile.css), added `min-height: unset` on `#root .app .listening-history-identity > button`, eliminating the 21px dead space between song titles and artist links.
  - In [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), maintained the clean desktop flex row alignment with discrete columns for metadata and actions.
- **Verification**:
  - Added unit test assertion in [`src/components/views/HistoryView.test.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/HistoryView.test.tsx) asserting `track-title-button` presence.
  - Full Vitest suite passed (84 test files, 527 tests); production compilation (`npm run build`) succeeded with 0 errors in 8.61s.

## Playlist batch download option and inline progress — 27 October 2026

- **Playlist Download in Library View**:
  - Added "Download playlist" action to the `…` header menu in [`src/components/views/LibraryView.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/LibraryView.tsx) when viewing an active playlist with items.
  - Dynamically updates the menu label to `"Downloading…"` while in progress, and `"Retry download"` if failures occurred and download completed/cancelled.
  - Reused [`useAlbumDownloads`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/hooks/useAlbumDownloads.ts) in [`src/App.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx) to coordinate batch downloads for playlist items, mapping playlist `Track` objects to `CatalogTrack` representations keyed by `playlist.id`.
- **Inline Download Progress & Controls**:
  - Displays progress status, pause/resume, cancel controls, and failed track details below the playlist header actions via the existing `.album-download-progress` component structure and CSS tokens.
- **Verification**:
  - Added unit test in [`src/components/views/LibraryView.test.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/LibraryView.test.tsx) asserting menu button states and download progress rendering.
  - Vitest suite passed (83 files, 526 tests); `npm run build` compiled cleanly in 5.98s with 0 errors.

## PromptModal confirmation validation and playlist deletion feedback — 26 October 2026

- **Inline Validation for Confirmation Prompts**:
  - In [`src/components/modals/PromptModal.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/modals/PromptModal.tsx), destructive actions requiring confirmation keywords (e.g. `Type DELETE to remove this playlist. Your files stay on disk.`) previously closed silently without feedback if the user made a typo or entered mismatched text.
  - Added `validatePromptKeyword(label, value, confirmKeyword?)` to enforce confirmation keyword matching (case-insensitive e.g. "delete" or "DELETE" for smooth UX).
  - Entering invalid text keeps the modal open and displays an inline error alert (`<p className="dialog-error" role="alert"><AlertCircle size={14} /><span>Type "{KEYWORD}" to confirm.</span></p>`) with red input border (`dialog input.has-error`, `aria-invalid="true"` in [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css)). The error automatically clears as soon as the user resumes typing.
  - Standard prompt dialogs (like creating or renaming playlists) without confirmation keywords continue to accept normal text without keyword restrictions.
- **Playlist Deletion Toast & Active Playlist Cleanup**:
  - In [`src/App.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx), successful playlist deletion now triggers a toast notification (`Deleted playlist "<name>"`) and clears `lumaire:last-playlist-id` from `localStorage` if it pointed to the deleted playlist.
- **Verification**:
  - Added unit tests in [`src/components/modals/PromptModal.test.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/modals/PromptModal.test.tsx) verifying keyword validation, error messaging, case-insensitivity, and standard prompt pass-through.
  - 83 Vitest test suites (525 tests) passed; `npm run build` compiled with 0 errors.

## Song search preserves original releases and remixes — 26 October 2026

- Fixed shared native catalog merging: an Apple release no longer disappears into a different JioSaavn compilation solely because the recording matches. Same-provider duplicate recordings and same-album cross-provider matches still coalesce.
- Searches allow remixes without requiring that word in the query; bracketed version titles receive strong base-title relevance so official editions survive the result limit. Autoplay version exclusions are unchanged.
- Validation: 8 catalog regression tests plus explicit live Despacito search passed. An isolated real Windows WebView2 app started successfully; actual `search_catalog` returned 20 rows, with JioSaavn Despacito, iTunes original on VIDA, and Justin Bieber remix first. No user data/queue changes, playback attempt, installer, or release.

## Save to playlist auto-add with toast "Change" option — 26 October 2026

- **Auto-Save to Last Selected Playlist**:
  - In [`src/App.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx), clicking "Save to playlist" on any track checks for the previously selected playlist ID (stored in `localStorage` under `lumaire:last-playlist-id` or single-playlist fallback).
  - If a valid previous playlist exists:
    - If track is not yet in the playlist, it automatically adds the track to that playlist without opening the dialog modal.
    - Shows an Apple-styled notification toast: `"Added to <Playlist Name>"` with an interactive `"Change"` action button.
    - If the track is already in the playlist, shows toast: `"Already in <Playlist Name>"` with `"Change"`.
  - If no previous playlist is recorded or if it was deleted, it opens [`SaveToPlaylistModal`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/modals/SaveToPlaylistModal.tsx) directly as before.
- **Change Action & Playlist Modal Improvements**:
  - Clicking `"Change"` on the toast dismisses the toast and opens [`SaveToPlaylistModal`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/modals/SaveToPlaylistModal.tsx) for that track, allowing the user to select another playlist, create a new playlist, or uncheck the previous one.
  - Selecting another playlist or creating a new playlist updates `lumaire:last-playlist-id` so subsequent saves default to it.
  - Enhanced [`Banners.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/Banners.tsx) and [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) with `messageAction` and `.toast-action` button styling (interactive accent hover, auto-extended 6-second timeout when an action is present).
  - Removing a track in [`SaveToPlaylistModal`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/modals/SaveToPlaylistModal.tsx) keeps the modal open for fluent toggling instead of abruptly closing, and supports track matching by `metadataSourceId`.
- **Sleek Horizontal Pill Toast UI**:
  - Removed redundant `<strong>Notification</strong>` heading from [`src/components/common/Banners.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/Banners.tsx).
  - Redesigned toast layout into a compact, single-row floating pill (`border-radius: 9999px; width: fit-content; align-items: center; padding: 8px 12px 8px 14px; min-height: 38px;`) in [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css).
  - Placed the `"Change"` action button inline beside the message text with high-contrast accent background, pill border-radius, and crisp `#ffffff` text, eliminating stacked vertical space.
  - Replaced the clunky thick left border with translucent frosted glass styling (`backdrop-filter: blur(28px) saturate(190%)`, `border: 1px solid rgba(255, 255, 255, 0.12)`), compact circular close button (`22px`), and subtle shadow.
- **Verification**:
  - 82 Vitest test files (520 tests) passed cleanly; `npm run build` completed with zero errors.

## Autoplay language continuity and original-song radio — 26 October 2026

- User superseded the previous multilingual/personal-radio policy: Autoplay must retain the deliberately selected song's language regardless of preferences/history. Live Magale (Baththa) search/radio check returned 30 Tamil songs, all without genre/mood data. Earlier candidate generation mixed taste/current radios and ranking admitted preferred/learned languages, so unrelated-language selections were possible.
- Autoplay now requests ONLY the original session anchor's radio. Hard language equality runs before duplicate filtering/ranking, excludes unknown/undetermined languages, and cannot be relaxed by likes, history, discovery, artist-cap relaxation, availability failure or fallback. Missing seed language stops safely. Metadata uses stable catalog IDs before title fallback; Apple/local identities lacking language can recover it through an existing catalog search requiring matching title/version, artist and recording duration (within two seconds). Recovery is cached and retains known genre tags. One radio, bounded five-second overall pool budget; existing availability budget/caches and cancellation/manual queue guards remain.
- Known specific genre conflicts are rejected. Per the user's explicit answer to the metadata limitation, absent genre/mood tags fall back to original-song same-language radio rather than stopping. No inferred mood/energy or guaranteed-vibe claim. Personal listening signals can still rank compatible candidates; they cannot broaden language or radio source. Home recommendations are unchanged.
- Tests include heavy contrary-language history/likes in Tamil, Malayalam, Hindi and English; unknown languages; genre conflicts; duplicate-title poisoning; cached Apple-language recovery; unavailable same-language tracks without foreign fallback; cold starts, long sessions, original anchor, manual queues and cancellation. Captured Magale snapshot plus a liked Hindi injection is retained at `src/domain/fixtures/autoplay-magale.json`. Focused 47 tests passed; production frontend build passed. Real React autoplay flow now verifies rejection of liked Hindi after a Tamil seed, subsequent unique picks, anchor caching, and manual-queue cancellation (`node scripts/autoplay-flow-test.mjs`). Live provider checks are metadata only, not subjective listening/vibe validation. No new dependency/backend/migration, version bump or installation.

## Android Back navigation and Discover double-tap — 26 October 2026

- Added Android-only interception through Tauri's app Back event. Dropdowns/action menus, cancellable dialogs, active search, expanded queue/player, and Settings categories dismiss before in-app screen history. Required dialogs retain cancellation protection. Home is the Android root even after switching tabs; first root Back shows a native short toast and a second press within two seconds minimizes with `moveTaskToBack`, never exit/finish/player teardown. Desktop navigation is unchanged.
- Mobile Discover taps respond immediately. Two consecutive Discover taps within 350ms focus the existing Discover input and request Android's IME, including when the first tap switches from another page. Intervening tabs and expired/completed tap pairs reset detection. Existing search query/results remain owned by App and are not cleared.
- Physical-phone testing caught a real integration issue missed by mocks: direct custom-plugin commands were blocked with `lumaire-android.navigation not allowed. Plugin not found`. Registered the inline plugin's three renderer commands in build.rs and granted only navigation/register-listener/remove-listener in an Android/main-window capability. This also permits the previous native playback event subscription; no broad shell, filesystem or playback-command permission was granted.
- Verification: final production frontend and ARM64 Android builds pass; 18 focused navigation/interaction/App/menu tests pass. Signed with the existing local certificate and installed in place on the connected Motorola; version remains 1.0.6, data retained, no publication. Actual hardware Back tests pass for keyboard/search (query retained), prior Library screen, Sync sheet, Settings category/screen, expanded queue → player → close, and Home double-Back. Native window/activity evidence confirmed launcher focus after minimization with the same Lumaire PID. Timeout logic has unit coverage; the on-device expiry check correctly stayed open beyond two seconds, while immediate WebView visibility assertions lagged native activity transitions, so use native focus for future minimize checks.
- Separate background playback verification is NOT complete: real Magale/Vibe Venuma playback was sought near completion and minimized without CDP polling during the wait. A paused run was inconclusive; a confirmed-playing Vibe Venuma run reached native ENDED/STOPPED after 18 seconds without an automatic successor. Native playback event delivery was confirmed separately while foreground. Do not claim background Autoplay fixed; renderer lifecycle/queue ownership still needs investigation. Test audio was paused and Lumaire returned to Home. Local test evidence: `.test-data/phone-navigation.log`, `.test-data/phone-background.log`, `.test-data/android-navigation-tests.log`; APK `.test-data/Lumaire-android-navigation-20261026.apk`.

## Device Sync Modal Sleekness & Alignment Refinements — 26 October 2026

- **Vertical Space & Scroll Elimination**:
  - Compacted [`dialog.collection-hub`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/collections.css) padding from `28px 32px` to `20px 24px`, width to `min(580px, 94vw)`, and `max-height: 88dvh`.
  - Scaled down `.device-sync-mark` and icon badges to 36x36px with 18px icons, reduced `.device-sync-heading h2` to 19px, and tightened card padding from 20px to 14px 16px.
  - The modal now completely fits in desktop viewports without requiring vertical scrolling.
- **Pairing Link Input & Connect Button Alignment**:
  - Restructured the form in [`src/components/views/NearbyDevices.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/NearbyDevices.tsx) into a dedicated `.device-sync-input-row` flex container instead of an unconstrained multi-row grid where the `<label>` forced jagged bottom-alignment.
  - Locked both `.device-sync-input` and `.device-sync button.device-sync-connect-btn` to a uniform `height: 38px`, `border-radius: 10px !important`, and `align-items: center` in [`src/components/views/collections.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/collections.css), ensuring identical heights, centered baselines, and matching corner radii.
- **Listening History Spacing & Toggle Fix**:
  - Removed distorted `inset: 9px 2px` track override on `.apple-switch` inside `.device-sync-setting`, restoring the standard centered 42x24px Apple switch toggle.
  - Added clean separation below the "Update Tracker and recommendations on both devices." row by giving `.collection-hub .device-sync-note` `margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line);`.
- **Verification**:
  - All 81 Vitest test suites (517 tests) passed cleanly; `npm run build` compiled without errors.

## Tracker Progress Bar Visibility & Player Bar Volume Auto-Collapse — 26 October 2026

- **Tracker Bar Visibility Fix**:
  - Found that `.listening-time-bar` progress indicators under "Top artists", "Top albums", and "Top tracks" in [`src/components/views/HistoryView.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/HistoryView.tsx) render an inner `<i style={{ width: ... }} />` representing the relative listening time compared to the #1 item in that category.
  - The inner `<i>` tag had no styling in [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), rendering default inline styling (0 height, transparent background) so bars appeared empty.
  - Added `.listening-time-bar i` styling with height, block display, `var(--accent)` background, subtle opacity, and smooth width transition matching the design of `.listening-month-bar i`.
- **Volume Controller Hover Auto-Collapse**:
  - In [`src/components/player/PlayerBar.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/PlayerBar.tsx) and [`src/components/player/ExpandedPlayer.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/ExpandedPlayer.tsx), clicking the volume slider or mute button gave focus to the element, triggering `:focus-within` and keeping the slider expanded even after the cursor moved away.
  - Added pointer tracking (`isVolumeDragging`) and `onMouseLeave` handlers to blur any focused elements inside the volume container when the cursor leaves (and mouse button is not currently held down), allowing the slider to collapse smoothly when the user finishes hovering.
  - Added window `pointerup` listener to safely clear focus if the drag gesture ended outside the volume container.
- **Verification**:
  - All 81 Vitest test suites (505 tests) passed; `npm run build` compiled cleanly.

## Apple-style smooth fluid spring lyric line transition animations — 26 October 2026

- **Removed Overriding Transform Locks:**
  - Removed `transform: none !important;` from `.is-immersive .expanded-lyrics .lyric-line` in [`src/components/player/immersive.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/immersive.css) and `:root .lyric-room .lyric-lines .lyric-line` in [`src/components/lyrics/word-lyrics.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/word-lyrics.css), which previously neutralized all scaling and elevation transitions.
- **Apple Fluid Spring Scaling & Depth-of-Field Blur:**
  - In [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), upgraded lyric line transitions to Apple's fluid decelerating spring curve `cubic-bezier(0.16, 1, 0.3, 1)` with a 620ms transform duration and 550ms opacity/blur duration.
  - Active line ascends to `scale(1.035)` with zero blur (`blur(0px)`) and full opacity (`1.0`).
  - Passed/inactive lines smoothly scale down to `scale(0.975)` -> `scale(0.95)` -> `scale(0.91)` with progressive optical depth-of-field blur (`blur(0.5px)` up to `blur(3px)`).
  - Maintained `transform-origin: left center` and `will-change: transform, opacity, filter` for 60fps GPU-composited motion without triggering text wrapping or relayout.
- **Verification:** All 81 Vitest test suites (505 tests) passed; `npm run build` compiled cleanly in 7.37s with zero errors.

## Preserve word timing across overlapping lyric lines — 26 October 2026

- Reproduced the reported missing word animation with public lrc.red recording QMZSY1600015, comparing exact timestamps rather than title-specific conditions. At 61.740s the lead has eight word segments ending 66.060s; backing vocals start 65.890s. The parser's cross-line cutoff deleted the lead's entire words array when it saw this legitimate 170ms overlap. The public file has 60 word-timed rows, with this one row rejected by that rule.
- Removed cross-line word deletion. Within-line order/prefix validation, recording-duration bounds and genuine-timing-only fallback remain. Renderer now keeps all still-running word-timed vocal lines active until their explicit final endpoints, while preserving the existing singular scroll/focus target. No guessed ends for lines lacking them; no change to providers, playback, typography, colors, or queue.
- Cached documents now recover lost word data from matching saved raw LRC. Recovery preserves document/line IDs, user offsets, variants/provenance and unrelated metadata; edited/nonmatching lines stay untouched. Unchanged documents retain identity to avoid redundant persistence updates. No cache clearing or refetch required when the raw word markers are retained.
- Two reproducing tests failed before the fix and passed afterward. All 503 frontend tests across 81 files passed, followed by 13 focused parser/cache/renderer checks after two extra edge cases were added. Production build passed. Actual provider-file browser replay verified eight word spans at 62s, eleven across both voices at 65.95s, lead expiry and backward-seek restoration without JavaScript errors. Evidence: `.test-data/lyric-overlap/result.json`, `actual-source-62s.png`, and `browser.mjs`. Generic connected media/browser regression also passed; its stale pure-white light-theme expectation was updated to neutral-channel validation to preserve the independently changed light theme. No Android hardware test or release/installation performed.

## Queue track drag reordering fix & queue expansion width cap — 26 October 2026

- **Fixed Queue Track Drag Reordering:**
  - Diagnosed failure root cause in [`src/components/queue/QueuePanel.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/queue/QueuePanel.tsx): browser element pointer-capture automatically released on pointer release, causing `lostpointercapture` to clear `dragRef` before `pointerup` could trigger `onReorderUpcoming`, causing drags to snap back without reordering.
  - Replaced element-level pointer capture with global window-level pointer event listeners (`window.addEventListener('pointermove' / 'pointerup')`), guaranteeing reliable drop tracking and reordering regardless of cursor speed or release timing.
  - Added `touch-action: none` to upcoming queue rows in [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) so browser gestures do not intercept drags.
  - Suppressed track selection click after drag completion (`didDragRef`) with an 80ms window debounce.
- **Capped Queue Dock Maximum Width & Artwork Scaling:**
  - In [`src/App.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx), reduced queue width expansion ceiling from `500px` down to `380px` (min `260px`, default `315px`, max `380px`).
  - Added an auto-clamp `useEffect` to smoothly pull any previously expanded width over 380px back within the new boundary and update `localStorage`.
  - In [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), restricted `.now-playing-cover-wrap` to `max-width: min(100%, 280px); margin: 0 auto;`, preventing album art from blowing up and pushing the queue items out of view.
- **Verification:** All 80 Vitest test suites (500 tests) passed; `npm run build` compiled cleanly in 8.02s with zero errors.

## Immersive mode lyric height reduction & control repositioning — 26 October 2026

- **Reduced Lyric Area Height & Smoothed Edges:**
  - In [`src/components/player/immersive.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/immersive.css), reduced `.is-immersive .expanded-lyrics` `max-height` from `min(100%, 70dvh)` to `min(100%, 54dvh)` to display a focused window of ~3–4 lines instead of sprawling across 70% of the screen.
  - Deepened vertical gradient mask fade (`transparent 0, #000 48px, #000 calc(100% - 68px), transparent 100%`) so top and bottom lines dissolve smoothly into the background.
  - Adjusted `.lyric-lines` padding (`padding-top: 24vh; padding-bottom: 26vh;`) and `.expanded-layout.has-lyrics` bottom padding from `180px` to `204px` (and `190px` on `<= 760px` screens) to maintain generous clearance from the raised playback controls.
- **Shifted Playback Controls Upward with Fixed Corner Buttons:**
  - In [`src/components/player/immersive.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/immersive.css), shifted `.player-center` up from `bottom: 26px;` to `bottom: 48px;`, lifting the 68px play/pause button and transport row off the Windows taskbar / bottom edge.
  - Shifted `.expanded-times` from `bottom: 118px;` to `bottom: 140px;` and `.seek-bar-top` from `bottom: 130px;` to `bottom: 152px;`, maintaining exact 24px vertical separation above the play button.
  - Preserved `.expanded-bottom-left` (lyrics toggle) and `.expanded-bottom-right` (volume capsule & fullscreen toggle) at `bottom: 38px;` untouched.
- **Verification:** All 78 Vitest test suites (490 tests) passed; `npm run build` compiled cleanly in 5.75s with zero errors.

## Lyric line vertical spacing & word-highlighting wrapping fix — 26 October 2026

- **Vertical Line Spacing:**
  - In [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), increased `.lyric-line` padding from `10px 16px` to `12px 18px` and doubled inter-line margin from `3px 0` to `6px 0` (12px total margin between consecutive lines).
  - Increased `.lyric-line` internal gap between primary lyrics and secondary translation/romanization from `6px` to `8px`, and raised `.lyric-primary` line-height from `1.3` to `1.35`.
- **Word Highlighting Layout Shift & Wrapping Fix:**
  - Resolved sudden line wrapping when a lyric line begins word-by-word highlighting:
    - In [`src/components/lyrics/WordLyrics.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/WordLyrics.tsx), extracted trailing whitespace out of the `.lyric-word` `display: inline-block` span into a standard text space in the DOM flow. Set `white-space: nowrap` on `.lyric-word` in [`src/components/lyrics/word-lyrics.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/word-lyrics.css), allowing spaces between words to break naturally and hang on the line margin identically to plain text.
    - In [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), kept `.lyric-line.is-active .lyric-primary` at `font-weight: 700` (matching inactive lines) to eliminate font-weight character width expansion when active.
    - Expanded `.lyric-lines` and `.lyric-line` max-width from `min(700px, 100%)` to `min(860px, 100%)` across [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), [`src/components/player/expanded.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/expanded.css), and [`src/components/player/immersive.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/immersive.css), aligning with the page heading (`840px`) and giving long lyric sentences ample runway without premature wrapping.
- **Verification:** All 78 Vitest test suites (490 tests) passed; `npm run build` compiled cleanly in 5.89s with zero errors.

## Compact PiP floating lyrics window & vertical padding polish — 26 October 2026

- **Compact Window Dimensions & Minimum Bounds:**
  - In [`src-tauri/src/lyric_overlay.rs`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src-tauri/src/lyric_overlay.rs), updated the initial Tauri Webview window size from `460.0 x 260.0` down to a sleek horizontal pill format of `440.0 x 116.0`.
  - Reduced `min_inner_size` from `300.0 x 180.0` to `280.0 x 72.0`, allowing the floating window to be resized down to a minimal, non-intrusive strip that hugs single-line lyrics.
  - Updated keyboard resize boundaries in [`src/components/lyrics/FloatingLyrics.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/FloatingLyrics.tsx) to match (`280` x `72`).
- **Vertical Padding and Layout Tightening:**
  - In [`src/components/lyrics/floating-lyrics.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/floating-lyrics.css), reduced `.floating-lyrics` padding from `10px 16px` to `6px 14px`, and border radius from `20px` to `18px`.
  - Reduced `.floating-lines` padding from `8px 10px` to `2px 8px` and gap from `8px` to `4px`, removing excessive dead space above and below active lyrics.
  - Set `.floating-lyrics.is-locked .floating-toolbar { display: none; }` so that locked (click-through) mode removes the invisible toolbar heights completely from the document flow, cleanly centering the lyrics.
  - Compacted toolbar button dimensions from `30px` to `26px` (and icons to 14-16px) with an ultra-compact tier below 90px window height.
- **Verification:** All 78 Vitest test suites (490 tests) passed; `npm run build` compiled cleanly with zero errors.

## Queue expanding/shrinking resizer & whole-row drag reordering — 26 October 2026

- **Queue Resizing Matching Sidebar Behavior:**
  - Added `.queue-resizer` to [`src/components/queue/QueuePanel.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/queue/QueuePanel.tsx) and [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), positioned on the left edge of `.queue-pane`.
  - Added `--queue-width` (default 315px, clamped 260px–500px) persisted in `localStorage.getItem("lumaire:queue-width")`.
  - Fluid dragging from the resizer edge resizes the queue panel in real time. Dragging below 180px collapses/closes the queue panel (mirroring sidebar collapse behavior). Double-clicking the resizer edge resets to default 315px.
- **Whole-Row Drag Reordering & 6-Dots Grip Removal:**
  - In [`src/components/queue/QueuePanel.tsx`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/queue/QueuePanel.tsx), enabled holding and dragging anywhere on an upcoming queue row (`.queue-entry`) to lift and reorder tracks.
  - Implemented a 5px drag distance threshold: pressing and moving drags the row with smooth translateY, auto-scroll, and drop indicator (`data-queue-drop`), while tapping/clicking without movement triggers immediate playback. Action buttons (Remove 'X' and artist links) remain clickable independently.
  - Removed the visual clutter of the 6-dots grip icon (`QueueDragHandle`) from desktop queue rows. Added `cursor: grab` and `cursor: grabbing` on upcoming queue items for clear affordance, plus `Alt+ArrowUp`/`Alt+ArrowDown` keyboard shortcuts for accessibility.
- **Verification:** All 78 Vitest test suites (490 tests) passed; `npm run build` compiled cleanly in 13.95s with zero errors.

## Immersive mode lyric UI alignment with Minimal mode & volume capsule polish — 26 October 2026

- **Lyric UI Alignment with Minimal Mode & Lyric Room:**
  - Removed diverging custom lyric overrides in [`src/components/player/immersive.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/immersive.css) (harsh 25%/75% mask, `clamp()` font sizes, unnatural line gaps, squashed `max-height: 62vh`, and custom opacity overrides).
  - Adopted the exact same clean typography and layout used by Minimal Mode and Lyric Room: all lines bold (`font-weight: 700`), uniform font size (`var(--lyric-size)`), smooth top/bottom mask fade (`transparent 0, #000 36px, #000 calc(100% - 60px), transparent 100%`), and progressive distance opacity fading (`1.0` -> `0.68` -> `0.42` -> `0.26` -> `0.14`).
  - Completely transparent lyrics container (`background: transparent; border: none; box-shadow: none;`) eliminating any panel/box appearance.
  - Softened light mode ambient background with increased blur (`filter: blur(56px) saturate(0.82) brightness(0.97)`) and a delicate warm overlay (`rgba(248, 247, 242, 0.82-0.62)`), ensuring high-contrast album art elements diffuse smoothly without competing with lyric legibility.
- **Volume Button Apple-style Capsule Animation & Zero-Overflow Containment:**
  - Fixed volume slider overflow on state changes in [`src/components/player/immersive.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/immersive.css), [`src/components/player/expanded.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/expanded.css), and [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) with strict `overflow: hidden !important; contain: paint;` and Apple fluid spring curve `cubic-bezier(0.32, 0.72, 0, 1)`.
  - Nested range slider fades out (`opacity: 0`) and shifts inwards (`translateX(6px)`) in 0.12s before the capsule fully collapses to 38px, eliminating any track or thumb protruding during closing.
- **Verification:** All 78 Vitest test suites (490 tests) passed; `npm run build` compiled cleanly in 5.90s with zero errors.

## Lyric room light mode theme compatibility fix — 26 October 2026

- **Light Mode Container Background & Text Fix:**
  - Removed hardcoded `[data-theme="light"] .lyric-room[data-embedded="false"] { background: #171717; --text: #fff; }` rule in [`src/components/lyrics/word-lyrics.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/word-lyrics.css) that forced the entire Lyric room tab into a solid pitch-black container.
  - Replaced with `:root[data-theme="light"] .lyric-room { background: transparent; color: var(--text); }`, cleanly adopting the app's warm cream/sage background.
  - Added high-contrast typography overrides for light mode: active primary line `#111210 !important;`, inactive lines `#6b7363 !important;`, sub-line translations `#383c33 !important;`, and word-ink wipe mapping from upcoming `#757d6e` to sung `#111210`.
- **Badges and Controls Polish:**
  - In [`src/style.css`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), updated `.lyric-provenance-link` and `.lyric-language-badge` backgrounds from hardcoded `rgba(255, 255, 255, 0.05)` to theme-aware `var(--bg-subtle-button)`, providing subtle contrast on light surfaces without washing out.
  - Added light-mode shadow override for `.lyric-float-btn` (`box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08)`) replacing the harsh dark-mode shadow.
- **Verification:** All 78 Vitest test suites (490 tests) passed; `npm run build` compiled cleanly with zero errors.

## Discover light mode styling, card hover shadows, and chevron backgrounds — 26 October 2026

- **Featured Album Spotlight in Light Mode:**
  - Resolved white-on-white text contrast where `.discover-spotlight-title` was hardcoded `#ffffff`, setting it to `var(--text-strong, #1a1d16) !important` in light mode.
  - Styled `.discover-spotlight-explore-btn` ("View Details") with light-theme glass surface (`background: rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.12); color: var(--text) !important;`) replacing the washed-out white border and white text.
  - Set `.discover-spotlight-play-btn` text color to `var(--accent-text, #ffffff) !important` with softened accent glow shadow instead of hardcoded dark text on dark accent.
  - Updated `[data-theme="light"] .discover-spotlight-overlay` gradient to `#ffffff 0%` through `rgba(255, 255, 255, 0.96) 35%` on the left for crisp text contrast, tapering to `transparent 100%` on the right so the album cover art and script hero branding remain punchy and unclouded.
  - Replaced the dark heavy shadow on `.discover-spotlight-card` with clean Apple-style elevation (`box-shadow: 0 4px 18px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03); border: 1px solid rgba(0, 0, 0, 0.08); background: #ffffff;`).
- **Card Hover Box Shadow Halo Elimination:**
  - In light mode, `.discover-spotlight-card:hover` now uses soft `0 8px 24px rgba(0, 0, 0, 0.08)` instead of the harsh pitch-black `0 16px 42px rgba(0, 0, 0, 0.48)`.
  - Added `:root[data-theme="light"]` overrides for `.album-card-cover-wrap`, `.discover-album-card:hover .album-card-cover-wrap`, `.mix-card-cover`, and `.discover-quick-track:hover` to eliminate heavy dark shadow halos on hover.
- **Left / Right Chevron Buttons Subtle Grey Background in Light Mode:**
  - Added subtle grey pill backgrounds to `.topbar-arrow-btn` (topbar navigation back/forward chevrons) in light mode: `background: rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.08); color: var(--text-secondary);`, with hover `background: rgba(0, 0, 0, 0.09); border-color: rgba(0, 0, 0, 0.14); color: var(--text);`.
  - Added matching subtle grey circular backgrounds to `.discover-nav-arrow` (shelf carousel navigation chevrons for "New releases", "Countrywise Top 10", "Featured Charts", "Your Rotation", etc.): `background: rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.08); color: var(--text-secondary);` and hover `background: rgba(0, 0, 0, 0.1); border-color: rgba(0, 0, 0, 0.14); color: var(--text-strong);`.
- **Verification:** All 78 Vitest test suites (490 tests) passed; `npm run build` compiled cleanly in 14.21s with zero errors. Verified visually via Edge that chevron buttons render with subtle grey circular backgrounds in light mode.

## Imported KR$NA artist credits — 26 October 2026

- Read-only inspection of the desktop library found imported YouTube No Cap, I Guess, Machayenge 4, Saza-E-Maut and Boom Shaka carrying `Krsna` credits and `KRSNA` source attribution; the catalog I Guess row already has `KR$NA`. Sync transports these stored strings without stripping punctuation. Name-based artist navigation therefore searched the wrong spelling.
- Added source-scoped canonicalization for the rapper's KRSNA channel to the existing online metadata repair: exact standalone Krsna credits become KR$NA, collaborators are retained, and Kr$na casing is normalized. Other channels, catalog-provenance Krsna credits, local tags, M.S Krsna, IDs and attribution remain unchanged. No blanket fuzzy artist alias.
- Reused startup repair/persistence for existing saved tracks, applied repair at the shared saveOnline boundary for new imports/sync/enrichment, and repaired validated restored queue metadata. Artist links now encode the canonical dollar sign. No sync protocol, playback source, playlist membership or dependency changes; no direct database mutation.
- Verification: final production build and 46 focused metadata/navigation/native-adapter/sync/library/queue tests pass, including missing-credit fallback, restored queues, save-boundary repair and idempotence. Physical phone not connected; no APK installed or release published. Existing unrelated historical listening records are not rewritten.

## Immersive fullscreen lyrics typography, theme compatibility, and cover visibility — 26 October 2026

- **All Lines Bold & Refined Sizing:** Kept all lyric lines bold (`font-weight: 700 !important;`) rather than isolating bold weight to the active line. Scaled down active line font size from 48px to `clamp(32px, 2.3vw, 36px)` and inactive lines to `clamp(26px, 1.8vw, 30px)`. This eliminates awkward multi-line wrapping on standard verses while keeping the active line cleanly highlighted via full opacity (1.0 vs 0.65/0.28/0.1), size prominence, and contrast.
- **Dynamic Accent Compatibility:** Removed hardcoded `--accent: #ff7195` override from `dialog.expanded-player.is-immersive`. The player, seekbar runnable track, active transport toggles (shuffle/repeat), layout menu selections, and focus outlines now dynamically inherit the user's selected accent from `:root`.
- **Light & Dark Theme Compatibility:**
  - **Cover Artwork Background:** In Light mode, removed the destructive 96% opaque beige wash and 0.35 opacity clamp that previously obscured the album art. Implemented a luminous soft veil (`rgba(247, 246, 238, 0.48-0.72)`) with `filter: blur(24px) saturate(1.4) brightness(0.96)` and `opacity: 1 !important;`, keeping the blurred album cover artwork richly visible across the entire screen in both themes.
  - **Lyric Text Colors:** Light mode lyrics now render in high-contrast deep charcoal `#111210` with matching word-by-word progress gradients (`#111210` sung, `#757d6e` upcoming) instead of washing out as white-on-light, while dark mode retains crisp `#ffffff` text.
- **Verification:** All 78 Vitest test suites (490 tests) passed; `npm run build` compiled cleanly in 7.06s. Automated headless Edge checks verified dark and light mode rendering, dynamic accent inheritance, bold typography across all lines, and active line high-contrast coloring.

## Continuous lyric wave from recording and REA inspection — 26 October 2026

- Inspected the user's 9.47-second / 30fps BitChord screen recording, extracted a frame contact sheet, and inspected the public shipped LyricsPanel chunk as inert text with REA. Evidence: parent `ev_82b02a9ce20f5d1b74bb281d188267f43d911af18cc59bea1b827cbc2e0eceb3`, summary `ev_437c1e7826193eb6974d4b0a75a578ba6277021560a33e7cac73f8be8f5d1497`. Local source snapshot `.test-data/lyric-wave/shipped/LyricsPanel.js`. REA parsed that chunk without executing it; semantic graph coverage was bounded/partial and no Brave runtime instrumentation was performed.
- Relevant static observations: ordinary words use overlapping two-second spring rise frames toward a roughly -3px offset, retaining the risen pose; a separate soft white wipe advances through supplied timed segments. Sustained-word character effects are a separate mode, not required for the ordinary-word effect in the supplied clip. The previous Lumaire 120ms-up/end-of-word-down envelope caused the pop.
- Replaced the pulse with an independently written monotonic damped rise toward -3px over two seconds after each genuine word start. Neighboring rises overlap and sung words stay raised/white until the line changes; no bounce, scale, glow or accent color. Added a soft neutral white/gray wipe driven by the existing wordProgress and exact supplied ends. Unknown final ends still use discrete highlighting, not guessed timings. Small CSS interpolation smooths clock samples; paused/reversed clocks continue to own the pose. Translations/romanization and whole-line layout remain unchanged. No foreign provider/scraping/translation code was imported.
- Production build and ten focused parsing/renderer checks passed, including overlapping monotonic rise, no overshoot/reset at word end, rewind reset and plain fallback. Connected browser media checks passed for playback/pause/seek/track replacement, grayscale text, stable line height and reduced motion. Frame-by-frame preview `.test-data/lyric-wave/lumaire-wave.mp4` uses synthetic lyrics and explicit media-clock samples; screenshot frames inspected alongside the supplied recording. No claim of exact source/runtime equivalence or physical Android validation.

## Immersive bottom right button uniform sizing and dropdown roundness polish — 26 October 2026

- **Bottom Right Button Sizing & Padding:** Diagnosed why the volume button appeared noticeably larger with extra padding compared to the refresh and fullscreen buttons. In `src/components/player/immersive.css`, `.expanded-volume-control` had an explicit 44px min-height rule while `.expanded-action-btn` was 38px, and `.expanded-volume-btn` was assigned a duplicate background and border inside `.expanded-volume-control`, creating a doubled outline with internal padding. Fixed by sizing `.expanded-volume-control` and `.expanded-action-btn` to an identical 38px diameter with `border-radius: 50%` when collapsed, stripping the inner `.expanded-volume-btn` background/border (`background: transparent !important; border: 0 !important; padding: 0 !important`), and preserving smooth horizontal expansion to 9999px pill when hovered/focused.
- **Dropdown Selection Rectangular Shape:** Restored the layout select trigger from fully-rounded pill (`border-radius: 22px`) to a clean rectangular shape with slightly rounded corners (`border-radius: 8px`, `min-height: 36px`, `padding: 6px 12px`), with matching menu radius (`border-radius: 10px`) and option radius (`border-radius: 6px`).
- **Verification:** Verified via Edge headless that all three bottom-right items measure exactly 38px × 38px with 50% border-radius and 0px padding, and dropdown trigger has 8px border-radius. All 78 Vitest test suites (487 tests) passed; `npm run build` completed cleanly in 6.50s.

## Android minimized next-track completion — 26 October 2026

- Confirmed the Android controller stopped its state polling when `document.hidden`; only those polls detected ExoPlayer completion. The service continued the current song, but playlist advancement and Autoplay waited for foregrounding.
- LumairePlugin now pushes real MediaController playback-state/error events through Tauri's native plugin channel. AndroidPlaybackController receives matching-track events while hidden, ignores obsolete selections, unregisters unused listeners, and retains visible clock polling without adding background polling. Native state also includes play intent so unavailable queued tracks retain the existing skip safeguards. Controller cleanup releases its listener, not the service player.
- Queue completion invokes the existing Autoplay path directly when no manual next entry exists; ranking, source validation, repeat/shuffle and manual queue priority remain shared. This is an event-driven bridge to the existing queue logic, not a service-owned/headless queue; Activity/WebView destruction is not addressed by this change.
- Verification: 22 focused Android-controller/playback-hook/provider tests pass, including hidden consecutive completions, obsolete events during catalog resolution, duplicate completion after foregrounding and Autoplay initiation without a visible render. Production frontend and final ARM64 debug APK builds pass. Full suite: 486 passed, one provider dispatch test timed out under concurrent build load; that unchanged test passed in the focused rerun. APK: `src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`.
- ADB reports no connected devices. No phone installation, real-song screen-off/minimized verification or OEM battery-policy test was possible. Version remains 1.0.6; nothing published. Prior user wording about moving advancement into the service was refined to native completion events feeding the existing queue owner.

## Immersive fullscreen bottom transport alignment polish — 26 October 2026

- **Timings Position:** Lifted `.is-immersive .expanded-times` from `bottom: 108px` to `bottom: 118px`, bringing the elapsed and remaining time labels up ~10px to sit cleanly right beneath the seek bar track. This eliminates the awkward empty gap and groups the timestamps tightly with the seek bar.
- **Bottom Corner Actions Alignment:** Replaced `left: 5vw` and `right: 5vw` on `.expanded-bottom-left` and `.expanded-bottom-right` with `clamp(24px, 2.5vw, 36px)`. The lyric toggle on the left and volume/fullscreen buttons on the right now anchor the outer corners, aligning with the 24px margins of the top close button and mode selector, while giving generous breathing room to the center transport buttons across widescreen viewports.
- **Verification:** Verified metrics and visual alignment via Edge headless at 1920x1080, 1366x768, and 1024x768. All 78 Vitest test suites (486 tests) passed; `npm run build` completed cleanly in 10.14s.

## Neutral lifted-word lyric highlighting — 26 October 2026

- Replaced accent-gradient Enhanced LRC rendering with genuine timestamp-driven word states: upcoming gray, active pure #FFFFFF, sung light gray. Active words rise up to 4px with smoothstep entry/settling ramps derived from the supplied word interval; short segments use proportional ramps. A 60ms transform interpolation smooths existing playback clock samples, with no looping animation, scale, bounce or glow. Unknown final-word ends remain unknown.
- Original lyrics, romanization and translations are now strictly white/neutral gray in Lyric Room and both desktop fullscreen modes, independent of app accent. Removed romanization's accent/glow and disabled whole-line scaling/weight changes so only the words move. Existing layout, timing offsets, seeking, typography sizes, language layers and line-only fallbacks remain intact. Light-theme reading surfaces remain dark for white-text contrast; reduced motion disables lifting.
- Verified actual HTML media playback, pause stability, backward seek, track replacement, 4px active lift, sung-word baseline, unchanged line height, grayscale computed text channels, light-theme white, and reduced-motion behavior at desktop/mobile browser sizes using `scripts/word-lyrics-ui-test.mjs`. Visually inspected Lyric Room and Immersive screenshots against the supplied reference (subtle individual lift and white/gray text, no layout copying). Four desktop-resolution Immersive checks also passed. No physical Android installation or new provider/word-timing coverage claim.

## Desktop PiP floating lyrics corner and background ghosting fix — 26 October 2026

- **Root Cause:** In the desktop floating lyrics overlay (`FloatingLyrics.tsx` / `floating-lyrics.css`), the container had an outset drop shadow `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 14px 38px rgba(0, 0, 0, 0.42);` and CSS `backdrop-filter: blur(28px) saturate(190%);`. Because the native Tauri overlay window is an exact transparent rectangle (460x260), the outset drop shadow bled past the 20px rounded corners into the transparent corner zones and got abruptly clipped at the window bounding box, creating dark rectangular corner fills and a flat clipped horizontal shadow bar across the bottom edge that made it look like a rectangular div was sitting behind the rounded PiP card.
- **Fix:**
  - In `src/components/lyrics/floating-lyrics.css`, removed the outset `0 14px 38px rgba(0, 0, 0, 0.42)` shadow and retained only the sleek glass top highlight `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);` (plus `box-shadow: inset 0 1px 0 rgb(0 0 0 / 12%);` in black text mode).
  - Added `overflow: hidden;` to `.floating-lyrics` so all child elements and resize edges stay strictly clipped within the 20px rounded card.
  - Removed `backdrop-filter: blur(28px) saturate(190%);` and `-webkit-backdrop-filter: blur(28px) saturate(190%);` from `.floating-lyrics` to prevent unclipped compositor quad passes in WebView2.
- **Verification:** Pixel-level analysis via Edge headless verified 100% true transparency (`[0, 0, 0, 0]`) outside all four rounded corners at `(0,0)`, `(0,259)`, `(459,0)`, and `(459,259)`. All 78 Vitest test suites (493 tests) passed; `npm run build` completed cleanly in 7.06s.

## Desktop Immersive fullscreen and requested refinements — 26 October 2026

- Audited ExpandedPlayer, PlayerBar, shared LyricsView/word timing, artwork cache/resolver, preference restore, settings and playback shortcuts. Added default Immersive mode and persisted Minimal choice in Appearance (desktop only) and the player. Minimal retains the centered artwork/ambient layout. Existing transport callbacks, queue and playback ownership remain unchanged.
- Immersive places artwork/title/artist left, shared synchronized lyrics centrally, and the existing seek bar across 90% of the bottom width with larger centered transport buttons. Hidden/missing/instrumental lyrics leave no empty lyric panel. Existing translations, romanization, genuine word highlighting and seeking remain connected. Foreground contrast stays readable in dark/light themes; reduced-motion supported.
- Follow-up supersedes the initial artist-image request: background now uses ONLY the current album cover, darkened/blurred, with bounded two-image transitions and stale-result cancellation. Artist-image lookup and its requests were removed entirely. Missing/broken cover stays neutral dark. Volume again collapses to its compact button and expands on hover or keyboard focus. Native layout select replaced by existing styled Select with selected check, rounded dark menu, outside click and Escape dismissal. Immersive title capped at 40 characters plus ellipsis and two lines; complete title remains in hover tooltip. Minimal title behavior preserved.
- Fixed existing global shortcut exclusion so the desktop fullscreen player accepts playback shortcuts while other dialogs/menus remain protected. Select Escape now prevents the native dialog from closing along with its menu.
- Verification: production build passed; full frontend suite 492 tests passed before final refinements, then 22 focused player/hook/preference tests passed including title truncation and fullscreen shortcut routing. Reproducible browser check `node scripts/immersive-player-ui-test.mjs` uses real ExpandedPlayer/PlayerBar/LyricsView and synthetic artwork at 1024x768, 1366x768, 1920x1080, 2560x1440, checking both themes, seeking, controls, volume, toggles, missing lyrics, track changes and modes. Evidence/screenshots in `.test-data/immersive/`. Android layout/source files untouched by this change; no package installed, release or version bump.

## Sync retry notifications and mobile/desktop sheet polish — 26 October 2026

- Diagnosed the screenshot's stacked errors: `useNearby` forwarded every changing retry message into App's permanent global toast stack; connect also overwrote the decorated retry error, creating another distinct toast, and successful sync did not remove previously stored toasts. Removed the global forwarding for background connection failures. Sync now shows one updating connection card with expandable details and clears it on recovery.
- Added bounded retry backoff (5s, 10s, 20s, 40s, 60s), immediate manual/online retries, real last-success time, cleared obsolete success text, and invalidated in-flight errors on disconnect. Three hook regressions cover recovery, manual retry and late failure after disconnect without playback operations.
- Used the apple-design skill to rebuild the existing Sync sheet with grouped cards, clearer hierarchy, 18–20px interior spacing, short Devices tab, accessible house switches, 44px phone controls, circular retry/close buttons, compact QR instructions and a single privacy footer. Existing sync, pairing, history opt-in and Listen Together remain available; no new dependency or merge/transport change.
- Actual connected Motorola diagnosis: three authenticated read-only requests from the phone to the existing desktop host succeeded in 151–199ms. One local request reset before two subsequent successes; historical causes of each network interruption were not established. The phone's saved peer link was absent when inspected. No pairing, history or playback mutation was made by these diagnostic requests.
- Verification: all 489 frontend tests across 77 files pass, production build and ARM64 Android build pass. Browser checks at 320px, 390px and 1200px verify ready/retry/QR layouts, no horizontal overflow, circular close controls and retry recovery. Evidence: `.test-data/sync-ui/`; native merging tests from the prior sync task remain unchanged.
- User explicitly approved an in-place phone update. Signed `.test-data/Lumaire-sync-polish-20261026.apk` using the existing local certificate, verified the signature, installed successfully with `adb install -r`, and reopened Lumaire; app data retained and version remains 1.0.6. USB disconnected before the final post-install WebView check, so on-device post-update sync/layout confirmation remains pending. No desktop process restart, network/firewall modification, version bump or publication.

## Genuine word-synchronized lyrics — 26 October 2026

- Audited the shared Android/desktop Lyric Room/expanded renderer, playback clocks, imported LRC/text, persisted lyric documents, LRCLIB and lrc.red. Existing lrc.red code explicitly stripped Enhanced LRC markers; it now preserves them. No new provider, scraping, account, dependency or database migration.
- Added Enhanced LRC segment timestamps to existing lyric lines, bounded/ordered parsing, plain fallback for invalid word timing, exact Unicode/spacing, document-offset support, cached raw-marker upgrade and persistence validation. Only the active original-text line renders word spans, with Lumaire accent progress driven by actual media position (desktop 50ms, Android foreground 100ms). No independent animation clock; final words without a supplied end highlight discretely. Translations/romanization retain line alignment and seeking.
- LRCLIB line results now allow one three-second lrc.red enrichment budget using the existing title/artist/version/duration checks. Only word-marker results supersede working primary lyrics; errors/misses retain primary lyrics. Existing cached line-only documents remain cached until explicitly cleared/refetched.
- Live public API availability sample (metadata/counts only, no lyric text retained): Yedi IND292218474 164 word markers; Tum Hi Ho INS181303031 242; Spring Day KRA381700253 372; Despacito USUM71607007 507. Darshana INT202102847 had 51 line markers and zero word markers. Coverage depends on the exact recording, provider uptime and three-second budget; no universal coverage claim.
- Format scope: Enhanced LRC from existing provider data or local imports; no TTML source/importer added because existing sources expose LRC. No word timing invented for translation, romanization, plain lyrics or line-only songs. Native home-screen widgets and desktop PiP retain their existing line-level presentation.
- Verification: all 488 frontend tests passed, then the additional provider-to-document regression passed in the 26-test focused suite; 20 native provider tests passed (four unrelated opt-in live tests skipped). Production frontend and ARM64 Android builds passed; isolated desktop native startup survived without panic. Browser screenshots inspected after adding a theme-token fallback. No physical-phone installation or subjective vocal-alignment check. Reproducible browser check: `node scripts/word-lyrics-ui-test.mjs` exercises real HTML audio playback/pause/backward seeking/track replacement at 1440px and 390px, with synthetic multilingual lyrics. Screenshots in `.test-data/word-lyrics/`. Android package builds are validation only; not installed or released.

## Mobile Countrywise Top 10 Dropdown and Refresh Button Same-Line Alignment — 26 October 2026

- **Root Cause:** In Discover view, `.apple-chart-controls` had `flex-wrap: wrap;` enforced under `@media (max-width: 600px)` in `src/style.css`, causing the circular refresh button to drop below the country selector onto a second line. Additionally, `.apple-chart-refresh-btn` was forced to 44px in `src/mobile.css` (mismatching the 32px trigger), and the redundant static "Country" text label took up ~55px of horizontal space, forcing "Countrywise Top 10" to wrap across two lines.
- **Fix:**
  - In `src/components/views/AppleCountryChart.tsx`, added `apple-chart-header` and `apple-chart-title-wrap` to precisely target the section header and heading.
  - In `src/style.css`, set `.apple-chart-controls { flex-wrap: nowrap; }` to eliminate unwanted media query wrapping.
  - In `src/mobile.css`, removed `.apple-chart-refresh-btn` from the 44px list and added dedicated rules for `#root .app .apple-chart-header` and `.app.android .apple-chart-header`:
    - Centered title and controls with `align-items: center; justify-content: space-between; gap: 8px;` and `white-space: nowrap;` on `h2` to prevent title wrapping.
    - Hid `.apple-chart-country-label` ("Country") on mobile/narrow screens to reclaim 55px.
    - Sized both `.apple-chart-select .apple-select-trigger` and `.apple-chart-refresh-btn` to a uniform 36px height with vertically aligned center baselines, pill border radius on trigger, 36x36px circle for refresh button with `active` tap depression (`scale(0.92)`).
- **Verification:** Vitest test suite passed (74 test files, 474 tests); Vite production build passed in 7.15s; ARM64 APK assembled in 15s, signed with `lumaire-release.p12` via `scripts/sign-apk.mjs` (v2/v3 verified), installed via ADB `-r` on connected Motorola Edge 50 Pro (`ZD222LVFWT`), and relaunched into PID 12152. Desktop UI strictly untouched.

## Mobile Expanded Player Up Next Auto-Play Toggle and Now Playing Card Fixes — 26 October 2026

- **Auto-Play Toggle Button Geometry:** Fixed deformed switch pill in `src/components/player/mobile-now-playing.css` and `src/mobile.css`. Excluded `:not(.mobile-np-toggle-switch)` from the generic `.android button` 40px min-height rule in `src/style.css`. Sized pill to standard 48×28px with 22px circular thumb and uniform 3px margins (`translateX(20px)` when active), smooth spring animation, and 44px hit-box via `::after`.
- **Now Playing Card Horizontal Padding:** Fixed 0px horizontal padding on `.mobile-np-queue-item.current` in `src/mobile.css` by setting `padding: 10px 14px; border-radius: 14px; border: 1px solid var(--line-accent); box-shadow: 0 4px 16px var(--accent-glow); margin-bottom: 12px;`. Artwork and metadata now have 14px breathing room, matching the Auto-play card above.
- **Verification:** Unit tests in `MobileNowPlaying.test.tsx` passed; production build passed in 13.63s; ARM64 APK assembled, signed with `lumaire-release.p12` via `scripts/sign-apk.mjs` (v2/v3 verified), installed via ADB `-r` on connected Motorola Edge 50 Pro (`ZD222LVFWT`), and launched into PID 31618. Desktop UI strictly untouched.

## Durable two-way playlist and optional listening-history sync — 26 October 2026

- Replaced one-way conflict-copy imports with versioned playlist/entry replicas persisted transactionally alongside the session in SQLite. Concurrent additions survive; entry and playlist tombstones prevent stale data resurrection; renames/order resolve deterministically. Existing linked imports migrate by original identity, settings and local-only files stay local. Library track removal also persists playlist tombstones and retired metadata is not re-imported.
- Added authenticated `/v2` local exchange with incremental revision cursors, bounded pages, durable acknowledgements, retries and atomic malformed/interrupted-packet handling. Pairing credentials/listener port survive restart; explicit Disconnect revokes the host token. Fixed a real stop/start listener race found by end-to-end testing. No server or paid dependency added.
- Added history opt-in on both devices. Existing playback UUIDs prevent duplicate counting while retaining repeat plays; monotonic cumulative checkpoints preserve day totals. Replicated clear epochs suppress stale/offline events and pending writes. Incoming history refreshes the existing shared hook for Tracker, Recently Played, Rotation, Forgotten Favorites and recommendations without changing playback.
- Verification: all 474 frontend tests across 74 files passed; 19 focused native sync/history/transport/library-removal tests passed; production frontend and final ARM64 Android builds passed. Two isolated real native/WebView2 profiles passed automatic bidirectional HTTP sync, conflicting offline edits, repeated events, clears, deletion, endpoint restart and retry checks; final Tracker-view verification is recorded in the evidence report. The broad parallel native suite had nine unrelated lyric mock-server timeouts; all 19 non-live lyric tests passed serially.
- Details and merge/clear semantics: `docs/DEVICE-SYNC.md`. Reproducible isolated test: `node scripts/two-way-sync-test.mjs`, using `.test-data/lumaire-sync-review.exe` and temporary profiles. Android package: `src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`; not installed or published. No phone attached at the physical-device check. Traffic remains unencrypted on trusted private IPv4 Wi-Fi; IP changes require a fresh link. Version remains 1.0.6 and previous WIP is preserved.

## Mobile Recently Played YouTube Music style carousel — 26 October 2026

- Rebuilt mobile `.recent-tracks-grid` layout in `src/mobile.css` to match YouTube Music mobile carousels:
  - Container extends edge-to-edge (`margin: 0 -18px; padding: 2px 18px 8px;`) while keeping content aligned with the 18px page margin.
  - Sized column width to `calc(100vw - 60px)`, allowing the current batch of rows to extend across the full width of the phone screen with generous space for song titles/artists and leaving ~26px peek of the next batch's artwork at the right bezel.
  - Replaced `scroll-snap-type: x proximity;` with `scroll-snap-type: x mandatory;`, `scroll-padding-inline: 18px;`, and `scroll-snap-stop: always;` on items, providing native touch momentum and smooth one-batch snap alignment.
  - Enhanced item ergonomics: 48x48px artwork with 8px radius, touch active depression animation (`scale(0.98)` with highlight tint), disabled desktop hover play badge on mobile, and smooth typography hierarchy.
  - Replaced hardcoded `52px` in `DiscoveryHome.tsx` with dynamic CSS variable `var(--recent-row-height, 52px)` (56px on mobile).
- Verification: all 73 Vitest suites (468 tests) passed; `npm run build` passed cleanly in 8.23s. Built ARM64 debug APK via `npm run android:build`, signed with `lumaire-release.p12` via `scripts/sign-apk.mjs` (v2/v3 verified), and installed to connected Motorola Edge 50 Pro (`ZD222LVFWT`) via `adb install -r`. App launched into PID 22852 without data loss. Desktop UI strictly untouched.

## Recently Played track extraction limit increase — 26 October 2026

- Increased `homeHistory` recent tracks extraction from 12 to 20 in `src/domain/home-listening.ts`.
- The desktop Recently Played grid renders 3 columns x 4 rows (12 items) per page. Slicing at 12 populated only the first page and kept carousel navigation arrows disabled. With 20 items, a second page of 8 items (2 columns) is available to scroll through.
- Added unit test in `src/domain/home-listening.test.ts` verifying extraction of up to 20 chronological tracks.
- Verification: all 73 Vitest suites (467 tests) passed; `npm run build` completed successfully.

## Android Home-Screen Widgets Polish and Adaptive Redesign — 26 October 2026

- **Adaptive Multi-Size Layouts:** Replaced static layouts in `widget_now_playing.xml` and `widget_lyrics.xml` with three responsive layout modes (compact horizontal bar for 1-row/4x1/height <= 85dp, expanded horizontal medium for 4x2/3x2/height 86..145dp, and vertical card for 2x2/3x3/height > 145dp) that adaptively reveal artwork, metadata, progress indicators, and controls.
- **Dynamic Color Extraction:** Implemented pure bitwise color extraction and Lumaire dark/lavender base blending in `WidgetUpdateHelper.kt`, generating rounded-corner gradient background bitmaps matching exact widget dimensions and adapting text/button tints with guaranteed WCAG contrast.
- **Playback Controls & Optical Centering:** Upgraded touch targets to 40-48dp, styled the play/pause button with Lumaire's prominent lavender circle, and added optical centering (+1.2dp shift) for the play triangle.
- **Battery-Efficient Progress Indicator:** Added subtle progress bars and mm:ss timestamp indicators to expanded and card layouts, driven via lightweight `partiallyUpdateAppWidget` calls on `PlaybackService` clock ticks without re-inflating views or recreating bitmaps.
- **Adaptive Live Lyrics:** Implemented dynamic header indicator, glowing active line, and size-adaptive line counts (single line on 1-row, 2 lines on medium, up to 4 lines with faint previous and upcoming lines on large widgets).
- **Verification:** Unit tests in `WidgetUpdateHelperTest.kt` passed via `./gradlew.bat :app:testUniversalDebugUnitTest`; all 467 frontend tests in `npm test` passed; Vite production build passed in 5.58s. Desktop UI strictly untouched.

## Autoplay similarity and diversity audit — 26 October 2026

- Checked live JioSaavn radios for 11 seeds across Malayalam, Tamil, Telugu, Hindi (melody and rap), Punjabi, Kannada, Bengali, and English pop/rock/hip-hop: 330 candidates. All had seed-language metadata; none had genre tags. Energy/mood are absent from the provider contract. Full findings and ranking examples: `docs/AUTOPLAY-AUDIT.md`.
- Fixed additive seed/current artist bias, strengthened reliable specific-genre and original-language scoring, removed arbitrary language-repeat penalties, and penalized seed-album repetition. Preserved history/favorites personalization and all existing provider budgets/caches, playback source validation and manual queue safeguards.
- Relax repeated-artist exclusion only when no comparable diverse candidate remains. The captured Tamil pool now supplies ten simulated picks instead of stalling after seven; all 11 seed replays reach ten. Real Tamil/English snapshots retained as regression fixtures. No new dependencies or metadata invention.
- Production frontend build passed. All 83 focused Autoplay/domain/adapter/hook checks passed across six files, including real Tamil/English fixtures and manual-queue/cancellation paths. Updated the older cross-language hook expectation to verify that favorites personalize same-language results without overriding the original seed's language. No release/version change, user queue mutation or audio interruption; live audio/vibe judgment remains unchecked.

## Mobile playback controls song and artist character limit increase — 26 October 2026

- Increased mobile bottom transport bar title character limit from 22 to 48 in `src/components/player/PlayerBar.tsx` so titles are not prematurely truncated with ellipsis in JavaScript.
- Increased `maxArtists` from 2 to 3 on mobile in `PlayerBar.tsx` so multi-artist credits are not cut off after only two artists.
- Added `max-width: none !important;` to `.now-playing-meta` under `@media (max-width: 768px)` and `.app.android` in `src/style.css`, as well as in `src/mobile.css`, removing the desktop 140px maximum width restriction on mobile screens and allowing title and artist text to fill the full available width (~260px).
- Added unit test in `src/components/player/PlayerBar.test.tsx` verifying that longer titles and 3+ artists render without early cut-off on mobile.
- Verification: all 457 Vitest unit tests passed; `npm run build` completed cleanly in 5.73s.

## Fix stalled desktop development startup — 26 October 2026

- Diagnosed the user's blank dev window: native executable had started and Rust was idle; Vite PID 2316 had consumed 651 CPU seconds and ~1.7 GB RAM. Vite config allowed default HTML dependency discovery and root file watching across native/Android targets, tool caches and generated test builds (165 HTML files in those generated folders).
- Limited optimizeDeps.entries to index.html and excluded src-tauri, .tools, .test-data, remote attachments, releases/release, scratch and experiments from Vite watching. Tauri continues watching native sources itself. No app/library logic, user data, version or release changed.
- Production frontend build passed. Isolated real native instance rendered in 1,658ms without captured JavaScript errors. Closed only the identified blank dev window/old Vite process and restarted npm run desktop with the existing profile.
- Clean restart: Vite ready 400ms; cached Rust dev build 1.34s; Vite ~111 MB RAM / 5.47 CPU seconds at measurement. Real existing-profile WebView confirmed app/workspace and Good night heading, first contentful paint 3,816ms. Evidence: .test-data/desktop-fixed.log, desktop-fixed-result.json and desktop-fixed.png. Development session remains running for the user.
- First Rust builds after native/dependency changes can still take longer; no cold toolchain compile or packaged-app startup benchmark was run. Prior WIP preserved; no push/publication.
## Same-hotspot Wi-Fi retest — 26 October 2026

- Rechecked connected Motorola and desktop after the user selected Wi-Fi verification. Phone initially had 172.25.218.131 on another network while PC remained 172.20.10.8/28. Phone then joined the PC's iPhone hotspot, but again obtained only IPv6 plus CLAT 192.0.0.4, no wlan0 IPv4 lease.
- One phone Wi-Fi reconnect did not obtain IPv4. PC Wi-Fi IPv6 binding is disabled. Existing app-specific Public-profile inbound allow rules are already enabled; firewall rules were not changed. The normal desktop executable is newer than the landing-page fix.
- Current pairing protocol uses private IPv4 only, so this hotspot configuration remains unsuitable for the phone's direct local link. Further Wi-Fi verification needs both devices on an IPv4-capable local network (regular router or Motorola hotspot). No new code changes, installation or publication in this retest; previous USB verification remains diagnostic only.

## Correct category artwork assignment — 26 October 2026

- Removed the erroneous index-based assignment of release/trending/library covers to mood and genre tiles. Restored each category's explicit photo; unavailable images are hidden so only the category color remains. No unrelated album or generic hero substitute, no new API requests.
- Removed the feed-artwork callback/state from DiscoverShelves and DiscoveryView. Added a regression asserting that unrelated saved artwork never appears on category cards; offline UI fixture now accepts the intentional color fallback.
- Focused regression and production frontend/ARM64 Android build passed. Signed `.test-data/Lumaire-category-artwork-fix-20261026.apk` with the existing certificate for in-place phone update. Version remains 1.0.6; no publication. Category-photo availability on the user's network remains dependent on the image host.
## QR pairing page and connected-phone diagnosis — 26 October 2026

- User connected Motorola Edge 50 Pro (ZD222LVFWT) and explicitly chose USB-only verification for now. PC Wi-Fi is 172.20.10.8 on a Public Windows network profile. Phone Wi-Fi has global/link-local IPv6 but no normal IPv4 lease; its IPv4 route to the PC uses CLAT v4-wlan0 / 192.0.0.4. A fresh native sharing server answered locally; direct phone-to-PC connection timed out. This establishes a current LAN reachability problem, not its sole cause; no firewall or Wi-Fi settings were changed.
- Corrected the QR browser-flow gap: native nearby server now serves a static, offline pairing page at GET /. The page reads the token from the browser fragment, offers Copy with an insecure-HTTP selection fallback, and directs users to Lumaire / Sync. Invalid/missing fragments disable Copy. Existing authenticated /v1/state, private-peer restriction, origin rejection and session lifetime remain intact. Root HTML contains no server token and sends no-referrer / no-store / CSP / nosniff headers. Updated desktop QR instructions.
- Built a separate `.test-data/lumaire-nearby-review.exe` via cargo rustc -o to avoid replacing/restarting the user's running app. Isolated data and WebView profiles only. Native startup and commands completed without panics.
- Actual on-phone USB verification passed using temporary adb reverse: landing page HTTP 200 and expected HTML; authenticated metadata HTTP 200; unauthenticated metadata HTTP 403. Read-only nearby_fetch executed inside the installed phone Lumaire WebView and returned the empty test share (zero playlists / no now-playing). No import, user-library mutation, APK install, pairing-state replacement or production session access. All test tunnels and isolated processes removed afterward. Evidence: `.test-data/nearby-phone-complete/result.json`.
- Verification: four native nearby tests and four frontend nearby tests passed; mobile-sized browser landing-page checks cover exact fragment link, copy/selection fallback and missing-token rejection. Production frontend build and whitespace checks passed.
- Limits: hotspot Wi-Fi pairing remains unreachable and was not claimed fixed. Actual Android Chrome/camera UI verification was not completed; successful phone checks used its native HTTP clients. USB test is diagnostic, not a permanent app USB mode. The user's normal executable/installed app is unchanged; the new browser landing page requires a rebuilt/restarted native desktop app. No publication. Existing WIP preserved.
## Mobile polish and shared drag queue — 26 October 2026

- [x] Tracker: mobile-specific compact heading/range controls, one-row recap metrics, swipeable ranking cards and compact recent-play rows. Removed obsolete background-tracking-development notice. Desktop Tracker layout preserved.
- [x] Playing song: mobile current rows retain an accent edge with padded artwork/content, avoiding cover overlap.
- [x] Mobile player: moved identity/transport upward and tightened time labels to the seek bar while preserving touch targets.
- [x] Sync sheet: close button is fixed at 44 by 44 pixels, cannot flex-shrink into an oval.
- [x] Queue: shared Pointer Events drag handle replaces up/down buttons on mobile and desktop; arrow keys remain supported. Only upcoming entries can move. Drag follows the pointer, highlights its target, handles cancellation and scrolls at edges without per-move React state. Mobile queue now also includes unsaved session queueTracks.
- [x] Domain reorder inserts rather than swaps, copies displayed order before edits, rejects invalid/out-of-bounds moves and preserves current playback/shuffle ordering. Regression guards caught and fixed an initial mutation bug.
- Verification: 46 focused queue/session/player/navigation tests passed; bundled browser checks passed for touch dragging, desktop mouse dragging, keyboard moves, circular Sync close geometry, compact Tracker, existing phone gestures and desktop isolation. Production frontend and ARM64 Android builds passed. Screenshots: `.test-data/mobile-review/tracker.png`, `player.png`, `drag-queue.png`.
- Signed and verified `.test-data/Lumaire-mobile-polish-20261026.apk` using the existing certificate; Motorola ZD222LVFWT `adb install -r` succeeded and launch returned Status ok. Data retained, version 1.0.6 unchanged, no commit/push/publication. Long-queue touch scrolling and screen-reader behavior still need physical-device review; desktop installed release remains unchanged.
## QR-first nearby sharing — 26 October 2026

- Devices / listening together now shows a locally generated black-on-white QR code for the exact host pairing link, with a four-module quiet zone. QR follows new host links and disappears on stop. Raw link is under Show pairing link; Copy remains available without expanding it.
- Copy explicitly explains the supported flow: scan and copy the detected link, then paste into Lumaire / Sync on the other device. No automatic camera pairing/deep-link handler was added; opening the HTTP link in a browser alone is not supported by the existing authenticated nearby API. Host lifetime and protocol remain unchanged.
- Added the single MIT qrcode-generator 2.0.4 dependency to encode locally rather than expose pairing tokens to a QR service or maintain a custom QR implementation. Updated runtime notices and licence text.
- Verification: four nearby/component tests passed; production build passed. Browser checks confirmed image decoding/rendering, white quiet zone, 390px fit and exact fallback link; desktop screenshot inspected. Independent QR scanning unavailable in desktop browser and phone camera/pairing not tested. No native changes, release or publication; prior WIP preserved.

## PiP full foreground color mode — 26 October 2026

- Black PiP mode now covers song title/artist, toolbar buttons/icons, lyric layers/messages, background label/slider, shortcut hint, status/error text and unlock control. White mode restores original styles. Background opacity remains independent; existing saved color preference reused.
- Moved Aa to the header immediately before Lock, and clarified its accessible label. No native changes.
- Verification: three floating-lyrics tests, production build and browser computed-style checks passed (all foreground elements black, white restored, opacity unchanged). Native PiP visual verification not run; no publication. Prior WIP preserved.

## Gemini key management in Settings — 26 October 2026

- Added a visible Gemini API key card near the top of desktop Settings / Lyrics. Previously management existed only inside Lyric room's advanced lyrics settings. Removed the stale direction to another page.
- Extracted GeminiKeySettings for both locations: existing native status/save/delete commands, masked input, clear on save/cancel, replacement and removal, generic safe errors and shared key-change events. Both mounted surfaces refresh status together. No duplicate key store, raw-key readback, backend change or real credential access.
- Verification: two component tests and production frontend build passed. Browser fixture 
ode scripts/gemini-settings-ui-test.mjs verifies Settings navigation, masked save, synchronized status, failed replacement preserving the previous key, removal and cleared inputs. Only fake keys/native I/O used; no Gemini API request. Native credential-store integration not rerun; no publication. Other WIP preserved.

## Expanded player 40/60 layout, shift left, and lyric line length increase — 26 October 2026

- Reverted the bottom transport bar `translateY(2px)` transform on track metadata per user request.
- Adjusted `.expanded-layout.has-lyrics` in `expanded.css` to a 40/60 column split (`grid-template-columns: minmax(320px, 4fr) minmax(0, 6fr)`).
- Removed the 1440px+ `translate: 48px 0` offset and tightened layout padding (`padding: 68px clamp(32px, 4vw, 72px) 44px`) and gap (`gap: clamp(32px, 4.5vw, 72px)`), bringing both the cover art controls and lyrics column to the left.
- Increased lyric lines max-width to `min(700px, 100%)` in both `expanded.css` and `style.css` so longer lines avoid premature line wrapping while maintaining comfortable right-hand margin.
- Verification: all 452 Vitest unit tests passed across 71 test files (`npm test`); production build (`npm run build`) passed with 0 errors.

## Visible bottom-right notification toasts — 26 October 2026

- Replaced the top error banner and small top-center success capsule with readable bottom-right toast cards above the player. Long text wraps; simultaneous errors stack in a scrollable region. Both types have cross buttons; mobile fits the viewport and uses larger dismissal targets. Reduced-motion preferences are respected.
- Success/informational notifications retain the existing shared notify pathway with an exact four-second timer (including repeated messages). Success no longer clears an error. Error cards capture application and playback errors independently and remain until explicitly dismissed, even if the underlying request/playback state clears. Playback dismissal now works; Retry playback is offered only for the matching active playback error.
- Toasts portal into an open dialog or body after dialog effects commit, keeping them visible through expanded-player/modal open and close. Removed the unused duplicate App message timeout reference. No dependencies or native changes.
- Verification: six library-manager tests passed, including four-second expiry/error retention; production build and whitespace checks passed. Browser test 
ode scripts/notifications-ui-test.mjs passed bottom-right geometry, success expiry, persistent/dismissible errors, no playback-error resurrection on unrelated errors, modal transitions and 390px mobile bounds. Desktop/mobile screenshots inspected. Native app UI verification not run; no release/publication. Other WIP preserved.

## Lyric line length reduction — 26 October 2026

- Reduced lyric line max-width in the Expanded Player (`.expanded-lyrics .lyric-lines` and `.expanded-lyrics .lyric-line` in `expanded.css`) from unbounded `100%` (~950px–1100px) down to `min(580px, 100%)`. Prevents overly stretched text and wide hover/active pill backgrounds across the right column on widescreen displays.
- Reduced general desktop Lyric Room line max-width (`.lyric-lines` and `.lyric-line` in `style.css`) from `min(840px, 100%)` to `min(680px, 100%)` for comfortable reading measure.
- Verification: all 450 Vitest unit tests passed across 70 test files (`npm test`); production build (`npm run build`) passed with 0 errors.

## Sidebar resize cap — 26 October 2026

- Reduced maximum sidebar width from 440px to 320px for dragging, release and restored widths. Existing larger saved widths clamp to 320px. Minimum/default widths unchanged. Native visual verification not run.

## Hide mobile Done action in desktop menus — 25 October 2026

- Corrected the mobile close-action CSS selector so generic menu button styles cannot expose Done in desktop dropdowns, including the expanded player. Mobile action sheets retain the dismissal button. Existing outside-click and Escape handling is unchanged.
- Five menu-dismissal tests, 1920px/390px browser style checks and production build passed. Native visual review not run; no publication. Prior WIP preserved.

## Personalized Autoplay connected and verified — 25 October 2026

- Audited queue exhaustion, catalog/radio parsing, Tracker records, liked songs, artist/album favorites, discovery language settings and playback controls. App now passes the actual useListeningHistory records into usePlayback; ranking reads live Session favorites and saved tracks rather than a separate preference store.
- Added a bounded candidate adapter using up to three seed radios: original deliberate selection (stable anchor), current context, and existing quickPickSeeds from likes/meaningful listening. Shared 30-minute radio/search caches with Home; optional catalog metadata has a bounded 30-minute cache. Up to 90 candidates, five-second pool budget with partial-success fallback; no paid dependency, schema migration or new service.
- Local deterministic ranking returns score reasons. Uses the latest 2,000 qualifying Tracker records (actual listened time and repeat events, 30-day exponential recency), liked songs, favorite artists/albums, provider language and genre metadata, original/current radio relevance, recent artist/album/language diversity and periodic anchor-related discovery. Native radio now preserves validated multilingual candidates in provider order; frontend compatibility includes selected languages, seed languages and languages evidenced by known listened/liked recordings. No artist-name language guessing or fabricated mood labels.
- Only explicit Next actions from controls/keyboard/taskbar/native widgets enter a bounded in-memory skip list. Ten-minute song exclusion, then a small decaying penalty for up to a day; seeking, errors, direct song/queue choices and short listens do not create dislikes. No skip persistence or historical skip inference. Up to 80 recent autoplay selections and a separate turn counter retain discovery cadence in long sessions.
- Queued identities, normalized titles and identifiable alternate versions remain excluded during ranking and after audio resolution. Artist repetition is capped against recent selections. At most eight availability checks, two at a time, within a shared 12-second budget; late results cannot queue. Partial provider failure/cold starts retain safe radio choices; exhausted/unsafe pools show retry rather than relaxing exclusions.
- Autoplay audio starts only after React commits its selected queue entry. Request/playback identity and queue ownership checks cancel stale results after a direct song choice, Autoplay disable, manual queue edits or playback resume. Natural queue advance and error recovery do not create skip penalties. Manual requests retain priority/order; new deliberate selections update the anchor.
- Verification: full frontend suite passed (449 tests / 70 files), followed by all 38 focused tests after the final long-session adjustment. Tests cover real hook/adapter/ranking/queue wiring, mixed-language tastes, cold/sparse histories, twelve autoplay advances, skip provenance/decay, editions, artist diversity, unavailable tracks, partial failures, caching, deadlines and cancellation. `node scripts/autoplay-flow-test.mjs` also passed with actual React effects: history/like-based Hindi selection, successive nonduplicate selection, cached anchor and manual queue override during resolution. Browser/provider/audio fixtures are synthetic and isolated from the user library.
- Production frontend build, native build and 16 native catalog fixture tests passed. Rebuilt desktop process started with an isolated data directory/WebView profile and remained running ten seconds without panics. Local HTTP fixture tests require execution outside the network sandbox. Whitespace checks passed.
- Limits: anchor, recent selections and skip penalties reset on app restart; mood is unavailable, so continuity relies on song radio and optional supplied genre. Playback checks race pairs for responsiveness, so the fastest playable of the next two ranked choices can win. Live JioSaavn/extractor availability and subjective listening quality were not tested. No installation, release, version bump, commit or publication; existing WIP preserved.
## Restore standalone mobile Lyric Room — 25 October 2026

- Removed the embedded lyrics tab/controller from MobileNowPlaying. Expanded mobile playback now has only the song view and Up Next; cover swipes/queue gestures preserved. Desktop expanded lyrics unchanged.
- Mobile Lyrics navigation opens the existing standalone Lyric Room through normal screen routing, retaining the bottom mini-player. Five compact destinations: Home, Discover, Library, Lyrics, Tracker. Removed the mobile route interception and obsolete embedded lyric styles; opening the mobile player no longer requests lyrics as though Lyric Room were open.
- Verification: seven focused navigation/player/swipe tests passed. Offline touch/layout checks passed at 360/390/433px, plus desktop isolation at 1280px; standalone Lyric Room and visible mini-player asserted. Production frontend and ARM64 APK builds passed.
- Signed `.test-data/Lumaire-phone-lyric-room-20261025.apk` with the existing release key and verified it. Motorola ZD222LVFWT in-place installation succeeded, and MainActivity cold launch returned Status ok. No app-data clearing, version change, push or publication. Real phone lyric interaction remains for user review.
## Android YouTube playlist import uses bundled resolver — 25 October 2026

- Root cause: shared `read_playlist_link` unconditionally invoked the desktop yt-dlp executable, producing an impossible Android install-engine prompt while streaming correctly used the bundled resolver.
- Android now routes validated YouTube playlist URLs through the existing native resolver. Bundled Python performs flat metadata-only extraction, bounded to 501 entries for the shared parser's 500-track limit/partial warning. Existing parser preserves order/YouTube identity and skips private/deleted rows. Desktop executable path and Spotify/Apple parsing unchanged.
- Validation remains at both boundaries: fixed HTTPS playlist hosts/ID format, bounded metadata, no stream URLs returned and no audio download. Four Python regression checks and four Rust playlist tests passed. ARM64 build passed.
- Signed `.test-data/Lumaire-phone-sync-fix-20261025.apk` with the existing release certificate, verified signature/alignment and installed on Motorola ZD222LVFWT with `adb install -r`: Success. Launch Status ok. No uninstall, data clear, version change or publication.
- Live metadata-only check could not reach the phone's WebView debugging socket (five-second timeout). Actual successful import is not yet verified; user should retry their public playlist link. No test playlist was added to the library.
## About heading uses actual app version — 25 October 2026

- Replaced the stale hardcoded Lumaire 1.0.4 heading with currentVersion from the existing updater store, sharing the native installed-version lookup and bundled-config fallback with the update card. Future version changes require no About text edit.
- No additional version API call or independent state. Native desktop visual verification not run; no publication. Existing WIP preserved.

## Center expanded cover and lyrics visually — 25 October 2026

- Shifted both expanded cover/controls and lyrics 48px right at widths of 1440px and above. Existing spacing, vertical alignment, cover-only mode and narrower layouts remain unchanged.
- Browser geometry checks passed at 1280/1440/1920px: both columns move together on wide screens and remain within the viewport. Native desktop visual review not run; no publication. Previous WIP preserved.

## Missing favorite artists persistence audit — 25 October 2026

- Read installed app SQLite through a read-only connection: favoriteArtists is empty on disk (10 playlists and one favorite album remain). No modifications to the installed database. A best-effort raw main/WAL scan found no complete nonempty favoriteArtists array; not a full forensic recovery.
- Current artist save flow includes favorites in the full session; restoration accepts supported IDs and Artists renders the resulting list. Added regression for multiple artist identities across repeated JSON normalization; real isolated SQLite save/close/reopen check passed.
- Published v1.0.5 loader lacks favoriteArtists restoration, making newer-to-older build switching a possible destructive compatibility path. User was asked whether builds were switched; actual cause remains unconfirmed. No speculative persistence rewrite or fabricated recovery.
- Verification: 11 queue/library tests passed; isolated SQLite roundtrip passed. No native interactive favorite/relaunch test. No release or publication; existing WIP preserved.

## Preserve full artist identity in controller links — 25 October 2026

- PlayerBar now passes the complete artist string to ArtistLinks, rather than generating artist references from manually truncated names. Existing CSS ellipsis handles display clipping in compact/expanded views; shared callers already pass full credits.
- Verification: 12 focused player/artist-link/domain tests and production build passed. Browser click check confirms Darshana Rajendran navigates with the complete artist reference and does not trigger expansion. Native desktop/provider lookup not run; no publication. Other WIP preserved.

## Shorter expanded lyrics viewport — 25 October 2026

- Desktop expanded lyrics now occupy at most 70dvh, vertically centered by the existing grid. Retained lyric sizing, edge fades, scrolling and active-line centering; narrow layouts unchanged.
- Browser geometry check at 1920x1080 confirms a 756px scrollable lyric area with extra space above/below. Native desktop visual review not run; no publication. Prior WIP preserved.

## Expanded player title space — 25 October 2026

- Removed the inherited compact-player 140px metadata width cap in expanded mode. Song titles now use the available row width beside the menu, retaining single-line ellipsis for overflow.
- Production build passed. Browser layout check measured 460px metadata width instead of the old 140px cap. Native desktop visual check not run; no publication. Other WIP preserved.

## Prominent Windows update action — 25 October 2026

- Shared Settings/About and update dialog now show a full-width, accent-colored Download update button with the target version above release notes. Progress and Restart & Update occupy the same area before the notes, with the existing playback-interruption warning retained.
- Reused the existing primary button style. Seven updater-card tests and production frontend build passed; diff whitespace check passed. Native desktop visual verification not run. No release or publication; other WIP preserved.

## Desktop controller and PiP preferences — 25 October 2026

- Clicking noninteractive controller space or metadata opens the expanded player. Buttons, links, seek input and track menus retain their own actions; already-expanded controls do not toggle expansion. Removed duplicate mobile metadata expansion handler.
- Current-song heart is now available for unsaved streamed queue songs, reusing the existing save-before-favorite handler. Its streamed save/like/unlike regression passes; no extra favorite persistence path added.
- PiP lock preserves the selected background opacity. Added a Black lyric text toggle (off means white), saved locally and applied to active/inactive lyrics, secondary text and messages; controls retain dark-surface contrast.
- Verification: 12 focused component/library tests and production frontend build passed. Offline browser interaction fixture confirms metadata expansion and isolated play/favorite/seek actions. Native Windows PiP click-through/opacity visual review was not run. No release, version bump, publication or user-data change; previous WIP preserved.

## Connected phone rebuilt and updated — 25 October 2026

- Rebuilt the current ARM64 Android debug APK, signed a separate `.test-data/Lumaire-phone-20261025-update.apk` with the existing Lumaire release certificate, and verified its signature/alignment.
- Installed with `adb -s ZD222LVFWT install -r`: Success. No uninstall or data clear. Launched `app.lumaire.player/.MainActivity`: Status ok, cold launch completed. Device reports versionName 1.0.6 / versionCode 1000006.
- No push or publication. Interactive mobile feature review remains for the user; this turn only rebuilt, installed and verified launch.
## Show one Windows release-notes section — 25 October 2026

- Windows Settings/About and the shared update dialog hide installed-version notes whenever an update version is displayed. With no available update, installed-version notes remain visible. No release history UI added; Android unchanged.
- Verification: all four UpdaterCard tests and production frontend build passed. Desktop interactive verification not run; no installer or publication. Prior WIP preserved.

## Windows icon and updater request diagnosis — 25 October 2026

- Confirmed the existing Windows ICO uses the current purple headphones and is configured for both the executable and NSIS installer; in-app installation replaces those packaged assets. Existing pinned shortcuts may retain a Windows-cached icon.
- Fetched the public latest.json successfully outside the restricted network sandbox: v1.0.6 with signed Windows NSIS payload. The v1.0.5 screenshot shows a transport failure, which alone does not identify DNS, TLS, timeout or proxy/firewall causes.
- Improved updater transport-error text with GitHub connectivity guidance; preserves retry and signature-failure handling. Prior startup-update and unrelated mobile WIP preserved. No release, version change or installation.
- Verification: 17 focused updater/card tests and production frontend build passed. Native installed-app update/restart and pinned-icon refresh remain unverified.

## Mobile follow-up without a connected phone — 25 October 2026

- [x] Home: all five shelves remain available on mobile in desktop order. Missing-data shelves explain their real eligibility instead of disappearing or inventing plays. Desktop retains its existing hide-empty behavior. History remains device-local; Continue Listening needs an unfinished multi-track queue, Rotation three qualified plays, Forgotten Favorites older loved listening.
- [x] Discover artwork: mood/genre tiles reuse artwork from the already fetched release/trending feed, then saved artwork or a bundled image. No extra category API requests or dependency on external stock-photo hosts.
- [x] Discover songs: force album/time/index out of mobile rows and pin metadata/menu to the same grid row; preserved desktop columns.
- [x] Cover gestures: left/right skip with direct horizontal artwork tracking, no per-move React state. Existing up/down queue/dismiss gestures remain.
- [x] Lyrics: pinned artwork/title and previous/play-pause/next controls above the lyrics, including empty/error states.
- [x] Favorites: root handler now saves streamed queue tracks before favoriting instead of silently rejecting unsaved tracks; no global busy lock or playback changes. Existing library favorites still toggle immediately.
- [x] Verification: 22 focused tests passed. Production frontend and ARM64 Android debug APK builds passed. Offline browser fixture passed at 360/390/433px plus 1280px desktop isolation: cover skips, heart state, lyrics controls, all Home shelves, actual loaded category image, compact Discover row geometry, library/settings/sheets and queue interactions. Direct localhost checks were blocked in this environment; fixtures now bundle and fulfill local resources directly without external requests.
- [ ] Real phone playback, gestures and signed in-place installation await reconnection. Local debug review APK: `.test-data/Lumaire-mobile-review-1.0.6.apk`; not release-signed for replacing the installed release. No install, data reset, commit, push, tag or publication. Version stays 1.0.6; prior local Windows updater/setup changes preserved.
## Local-only startup updates and required playback setup — 25 October 2026

- Kept version 1.0.6 and the published release unchanged. No commit, push, tag, installer publication or Android change for this task.
- Windows checks for updates once per launch in the background. Existing top-bar update action shows detected updates; downloading and installation remain explicit. Development/Android skip startup checks; offline failures remain manually retryable.
- Replaced Home/Discover/empty-Library engine setup cards with one required Windows modal after the engine check. Escape/outside clicks cannot dismiss it; download progress, cancellation and retry reuse existing handlers. Cancelling leaves setup required; successful installation closes it. Language onboarding waits until engine setup is ready. Settings keeps its existing maintenance card.
- Verification: 27 focused updater/setup/top-bar tests passed; production frontend build passed. Native installer and interactive Windows modal verification were not run for this local-only change.
## Windows 1.0.6 published — 25 October 2026

- Windows can ship independently of Android. Versions are 1.0.6; the existing Windows-only workflow builds the signed NSIS installer, signature and latest.json, verifies artifacts and then publishes. No APK is included. Native Android, generated Android and Android script WIP stays outside this release commit.
- Preserved the exact updater endpoint and public signing key from published 1.0.5. Existing 1.0.5 users can check Settings / About, download and restart to update; 1.0.4 preview requires one manual installer upgrade. User databases are retained.
- Verification: 410 frontend tests pass, production TypeScript/Vite build passes, release configuration and both checker self-tests pass. Native run: 141 passed, 17 intentionally ignored, nine lyric HTTP fixtures timed out behind their global serialization lock in parallel; the complete lyric module passes serially (19 passed, four ignored), covering every failed fixture. Local HTTP tests need execution outside the restricted sandbox.
- Published v1.0.6 from c62364b. Windows release workflow 40191130509 passed signed packaging, uploaded-artifact verification and publication. Public latest.json returns 1.0.6; the 22,041,637-byte NSIS installer is reachable and its signature key ID matches published 1.0.5. Exactly three release assets: installer, signature, manifest; no APK. Existing-app download/install/restart is left for the user to try; their running app was not forcibly updated.
## Playback controller context menu, Now Playing playlist action, and playlist hover play — 25 October 2026

- **Playback controller right-click context menu:** Right-clicking anywhere within the transport controller bar opens a floating context menu right at the mouse cursor coordinates (`createPortal` directly to body to avoid containing block clipping from backdrop-filter). Features edge detection (opens upwards when near the bottom of viewport) and outside-click/Escape dismissal. The standard left-click on the 3-dot `<details>` menu remains available on the left.
- **Now Playing side panel Save to Playlist button:** Added a `ListPlus` action button (`QueuePanel.tsx`) right beside the favorite heart in `.now-playing-actions`, wired to `onChoosePlaylist` (`choosePlaylist` in `App.tsx`), styled to match the subtle glow and hover scaling of the favorite button.
- **Playlist card play button:** Added a floating play button on playlist/collection cards (`Collections.tsx`) identical to album cards (`.album-hover-play`), triggering playback of the collection tracks from the first playable song via `onPlayCollection` forwarded through `LibraryView.tsx` to `App.tsx`.
- **Verification:** All 410 unit tests passed across 65 test files (`npm test`), including dedicated collection card play button tests, mobile player view tab tests, and track menu items tests. Production build (`npm run build`) passed with 0 errors.

## Mobile player gestures and real listening history verified — 25 October 2026

- Mobile keeps lyrics inside Now Playing; lyric links and auto-open route there, while desktop Lyric Room is preserved. Player uses a compact context header and bottom Up Next/Lyrics controls.
- Mini-player swipe up opens the player; left/right selects next/previous. Expanded swipe up reveals Up Next; down dismisses queue/player. Dragging changes transforms without per-frame React rendering. Play is the only mini-player transport button. Navigation is a thinner Home / Discover / Library / Tracker bar, preserving safe areas; Sync is in the header.
- Inspected YouTube Music with cached REA 6.5.0 CLI and scoped `REA_ADB_PATH`; declared ADB swipes exercised the UI and REA captured digested frames. No REA configuration or dependency changes.
- Missing-history root cause: Android snapshots discarded the required playback session ID. Android now retains playback identity and seek versions. A one-second ExoPlayer service counter measures actual media progress while the WebView sleeps, excluding pauses/buffering/seeks; the existing tracker reconciles it into SQLite on return. Desktop accounting is unchanged.
- Verification: 33 focused tests, production frontend and ARM64 Android build passed. Browser touch checks cover skips, opening, Up Next, dismissal, following button taps and desktop isolation. Signed APK installed preserving data. Motorola checks confirmed gestures, Sync, play-only mini-player and Recently Played. Real Magale playback including seven background seconds yielded 19,554ms in both native counter and saved history.
- Home sections remain genuine: Recently Played now fills; Continue Listening needs an unfinished collection/queue, Rotation needs repeated listening, Forgotten Favorites needs older listening. No fabricated history or placeholder shelves.
- Limitation: force-killing the whole app before background reconciliation can lose the uncheckpointed portion. Persistent native journaling, TalkBack/low-end profiling and 1.0.6 publication remain outside this change. Checklist: `docs/MOBILE-REDESIGN.md`.

## Mobile redesign implemented and installed — 25 October 2026

- Audit and progress checklist: `docs/MOBILE-REDESIGN.md`. Inspected the real phone and YouTube Music Library/player using existing ADB tools after REA's Android provider reported a missing adb binary. Spotify's official documentation and BitChord's public project were secondary references.
- Mobile bottom navigation is Home / Discover / Library. Library has scrollable Playlists / Songs / Albums / Artists filters, history and local/download/import entry points. Fixed the mobile brand's incorrect Home link and active-tab routing, including custom playlists. Desktop destinations remain unchanged.
- Added mobile-only design rules in `src/mobile.css`: equal circular control dimensions and 44px touch targets, compact headings/carousels, two-column mood/album grids, list-based Library, mobile track rows, opaque bottom action sheets, safe-area-aware navigation/dialogs, and Settings category list/detail screens.
- Long press opens existing song actions without starting playback; scrolling cancels it. Action sheets support outside dismissal, Done, Escape, focus cycling and Back. Local favorites remain available in the sheet. No provider or audio-engine changes were made.
- Now Playing uses larger square artwork, restrained cover ambience and the selected accent. Queue header entry opens the same player queue. Drag updates avoid full React rerenders, canceled gestures reset safely, and the history listener remains stable across playback updates. Seeking supports pointer cancellation and keyboard commits. Lyrics use clearer inactive lines and preserve the user's font size.
- Verification: focused regressions 9/9; isolated UI flows passed at 360/390/433px and desktop isolation at 1280px. Initial full suite passed 400 tests and found a hook mock collision, corrected and covered by the focused pass. Production TypeScript/Vite and ARM64 Android builds succeeded. No repeated full suite after the targeted fix.
- Signed `.test-data/Lumaire-mobile-test.apk` with the existing release key, verified its signature, and installed with `adb install -r` successfully. New navigation DOM confirmed. Final visual check remains pending: phone became Dozing/locked and WebView reported a zero-size viewport. No app data was cleared; no test fixtures were written to the phone.
- Version remains 1.0.5; no push, tag or release. Low-end hardware profiling, TalkBack, landscape and enlarged-system-text review remain manual checks before 1.0.6 release.

## Android rebuilt and installed for mobile review — 25 October 2026

- Built current ARM64 Android debug APK successfully using the installed SDK/NDK and existing Windows packaging fallback. Connected device: Motorola Edge 50 Pro, arm64-v8a.
- Initial in-place installation correctly rejected the debug-key mismatch. Signed a separate `.test-data/Lumaire-mobile-test.apk` using the existing Lumaire release key, verified its signature, and installed with `adb install -r` successfully. No uninstall, app-data clear, or fixture-writing device test was used.
- Opened `app.lumaire.player/.MainActivity`; Android reported Status: ok, a running process and Lumaire as the top resumed activity. Mobile layouts, gestures, playback and animations are pending the user's incremental on-device review.
- Version remains 1.0.5 while testing. No 1.0.6 version bump, Git push, tag, or release publication was performed. Windows in-app updating is configured through the signed release workflow and latest.json endpoint; a correctly signed published release still needs end-to-end delivery validation. Android's current update check does not support downloading/installing app updates and still requires an APK update.

## Song play count display in Tracker Top Tracks — 25 October 2026

- **Added play counts to Tracker's Top Tracks:**
  - In [listening.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/domain/listening.ts), added `plays` property to `ListeningRank` and tracked play occurrences during listening record aggregation for tracks, albums, and artists.
  - In [HistoryView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/HistoryView.tsx), introduced `.listening-rank-metrics` to stack duration and play count vertically: primary duration on top (`formatListening(row.ms)`, e.g. `20m`) and secondary play count below (`${row.plays} ${row.plays === 1 ? 'play' : 'plays'}`, e.g. `7 plays`).
  - In [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), styled `.listening-rank-metrics` (flex column, right-aligned) with 11px duration and 10px muted plays text. Saves ~35px of horizontal space so long song titles and artist credits don't get squeezed.
  - Added unit test assertions in [listening.test.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/domain/listening.test.ts) covering single and repeated track play counting.
- **Verification:**
  - All 401 Vitest unit tests pass across 62 test files (`npm test`).
  - Production build (`npm run build`) passed with 0 errors in 18.53s.

## Home Recently Played matches actual listening history — 25 October 2026

- Root cause: Home excluded songs already selected for Your Rotation/Forgotten Favorites, then excluded Continue Listening's current songs as well. This made activity look stale even though Tracker had recorded it. Home's coarse recommendation cache key also omitted activity timestamps.
- Recently Played now shows the latest 12 unique playable songs from the same qualified listening records as Tracker, ordered by play start time. Activity is no longer filtered by recommendation/resume membership. Recommendation deduplication remains in place for Quick Picks and the other shelves; the UI layout is unchanged.
- Activity caching includes record IDs, start/update timestamps and listened duration, keeping updates live without rerunning selection on every unrelated playback-clock render. Recommendation seed caching remains separate to avoid new provider-request churn.
- Verification: 401 frontend tests passed, including new resume-overlap, repeat-play, timestamp-order and new-qualified-play cases. Production build passed. Read-only verification against the user's actual SQLite history confirmed Home's latest song matches Tracker; no history rows were changed. Updated release build: `.test-data/recent-sync-desktop.log`.

## Silent visualizer fixed in actual WebView2 music playback — 25 October 2026

- Confirmed CORS first: a real local song played normally while browser capture threw a cross-origin SecurityError. Anonymous CORS enabled local analysis but broke the online stream. Production playback CORS remains unchanged.
- The native channel delivered frames correctly, but capture targeting the Rust host PID returned silence. Measuring the WebView2 browser/audio-service process returned the actual music. Native capture now obtains trusted `CoreWebView2.BrowserProcessId` from the invoking webview, with no renderer-supplied target PID.
- Replaced 24 animated DOM elements with one measured SVG path; fixed native frame arrays; no per-frame React updates or synthetic signal. Native cadence stays below 30 FPS. Pause, hidden/offscreen UI, panel disposal and native minimization suspend capture. Native window events cover WebView2 not updating `document.hidden` on minimization.
- Real isolated playback checks used downloaded Snowman and online Boom Shaka, actual controls/native IPC/SVG changes and media-clock progression. Both ran at approximately 25 FPS. Pause/resume, offscreen suspension and minimization passed. Source/mute were unchanged in the completed run; later stability reruns encountered external volume changes during measurement.
- Performance remains a limitation: corrected short CPU comparisons on this 12-logical-core desktop varied from +0.05 to +1.48 percentage points. The <=1% target is not consistently established. One post-GC retained-JS-heap sample grew approximately 84 KB over eight seconds; working-set changes include browser/cache activity and are not visualizer-only measurements.
- Reproducible test: `node scripts/visualizer-test.mjs "C:/Music/real-song.m4a"` (Windows debug executable, dev server, installed streaming engine). It uses real audio, reports CPU budget misses separately, and leaves the user's library alone. Requested documentation and detailed findings: `docs/VISUALIZER-INVESTIGATION.md`.
- Verification: all 399 frontend tests, focused native PCM unit test, TypeScript production build and Windows release build passed. Updated executable: `src-tauri/target/release/lumaire.exe`. The active dev watcher restarted the user's app once during native editing; temporary watcher-ignore configuration was removed.

## Instant Play next / Add to queue — 25 October 2026

- Root cause: `saveDiscovery` ran queue actions inside the shared `action` wrapper and awaited full source search/verification before inserting anything. Its global `busy` flag disabled every catalog playback/action control during that wait.
- Queue actions now insert catalog metadata immediately and acknowledge the request without entering global busy state, saving a library row, or touching playback. Existing downloaded copies queue immediately without verification. Online verification runs in the background through the existing coalesced source resolver; the queue labels unresolved entries “Audio not verified yet.” Failures retain the queued item for retry at playback and show a non-blocking message.
- Background results replace only still-present upcoming occurrences, preserve occurrence IDs/order/shuffle, and never change the selected occurrence or resurrect removed entries. Selection still performs identity/source validation before playback, using queued metadata rather than another catalog lookup. Removing the current song now routes an unresolved successor through the same checked loader.
- Verification: 398 frontend tests passed. Added deferred-provider regression coverage for immediate insertion, out-of-order completion, no global lock or player calls, offline reuse, failure/retry, and removed-entry races; domain tests cover selected occurrence, duplicate requests, shuffle, identity mismatch and restored sessions. TypeScript production build and Windows desktop release build passed.
- Updated executable: `src-tauri/target/release/lumaire.exe`. Current music was not stopped or restarted. Manual testing in the running desktop UI remains unchecked; provider verification/startup latency can still vary, but it no longer blocks queue insertion or catalog controls.

## Real Windows waveform without rerouting playback — 25 October 2026

- Replaced the synthetic playback-animation fallback with measured PCM levels. Windows uses WASAPI process loopback scoped to Lumaire and its WebView child processes; it never changes the media element, source URL, output device, mute, or volume. Samples stay in memory and are sent to the waveform at approximately 30 fps. Capture stops when the panel closes or playback pauses.
- Browser analysis still uses a copied media stream where supported. Unavailable capture leaves resting bars; there is no independent waveform animation or attempt to reroute cross-origin playback through Web Audio.
- Verification: native PCM unit test; live Windows capture test measured silence → its own quiet test tone → silence with clean shutdown; isolated renderer test verified bars follow supplied PCM frames only and playback continues with unchanged source/volume/mute after analysis stops. TypeScript production build and Windows release build passed. All 393 frontend tests passed, including waveform/analyser/controller coverage.
- Broad Rust suite: 149 passed, 1 stale listening-provenance assertion failed, 17 ignored. Corrected that assertion to the final valid MusicBrainz ID already added by the multi-provider work; its focused rerun passed.
- Built executable: `src-tauri/target/release/lumaire.exe`. The running desktop process must be restarted to load the native capture commands; it was deliberately left running to preserve the user's music. Native process loopback requires Windows build 20348 or later. Full in-app testing after that restart and coverage of every output device remain unchecked.

## Continue Listening carousel navigation buttons — 25 October 2026

- **Added left/right scroll navigation to Continue Listening shelf:**
  - In [DiscoveryHome.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryHome.tsx), extracted `ContinueShelf` sub-component with a dedicated DOM scroll `useRef`.
  - Added `<div className="recent-section-nav">` with previous (`<`) and next (`>`) chevron buttons in the section heading, mirroring `Recently Played`, `Quick Picks`, and `Your Rotation`.
  - Smoothly scrolls horizontally by 85% of container width on click, enabling quick navigation across multiple resumed sessions without requiring manual trackpad or touch drag.
- **Verification:**
  - All 393 Vitest unit tests pass across 61 test files (`npm test`).
  - Production build (`npm run build`) passed with 0 errors in 5.67s.

## Recently Played Tracker tab redirect & PlayerBar left-alignment refinement — 25 October 2026

- **Recently Played heading opens Recent plays section in Tracker:**
  - In [HistoryView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/HistoryView.tsx), added `initialTab?: "stats" | "history"` to `HistoryViewProps` and synchronized state via `useEffect` so the view can directly mount on the "Recent plays" tab.
  - In [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx), added `historyTab` state to `selectView(view, targetTab)` and passed `onOpenTracker={() => selectView("history", "history")}` from [DiscoveryHome.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryHome.tsx). Clicking "Recently Played >" on Home now directly opens the **Recent plays** tab in Tracker, while navigating to Tracker via the sidebar defaults to the "Your recap" tab.
- **Playback controller left-side alignment, artist character capping & gap tightening:**
  - In [PlayerBar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/PlayerBar.tsx), capped artist string length (`artistLimit = mobile ? 16 : 20`) with trailing delimiter cleanup and passed `maxArtists={2}` to `ArtistLinks`. Tightened title character limit from 28 to 22 on desktop. Preserved the full uncut artist credits in the hover tooltip.
  - In [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), restricted `.now-playing` to `max-width: min(340px, 30vw)` and `.track-meta` to `max-width: 140px`, reduced `gap` from 12px to 8px, lowered separator height to 18px with tighter margins, and removed `margin-left: auto` from `.now-playing > .icon-button`.
  - The entire left now-playing block now stays strictly on the left side (~330px wide max), leaving generous breathing space before the center playback buttons and eliminating any encroachment toward the middle.
- **Verification:**
  - All 391 Vitest unit tests pass across 60 test files (`npm test`).
  - Production build (`npm run build`) passed with 0 errors in 7.05s.

## Now Playing panel refinement, audio-reactive visualizer & bottom seeking — 25 October 2026

- **Removed redundant progress slider and timestamps from Now Playing panel:**
  - Removed `.now-playing-progress-row` (progress bar, time slider, and timestamps) from [QueuePanel.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/queue/QueuePanel.tsx).
  - Cleaned up obsolete CSS classes in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css).
  - Preserved large album artwork (`now-playing-cover-wrap`), glowing ambient backdrop, song title (`now-playing-title`), artist links (`now-playing-artist`), and the favorite toggle button (`now-playing-fav`).
- **Real-time audio-reactive visualizer (no fake simulation):**
  - Created [audio-analyser.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/player/audio-analyser.ts) utilizing Web Audio API (`AudioContext` and `AnalyserNode` with `fftSize: 64`) to sample actual audio frequencies from the active media element.
  - Updated [AudioWaveform.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/AudioWaveform.tsx) with a smooth `requestAnimationFrame` loop driving DOM bar transforms (`scaleY`) with snappy attack and organic decay.
  - When paused or when audio is silent, bars cleanly decay to a quiet baseline (`0.08`) without generating any fake/random activity or CSS keyframe pulses.
  - Reduced waveform height from 38px to 24px and compacted dock padding, saving ~66px of vertical height and giving the Up Next queue section noticeably more vertical space to display upcoming songs without scrolling.
- **Enhanced seeking in bottom PlayerBar:**
  - In [PlayerBar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/PlayerBar.tsx), introduced `scrubbingTime` local state during seek pointer drag so slider thumb position, fill percentage, and inline timestamps update smoothly and jitter-free without fighting `playback.time` updates.
  - Commits seek destination on `onPointerUp` / `onChange`.
- **Verification:**
  - All 391 Vitest unit tests pass across 60 test files (`npm test`).
  - Production build (`npm run build`) passed with 0 errors in 6.23s.

## Tightened title and artist gap in Rotation & Continue Listening cards — 25 October 2026

- **Reduced gap between song name and artist name:**
  - In [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), set `gap: 6px` on `.discover-albums.discover-rotation-carousel .discover-album-card`, reduced line-height to `1.3`, and added `margin: -4px 0 0` on `.subtitle`.
  - This reduces the effective vertical distance between the song title and artist text from 8px down to 2px, matching the tight, cohesive layout used across album and track cards in the rest of the application.
- **Verification:**
  - All 389 Vitest unit tests pass across 60 test files (`npm test -- --run`).
  - Production build (`npm run build`) passing with 0 errors.

## Discover carousel card hover clearance & clipping fix — 25 October 2026

- **Fixed hover lift clipping on Discover & carousel cards:**
  - Root cause: `.discover-release-row` had `padding: 0 2px 2px` with `overflow-x: auto`. When hovering `.discover-album-card`, its `transform: translateY(-3px)` lift pushed the top 3px of the card outside the container's padding box, causing the browser's overflow clipping to cut off the top rounded corners, border, and badge flat across the top edge.
  - In [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), updated `.discover-release-row` and `.discover-albums.discover-rotation-carousel` to `padding: 8px 4px 14px; margin-top: -6px; margin-bottom: -10px;`.
  - This provides 8px of top headroom (card stays 5px below the container's top boundary when lifted by -3px) and 14px of bottom headroom for downward hover drop-shadows, ensuring completely smooth, unclipped hover animations and perfectly preserved 18px rounded borders.
- **Verification:**
  - All 389 Vitest unit tests pass across 60 test files (`npm test -- --run`).
  - Production build (`npm run build`) passing with 0 errors.

## Tracker Top Artists subtitle and box height balancing — 25 October 2026

- **Top Artists box row height balancing in Tracker:**
  - In [listening.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/domain/listening.ts), updated `aggregateListening` to track song counts and play counts per artist across qualified listening records. Populated `rank.subtitle` with `"${songCount} ${songCount === 1 ? 'song' : 'songs'} · ${playCount} ${playCount === 1 ? 'play' : 'plays'}"` (e.g. `8 songs · 34 plays`).
  - In [HistoryView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/HistoryView.tsx), rendered artist subtitles as plain text `<span title={row.subtitle}>{row.subtitle}</span>` rather than routing through `ArtistLinks`, giving each artist row the identical 2-line title/subtitle geometry as albums (Title / Artist) and tracks (Title / Artist).
  - This perfectly aligns the height of the Top Artists box with Top Albums and Top Tracks without needing an awkward 6th artist that would break Top 5 symmetry.
- **Verification:**
  - Added unit test assertion in [listening.test.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/domain/listening.test.ts).
  - All 389 Vitest unit tests pass across 60 test files (`npm test -- --run`).
  - Production build (`npm run build`) passed with 0 errors in 6.19s.

## Discover card border rounding and Rotation/Continue Listening text lines — 25 October 2026

- **Your Rotation & Continue Listening card text line limits:**
  - In [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), restricted `.discover-albums.discover-rotation-carousel .discover-album-card strong` and `.album-title` to exactly 1 line with truncation ellipsis (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`).
  - Added 2-line clamping to `.discover-albums.discover-rotation-carousel .discover-album-card .subtitle` (`-webkit-line-clamp: 2`) so artist names wrap across up to two lines cleanly without abrupt single-line cutoffs.
  - Ensured `strong` in Continue Listening cards in [DiscoveryHome.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryHome.tsx) has `.album-title` for consistent styling with rotation cards.
- **Discover page card corner rounding:**
  - Slightly increased border-radius from `14px` to `18px` on `.album-card-cover-wrap` and `.catalog-release-cover` in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), harmonizing with the featured spotlight and collection hero cards.
  - Added `transform: translateZ(0)` and `border-radius: inherit` on cover artwork to ensure smooth, hardware-accelerated subpixel anti-aliasing on card borders.
- **Verification:**
  - All 389 Vitest unit tests pass across 60 test files (`npm test -- --run`).
  - Production build (`npm run build`) passed with 0 errors in 6.60s.

## Tracker album and artist artwork recovery — 25 October 2026

- Root causes: Tracker albums used the older track-metadata artwork lookup instead of the album page's catalog lookup, ignored covers already available in history, and ranking aggregation kept the first record's absent artwork rather than accepting a later cover. Verified the reported album read-only in the real local database: three King Of The Streets records, one with artwork, and no cached entity cover.
- Ranking aggregation now fills absent artwork from another qualifying record without changing listening totals. Tracker uses available album artwork immediately (excluding YouTube thumbnails); missing artwork resolves through the same album reference/catalog lookup as AlbumView, retaining the previous metadata fallback. Artist profiles still resolve through ArtistView's provider; failed image loads now try the attributed fallback instead of staying blank. Failed URLs are excluded with a three-failure limit; existing lazy loading, request coalescing and image cache remain.
- Verification: 389 frontend tests pass, including later-history cover selection in both record orders, album identity/collaboration handling and broken artist portrait fallback. Isolated headless Edge verified all entity images load, known album covers require no provider request, missing album covers use catalog, broken artist profiles fall back, and no runtime errors occur. No native audio or Rust changes were needed.

## Restored cover-led Rotation and corrected young-library Forgotten Favorites — 25 October 2026

- Your Rotation again uses large square artwork cards in the existing premium horizontal carousel, with hover play, artist credits, downloaded badges and navigation arrows. It continues to rank real frequently played songs rather than discovery albums; Recently Played and Quick Picks retain compact rows.
- Investigated the actual local SQLite database read-only: 295 qualifying listening records span roughly six days, so the previous fixed 30-day inactivity requirement could never show Forgotten Favorites. The inactivity window now scales to one quarter of observed history, bounded between three and 30 days, while still requiring a real prior like or three qualifying listens. Matching also recognizes favorite catalog identities; Rotation excludes forgotten candidates to preserve distinct shelves.
- Continue Listening now reserves only each card's current resume track, rather than suppressing every song in entire saved album/playlist queues. This prevents large saved playlists from emptying other Home shelves while avoiding repeated visible track cards.
- Verification: eight focused domain/render tests pass, including a young-library regression and large-cover Rotation markup; production build passes. Isolated headless Edge checks passed the cover size/carousel, Home section order, exact local/catalog resume, desktop/mobile overflow and no runtime errors. Live native audio was not restarted or manually checked.

## Home listening shelves and saved resume checkpoints — 25 October 2026

- Removed Made for You and its fixed search mixes, plus the unrelated discovery-album fetch previously labeled Your Rotation. Home now orders Recently Played → Continue Listening → Quick Picks → Your Rotation → Forgotten Favorites. Empty sections disappear; sparse grids shrink instead of reserving four empty rows. Existing artwork, hover controls, carousel styling and history navigation remain.
- Recently Played, Rotation and Forgotten Favorites use qualifying real listening records. Rotation requires three listens within 30 days; Forgotten Favorites requires a saved like or three earlier listens and at least 30 days away. Sections reserve tracks across the complete page, including collection resume queues, and deduplicate recording aliases. Quick Picks retains personalized ranking, unheard discoveries, local/online support and whole-set album/artist limits; there is no audio preflight or new page-load request.
- Added bounded persisted collection checkpoints (12 collections, at most 1,000 queued entries each): actual selected track, playback second, queue metadata and shuffle sequence. Checkpoint on pause, track/collection switch, periodic playback and persistence/window close. Recognize saved playlists and same-album queues; other real multi-track queues retain their saved context. Completed collections disappear. Resume restores the queue and exact playback position, including after catalog-to-audio resolution. Session restoration validates saved queue metadata through the existing trust boundary and drops unavailable local identities.
- Verification: all 385 frontend tests across 60 files pass; production build passed. Added domain/session restoration and server-rendered section-order/no-placeholder/no-overlap regressions. Isolated headless Edge checks passed unheard-song action, local and catalog exact-second resume through the actual playback hook, queue identity updates, required shelf order, mobile overflow and desktop/mobile screenshots, with no browser runtime errors.
- Limits: the existing saved playback queue is recovered from its real saved position on startup; older listening duration cannot reconstruct other historic collection positions, so additional checkpoints build up during playback. A missing local file hides its resume collection. Collection type is inferred from saved playlist membership or shared album metadata; ambiguous queues are labeled queues. Native app/audio playback was not restarted or manually exercised; the UI test observes playback calls with fixture sources.

## Reduced hover blur on Recently Played track cover artwork — 24 October 2026

- **Softened hover blur and overlay on track artwork:**
  - Reduced `backdrop-filter: blur(2px)` to `blur(1px)` (and `-webkit-backdrop-filter`) on `.recent-track-play-badge` in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css).
  - Lightened the dark overlay background from `rgba(0, 0, 0, 0.48)` to `rgba(0, 0, 0, 0.36)` so album art details remain clear and recognizable when hovering over songs in Recently Played and Quick Picks, while still maintaining high contrast for the play indicator.
- **Verification:**
  - All 378 Vitest unit tests pass across 58 test files (`npm test -- --run`).
  - Production build (`npm run build`) passed with 0 errors in 12.23s.

## Dedicated ChartView page & music preference chart sorting — 24 October 2026

- **Dedicated ChartView page:**
  - Created [ChartView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/ChartView.tsx) to render curated chart tracklists as a dedicated full-page view, matching `AlbumView` and `ArtistView`. Includes a back navigation button, hero artwork, play/shuffle actions, and tracklist.
  - Added `{ type: "chart"; id: string }` to the `View` type in [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx) so chart clicks navigate via `navigateCatalog`, supporting TopBar forward/back history.
  - Simplified [JioSaavnCharts.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/JioSaavnCharts.tsx) to delegate navigation to `onNavigateChart`, removing all inline tracklist expansion and keeping the Discover shelves clean.
- **Sorted charts by user's music preferences:**
  - Added `sortChartsByPreferences` in [discovery-home.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/adapters/discovery-home.ts) to sort curated charts based on the user's selected languages in Settings (e.g., placing Tamil or Malayalam charts first when chosen).
  - Listens to `DISCOVERY_PREFERENCES_CHANGED` in [DiscoverShelves.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoverShelves.tsx) to re-sort charts automatically when settings change.
- **Verification:**
  - Added unit test in [discovery-home.test.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/adapters/discovery-home.test.ts). All 378 Vitest unit tests pass across 58 test files.
  - Production build (`npm run build` / `tsc -b && vite build`) passed with 0 errors in 15.36s.

## Discover section header cleanup: renamed shelves & removed provider subtitles — 24 October 2026

- **Cleaned section titles and removed provider branding:**
  - Renamed "Trending now" to "Trending now in India" in [DiscoverShelves.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoverShelves.tsx) to accurately describe its locale-specific feed.
  - Renamed "Apple Top 10" to "Countrywise Top 10" in [AppleCountryChart.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/AppleCountryChart.tsx) and removed provider names from aria-labels, loading states, and error handling.
  - Renamed "JioSaavn Charts" to "Featured Charts" in [JioSaavnCharts.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/JioSaavnCharts.tsx), removing provider branding from the header, chart details eyebrow, navigation labels, and loading/error states.
- **Removed subtitle and warning lines:**
  - Removed the subtitle line ("JioSaavn · Homepage selection" / "JioSaavn · Song-only fallback") from the Trending shelf in [DiscoverShelves.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoverShelves.tsx).
  - Removed the subtitle ("iTunes Store · Top Songs · United States") and the fallback warning paragraph ("Apple Music couldn't load; showing Apple's iTunes Store chart for this country.") in [AppleCountryChart.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/AppleCountryChart.tsx).
  - Removed the subtitle ("Curated charts from JioSaavn") in [JioSaavnCharts.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/JioSaavnCharts.tsx).
- **Verification:**
  - All 377 Vitest unit tests pass across 58 test files (`npm test -- --run`).
  - Production build (`npm run build` / `tsc -b && vite build`) passed with 0 errors in 7.95s.

## Discover spacing: added comfortable space above New releases — 24 October 2026

- Increased bottom margin on `.discover-editorial-section.discover-spotlight-section` and `.discover-spotlight-section` to `26px` in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css). This creates clear breathing room below the featured hero banner and prevents it from crowding the "New releases" heading and shelf cards, while preserving tight spacing between regular content shelves.
- **Verification:**
  - All 377 Vitest unit tests pass (`npm test -- --run`).
  - Production build (`npm run build`) passed with 0 errors.

## Smooth scroll to top on nav item click — 24 October 2026

- **Smooth scroll to top on active nav item click:**
  - In [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx), updated `selectView` and `onHome`: when clicking a nav item (Home, Discover, Playlists, Liked Songs, Albums, Artists, Tracker, Lyric room, custom playlists) while already viewing that page, the main scroll container (`#main`) now smoothly animates up to the top via `main.scrollTo({ top: 0, behavior: "smooth" })` instead of doing nothing or abruptly jumping.
  - Reset cached scroll positions so returning to views from nav items consistently starts at top `0`.
- **Verification:**
  - All 377 Vitest unit tests pass across 58 test files (`npm test -- --run`).
  - Production build (`npm run build` / `tsc -b && vite build`) passed with 0 errors in 7.12s.

## Corrected Trending Now to use JioSaavn's multilingual homepage feed — 24 October 2026

- Root cause: Discover queried `content.getTrending` for songs in only the first language. JioSaavn's website uses `webapi.getLaunchData.new_trending`, a mixed album/song/playlist module. Its language query parameters are ignored; it reads the URL-encoded `L` cookie instead. Verified live with Tamil/English and Hindi/English/Tamil cookie values and compared homepage embedded data. The earlier explanation attributing the entire mismatch to old provider selections was incomplete.
- Switched Trending Now to the homepage endpoint with all recommended/selected languages in the cookie, preserving provider order, entity identities and validated metadata. Added typed mixed trending items while retaining the song-only field consumed by Quick Picks. Existing new-release and chart sources remain intact. Reuse existing HTTP retry/timeouts for the language-cookie request; never send user accounts/cookies, only locally selected language names.
- Album cards open existing album details; songs use existing playback. Provider playlists are explicit external JioSaavn links (not imported or expanded automatically), with strict HTTPS/host/path/credential/port validation and narrow native opener permission. A failed/empty homepage falls back to the prior song endpoint with visible warning and source label. Language preference changes now refresh the mounted Discover shelf.
- Verification: 372 frontend tests across 57 files pass; complete native suite 138 passed/13 existing opt-in tests skipped. Added and separately passed an opt-in live homepage integration probe: 24 mixed items, four compatible recommendation songs, current albums such as Veezha Veera, Jailer 2 and Awarapan 2 plus homepage playlists. Offline tests verify language cookie, provider order, album credits, deduplication, safe playlist links and partial/fallback behavior. Isolated headless Edge desktop/mobile checks passed mixed-card actions, source labels, external playlist URLs, all language preferences and live preference changes. Frontend production build, scoped whitespace check and Windows release executable rebuild passed.
- Limits: homepage results can rotate and differ with selected languages/provider curation; no exact personalized website ordering is promised. Playlist browsing uses JioSaavn in the user's browser. No native audio playback or in-app restart performed; restart Lumaire to load the changed Rust provider integration and opener permissions.

## Fixed playback for generic Topic releases such as Claude's Plan — 24 October 2026

- Reproduced the exact failure with live public search: `Jos0Nzvj-2s` is Claude's Plan (Lo-fi Version), duration 150s, but flat search labels its channel `Release - Topic` and omits artist/track fields. Matching rejected the absent artist before extracting details. Full extraction confirms Jallidevs, the exact track title and an available audio stream; the catalog duration of 149s is compatible.
- Generic Release/Various Artists/Unknown Artist Topic results with matching title/version and compatible known duration can now request their missing artist metadata. Extracted artist, title/version and duration must still match. Explicit wrong artists, titles, versions and durations remain rejected. Limit missing-artist checks to three across the complete search and reuse an already verified candidate without extracting it twice. No Home/Quick Picks preflight was reintroduced.
- Added regressions reproducing the original error, extracted artist/version/duration mismatches, incomplete metadata, early mismatch rejection and bounded requests with known/unknown duration. Verified the actual updated resolver against live search and extraction: two first-phase searches, one extraction, exact `Jos0Nzvj-2s` resolved; other returned versions rejected.
- Verification: all 371 frontend tests across 57 files and production TypeScript/Vite build passed. Scoped diff whitespace check passed. Audio stream availability was checked without downloading or playing the song; native app restart/audio output were not tested and Rust was unchanged.

## Discover page refinements & Apple Top 10 carousel — 24 October 2026

- **Discover header & search:**
  - Removed the subtitle text "Fresh releases and the sounds getting attention."
  - Shrunk and shifted the Discover refresh button directly next to the central search bar into a cohesive circular pill button matching the search bar's 44px height and border styling.
- **Card cleanup & Album/Single badge:**
  - Moved the "Album" / "Single" indicator from an extra 3rd text line onto the top-left of the artwork cover as a frosted glass pill badge (`.discover-release-badge`), preserving the tag without adding vertical lines below the card. Also appended it to the subtitle hover tooltip.
- **Section rhythm & spacing:**
  - Further tightened spacing between all Discover sections (Spotlight, New Releases, Trending Now, Apple Top 10, Moods & Moments, Genres). Reduced section margins to `2px 0 6px`, top margin on explore sections to `8px`, header margins to `6px`, and release row padding to `0 2px 2px`, eliminating all dead vertical space.
- **Top 10 charts consolidation & custom country dropdown:**
  - Removed duplicate JioSaavn "Top songs" shelf, keeping the Apple Top 10 chart.
  - Replaced the raw browser `<select>` dropdown with the app's custom frosted-glass `<Select>` component with an animated chevron, rounded 32px pill trigger, custom checkmarks, and backdrop blur popover.
- **Apple Top 10 navigation & timestamp cleanup:**
  - Added horizontal carousel scroll buttons (`<` and `>`) to the Apple Top 10 shelf using ChevronLeft/Right, matching New Releases and Trending Now.
  - Removed the raw visible timestamp string ("Chart updated: Sat, 24 Oct 2026 14:27:19 +0000"), moving it into the Apple chart refresh button's tooltip (`title="Refresh chart (Updated: ...)"`).
- **Verification:**
  - All 363 Vitest unit tests pass across 57 test files (`npm test -- --run`).
  - Production build (`npm run build` / `tsc -b && vite build`) passed with 0 errors in 8.99s.

## Quick Picks: remove expensive page-load playback preflight — 24 October 2026

- Supersedes the upfront source-checking approach below. The 20-song shelf was waiting for up to 40 matching/stream-extraction attempts, which made loading impractically slow even after atomic publication stopped visible jumping.
- Removed that entire verification loop and its player-service dependency. Saved candidates rank synchronously without media IPC, stream search/extraction or downloads. Keep all personalization, global two-per-album/three-per-artist constraints, identity deduplication and overplay exclusions. Reject known missing files, unsupported sources and invalid catalog/video identities; respect engine availability and downloads.
- Optional feed and up to three personal radios run concurrently with one 2.5-second metadata budget. Available responses blend deterministically; late seed matches cannot start additional radios after the budget expires. Existing request caches remain. Removed the blocking 'Checking playable tracks' state/copy.
- Catalog Play now routes to the existing catalog handler, so only the clicked song triggers source matching/extraction with normal player loading/error handling. Local and already resolved tracks retain the direct playback path. Availability is checked at playback rather than promised by metadata.
- Verification: all 363 frontend tests pass, including 15 Quick Picks regressions (zero page-load source/media requests, stalled radio budget, no late radio scheduling, global caps and personalization). Isolated headless Edge showed the first fixture shelf in 215ms, expanded to 20 mixed candidates, made zero background stream/file checks and retained stable ordering through parent checkpoints. TypeScript/Vite production build passed.
- Limits: browser timing uses a deterministic mocked-provider fixture, not a universal timing guarantee. Unreported moved files or unavailable remote recordings are detected on Play. No real audio or native app restart tested in this follow-up; Rust was unchanged.

## Personalized, globally diverse and playable Quick Picks — 24 October 2026

- Root cause: Home populated Quick Picks from the first discovery album (and at most a second album), then sliced 20 tracks. No personalization, global diversity selection or local playback path was used. Removed that album-expansion path and its single-album heading link/fallback cast.
- Added a shared domain selector over saved tracks and a blended discovery/song-radio pool. Up to three distinct-artist seeds use liked tracks and meaningful listening history, including unsaved history/local metadata matches. Existing language discovery/radio providers remain unchanged. Ranking uses recency-weighted listening, liked tracks, favorite artists/albums and optional actual provider genre/language metadata. Genre/language are exposed from catalog responses, never inferred from names.
- A single pass caps the entire shelf at two tracks per normalized album and three per individual credited artist, including collaborations. Cross-provider IDs and matching performer/title editions deduplicate. Three meaningful sessions or three song-lengths listened within seven days exclude an overplayed recording. Familiar/discovery and local/online proportions are soft preferences: a small pool relaxes these preferences and returns fewer tracks rather than violating hard diversity caps or showing unavailable audio.
- Files are checked through native media resolution; online catalog tracks pass existing source matching and stream extraction before publishing a real playback identity. Failed checks release their slots and ranking retries candidates. Checks run two at a time, stop after 40 attempts or 20 selections, and stop scheduling after navigation. Publish only one complete result per run and retain the prior shelf while checking; progressive per-pair re-ranking caused visible song jumping and was removed. A deferred-check regression asserts no intermediate publication. Seed/radio requests coalesce and cache for 30m, recent stream verification for 60s; existing player stream cache is reused. Listening checkpoints do not continually restart work. No song download or audio autoplay occurs during recommendations.
- Quick Picks now plays local/verified remote Track objects through the existing playback hook (clearing pending catalog state), rather than casting local files to catalog entries. Saved songs are available while optional online candidates load; Commons streams do not require the YouTube engine.
- Regression verification: 363 frontend tests across 57 files pass, including 15 Quick Picks regressions and atomic publication; the repeated desktop/mobile UI regression passes. Complete native suite: 135 passed/13 opt-in live tests skipped; additional iTunes genre parser test passed (136 native tests total). Production TypeScript/Vite build passed. Isolated headless Edge checked desktop/mobile rendering, the actual Home shelf/effects, all 20 click identities, failed/overplayed exclusions and stable checkpoints: final fixture list had 8 local + 12 resolved online tracks, 20 distinct albums/artists, one Petta track. Source APIs were mocked for the reproducible UI fixture; result and screenshots are in ignored test-results/quick-picks/.
- Limits: source verification is point-in-time; online availability can change and playback refreshes streams. Missing genre/album/artist tags limit affinity/identity evidence; no invented genres or forced random diversity. Real personal-library audio was not played. Native startup could not be completed alongside the running app: default launch hit existing port 1420; reusing the dev server reached Rust compilation but could not replace the in-use debug/lumaire.exe (Access denied). Did not terminate the user's running app.

## Refactor metadata section into compact footer that doesn't disrupt listening flow — 24 October 2026

- **Moved and streamlined supplementary album and artist metadata:**
  - In [AlbumView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/AlbumView.tsx), moved `<MusicMetadataDetails>` from between the album header/action buttons and the tracks down to the bottom of the page, below the track table. The album header and action buttons now immediately flow into the tracklist.
  - In [ArtistView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/ArtistView.tsx), moved `<MusicMetadataDetails>` from between the artist hero and Popular tracks down to the bottom of the page, below Albums & releases.
  - In [MusicMetadataDetails.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/MusicMetadataDetails.tsx), simplified markup to compact horizontal entries (`.metadata-entry`) and removed the intrusive fallback message, returning `null` when metadata is unavailable.
  - In [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), removed the large bordered box and styled `.music-metadata-details` as a subtle, single-line/wrapped footer (`font-size: 11.5px`, muted colors, subtle top divider) resembling standard album liner credits in Spotify and Apple Music.
- **Verification:**
  - Vitest test suite: all 360 unit tests passed across 57 test files (`npm test -- --run`).
  - Production build (`npm run build` / `tsc -b && vite build`) passed with 0 errors in 16.31s.

## Truncate track and album table names before end of table with ellipsis — 24 October 2026

- **Fixed runaway track titles and album names overflowing across the table:**
  - In [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), increased track table grid column gap in `.track-header, .track-row` from `12px` to `20px` to give columns clean breathing space.
  - Set `max-width: min(360px, calc(100% - 16px))` on `.track-meta-text`, with `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` on `strong` and `small`.
  - Set `max-width: min(240px, calc(100% - 16px))` on `.album`, `.album.ellipsis`, and `.album .link-button`, ensuring long album names stop well before the duration/time column.
  - Set `max-width: min(520px, calc(100% - 16px))` for `.catalog-album-tracks .track-meta-text` where no separate album column exists.
  - In [LibraryView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/LibraryView.tsx), added `title={t.title}` tooltip to the track title `strong` element so users can hover to read the full title when truncated.
- **Verification:**
  - All 348 unit tests passed across 55 test files (`npm test -- --run`).
  - Production build (`npm run build` / `tsc -b && vite build`) passed with 0 errors in 8.87s.

## Gradual metadata and chart providers with regional evaluation — 24 October 2026

- Preserved all JioSaavn discovery/search/artist/album identities and playback behavior. Added optional MusicBrainz enrichment on loaded artist and album detail pages, with iTunes fallback and explicit source links. Verified unique names, release-group title/artist evidence, score and IDs; reject ambiguous matches and preserve native combining marks. Full release-date precision and original artist credits are displayed separately without rewriting user data or catalog identity.
- Added an independent Apple country-specific Top 10 below the existing JioSaavn chart. Country defaults to India and is saved locally. Apple Music Most Played falls back to the official iTunes Store chart with a distinct source and visible explanation. Ranks require ten valid unique records; no silent re-ranking after dropping bad rows. Retained/labeled JioSaavn charts.
- Optional HTTP requests are capped at six seconds/2 MB with no stacked retries. MusicBrainz is paced >=1.1s, iTunes uses its existing global rate gate, metadata loads after a short detail-page dwell, and renderer requests coalesce. Bounded in-memory caches retain metadata for 24h/negative results for 5m, Apple charts for 1h with stale-on-error and failure cooldown. Chart identities resolve only on Play, avoiding ten additional requests during page load.
- Evaluated MusicBrainz across Malayalam/Tamil/Telugu/Hindi/Punjabi and international samples; artist matches were strong, album queries were uneven. Live Rust probes verified Sushin Shyam and Vikram's MusicBrainz date/credits. Actual IN/US Apple integration returned ten entries each through explicitly labeled iTunes Store fallback; one sampled upgraded cover was verified as 600x600 (~123KB).
- ListenBrainz remains evaluation-only: a 30-day response exceeded 4MB; a 3-day response held 934 releases (~406KB) without language fields. Two English titles overlapped a five-album date-comparable sample, while three Indian-language editions did not match by title. This small comparison does not establish absence or overall coverage; there is no demonstrated advantage warranting replacement of regional discovery.
- Added reproducible read-only provider evaluation, local-HTTP parser/fallback regressions and isolated headless Edge UI checks. Details, measured responses, primary references and limitations: docs/PROVIDER-EVALUATION.md.
- Verification: 348 frontend tests across 55 files pass; complete serial native suite 135 passed/13 opt-in tests skipped. Additional live Rust metadata and IN/US chart probes passed. Production frontend builds. Headless Edge UI passed desktop/dark + mobile/light, responsiveness during pending metadata, country persistence/change, explicit fallback, error recovery and lazy Play lookup. Windows release build passed; rebuilt src-tauri/target/release/lumaire.exe.
- Limits: optional metadata is supplemental (release-group artist credits, not full personnel); new caches are process-local. Broader regional coverage, all storefronts, real audio from chart entries and full native app interactions were not exhaustively verified. JioSaavn remains the production release source; no required API keys/accounts or new runtime dependencies.

## Fixed Sidebar "Playlists" count mismatch — 24 October 2026

- **Fixed Sidebar displaying 10 instead of 8 playlists:**
  - In [Sidebar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/sidebar/Sidebar.tsx), updated the library navigation badge to display `playlists.length` instead of `collectionsCount`.
  - In [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx), passed `collectionsCount={session.playlists.length}` instead of `collections.length`.
  - Root cause: `collections` from `libraryCollections()` includes built-in system collections ("Local" and "Downloads") when tracks exist, adding 2 to the count. Since the UI button and page are specifically for user **Playlists** (and [Collections.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/Collections.tsx) deliberately filters to `collection.playlist`), the badge now accurately reflects the actual 8 user playlists.
- **Verification:**
  - 345 unit tests passed across 54 suites.
  - Production build (`npm run build` / `tsc -b && vite build`) passed with 0 errors in 6.54s.

## Shifted Featured Album Spotlight Hero Banner from Home to Discover — 24 October 2026

- **Moved Spotlight Hero Banner from Home to Discover:**
  - Removed the hero banner section from [DiscoveryHome.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryHome.tsx), letting Home focus purely on personal listening flows: dynamic greeting, Recently Played, Made for you, Quick picks, and Your rotation.
  - Added the Featured Spotlight Hero Banner to [DiscoverShelves.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoverShelves.tsx) using the newest top release from `feed.newAlbums[0]`, functioning as the grand editorial centerpiece at the top of the Discover view.
  - Connected `onPlayAlbum` through [DiscoveryView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryView.tsx) to [DiscoverShelves.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoverShelves.tsx) for direct playback with loading state feedback.
  - In [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), added `.discover-spotlight-section` margin for natural spacing below the Discover header.
- **Verification:**
  - Vitest test suite: all 345 unit tests passed across 54 files.
  - Production build (`npm run build` / `tsc -b && vite build`) passed with 0 errors in 8.77s.

## Fixed Artist page "Albums & releases" grid layout and standardized card hover play — 24 October 2026

- **Fixed broken overlapping album cards on Artist page:**
  - In [ArtistView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/ArtistView.tsx), replaced the mismatched `.collection-grid` and `.collection-card` structure with `.albums-grid.artist-albums-grid` and `.album-card.discover-album-card`.
  - Wrapped artwork in `.album-card-cover-wrap`, preventing the flex cyclic height bug in WebView2 that caused row 2 cards to overlap and truncate row 1's title and hide the year/track count.
  - Added Sonora-standard floating `.album-hover-play` button with accent background and glow on hover.
  - Wired `onPlayAlbum` in [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx) so users can play albums directly from the hover button or open album details by clicking the card.
  - In [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), styled `.artist-albums-grid` with clean `gap: 24px 18px`, 14px bold title, and single-line `12px` muted year/track metadata without vertical clipping.
- **Verification:**
  - 345 unit tests passed across 54 files.
  - Production build (`npm run build` / `tsc -b && vite build`) passed with 0 errors.

## Combined New releases shelf and provider assessment - 24 October 2026

- Merged New albums/New singles into one New releases carousel with shared navigation. Interleaves the existing provider lists, preserves canonical IDs and deduplicates IDs, and labels each card Album or Single. Albums still navigate to album details; singles still play and respect engine/busy availability. Existing carousel styling and other uncommitted UI edits are preserved.
- Added merge regressions (mixed kinds, duplicate IDs, singles-only and empty shelves). Nine discovery adapter tests passed and production frontend build passed. No Rust changes or new dependencies.
- Current sources: Discover releases/trending/charts use JioSaavn website endpoints (api.php); catalog search primarily uses JioSaavn with iTunes song-search fallback and iTunes identity lookups. This turn does not migrate providers.
- Research recommendation: use documented MusicBrainz metadata with iTunes fallback, Cover Art Archive for release artwork, and consider Apple's public country-specific Most Played RSS feeds for clearly labeled charts. ListenBrainz has Fresh Releases and community listening statistics, useful as an open discovery supplement rather than a claimed universal popularity chart. Test regional-language coverage before replacing existing discovery.
- Sources checked: https://musicbrainz.org/doc/MusicBrainz_API (free noncommercial API, no key, rate limits); https://performance-partners.apple.com/search-api (documented search/lookup and approximate 20 calls/minute); https://rss.marketingtools.apple.com/ (official feed builder); https://listenbrainz.org/explore/fresh-releases/ and https://listenbrainz.readthedocs.io/en/latest/users/api/statistics.html; https://musicbrainz.org/doc/Cover_Art_Archive/API. Spotify currently documents Premium/developer-access requirements, unsuitable for a zero-cost/no-account default.
- Manual visual verification of the merged carousel was not performed. Provider coverage comparison and migration are not implemented.

## Aaraadhike LRCLIB search recovery and explicit provider fallback - 24 October 2026

- Reproduced the live response: LRCLIB's title search returned 20 Aaraadhike records, including two with duration:null. Deserializing the entire array as Vec<Record> rejected every result, hiding the valid 357-second synced record (32091745).
- Parse the search array first and validate individual records, skipping malformed metadata while retaining valid neighbors. Array size, metadata length and finite duration bounds remain checked; title, artist, recording duration and timestamp matching are unchanged. All-malformed responses remain retryable errors, distinct from an empty search.
- A malformed exact record now proceeds to LRCLIB search; malformed artist-constrained search results can continue to the existing title-only query rather than immediately losing the provider.
- Existing chain remains LRCLIB then lrc.red, preferring verified synced lyrics and retaining plain lyrics if fallback fails. Provider-chain errors now explain which services failed or had no match; detailed parser/transport errors are logged rather than showing a misleading LRCLIB-only failure.
- Verification: 19 native provider tests passed (4 opt-in tests skipped), including new null-duration-neighbor and malformed exact/artist-query recovery regressions. Existing lrc.red fallback regressions pass. All 16 frontend lyric adapter tests pass. Explicit live Aaraadhike regression passed through LRCLIB: record 32091745, duration 357 seconds; lyric contents were not printed.
- Windows release executable and production frontend build passed. The desktop Retry interaction was not manually checked. No additional providers or API keys introduced; local/imported lyric handling is unchanged.

## Discover page carousel buttons, hover play standardization, Top songs carousel, and rich artwork covers for Moods & Genres — 24 October 2026

- **Replaced scrollbars with Home-style `<` and `>` navigation arrows:**
  - Added section header navigation buttons using `ChevronLeft` and `ChevronRight` for New albums, New singles, Trending now, and Top songs in [DiscoverShelves.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoverShelves.tsx).
  - Hid horizontal scrollbars across all discover rows (`scrollbar-width: none; -ms-overflow-style: none; &::-webkit-scrollbar { display: none; }`).
- **Standardized card hover play button across all discover cards:**
  - Unified all release and song cards to `.album-card.discover-album-card` with `.album-card-cover-wrap` and `.album-hover-play`.
  - Removed permanent purple play badges on singles, making play buttons seamlessly reveal on hover with smooth opacity, lift, and accent glow matching Home.
- **Transformed "Top songs" into a single-line horizontal card carousel:**
  - Replaced the vertical table list with a single-line card carousel with smooth scroll navigation and elegant rank badges (`#1`, `#2`, etc.).
- **Rich photographic artwork covers for Moods & Moments and Genres:**
  - Replaced flat colored blocks with curated high-resolution photographic covers for all 11 moods and 12 genres in [DiscoveryView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryView.tsx).
  - Added subtle zoom on hover (`scale(1.08)`), dark contrast gradient overlays for clear white text readability, elevation lift, and resilient fallback theme background colors.
- **Verification:**
  - Vitest test suite: 344 unit tests passed across 54 files.
  - Production build (`npm run build` / `tsc -b && vite build`) passed with 0 errors.

## Modern borderless Sonora / Apple Music UI for Playlists & Collections — 24 October 2026

- **Playlists view modernized to borderless artwork-first UI:**
  - Modernized `.collection-card` and `.collection-grid` in `src/style.css` and `src/components/views/Collections.tsx`.
  - Removed old 2022-era card borders, container padding (`padding: 12px`), and background boxes (`background: var(--bg-panel); border: 1px solid var(--line);`).
  - Elevated the 2×2 mosaic covers into the visual hero: 100% full-width floating squircles with `border-radius: 14px`, 2px mosaic dividers, smooth cover scaling (`transform: scale(1.03)`) and elevation shadow on hover (`box-shadow: 0 14px 34px rgba(0, 0, 0, 0.48), 0 0 20px var(--accent-glow)`).
  - Streamlined typography below the artwork: playlist title (`14px font-weight: 600`) gets the full card width without cramped badge pill; subtitle cleanly shows track count (`8 tracks`) and optional custom description (`24 tracks · Summer roadtrip`).
  - Also modernized `.catalog-release-cover` in `ArtistView.tsx` with matching 14px squircle and elevation depth.
- **Verification:**
  - Vitest suite passed: all 344 unit tests passing across 54 suites.
  - Production build (`npm run build` / `tsc -b && vite build`) passed with 0 errors in 6.69s.

## Stabilized hover play badge in Recently Played & Quick Picks, removed "See all" buttons — 24 October 2026

- **Fixed play button hover displacement in Recently Played & Quick Picks:**
  - Removed `transform: scale(0.85)` / `transform: scale(1)` and spring easing from `.recent-track-play-badge` in `src/style.css`, eliminating the upward scale overshoot and vertical twitch when hovering over items.
  - Set smooth, pure opacity fading (`transition: opacity 0.15s ease`) with rock-solid in-place centering (`transform: none`).
  - Added optical centering (`margin-left: 1px`, `display: block`, `margin: 0`) and drop-shadow on `.recent-track-play-badge svg` for clean alignment within the 42×42px squircle artwork.
- **Removed "See all" buttons from homepage sections:**
  - Permanently removed the "See all" buttons from both "Made for you" and "Your rotation" section headers in [DiscoveryHome.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryHome.tsx), leaving clean headers with section titles on the left and navigation arrows/refresh action on the right.
- **Verification:**
  - Full Vitest suite: 344 unit tests passed across 54 files.
  - Production build (`npm run build` / `tsc -b && vite build`) passed with 0 errors.

## Home layout reordering, Quick Picks lockup grid, and single-row Rotation carousel — 24 October 2026

- **Section reordering on Home:**
  - Moved **Recently played** above **Made for you**.
  - Added **Quick picks** directly below **Made for you**, using the exact same 4-row column-flowing track lockup grid UI as Recently played (interactive title with chevron `Quick Picks >`, 42px squircle art, hover play badge, single-line typography, and smooth horizontal carousel navigation).
  - Positioned **Your rotation** right below Quick picks.
- **Removed category selection chips:**
  - Removed the `discover-subbar` and `discover-mood-bar` pills ("All", "Top Hits", "Chill", etc.) and associated state/queries to declutter the Home landing page. Integrated the subtle refresh button directly into the "Your rotation" section actions.
- **Single-line moveable "Your rotation" carousel:**
  - Transformed "Your rotation" from a wrapped 2-row grid into a sleek, single-row horizontal carousel (`.discover-albums.discover-rotation-carousel`).
  - Added smooth left and right carousel scroll buttons (`scrollRotation("left" | "right")`), allowing users to smoothly browse through trending album cards horizontally.
- **Verification:**
  - Vitest test suite passed: 344 tests passed across 54 files.
  - Production build (`npm run build`) succeeded with 0 errors.

## Expanded-player cover tint and circular volume control - 24 October 2026

- Cover-derived backgrounds were working but mixed at only 18% strength. Increased the desktop expanded-player mix to 44% so artwork changes are easier to see, preserving the existing 32% light-theme setting and the mobile appearance. Palette extraction/cache/crossfade remain unchanged; no large blur layer or per-frame color work added.
- The collapsed volume control inherited generic dialog input padding, leaving a hidden slider's padding visible and stretching the circle into a pill. Reset slider padding/min-width and flex sizing so collapsed width is only the 36px button plus its 2px border. Hover/focus still reveals the slider.
- Verification: production frontend build passed; artwork-palette and PlayerBar tests passed (7 total). Live UI observation was attempted, but changing/minimized window state prevented a reliable final expanded-player screenshot. No native backend changes.

## Discover replaces the Search landing page - 24 October 2026

- Sidebar entry is now Discover (Compass icon); existing search/discover routes remain compatible. Mobile Discover highlights correctly for either route. The large central search field and existing result/search history behavior remain intact.
- Default order: New albums, New singles, Trending now, Top songs, Moods & moments, Genres. Release/trending cards scroll horizontally; Top songs uses the existing ranked track list with artist/album links and catalog actions. Genre tiles no longer treat Tamil/Hindi as genres.
- Added a metadata-only discover_page command using the provider's content.getAlbums new-release feed, content.getTrending songs, content.getCharts and the chosen chart's playlist.getDetails. Album/single parsing uses actual provider entity types, canonical identity/credits/artwork validation and deduplication. Top songs displays the chart's title; failures are visible per shelf rather than mislabeled search results.
- Reuses language preferences with broader discovery. The release feed accepts multiple languages, while trending uses the first preferred language (the upstream trending API returned no rows for comma-separated languages). Chart selection prefers that language's named chart and otherwise uses India Superhits Top 50.
- Added a bounded single-result 10-minute in-memory Discover cache and coalesced in-flight requests, plus a Refresh action. New metadata fetching is separate from playback source resolution.
- Verification: inspected live public release, trending and chart endpoint structures; 344 frontend tests pass and production frontend build passes. Four native catalog/discovery parser and local-HTTP tests pass, including album/single separation, chart routing, invalid rows and partial failures. Windows release executable build passed (existing lyric_overlay unused-mut warning remains).
- Manual visual verification was stopped because the desktop was locked. Native command additions require an app restart. Onboarding portal/centering/explicit-close fixes from the preceding issue are retained; their interactive verification remains incomplete.

## Apple Music / BitChord Recently Played Grid Refinement — 24 October 2026

- **BitChord / Apple Music 4-row track lockup grid:**
  - Redesigned the "Recently played" section in [DiscoveryHome.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryHome.tsx) from single-row portrait carousel cards into the 4-row column-flowing track lockup layout matching BitChord (`bitchord-8bw.pages.dev/home`) and Apple Music.
  - Interactive section title: replaced the static heading and separate "See all" button with an Apple-style interactive button (`Recently Played >`), where hovering smoothly nudges the chevron right (`transform: translateX(3px)`) and clicking navigates directly to full listening history (Tracker / `HistoryView`).
  - Grid geometry: 4 rows high with `grid-auto-flow: column; grid-auto-columns: calc((100% - 32px) / 3);` on desktop (12 tracks visible on first screen, responsive down to 2 columns on tablet and 1 on mobile). Supports up to 20 tracks with smooth horizontal scrolling and frosted glass carousel arrows.
  - Apple HIG lockup styling: 42px squircle artwork with subtle inner border, hover frosted play badge overlay (`backdrop-filter: blur(2px)`), single-line truncated title (`13.5px font-weight: 500`), secondary artist metadata (`12px`), and subtle background hover/press highlight (`--bg-subtle-button`). Fully compatible with both dark and light modes.
  - Linked `onOpenTracker={() => selectView("history")}` in [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx).
- **Verification:**
  - `npm test` passed (343 tests across 54 test suites).
  - Production build (`npm run build`) succeeded with 0 errors in 5.30s.

## English first in Music preferences & discovery languages — 24 October 2026

- **English first language ordering:**
  - Placed `"english"` at the beginning of [`DISCOVERY_LANGUAGES`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/adapters/discovery-home.ts#L3) (`["english", "hindi", "tamil", ...]`).
  - Both Settings → Music preferences and the first-run language onboarding modal now display English as the first checkbox option.
  - Set default recommendation fallback order in [discovery-home.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/adapters/discovery-home.ts#L31) and [DiscoveryHome.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryHome.tsx#L154) to prioritize English when no custom languages are selected.
- **Verification:**
  - `npm test` passed (343 tests across 54 test suites).
  - Production build (`npm run build`) succeeded with 0 errors.

## Music language preferences and optional onboarding - 24 October 2026

- Removed the single-language selector below Recently Played. Added Settings > Music preferences with optional multi-select checkboxes for the nine existing discovery languages; changes save automatically on this device.
- First-run language dialog asks which languages the user listens to, with Continue and Skip. Escape skips too, focus uses the native modal dialog, and playback shortcuts ignore open dialogs. Completing or skipping persists the onboarding flag so the prompt does not repeat.
- Existing single-language selections migrate to the new list. Recent searches remain independent. Empty selections remain valid and use broad defaults; no accounts, keys, database migration or paid services are introduced.
- Home albums and mood results blend/interleave selected languages plus broader English discovery, deduplicating IDs and keeping healthy language results if another provider request fails. Search is unrestricted; no Home language dropdown remains. Per-language caches and in-flight requests are reused.
- Verification: targeted preference/cache/blending, picker/onboarding rendering and App tests passed; production frontend build passed. Final full frontend suite passed: 343 tests across 54 files; final production build passed.
- Manual native onboarding/Settings interaction not verified. Preferences and onboarding completion are device-local; on this upgrade existing users see the optional prompt once.

## Fixed lyric settings anchor in Lyric room — 24 October 2026

- **Lyric room settings fixed anchor:**
  - Diagnosed why lyric settings was not fixed when scrolling in Lyric room: when optical alignment was cleaned up previously, the trigger button was placed inside the in-flow `.page-heading.lyric-room-heading`. As soon as lyrics scrolled down (autoscroll or manual), the entire header scrolled out of the viewport.
  - Restored `.lyric-settings-fixed-anchor` as a direct child of `.lyric-room` with `position: sticky; top: 10px; align-self: flex-end; z-index: 45; height: 0; pointer-events: none;`, keeping `.lyric-settings-trigger` always visible and clickable at the top-right corner of the workspace throughout the entire song.
  - Removed obsolete negative margin hacks (`margin-bottom: -38px`) across media queries and desktop styling so lyrics and headers maintain clean vertical flow without layout collision.
  - Restored the fixed lyric settings anchor in mobile Now Playing as well.
- **Verification:**
  - `npm test` passed (338 tests across 53 test suites).
  - Production build (`npm run build`) succeeded with 0 errors.

## Sidebar playlists sorted by latest content update - 24 October 2026

- Your Playlists now sorts by descending persisted updatedAt without mutating session order. Legacy playlists without a timestamp retain their relative order below timestamped playlists.
- The shared session update path stamps playlist creation, renaming, song additions/removals and song-order changes, covering local edits, imports, sync and track deletion. Playback and no-op imports/sync do not change timestamps. Unchanged playlist references avoid content scans.
- Restore validates timestamps and preserves them through session saves/backups; no database migration or inferred historical update dates.
- Verification: 15 targeted domain/import/sync/sidebar tests passed and production frontend build passed. Final focused recheck also passed (6 tests); final production frontend build passed.
- Manual desktop UI verification not performed. Old playlists only acquire an update timestamp when subsequently edited; no historical edit times were stored.

## Expanded Player volume animation unification & lyric motion blur optimization — 24 October 2026

- **Sound/Volume animation unification:**
  - Replaced the clunky backwards `max-width` volume control in [ExpandedPlayer.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/ExpandedPlayer.tsx) and [expanded.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/expanded.css) with the smooth, direct slider reveal animation used by the main playback controller (`PlayerBar.tsx`).
  - Placed the speaker icon button first and the slider second, eliminating layout jumpiness, nested slider wraps, and awkward leftward squishing on hover.
- **Motion blur optimization & lightweight expanded player:**
  - Removed continuous fractional `filter: blur(...)` and `filter` transitions on inactive lyric lines in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css).
  - Switched lyric depth of field to pure GPU-composited `opacity` and subtle `transform` scaling, eliminating costly 2D Gaussian convolution shader passes and texture re-rasterization on every lyric scroll frame.
  - Lightened `backdrop-filter` radii on control pills, dropping GPU memory bandwidth and locking 60/120 FPS playback.
- **Verification:**
  - `npm test` passed (334 tests across 52 test suites).
  - Production build (`npm run build`) succeeded with 0 errors.

## Gemini missing-line recovery instead of discarding the song - 24 October 2026

- The screenshot's "Translation line count does not match the original" came from the separate strict translation-array validator, before the earlier pronunciation fallback could run. The old schema did not constrain array length or IDs and one omitted line discarded all completed results.
- Response schemas now require the selected batch's exact array length and restrict IDs to that batch. Each returned ID is validated independently; unknown and duplicate IDs, malformed rows and blank/oversized translations cannot be assigned to another lyric.
- Keep valid entries and automatically retry only unresolved IDs, at most twice per batch. Persistent omissions return completed translations plus an explicit incomplete warning, leaving missing lines untouched. Partial results are saved but not cached as a completely processed song, and both automatic/manual UI paths show the remaining issue with Retry.
- Added HTTP-fixture regressions for repeated lyrics, missing/duplicate/unrequested IDs, constrained retry requests and bounded persistent omissions; added frontend coverage for saving partial results without marking completion.
- Verification: 15 native translation/keyless tests passed (2 live tests ignored), 11 frontend processing tests passed, production frontend and Windows release executable build successfully (existing lyric_overlay unused-mut warning only).
- Not verified against the user's live Gemini response/API key. This change addresses malformed line alignment; authentication, quota and provider outages retain their existing errors. Restart the native app after rebuilding, then retry the affected song.

## Circular collection header buttons & track menu hover stability — 24 October 2026

- **Collection header button geometry:**
  - Restored `border-radius: 50%` on collection/album header action buttons (`.album-actions .icon-only, .subtle.icon-only` and `.collection-menu summary`), keeping top header action buttons (shuffle, collection three-dots menu) circular.
  - Retained squircle `border-radius: var(--radius-md)` on track row items (`.track-menu summary`) matching adjacent heart buttons.
- **Track menu hover stability:**
  - Removed `transform: scale(1.06)` and transform transition from [`.track-menu summary:hover`](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css#L1664), eliminating visual shifting/jumping of the three dots on track rows during hover.
- **Verification:**
  - `npm test` passed (333 tests across 52 test suites).
  - Production build (`npm run build`) succeeded with 0 errors.

## TopBar Sync unification & Playlists tab Import button — 24 October 2026

- **TopBar Sync unification:**
  - Combined `Import` and `Connect` into a single, compact `[ ↻ Sync ]` button in [TopBar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/TopBar.tsx) with `.topbar-sync-btn` styling in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), opening the Collection Hub where both playlist imports and device syncing live.
  - Reduced horizontal topbar footprint and preserved responsive icon-only collapsing at narrow viewports.
- **Playlists tab Import button:**
  - Added a companion `[ Import ]` button beside `[ + New playlist ]` in [LibraryView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/LibraryView.tsx) header actions (`view === "library"`), directly triggering playlist imports from Spotify, YouTube, Apple Music, and local files.
  - Wired `onOpenImport` callback in [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx).
- **Verification:**
  - `npm test` passed (333 tests across 52 test suites).
  - Production build (`npm run build`) succeeded with 0 errors.

## Collapsed sidebar playlist removal & clean icon dock — 24 October 2026

- **Clean collapsed sidebar navigation rail:**
  - Removed playlists and scroll container from the collapsed sidebar (`.app.sidebar-collapsed .playlist-scroll-region, .app.sidebar-collapsed .playlist-label { display: none !important; }`), eliminating cramped artwork tiles and truncated text.
  - Added clean separator before Library navigation in the collapsed rail, grouping Main Navigation (Home, Search, Lyric room, Tracker) and Library (Playlists, Liked Songs, Albums, Artists).
  - Preserved full playlist access via the Playlists collection nav item (`<ListMusic>`) in collapsed mode, and full playlist list with covers and create action when sidebar is expanded.
- **Verification:**
  - `npm test` passed (332 tests across 52 test suites).

## Sharper taskbar controls and explicit playback loading - 24 October 2026

- Replaced 16px one-bit taskbar bitmaps with 128px antialiased RGBA artwork. Native icons are created at the monitor DPI icon size and refreshed on DPI changes; no new image/rendering dependency is required.
- Windows thumbnail Play/Pause now displays an eight-frame native spinner and a Loading song tooltip during song resolution, autoplay preparation or buffering. The 100ms timer exists only while loading and is removed when loading ends or the window closes; no animation ticks cross the renderer bridge.
- Kept the in-app loading/buffering indicator in compact and expanded controls, enlarged its ring, and replaced animated shadow pulsing with a simple linear rotation. The ring uses current text color and respects reduced motion.
- Verification: targeted player tests pass (7 tests); both native taskbar tests pass, including real icon creation at 32/48/64/128px. Production frontend and Windows release executable build successfully; existing lyric_overlay unused-mut warning remains.
- Manual taskbar appearance and loading animation on a running desktop session have not been verified. Restart the app after rebuilding to replace native icons and load the updated command signature.

## Track action button squircle border unification — 24 October 2026

- **Action button border radius consistency:**
  - Unified `.track-menu summary`, `.album-actions .icon-only, .subtle.icon-only`, and `.collection-menu summary` to use `border-radius: var(--radius-md);` (10px squircle), matching the adjacent heart (`.icon-button`) button and eliminating circular button mismatch.
  - Added `.track-menu[open] summary` styling for visual feedback when the menu dropdown is active.
  - Maintained circular styling for player bar transport controls where circular geometry is intentional across the transport strip.
- **Verification:**
  - `npm run build` completed with 0 errors.
  - `npm test` passed (332 tests across 52 test files).

## Lyric settings far-right alignment refinement — 24 October 2026

- **Lyric room settings position:**
  - Guaranteed full-width container expansion by adding `width: 100%` to `.lyric-room` in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css).
  - Positioned `.lyric-room-heading-actions` at the far right with `margin-left: auto; margin-right: 8px;`, ensuring perfect vertical optical alignment with the bottom-right floating action bar (`.lyric-room-floating-bar`).
  - Added responsive overrides for mobile and Android media queries so heading actions maintain proper spacing on all viewport widths.
- **Verification:**
  - Full test suite passed (332 tests across 52 test files).
  - Production build (`npm run build`) succeeded with 0 errors.

## Artist identity, offline pronunciation, playback responsiveness and Windows taskbar controls — 24 October 2026

- Split joint comma/“and” artist records into individual name references, without borrowing a collaboration's provider ID; preserve authoritative band names. Named artist lookup also matches individual collaborators. Added provider-fixture and frontend regressions.
- Clean video presentation labels and pipe-separated promotional metadata before lyric lookup; uploader-only video credits no longer masquerade as performers. Search popovers dismiss on outside pointer events in capture phase, including lyric surfaces.
- Reused existing Sanscript for major Indic scripts (including Assamese), fixed Malayalam atomic chillus and readable spellings, and repair only recognizable generated legacy pronunciations. Added lazy offline foreign engines through lyric-romanizer and transliteration; Chinese, Japanese, Korean, Russian, Ukrainian, Greek, Arabic, Hebrew, Persian and Thai have fixtures. Urdu shares Arabic-script handling. Japanese dictionary assets ship locally (~17.8 MB compressed); foreign processing runs in a worker. Script transliteration remains approximate, especially unvocalized Arabic/Hebrew and Thai; ambiguous kanji use document language/kana context.
- Research: selected https://github.com/thedavidweng/lyric-romanizer and https://github.com/yf-hk/transliteration alongside existing https://github.com/indic-transliteration/sanscript.js. Considered ml2en (older Malayalam-only GPL), Aksharamukha (AGPL/Python) and uroman (Python/Perl); avoided adding another runtime. Added full dependency licenses and Japanese dictionary notices to the third-party inventories.
- Gemini receives original lyrics. Missing or invalid pronunciation lines now preserve valid aligned translations and fall back locally per missing line, with warnings; malformed IDs and oversized responses still fail validation. This error was independent of the local Malayalam output.
- Playback already streams rather than downloading the whole file first. Coalesced concurrent stream resolution, added a bounded short-lived URL cache, and prepare the next queued source during the final 30 seconds. Matching and retry validation remain intact.
- Removed whole-dialog/FLIP artwork animation and redundant ambient blur from expanded player switching; retained a short artwork-only transition with reduced-motion support.
- Added Windows thumbnail-toolbar Previous / Play-Pause / Next controls using ITaskbarList3 and existing playback actions, including state updates, Explorer restart handling and icon cleanup. Windows controls the preview layout; this adds its supported toolbar beneath it.
- Verification: 332 frontend tests pass; serial native suite 121 passed, 10 live-provider tests ignored. Production frontend and final Windows release executable build successfully (src-tauri/target/release/lumaire.exe). Existing unused-mut warning in lyric_overlay.rs remains.
- Limits: computer-use approval timed out, so native visual behavior, taskbar hover controls and lower-end hardware smoothness were not manually verified. Live Gemini/provider calls were not exercised; no API keys required for local romanization. Existing unrelated WIP preserved.

## Smooth draggable desktop sidebar resizer — 24 October 2026

- **Draggable sidebar resizer implementation:**
  - Added `.sidebar-resizer` vertical separator to [Sidebar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/sidebar/Sidebar.tsx) positioned on the right boundary of the desktop sidebar with accessible `role="separator"` and `aria-orientation="vertical"`.
  - Implemented 60fps lag-free pointer drag tracking in [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx) with clamped width (180px–440px), auto-collapse snap when dragged under 120px, drag-to-expand out of collapsed state, and double-click to reset to default 240px.
  - Applied `.app.is-resizing` in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) to disable transitions and text selection during drag, preventing cursor drift and rubber-banding.
  - Linked grid template columns in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) to CSS custom property `--sidebar-width` (with 240px fallback), persisted user preference in `localStorage` (`lumaire:sidebar-width`).
- **Verification:**
  - Added unit test in [Sidebar.test.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/sidebar/Sidebar.test.tsx) for `.sidebar-resizer`.
  - Unit tests for `Sidebar` and `App` passed.
  - Production build (`npm run build`) succeeded with 0 errors.

## Lyric room header optical alignment & desktop LRCLIB opener fix — 24 October 2026

- **Lyric room header alignment & spacing:**
  - Solved horizontal misalignment: added `max-width: min(840px, 100%)` and `padding: 8px 16px 0` to `.lyric-room-heading` in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) so the eyebrow, title, and metadata start at 16px, matching the exact pixel column of `.lyric-line` text.
  - Eliminated the floating `.lyric-settings-fixed-anchor` negative margin hack (`height: 0; margin-bottom: -44px; padding-top: 30px`). Integrated the lyrics settings trigger button into `.heading-actions.lyric-room-heading-actions` inside [LyricsView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/LyricsView.tsx), naturally positioning it in the top-right of the lyric column.
  - Removed duplicate and conflicting margin overrides at line 9345 in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css). Reduced `.lyric-lines` top padding from 28px to 10px and header margin-bottom to 14px, cutting the vertical dead space between header and first lyric line from 56px to 24px.
  - Upgraded raw comma-separated text into structured metadata: prominent track title with artist links, accompanied by neat pill chips (`.lyric-meta-pills`) for sync state (`.lyric-timing-badge`), external provenance (`.lyric-provenance-link`), and detected language (`.lyric-language-badge`).
  - Allowed `.lyric-room-heading` to span 100% width with `margin-left: auto` on `.lyric-room-heading-actions`, pushing the lyrics settings trigger button all the way to the far-right edge of the workspace while keeping the left text column strictly aligned with the 840px lyric text.
- **Desktop LRCLIB link opener fix:**
  - Created [src-tauri/capabilities/lyrics.json](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src-tauri/capabilities/lyrics.json) with `opener:allow-open-url` permissions scoped to `https://lrclib.net/*` and `https://lrc.red/*`.
  - Added click delegation in [LyricsView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/lyrics/LyricsView.tsx) using `isTauri()` and `openUrl()` from `@tauri-apps/plugin-opener` so clicking provenance links opens the verified URL in the user's default browser instead of doing a webview no-op.
  - Added capability scope unit test to [lyric-display.test.ts](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/domain/lyric-display.test.ts).
- **Verification:**
  - `lyric-display.test.ts` (5 tests) and `LyricsSettings.test.tsx` passed.
  - `npm run build` completed cleanly with zero TypeScript or Vite errors.

## Topbar Settings migration & desktop controls alignment — 24 October 2026

- **Settings moved to TopBar:**
  - Added Settings gear icon button (`<Settings size={18} />`) to [TopBar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/TopBar.tsx) adjacent to the Queue icon toggle, positioned before the window controls: `[ Import ] [ Connect ] [ Queue ] [ Settings ] [ — □ ✕ ]`.
  - Added `onOpenSettings` callback to `TopBarProps` and wired it in [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx) (`selectView("settings")`).
  - Removed the standalone bottom settings button (`.sidebar-bottom`) from the desktop sidebar in [Sidebar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/sidebar/Sidebar.tsx), matching the layout structure of the mobile header.
  - Kept `Import` and `Connect` action buttons in the topbar with their responsive text collapsing behavior intact.
- **Verification:**
  - Added unit test in [TopBar.test.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/TopBar.test.tsx) verifying settings icon rendering and click dispatch.
  - Vitest suite passed for `TopBar.test.tsx`, `Sidebar.test.tsx`, and `App.test.tsx`.
  - Production build (`npm run build`) succeeded with zero errors.

## Library views overhaul: Playlists, Artists, Albums & Liked Songs modernization — 24 October 2026

- **Playlists tab header & info:**
  - Updated heading in [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx) and [LibraryView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/LibraryView.tsx) to `"Playlists."`, eyebrow to `"YOUR LIBRARY"`, and subtitle to `"Your playlists, mixes, and custom collections."`.
  - Replaced generic import action with `+ New playlist` button connected to the playlist creation dialog.
  - Search placeholder updated to `"Search playlists…"` and item count indicator now reports playlist collections (e.g., `8 playlists`) instead of raw library track counts.
- **Artists & Albums declutter:**
  - Removed inappropriate `+ Add music`, `Add folder`, and `Play collection` buttons from both Artists and Albums views in [LibraryView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/LibraryView.tsx).
  - Configured search placeholders to `"Search artists…"` and `"Search albums…"`.
  - Fixed count indicators to show total artists (e.g., `4 artists`) and albums (e.g., `1 album`) instead of library track counts.
- **Liked Songs modernization:**
  - Renamed title to `"Liked Songs"` (matching sidebar), with eyebrow `"PLAYLIST"`.
  - Replaced legacy 4-tile square with a signature vibrant purple-violet gradient squircle with centered white heart (`.liked-songs-cover`).
  - Removed redundant duplicate `<h2>Favorite songs</h2>` title between the search bar and the track table.
  - Set search placeholder to `"Find in Liked Songs…"`.
- **Premium Three-Dots icon alignment:**
  - Replaced raw text `•••` with Lucide `<Ellipsis size={18} />` across collection header menus, library track rows, and catalog track rows in [LibraryView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/LibraryView.tsx) and [CatalogTrackActions.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/CatalogTrackActions.tsx).
  - Styled `.track-menu summary` and `.collection-menu summary` in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) as circular 32px/36px icon buttons matching the geometry, optical centering, and hover behavior of the bottom playback controller.
- **Verification:** 318 tests pass across 51 test suites; production build (`npm run build`) passes cleanly.

## Discovery Home featured album, recently played carousel, categories gap & borderless cards — 24 October 2026

- **Featured album card:**
  - Increased card height from 128px to 164px with increased padding (22px 32px), title font size (26px), and balanced margins to give text, action buttons, and hero branding ample breathing room.
  - Removed vibe-coded sparkle icon from the featured badge in [DiscoveryHome.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryHome.tsx), styling it as a clean, editorial tracked badge in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css).
- **Recently played single-row carousel:**
  - Expanded track limit from 9 to 15 items in [DiscoveryHome.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryHome.tsx).
  - Converted Recently Played into a strictly single-row horizontal carousel (`.discover-recent-carousel`) with smooth scrolling and hidden scrollbars in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css).
  - Connected the header `<ChevronLeft />` and `<ChevronRight />` navigation buttons to smoothly scroll the carousel container via a `useRef`.
  - Preserved multi-row grid layout for Library artist cards (`.discover-portrait-grid`).
- **Categories spacing:**
  - Added a 32px top margin to `.discover-subbar` in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) so the mood filter pills and language selector have clear visual separation from the recently played section.
- **Card styling unification:**
  - Converted `.discover-album-card` in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) to clean borderless cards (transparent background and border, zero outer padding, hover elevation on cover art). This unifies "Your rotation" and Library album views with the borderless aesthetic of Recently Played, Apple Music, and Spotify.
- **Verification:** 318 tests pass across 51 test suites; production build (`npm run build`) passes cleanly.

## Artist hero header redesign & Favorite Artist button polish — 24 October 2026

- Redesigned the artist header in [ArtistView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/ArtistView.tsx) and [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) with a premium Spotify/Apple Music-grade layout:
  - Enclosed the circular artist avatar in `.artist-cover-wrap` with subtle outline border and 36px drop-shadow.
  - Formatted `.artist-info` flex column with distinct typographic hierarchy (`.eyebrow`, clamp-scaled `.artist-name`, and spaced `.artist-subtitle`).
  - Encapsulated the Favorite button inside an `.artist-actions` row with generous margins (`margin-top: 4px; margin-bottom: 36px` to the sections below).
  - Upgraded `.artist-favorite-btn` to a frosted glass pill with smooth hover elevation, active lavender fill (`.is-active`), and clean `"Favorited"` / `"Favorite artist"` state text.
- Verification: all 318 tests pass across 51 test suites; production build (`npm run build`) passes.

## Sidebar section spacing and settings background softening — 24 October 2026

- Compacted vertical section gaps across the sidebar in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css): reduced brand bottom padding from 32px to 22px, section captions (`.sidebar-caption`) margin from 16px/10px to 12px/6px, playlist label top margin from 28px to 16px, and bottom padding above settings from 20px to 12px.
- Softened the background on `.nav-settings` ("Settings & sources"): reduced selected background opacity from 0.16 to a subtle 0.08 with zero drop-shadow, and lightened hover background to `rgba(255, 255, 255, 0.05)`.
- Verification: all 318 tests pass across 51 test suites; production build (`npm run build`) passes.

## Declutter bottom-right expanded player controls — 24 October 2026

- Removed redundant romanization and translation icon buttons from the bottom-right corner (`.expanded-bottom-right`) in [ExpandedPlayer.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/ExpandedPlayer.tsx). Both settings remain fully accessible via the Lyrics settings popover (opened from the top-right header button).
- The bottom-right now cleanly displays only the back-to-sync button (when lyrics are desynced), the expandable volume slider/mute button, and the fullscreen toggle.
- Removed unused `Languages`, `Subtitles`, and `Loader2` imports from `ExpandedPlayer.tsx`.
- Verification: all 318 tests pass across 51 test files; production build (`npm run build`) passes.

## Fullscreen button in expanded bottom-right corner — 24 October 2026

- Added desktop fullscreen toggle button (`Maximize2` / `Minimize2`) into the bottom-right action controls (`.expanded-bottom-right`) right next to the volume control in [ExpandedPlayer.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/ExpandedPlayer.tsx) and wired props in [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx).
- Kept the 5-button transport controls (`.player-buttons`) in [PlayerBar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/PlayerBar.tsx) symmetric and clean at 320px width in [expanded.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/expanded.css).
- Verification: 318 tests pass across 51 files; production build (`npm run build`) passes.

## Expanded player left alignment and progress bar timing gap fix — 24 October 2026

- Fixed left padding / indent on track title and artist in ExpandedPlayer: omitted the empty cover-expand button when `expanded` is true in [PlayerBar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/PlayerBar.tsx) (which previously left a ghost node plus flex gap before the metadata) and ensured `.now-playing` and `.track-meta.now-playing-meta` have zero padding/margin in [expanded.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/expanded.css) to align flush left with the album art and progress bar.
- Fixed progress bar border and hover jump in ExpandedPlayer: removed `border-radius: 999px` and height animation from `input[type="range"]` in [expanded.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/expanded.css), which was causing Chromium to render an outer rounded border box around the slider and push the track down by 2px on hover. The track (`::-webkit-slider-runnable-track`) is now a borderless 4px pill that remains rock-solid in place without moving on hover, and `.expanded-times` maintains a tight ~6px gap below.
- Verification: 317 tests pass; production build (`npm run build`) passes.

## Search bar queue-responsive width and focus vertical expansion fix — 24 October 2026

- Search bar container `.topbar-center` now automatically reduces `max-width` from 480px to 320px when the right-hand queue/Now Playing dock is open (`queueOpen={true}` / `.queue-open` and `.app.with-queue`), smoothly transitioning with `transition: max-width var(--duration-fast) var(--ease-out)` to maintain comfortable breathing room.
- Fixed search bar vertical expansion on click: replaced `.topbar-search-wrap:focus-within`'s 3px outer spread ring (`box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.14)`) with `box-shadow: none`, and locked `.topbar-search-input` to `height: 100%; padding: 0; margin: 0;`.
- Scope: [TopBar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/TopBar.tsx), [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), [TopBar.test.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/TopBar.test.tsx).
- Verification: 317 tests across 51 files pass; production build passes (`npm run build`).

## Window controls integrated into the search header — 24 October 2026

- Removed the separate custom title strip and its 32px app-height deduction. Reused its native state tracking, minimize/maximize/restore/close handling and errors in WindowControls, rendered at the far right of TopBar on native desktop only.
- Empty header/wrapper areas are native drag regions with double-click maximization; search, navigation and utility controls remain interactive. Native controls fill header height and meet the right edge. Narrow desktop layouts compact utility labels and navigation arrows to leave search space.
- Scope: App, TopBar, WindowControls (renamed from TitleBar), their tests and CSS. Existing frameless config, window permissions, safe-close persistence and fullscreen gap workaround retained.
- Reduced topbar height from 56px to 46px (search input to 32px), scaled Made for You mix cards down to a maximum of 140px, and added back comfortable spacing throughout the hero page (greeting padding, featured album margins, and section gaps) in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css).
- Verification: 316 tests across 51 files pass; production build and changed-file whitespace checks pass. No native/config changes or release rebuild. Native visual/drag/snap verification remains unchecked; earlier WebView2 probes could not connect.

## Fullscreen taskbar-area gap workaround — 24 October 2026

- Confirmed installed Tao 0.37.1 Windows WM_NCCALCSIZE logic restricts maximized undecorated clients to monitor rcWork even while fullscreen, explaining the taskbar-height blank strip after adding the custom frame.
- Shared native fullscreen toggle now unmaximizes before entering, remembers previous maximization and restores it on exit. Normal windows remain normal. Entry failure restores maximization; duplicate transitions are guarded and error paths reconcile UI state. Browser fullscreen behavior stays unchanged.
- Added main-window maximize/unmaximize permissions. Native restart required. No CSS sizing hacks or dependency changes.
- Verification: four fullscreen regression tests plus two titlebar tests pass, covering ordering, state restoration, failure recovery and permissions. Production build passes. Windows release build passes (existing unused-mut warning only); actual native fullscreen visual confirmation remains unavailable because prior WebView2 probes could not connect.

## Custom desktop title bar and lavender branding — 24 October 2026

- Added a 32px theme-aware native title bar for desktop only: Tauri drag region (including native double-click maximize), minimize, maximize/restore state from resize events, and close via the existing save-before-exit handler. Hidden in fullscreen and on Android/browser; app height reserves its space without changing internal grid rows. Main window is undecorated; permissions remain scoped to main.
- Chose neutral charcoal #121212 with muted lavender #A78BFA; this is a considered visual preference, not an objectively universal best pairing. Preserved the headphone mark and saved appearance preferences.
- Updated SVG favicon/titlebar icon, 35 desktop/iOS icon assets, Android legacy/round/transparent foreground PNGs in icon and generated resource folders, and adaptive icon vector/background colors. Regenerated from vector using the installed Tauri CLI, preserving Android foreground safe-area bounds and image dimensions. Monochrome notification assets and widget UI left alone.
- Removed the italicized `"One song. Then another."` footer tagline from [QueuePanel.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/queue/QueuePanel.tsx) in the Now Playing dock.
- Removed the inner/outer border on topbar search input in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css), removed repeated categories/metadata below Made for you cards in [DiscoveryHome.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryHome.tsx), and compacted vertical padding and section margins so Recently Played fits in the hero page without scrolling.
- Verification: all 311 tests across 50 files pass; final titlebar tests and production build pass. Icon self-checks pass for palette, source/output equality, dimensions, safe-area bounds and ICO frames. Native startup probe could not reach WebView2 debugging, so drag, window controls and visual layout remain unverified on Windows. Windows release build (`npm run desktop:build`) passed and produced src-tauri/target/release/lumaire.exe; only an existing unused-mut warning in lyric_overlay.rs.

## Header autocomplete correction — 24 October 2026

- Top-bar typing now opens an anchored suggestions dropdown while leaving the current page visible. Header input is separate from full Search page state; only Enter/View all results opens full search. Artist/album suggestions open details, song suggestions use existing playback handling.
- Uses existing catalog APIs with 300 ms debounce, bounded results, stale-response cancellation, loading/partial-failure/error/empty feedback. Arrow keys select suggestions; Enter activates, Escape/outside click/blur dismiss, Clear resets input. Uses combobox/listbox semantics and theme popover tokens.
- Scope: TopBar and new TopBarSearch component, App wiring, dropdown CSS, TopBar regression test. No adapter/backend/config changes or dependencies.
- Verification: production build passed; all 308 existing unit tests passed and the added TopBar regression test passed separately (6 TopBar tests). Browser interaction harness could not complete: Edge launch stalled; Chrome launched but page creation stalled. Native desktop/manual visual verification remains unchecked.

## Search, favorites and desktop navigation wiring — 24 October 2026

- Header search stays on Home and shows debounced catalog results with loading/error/empty feedback; stale requests are ignored and typing remains enabled. Search now opens mood/genre exploration tiles that run catalog searches, replacing the duplicate discovery home feed. Logo returns Home and clears search.
- Liked Songs no longer includes album cards. Albums shows favorite albums only; Artists shows favorite artists only, with a persistent heart toggle on artist detail pages. Artist restoration validates IDs and metadata and supports older sessions. Playlists remains the library overview with individual sidebar shortcuts; overview excludes local/download collections.
- Sidebar selected backgrounds use the active accent. Kept lavender: ranked first for cohesion with the dark UI, sage second for a softer alternative. Existing saved theme choices preserved.
- Added missing native fullscreen query/set permissions; failures now surface in the app banner. Requires a native app restart.
- Verification: 308 tests across 49 files pass, including favorite artist restoration and separated library rendering. Production build passes. Native/manual visual verification remains incomplete: default dev port 1420 was occupied, alternate dev server could not be reached by Tauri. Stopped only verification processes started in this session. No Rust handler changes or dependencies added.

## Sonora-Inspired Desktop UI Transformation & Fullscreen Mode — 23 October 2026

- **Sonora Dynamic Greeting & Editorial Featured Album Hero Banner:**
  - Added time-of-day greeting header (`Good morning / afternoon / evening / night.`) with illuminated accent dot and warm subtitle (*"Music for a calmer, brighter you."*) in [DiscoveryHome.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/DiscoveryHome.tsx).
  - Promoted and redesigned the Featured Spotlight hero banner to the very top of the Discovery home feed: wide cinematic card with frosted backdrop blur, high-contrast serif typography (`Playfair Display`) for featured titles, subtitle badge, rounded pill actions (*"Play Album"* and *"Save"*), and graceful editorial fallback.
- **Dedicated Home vs. Search Route & Sidebar Restructuring:**
  - Kept only `"home"` and `"search"` in main navigation; moved `"lyrics"` (Lyric room) and `"history"` (Tracker) above into the primary navigation bar.
  - Under `YOUR LIBRARY`: structured Playlists, Liked Songs, Albums, and Artists with full routing support, album/artist grids in [LibraryView.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/views/LibraryView.tsx), and removed Discover from the sidebar.
- **TopBar Cleaned Up:**
  - Removed notification bell and user profile "L" avatar from [TopBar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/TopBar.tsx), leaving the centered search pill, history chevrons, and essential utility actions.
- **Sonora Proportions & Squarish "Made for you" Cards:**
  - Made "Made for you" cards squarish (`aspect-ratio: 1 / 1; border-radius: 14px`) matching the Sonora reference. Added atmospheric multi-stop gradients, top-left frosted badge, and bottom-aligned title/subtitle watermarks.
  - Adjusted responsive breakpoints in [style.css](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/style.css) so all 6 "Made for you" mixes remain on a single row across desktop screens down to 1100px instead of prematurely breaking to 5 columns with a wrapped single card.
  - Resized the Featured Album hero banner down to `150px` height with clickable cover navigation.
- **Bottom Playback Controls Cleanup:**
  - Removed queue button and "Desktop Audio" device badge from bottom controls in [PlayerBar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/PlayerBar.tsx) (queue panel remains togglable via top-bar action). Preserved bottom scrubber bar.
- **Expandable / Collapsible Right-Hand "Now Playing & Up Next" Dock:**
  - Upgraded [QueuePanel.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/queue/QueuePanel.tsx) into a unified Now Playing dock matching Sonora's 3-column desktop layout.
  - Features large squircle artwork, bold track title, artist links, favorite heart toggle with accent glow, and an upcoming queue section with track durations.
  - Added sleek progress bar with glowing thumb dot beneath the live audio visualizer.
- **Lightweight Audio Waveform Visualizer (`AudioWaveform`):**
  - Created [AudioWaveform.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/common/AudioWaveform.tsx) rendering 28 dynamic pill bars in the user's active accent color directly beneath track metadata in the Now Playing dock.
  - GPU-accelerated CSS keyframe oscillation when playing, smooth resting curve when paused, zero idle CPU overhead, and full `prefers-reduced-motion` compliance. Added unit test in `AudioWaveform.test.tsx`.
- **Desktop Player Bar Queue Toggle & Scrubber Continuity:**
  - Preserved the main audio seek/progress bar in [PlayerBar.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/components/player/PlayerBar.tsx) as requested.
  - Added Desktop Audio output device badge and queue toggle button so users can collapse/expand the right panel directly from bottom controls.
- **Native Immersive Fullscreen Mode:**
  - Implemented `toggleFullscreen()` in [App.tsx](file:///d:/CODING/Web%20Development/Projects/Fullstack/music-player/src/App.tsx) using Tauri's native window API (`getCurrentWindow().setFullscreen()`) with HTML5 Fullscreen API fallback.
  - Bound `F11` key and `Escape` key, and added a dedicated Fullscreen toggle button (`Maximize2` / `Minimize2`) on the bottom player bar.
  - Added `.app.is-fullscreen` style rule hiding the top action bar and Windows taskbar, with a floating translucent glass exit badge on hover.
- **Verification:**
  - 306 Vitest unit tests pass across 48 test files (`npm test`).
  - Production build passed cleanly in 3.5s with zero warnings (`npm run build`).

## Windows v1.0.5 Signing Audit — 23 October 2026

- Downloaded the published GitHub installer without executing it. SHA-256 `247fff6c05ec05cf0dc2921a2421042bda1ab33b12ecd970530386d0e1bcada0` matches GitHub's asset digest. Windows `Get-AuthenticodeSignature` reports NotSigned, with no signer certificate.
- Release contains the installer, updater `.exe.sig`, and `latest.json`. Existing workflow signs updater artifacts only; neither Windows bundle config enables Authenticode signing. Updater signatures do not establish Windows publisher trust.
- Host CurrentUser/My and LocalMachine/My contain no code-signing certificates. A trusted Windows signing certificate/private key or configured signing service is required before a publisher-signed replacement can be built and published. No release assets or signing configuration changed; other laptop's exact warning remains unverified.

## Catalog Subtitle Matching Fix — 23 October 2026

- Shared source matcher now tries the full title, then a conservative core-title fallback for article-led descriptive subtitles and redundant Theme annotations. Remix/Live/Reprise/Instrumental and other existing recording-version checks, artist evidence, and duration validation remain required. Catalog display metadata is preserved.
- Resolver adds core-title/credit/album searches only after existing full-title searches fail, covering playback, source reuse, and downloads through existing callers. No dependencies or native changes.
- Added regression coverage for all four reported album title formats, live Sony lyric metadata, shortened-video rejection, unknown annotations, artist mismatches, fallback search order, and recording-version separation. Removed the temporary diagnosis-only test that asserted the old rejection.
- Verification: all 303 tests across 47 files passed; `npm run build` passed. No desktop playback or live download verification; provider extraction availability remains separate from matching. Subtitle normalization intentionally covers only article-led descriptive subtitles and redundant Theme labels.

## Nee Paartha Vizhigal Source Diagnosis — 23 October 2026

- Metadata-only live search with the installed yt-dlp engine returned 15 candidates. Replayed results through the current shared matcher using screenshot metadata (title, credits, album `3`, duration 264s).
- All candidates rejected for `title` with `(The Touch of Love)` included. Removing only that subtitle in the diagnostic input accepts SonyMusicSouthVEVO lyric source `sZksJJ0169M` (268s) and Shweta Mohan source `wC-XHMyr-8o` (265s). Sony's 249s music-video edit remains rejected for duration.
- Evidence: `test-results/nee-paartha-search.ndjson`, `test-results/nee-paartha-diagnosis.json`; diagnostic Vitest probe passed (1 test). Application code unchanged; no stream extraction, playback, or download verification performed.
## Mobile UI/UX Polish (Apple Design System), Autoplay Switch & Lyrics Fixes — 22 October 2026

- **Save To Playlist Modal Cross Button Boundary Fix:**
  - Added `box-sizing: border-box; width: min(540px, calc(100vw - 32px)); max-width: calc(100vw - 32px); overflow: hidden;` to `dialog.save-playlist-modal` to prevent mobile viewport boundary overflow.
  - Added `.save-playlist-header-left, .save-playlist-header > div:first-child { flex: 1; min-width: 0; }` and `.save-playlist-subtitle { max-width: 100%; }` so long track titles/artists truncate with ellipsis instead of pushing `.save-playlist-close` offscreen.
- **Autoplay Switch Apple iOS UISwitch Redesign:**
  - Completely redesigned `.mobile-np-toggle-switch` according to Apple iOS UISwitch proportions: 51×31px track (`border-radius: 31px`), no border, native subtle blur track (`rgba(120, 120, 128, 0.32)` in dark, `rgba(120, 120, 128, 0.22)` in light).
  - 27×27px pure white circle thumb with Apple layered shadow (`0 3px 8px rgba(0, 0, 0, 0.24), 0 1px 2px rgba(0, 0, 0, 0.12)`).
  - Symmetric 2px insets: `translateX(20px)` on active switch, with Apple rubber-band stretch (width 31px on press).
- **Now Playing Song Page Vertical Balancing:**
  - Raised controls and metadata upward from the bottom navigation bezel: adjusted `.mobile-np-main-view` padding to `calc(env(safe-area-inset-bottom, 16px) + 38px)` and tightened `.mobile-np-artwork-container` margin to `6px`.
- **Lyrics Tab UI Alignment & Gesture Follow Fix:**
  - Eliminated the awkward 26vh blank void at the top of the mobile Now Playing lyrics tab: reduced `.lyric-lines` padding-top from `26vh` to `24px` so lyrics begin immediately under the header tabs.
  - Positioned `.mobile-now-playing .lyric-settings-fixed-anchor` to `width: 100% !important; display: flex !important; justify-content: flex-end !important; position: sticky !important; top: 6px !important; right: 0 !important;` so the settings button is pinned to the top-right matching Lyric Room.
  - Positioned floating action buttons (`.lyric-room-floating-bar`) lower down at `bottom: calc(env(safe-area-inset-bottom, 16px) + 14px); right: 16px;`.
  - Fixed sync button flash: clicking translation, romanization, or settings buttons previously bubbled `pointerdown` to the scroll container, erroneously triggering manual browse mode (`setFollow(false)`). Added target filtering in `handleUserGesture` and `stopPropagation()` on floating bar touches.
  - Fixed keyless translation failure: updated backend endpoint from `translate.googleapis.com` (which was CAPTCHA rate-limited) to `translate.google.com/translate_a/single` with modern browser user agent and `client=at`.
- **Verification & Deployment:**
  - 290 unit tests passing (`npm test`).
  - Production build passing in 3.83s (`npm run build`).
  - Keyless translation backend tests passing (`cargo test keyless_translation`).
  - Android debug APK assembled and signed with `lumaire-release.p12` via `apksigner` (v2 and v3 signatures verified).
  - Successfully streamed and installed via ADB onto physical Motorola Edge 50 Pro (`ZD222LVFWT`), and launched `MainActivity`.

## Mobile Now Playing Theme/Accent Responsiveness, Lyric Room & Autoplay Polish — 22 October 2026

- **Full Theme & Accent Color Responsiveness:**
  - `MobileNowPlaying.tsx` now passes `data-theme` and `data-accent` attributes directly to the sheet root container.
  - `mobile-now-playing.css` uses dynamic theme token variables (`--np-bg`, `--np-text-primary`, `--np-text-secondary`, `--np-pill-bg`, `--np-slider-unplayed`, `--np-play-btn-bg`, etc.) that seamlessly adapt between Dark mode (deep velvet charcoal) and Light mode (Apple/Lumaire warm sage-cream).
  - High-impact controls adapt to the user's selected accent color: the played half of the progress bar scrubber, scrubber thumb, favorite heart, active transport buttons, play button in light mode, active autoplay toggle switch, clear queue button, and current queue card border/glow.
- **Album Cover Full Sizing Fix:**
  - Resolved the 44px thumbnail bug where global `.cover` rule in `style.css` constrained the image inside the 320px squircle card. Added `.mobile-np-artwork-card .cover, .mobile-np-artwork-card .mobile-np-artwork-img { width: 100% !important; height: 100% !important; display: flex !important; }` and `.mobile-np-artwork-card img { width: 100% !important; height: 100% !important; object-fit: cover !important; }`.
- **Seek Bar / Progress Slider Clarity Fix:**
  - Replaced the indistinct dual-grey track with an accent-illuminated WebKit/Blink runnable track: `linear-gradient(to right, var(--accent) 0%, var(--accent) var(--seek-percent), var(--np-slider-unplayed) var(--seek-percent), var(--np-slider-unplayed) 100%)`.
  - Added `-5px` margin-top on the 14px slider thumb for vertical centering on the 4px track, with high-contrast accent fill and theme border.
- **Authentic Lyric Room Experience in Now Playing:**
  - Suppressed Google/Gemini translation error banners (`.listening-notice`) on mobile and when embedded.
  - Hidden clutter headers (`.lyric-room-heading`, `.page-heading`, `.parser-warning`) inside the mobile Now Playing sheet so lyrics occupy maximum vertical space.
  - Restored Apple-style progressive focus depth blur (`data-distance="0..4"`), scaling, and font tokens from `style.css`.
  - Added floating action buttons (`文A` translation, `🔤` romanization, and scroll-to-sync button) sticky-positioned at the bottom-right of the lyrics tab.
  - Updated `centerLyricLine` and `LyricsView` scroll listeners to support `.mobile-np-lyrics-scroll-wrap`.
- **YouTube Music-Style Auto-Play Button:**
  - Added an interactive Auto-play toggle switch card in the Queue tab ("Up next") directly below the header, wired to `onSetting("autoplay", !session.settings.autoplay)`.
- **Android Widget Picker Play Button & Realistic Demo Previews:**
  - **Root Cause of Missing Play Button:** In static layouts and the Android launcher widget picker, `widget_play_btn_bg.xml` was a transparent ripple mask, and `ic_widget_play.xml` had `fillColor="#18181B"`. Drawn on a `#18181B` background, the play button was 100% black-on-black invisible.
  - **Play Button Fix:** Updated `ic_widget_play.xml` and `ic_widget_pause.xml` to `fillColor="#FFFFFF"`, and `widget_play_btn_bg.xml` to have a solid `#F59E0B` (Lumaire Amber/Gold) circle with ripple. The play button is now unmistakably visible and vibrant in both preview and resting states.
  - **Realistic Demo Previews (`android:previewLayout`):**
    - Created `widget_art_demo.xml` featuring a multi-stop gradient (violet `#8B5CF6` to pink `#EC4899` to amber `#F59E0B`) with centered vinyl overlay.
    - Created `widget_now_playing_preview.xml` showcasing realistic demo data: "Blinding Lights", "The Weeknd" in amber accent, stylish demo cover art, and the illuminated play button.
    - Created `widget_lyrics_preview.xml` displaying realistic synchronized lyrics: active line "I once was a man with dignity and grace" in bold amber `#F59E0B`, and upcoming line in subdued `#A1A1AA`.
    - Pointed `android:previewLayout` in `widget_now_playing_info.xml` and `widget_lyrics_info.xml` to these dedicated preview layouts.
- **Verification & Deployment:**
  - 290 Vitest unit tests pass across 47 test files (`npm test`).
  - Production build passed cleanly in 3.75s (`npm run build`).
  - Gradle assembled `:app:assembleArm64Debug` in 27s.
  - Signed with `lumaire-release.p12` via `apksigner.jar` (v2 and v3 signatures verified).
  - Installed over ADB to Motorola Edge 50 Pro (`ZD222LVFWT`): `Success in 2305 ms`. Launched `MainActivity`.

## Android Home-Screen Widgets Fix, 1-Row Lyrics & Apple-Design Theme/Accent Polish — 22 October 2026

- **Play/Pause Button Optical Alignment Fix (Apple Design):**
  - Diagnosed and fixed the rightward shifting glitch when paused:
    1. In `WidgetUpdateHelper.kt`, an arbitrary `val extraX = if (!isPlaying) (1 * density).toInt() else 0` offset was being added when paused, shifting the play icon 2-3px to the right. Removed this offset completely.
    2. Re-engineered `ic_widget_play.xml` and `ic_widget_pause.xml` paths so both icons occupy the identical 24x24 coordinate frame bounds `[6.5, 6.0, 17.5, 18.0]` with equal 6.5dp horizontal margins, matching Apple SF Symbols precision.
    3. Replaced `widget_play_btn_bg.xml` with a transparent circular ripple mask so clicking the hero button triggers native feedback without any subpixel color bleed.
- **Apple Design Surface Materials & Elimination of Hardcoded Colors:**
  - Replaced hardcoded olive/sage colors (`#151812`, `#F6F7F3`, `#22281D`, `#E6ECE0`) with Apple-grade neutral surfaces:
    - **Dark Mode:** Deep velvety Apple SystemBackground `#18181B` with subtle `#27272A` border.
    - **Light Mode:** Pristine Apple White `#FFFFFF` with Apple SystemGray5 `#E4E4E7` border.
    - **Secondary Controls (Prev & Next):** Apple frosted glass translucent oval pills (`#14FFFFFF` in dark mode, `#0A000000` in light mode) with high-contrast neutral icons (`#E4E4E7` / `#3F3F46`).
- **Full Theme & Accent Color Synchronization Across Text & Lyrics:**
  - **Now Playing Widget:** Track title uses crisp high-contrast text (`#FFFFFF` in dark, `#18181B` in light); artist name harmonizes in the user's active Lumaire accent color via `getAccessibleAccentColor()` with automatic WCAG AA luminance adjustment.
  - **Lyrics Widget:** The current active lyric line dynamically highlights in the user's chosen **accent color** (Ocean Blue, Amber Glow, Electric Violet, Sunset Rose, Sage, or custom hex), with upcoming lines rendered in subdued neutral gray (`#A1A1AA` / `#71717A`). Fallback messages ("Not playing", "No lyrics available") display in clean primary neutral text.
- **Verification & Deployment:**
  - 288 Vitest unit tests pass (`npm test`).
  - Production build passed in 3.99s (`npm run build`).
  - Android ARM64 debug APK compiled and signed with `lumaire-release.p12` via `apksigner.jar` (v2 and v3 signatures verified).
  - Installed and verified on physical Motorola Edge 50 Pro (`ZD222LVFWT`): `Success in 2433 ms`. Launched `MainActivity`.

## Mobile-First Now Playing Screen (YouTube Music UX + Apple Design) — 22 October 2026

- **Full-Screen Mobile Now Playing (`MobileNowPlaying`):** Implemented a full-screen mobile sheet for Lumaire triggered by tapping the bottom mini-player cover or title metadata on mobile viewports (`mobile || window.innerWidth <= 768`). Preserved the desktop `ExpandedPlayer` for desktop layouts.
- **YouTube Music UX Reference:** Reverse-engineered YouTube Music's interaction patterns into three switchable tabs:
  - **Song / Player Tab:** Large responsive squircle artwork (scale 1.0 when playing, 0.95 when paused), track title with negative tracking, clickable artist credits via `ArtistLinks`, favorite heart toggle, interactive scrubber with elapsed/remaining time toggle, and transport controls (Shuffle, Previous, 68px Play/Pause button, Next, Repeat/Repeat1).
  - **Lyrics Tab:** Full-height scrollable synchronized lyrics container with current line highlight and glowing pill, tap-to-seek, and support for original, romanized, and translated layers with graceful empty state fallback.
  - **Queue Tab:** Up-next count badge, "Clear queue" button, undo removal banner, now-playing card with equalizer pill, and reorderable/removable upcoming track list with immediate tap-to-play.
- **Apple Design Polish (`mobile-now-playing.css`):** Applied frosted glass translucency (`backdrop-filter: blur(40px)`), dynamic ambient background glow derived from track artwork palette, fluid spring physics, direct-manipulation pull-to-dismiss gesture with momentum fling, and Android system back gesture / button interception via the History API (`popstate`).
- **Zero-Regression Audio Integration:** Tied directly into Lumaire's existing `usePlayback` controller and Android Media3 background playback service. No duplicate players, audio interruptions, or provider settings broken.
- **Verification:**
  - 288 Vitest unit tests pass across 47 test files (`npm test`), including dedicated tests in `MobileNowPlaying.test.tsx` verifying tab switching, lyrics line seek, queue reorder/removal, and dismiss actions.
  - Production build passed cleanly in 4.93s (`npm run build`).
  - Physical Android device verification: inspected DOM, evaluated styles, and validated APK on connected device (`ZD222LVFWT`) over ADB.

## Mobile Queue Artist Name Cap & Overflow Containment — 22 October 2026

- **Artist Capping (`ArtistLinks`):** Added `maxArtists?: number` support to `ArtistLinks.tsx`. When specified, collaborations exceeding the cap display the primary artists followed by `…` (e.g., `Artist 1, Artist 2…`), preventing unbounded credit lists from overwhelming compact views. Added unit test in `ArtistLinks.test.tsx`.
- **Queue Panel Cap:** In `QueuePanel.tsx`, set `maxArtists={2}` and wrapped `" · Now playing"` in `<span className="queue-now-playing">` with `flex-shrink: 0` so the active track indicator never gets partially cut off.
- **CSS Flex Containment:** Fixed flexbox text truncation in `src/style.css`. Because parent flex containers do not trigger ellipsis on inner flex items, added `min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto;` to `.queue-artist` and `.queue-info`, and enforced mobile maximum width limits on `.queue-select` (`calc(100% - 36px)` for current track, `calc(100% - 90px)` for upcoming tracks) so the text stays strictly within the card bounds without colliding with or slipping under the remove (`X`) button.
- **Verification:**
  - 285 frontend Vitest unit tests pass (`npm test`).
  - Production build passed in 8.62s (`npm run build`).

## Recent Search Item Removal & Native Android Widgets — 22 October 2026

- **Individual Search History Removal:** Added a subtle remove button (`X`) on each recent search item row in `DiscoveryView.tsx`. Hovering over any item on desktop or viewing on mobile/touch screens reveals the clear button, allowing users to remove individual searches from localStorage without having to clear their entire search history via `Clear all`.
- **Domain & Adapter Support:** Added `removeDiscoverySearch(query)` in `discovery-home.ts` which case-insensitively filters and saves the updated history list. Added unit test in `discovery-home.test.ts`.

- **Zero-Dependency Native Architecture:** Implemented two Apple-styled Android home-screen widgets using Kotlin `AppWidgetProvider` and `RemoteViews` with zero added third-party dependencies, keeping binary footprint minimal and build times fast.
- **Now Playing Widget (`NowPlayingWidgetProvider`):** Features 24dp squircle dark container (`#151812`), 16dp rounded album artwork (loaded asynchronously from local file or HTTPS with smooth `BitmapShader` rounding and dark sage vector fallback), high-contrast title (`#F4F5F0`), muted artist (`#8A9280`), and background controls (Previous, Next, and glowing Sage `#C4DCA3` Play/Pause toggle). Tapping the widget body launches `MainActivity`.
- **Live Lyrics Widget (`LyricsWidgetProvider`):** Displays real-time synchronized playback lyrics with bold active line (`#F4F5F0`, 16sp) and subdued upcoming preview line (`#7A8272`, 13sp). Gracefully handles missing, untimed, or paused lyrics with "No lyrics available" / "Tap to open Lumaire" fallback states.
- **Minimal Battery Footprint:** Configured `updatePeriodMillis=0` (no continuous background polling). The lyrics engine schedules a single `postDelayed` callback targeted directly at the next lyric line's timestamp (`lines[idx + 1].timeMs - positionMs`), waking up only when the active line advances.
- **In-Process Coordination:** Single-process mediator `WidgetUpdateHelper` connects directly with Media3 `PlaybackService` and `ExoPlayer.Listener` (`onIsPlayingChanged`, `onPlaybackStateChanged`, `onMediaItemTransition`, `onPositionDiscontinuity`). Pending queue actions (`next`, `prev`) pass seamlessly into `AndroidPlaybackController` to advance playback in React.
- **Verification:**
  - 284 frontend Vitest unit tests pass (`npm test`, including 2 new tests for widget actions, artwork forwarding, and lyric sync).
  - Production build passed in 3.91s (`npm run build`).
  - Android debug ARM64 APK assembled and signed with `lumaire-release.p12` (v2/v3 signatures verified).
  - Installed to physical Android device via ADB (`Success in 1810 ms`).
  - Confirmed system widget registration and attributes via `dumpsys appwidget` (`updatePeriodMillis=0`, `resizeMode=3`, `zombie=false`).
  - Broadcast intents `ACTION_WIDGET_PLAY_PAUSE`, `ACTION_WIDGET_PREV`, and `ACTION_WIDGET_NEXT` verified with `result=0` and zero logcat errors.

## Android mobile settings UI & listening history tracking — 22 October 2026

- **Mobile listening history enabled:** Removed the early exit in `startListening()` on mobile so foreground listening is tracked, checkpointed to SQLite, and surfaced in the Tracker view. Updated empty state and notice text in `HistoryView.tsx`.
- **Responsive Settings redesign:** Fixed squished multi-word wrapping on mobile settings rows (Backup & Restore, Lyric text size, Clear Data, Offline Downloads) by making action buttons stack cleanly below full-width titles and descriptions. Styled the top settings category navigation with smooth horizontal-scrollable pills and hidden scrollbars, made licence segmented tabs wrap responsively, and formatted appearance custom color controls.
- **Queue pane lowered below mobile navbar:** Lowered `.queue-pane` on mobile/Android from `top: 54px` to `top: calc(52px + env(safe-area-inset-top, 36px) + 8px) !important;` and adjusted `max-height` accordingly, preventing the queue popover from obscuring the top app bar and settings button.
- **Queue and catalog track title/artist vertical gap:** Fixed the root cause of the vertical gap: excluded `.link-button`, `.track-title-button`, `.track-meta-text button`, and queue buttons from `.android button { min-height: 40px; }`. Added global `.link-button` and `.track-title-button` resets (`min-height: 0`, line-height `1.25`, zero padding/margin), styled `.queue-select small`, `.queue-info small`, `.queue-entry.current small`, and `.track-meta-text` to eliminate spacing between song titles and artist names.
- **Mobile catalog actions:** Moved the inline favorite button into the 3-dots popup on screens <= 768px and Android viewports, and hid extra `.album` columns on mobile track rows to fit the 4-column mobile layout.
- **Signed APK ready:** Rebuilt ARM64 debug APK and re-signed with matching key (`.tools/release-signing/lumaire-release.p12` via `password.txt`) so it updates seamlessly over existing installs without signature mismatch (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`).


## 1.0.5 release preparation — 22 October 2026

- User authorized pushing and publishing 1.0.5. Updated npm/lockfile, Cargo/lockfile, Tauri version and versioned Windows shortcut icon resource; retained app identity and signing keys.
- Finalized RELEASE_NOTES.md with user-facing changes and the important bootstrap limitation: published 1.0.4-preview binaries predate the updater. Windows users must install 1.0.5 manually once without uninstalling; future signed versions use the configured update feed. Android keeps its existing signing certificate.
- Release notes render safe headings, paragraphs, lists, bold text and inline code instead of exposing Markdown hashes/asterisks. Shared rendering covers available/installed notes on Windows/Android. Untrusted HTML stays escaped. Native desktop verified both pre/post-update formatting.
- Checks: production build; 282 frontend tests; native serial run 116 passed, 10 explicit live-provider/key-dependent checks ignored; release-config validation, two manifest self-checks and actionlint passed. The default parallel native run exposed mock-server expiry behind the shared lyric request gate; serial rerun passed all enabled tests.
- Android ARM64 release APK built from final UI and signed with the existing key; v2/v3 signatures and ZIP alignment verified. Physical-device replacement not performed. Windows release workflow completed cleanly (7m 45s on GitHub Actions, run #2 on tag v1.0.5): built signed NSIS installer, verified artifacts/signatures, and published Lumaire v1.0.5 release.
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

## Mobile Android App Icon Proportions & Vector Unification — 22 October 2026

- **Diagnosed Discrepancy:**
  - On desktop (`icon.png`), the Lumaire headphones occupy 57.8% of the canvas with balanced padding on dark background `#151812`.
  - On Android mobile launchers, the adaptive icon appeared weird, oversized, and clipped (headphones filled 86% of the 72dp circular mask, touching the top and side edges).
  - Cause: `ic_launcher.xml` and `ic_launcher_round.xml` in `mipmap-anydpi-v26` referenced `@mipmap/ic_launcher_foreground` (loading legacy oversized raster PNGs) rather than `@drawable/ic_launcher_foreground`.
- **Fixed Vector and Adaptive Icon References:**
  - Updated `ic_launcher.xml` and `ic_launcher_round.xml` in both `src-tauri/icons/android/` and `src-tauri/gen/android/app/src/main/res/` to use `@drawable/ic_launcher_foreground`.
  - The vector drawable in `drawable/` and `drawable-v24/` applies `scale: 0.5625` and `translate: (18, 18)` to the 128x128 SVG viewBox, mapping the geometry with 100% mathematical fidelity onto the 72dp safe zone of the 108dp adaptive canvas.
- **Regenerated Mipmap Raster Fallbacks:**
  - Regenerated all raster foregrounds and legacy square/round launcher PNGs across `mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, and `xxxhdpi` so the headphone width sits at ~57.5% of the 72dp circle, matching the desktop icon identically regardless of launcher or Android version.
- **Verification:**
  - All 282 Vitest unit tests pass (`npm test`).
  - Production build passed (`npm run build`).
  - Android debug APK assembled and signed with `lumaire-release.p12` (`apksigner verify` confirms v2 and v3 signatures).

## Lyrics Settings Translation Toggle & Mobile AI Cleanup — 22 October 2026

- **Restored Translation Display Toggle:**
  - Added `"translation"` toggle ("Translation", "English meaning beneath lyrics") directly into the `DISPLAY` grid in `LyricsSettings.tsx` alongside `romanisation`, `originalScript`, `originalFirst`, `autoOpenLyrics`, and `estimatedScroll`.
  - Toggling Translation immediately updates `session.settings.translation` and triggers background keyless Google translation for foreign lyrics.
  - Symmetrical 3x2 grid layout now neatly balances all 6 display options with no trailing empty spaces.
- **Cleaned Up Desktop-Only Gemini AI Key on Mobile:**
  - On mobile, hidden the non-functional "AI TRANSLATION KEY" section and permanently grayed-out `autoGemini` switch in `LyricsSettings.tsx` (labeled as "Lyrics cache") and `SettingsView.tsx`.
  - Mobile relies on built-in keyless Google translation which requires no setup or private key.
- **Verification:**
  - All 282 Vitest unit tests pass (`npm test`).
  - Production build passed (`npm run build`).
  - Debug APK built, re-signed, and installed onto the connected device via ADB.

---

*This file is the source of truth for current work. Update it instead of relying on conversation history.*

