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
