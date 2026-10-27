## Mobile polish and shared drag queue — 26 October 2026

- [x] Tracker: mobile-specific compact heading/range controls, one-row recap metrics, swipeable ranking cards and compact recent-play rows. Removed obsolete background-tracking-development notice. Desktop Tracker layout preserved.
- [x] Playing song: mobile current rows retain an accent edge with padded artwork/content, avoiding cover overlap.
- [x] Mobile player: moved identity/transport upward and tightened time labels to the seek bar while preserving touch targets.
- [x] Sync sheet: close button is fixed at 44 by 44 pixels, cannot flex-shrink into an oval.
- [x] Queue: shared Pointer Events drag handle replaces up/down buttons on mobile and desktop; arrow keys remain supported. Only upcoming entries can move. Drag follows the pointer, highlights its target, handles cancellation and scrolls at edges without per-move React state. Mobile queue now also includes unsaved session queueTracks.
- [x] Domain reorder inserts rather than swaps, copies displayed order before edits, rejects invalid/out-of-bounds moves and preserves current playback/shuffle ordering. Regression guards caught and fixed an initial mutation bug.
- Verification: 46 focused queue/session/player/navigation tests passed; bundled browser checks passed for touch dragging, desktop mouse dragging, keyboard moves, circular Sync close geometry, compact Tracker, existing phone gestures and desktop isolation. Production frontend and ARM64 Android builds passed. Screenshots: `.test-data/mobile-review/tracker.png`, `player.png`, `drag-queue.png`.
- Signed and verified `.test-data/Lumaire-mobile-polish-20261026.apk` using the existing certificate; Motorola ZD222LVFWT `adb install -r` succeeded and launch returned Status ok. Data retained, version 1.0.6 unchanged, no commit/push/publication. Long-queue touch scrolling and screen-reader behavior still need physical-device review; desktop installed release remains unchanged.
## Restore standalone mobile Lyric Room — 25 October 2026

- Removed the embedded lyrics tab/controller from MobileNowPlaying. Expanded mobile playback now has only the song view and Up Next; cover swipes/queue gestures preserved. Desktop expanded lyrics unchanged.
- Mobile Lyrics navigation opens the existing standalone Lyric Room through normal screen routing, retaining the bottom mini-player. Five compact destinations: Home, Discover, Library, Lyrics, Tracker. Removed the mobile route interception and obsolete embedded lyric styles; opening the mobile player no longer requests lyrics as though Lyric Room were open.
- Verification: seven focused navigation/player/swipe tests passed. Offline touch/layout checks passed at 360/390/433px, plus desktop isolation at 1280px; standalone Lyric Room and visible mini-player asserted. Production frontend and ARM64 APK builds passed.
- Signed `.test-data/Lumaire-phone-lyric-room-20261025.apk` with the existing release key and verified it. Motorola ZD222LVFWT in-place installation succeeded, and MainActivity cold launch returned Status ok. No app-data clearing, version change, push or publication. Real phone lyric interaction remains for user review.
## Mobile follow-up without a connected phone — 25 October 2026

- [x] Home: all five shelves remain available on mobile in desktop order. Missing-data shelves explain their real eligibility instead of disappearing or inventing plays. Desktop retains its existing hide-empty behavior. History remains device-local; Continue Listening needs an unfinished multi-track queue, Rotation three qualified plays, Forgotten Favorites older loved listening.
- [x] Discover artwork: mood/genre tiles reuse artwork from the already fetched release/trending feed, then saved artwork or a bundled image. No extra category API requests or dependency on external stock-photo hosts.
- [x] Discover songs: force album/time/index out of mobile rows and pin metadata/menu to the same grid row; preserved desktop columns.
- [x] Cover gestures: left/right skip with direct horizontal artwork tracking, no per-move React state. Existing up/down queue/dismiss gestures remain.
- [x] Lyrics: pinned artwork/title and previous/play-pause/next controls above the lyrics, including empty/error states.
- [x] Favorites: root handler now saves streamed queue tracks before favoriting instead of silently rejecting unsaved tracks; no global busy lock or playback changes. Existing library favorites still toggle immediately.
- [x] Verification: 22 focused tests passed. Production frontend and ARM64 Android debug APK builds passed. Offline browser fixture passed at 360/390/433px plus 1280px desktop isolation: cover skips, heart state, lyrics controls, all Home shelves, actual loaded category image, compact Discover row geometry, library/settings/sheets and queue interactions. Direct localhost checks were blocked in this environment; fixtures now bundle and fulfill local resources directly without external requests.
- [ ] Real phone playback, gestures and signed in-place installation await reconnection. Local debug review APK: `.test-data/Lumaire-mobile-review-1.0.6.apk`; not release-signed for replacing the installed release. No install, data reset, commit, push, tag or publication. Version stays 1.0.6; prior local Windows updater/setup changes preserved.
# Mobile redesign checklist — 25 October 2026

## Player/history follow-up

- [x] REA 6.5.0 CLI works with scoped `REA_ADB_PATH`; actual YouTube Music mini/player/Up Next states captured under `.test-data/yt-gesture-*`. ADB supplied declared swipes; REA supplied digested before/after captures.
- [x] Keep one mobile lyrics destination inside Now Playing; route auto-open and other lyric links there. Keep desktop Lyric Room.
- [x] Compact four-item Home / Discover / Library / Tracker navigation; Sync in the top header; play-only mini-player.
- [x] Mini-player swipe up opens Now Playing; left/right skips. Full-screen swipe up opens Up Next; down dismisses queue/player; bottom Up Next/Lyrics controls replace the segmented top switch.
- [x] Fix lost Android playback identity preventing history writes. Count actual ExoPlayer media progress in the native service while the WebView sleeps, excluding seeks, pauses and buffering; reconcile into existing SQLite history on return. No clock-only estimates or placeholder shelves.
- [x] Actual-touch UI checks: mini-player left/right, swipe-up opening, Up Next, downward dismissal, subsequent button taps and desktop isolation. 33 focused tests and the Android/production build passed.
- [x] Signed APK installed preserving data. Real Magale playback including background time produced 19,554ms in both native counter and persisted history. Home now shows Recently Played. Motorola swipe opening/Up Next/dismissal, play-only controls and header Sync were verified; results are under `.test-data/mobile-player-*`.

Native background counters live with the playback service and are reconciled on return to the UI. Force-killing the entire app before reconciliation can lose the uncheckpointed background portion; no persistent service journal was added.

Scope: mobile presentation and touch behavior. Preserve desktop layouts, providers, playback and saved data. No release/version change during review.

## Audit evidence

- Real Motorola Edge 50 Pro: inspected Lumaire Discover, empty Library, Settings, album actions, Now Playing, lyrics and empty queue. Captures/measurements are local in `.test-data/lumaire-mobile-*`.
- Inspected installed YouTube Music Library and player using ADB/UI Automator. REA's Android provider could not find adb; existing SDK tools supplied observations. Spotify's official player documentation and BitChord's public project/site supplied secondary references.
- Five bottom tabs omit Home. Mobile brand links to Library despite its Home label. Discover can highlight Library too.
- Measured header buttons 36×40, shelf arrows 24×40 and mini-player Play 38×40. Android's blanket minimum height overrides smaller widths. Several touch targets are below 44px.
- Discover repeats branding, eyebrow, heading, description and tall promotional hero before browsing content. Desktop carousel arrows remain on phone.
- Library lacks category filters. Playlist/catalog rows retain table columns and 215px desktop popovers with 40px action rows. Long press is absent.
- Settings turns a desktop sidebar into a horizontal strip, hiding categories off screen.
- Player caps artwork at 304px on this phone, leaves excess space, mixes green-black surfaces with lavender branding, and rerenders React on each drag event. Its history effect depends on an unstable callback, risking repeated entries during playback.
- Lyrics inherit desktop spacing and heavy dimming. App-header queue uses a different panel from player queue. Dialogs, selectors and menus have inconsistent presentation/dismissal.

## Implementation checklist, in priority order

- [x] Mobile shell: Home / Discover / Library, category filters, secondary entry points, safe areas, circular controls and touch targets.
- [x] Browsing: compact headings, swipe shelves, mobile track rows, balanced artwork, Library/playlist density and empty states.
- [x] Listening: artwork-led player, gestures without per-frame React rendering, stable Back handling, seeking, readable lyrics and unified queue entry.
- [x] Consistency: long press and overflow share actions, bottom action sheets, mobile dialogs/selectors, Settings list/detail navigation.
- [x] Verification: 9 focused regression tests; browser flows at 360/390/433px and desktop isolation at 1280px; production frontend and Android build; signed APK installed preserving data.
- [x] Follow-up build reviewed on the unlocked Motorola. The initial build review had been blocked by the lock screen.

The first full unit run passed 400 tests and exposed a click-listener mock collision in the existing hook test. Registration order was corrected and all 9 related tests passed, including new long-press/scroll-cancel and navigation regressions. The rest of the suite was not repeated. Android packaging reran the production TypeScript/Vite build successfully.

Run isolated UI checks with a dev server at port 5175 and `npm run test:mobile-ui` (or set `LUMAIRE_TEST_URL`). Fixtures in `tests/mobile` never touch the phone's library. Results/screenshots are in `.test-data/mobile-review/`.

## Design decisions

- Keep the serif brand/headings, chosen accent, dark/light themes and cover-based atmosphere. Avoid extra glow/glass and decorative motion.
- Three permanent destinations. Songs means liked songs; albums and artists stay separate. History lives in Library; lyrics and queue in Now Playing; Settings in the header.
- At least 44×44px touch targets, 68px primary Play, 15–16px row titles, 12–13px secondary labels, 24–28px headings, 16–20px gutters. Respect Indian scripts and enlarged text.
- One main scroll area per screen. Swipeable artwork shelves show the next card edge; remove desktop table headings and carousel arrows on phone.
- Overflow/long press open the same actions. Scrolling cancels long press. Sheets support outside dismissal, Back/Escape, focus containment and explicit close.
- Share domain/data code and scope presentation to mobile. No new dependency, provider or audio-engine replacement.

## Verification limits

Phone Library is empty; populated states require isolated browser fixtures rather than writing test data to the phone. Static reference screenshots do not establish animation timing. Do not claim measured CPU/60fps, TalkBack certification or low-end hardware coverage without measurements.

References: [Spotify player](https://support.spotify.com/us/article/now-playing/), [BitChord project](https://github.com/kushagrasinghx/BitChord), [BitChord site](https://bitchord.kushagrasingh.in/).
