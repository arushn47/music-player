# Lumaire: first-use reliability and product improvements

## Order and release gates

Work begins with milestone 1. Do not start milestones 2–6 until the streaming setup gate passes. Preserve local playback, user libraries, artist/album routes, Android's bundled engine and existing preferences throughout.

### 1. Windows online-playback setup — locally verified

Status (21 October 2026): implemented and passed local automated/native desktop gates (see CURRENT-STATUS). A new distributable and recheck on the affected friend's machine remain release follow-up work.

Problem: Discover exposes a manual yt-dlp/PATH error; installation has no progress or cancellation, one fixed timeout, and only verifies file hashes, not execution. Availability checks are synchronous native commands and can block the command thread.

Scope: `src-tauri/src/components.rs`, availability/command registration, native adapter, library-manager state, shared setup card in Settings/Discover, styles, unit tests and isolated desktop installation script. No new dependency, system PATH changes, administrator prompt, unverified mirror or security-software workaround.

- Put an explicit Enable online playback action directly in Discover. Missing optional components are setup status, not a playback error. Keep catalog search and local music usable.
- Report connecting, downloading (real bytes and percent when length is known), retrying, verifying, testing and activating. Preserve the state across navigation. Disable duplicate installs; allow cancellation and retry.
- Bound connection/stalled-download/process checks; permit slow active downloads. Retry transient network/429/5xx errors a limited number of times. Never retry checksum failures blindly or activate partial files.
- Preserve pinned official HTTPS URLs, size limits, hashes, staging and rollback. Test both yt-dlp and QuickJS before activation. Report disk, network, verification and execution failures distinctly. Keep an existing working installation recoverable.
- Run availability probes off the UI/command thread. Report ready only after usable-component checks.

Gate: frontend tests/build, Rust tests/check and native startup pass; a fresh isolated desktop profile downloads verified official files with visible progress, runs both executables, becomes ready without restart and stays ready after reload. Exercise failure→retry, cancel→retry, duplicate click and navigation during installation. Inspect screenshots. Record limits: another person's machine/antivirus environment cannot be certified without its diagnostic evidence.

### 2. Discover home and onboarding

Status (21 October 2026): implemented and locally verified. Discover is the startup/home entry, with language-filtered JioSaavn album selections, recent searches/plays, local-library actions, six-hour device caching and recoverable offline/empty states. Native navigation/playback and browser offline/privacy/narrow-layout checks passed; physical Android and release packaging remain separate checks.

Default new sessions to Discover; retain deliberate navigation/session restoration. Put search immediately in view. Show recent listening/searches and useful first-use choices (search, add local music, import when implemented). Add a small real provider-backed selection with language/region controls, caching, source attribution and unavailable/offline states. Do not display fabricated recommendations or add endless shelves. Gate: new user reaches search/playback without guidance; returning/offline users retain library access; navigation and scroll tests pass.

### 3. Simple multilingual lyric controls

Expose Romanize and Translate as direct controls with visible selected/loading/error states. Keep advanced preferences in Settings; preserve existing settings and English-line suppression. Explain unavailable language/source cases. Gate: English-only, original-script and mixed-language songs behave correctly on desktop and Android without unnecessary translation calls.

### 4. Bring an existing collection

Status (21 October 2026): shared public playlist links are now the primary input for YouTube Music/YouTube, Spotify and Apple Music. Preview precedes saving; original provider identities or explicit catalog matches are retained. CSV/TSV/M3U remain optional. No browser extension, cookies or service login. Public Spotify completeness/access can vary; private/shortened links are not silently treated as complete imports. See `docs/connected-features.md` for current limits and actual verification.

Gate: import is reversible, preserves order and duplicate choices, discloses partial/unmatched entries and never claims that metadata guarantees playback. Test blocked/private playlists and page-format changes independently for each service. Private service libraries still require authentication; no login integration is planned here.

### 5. Local recommendations

Status (21 October 2026): the dashboard recommendation shelf was removed at the user's request. Opt-in **Autoplay (∞)** now continues after the normal queue ends, using artist-related real catalog candidates, existing source resolution and one new song at a time. No AI/key, account or uploaded history. Explicit queue order/Repeat win; turning it off cancels pending continuation.

Gate: no already-queued duplicates, reliable cancellation, honest source/network errors and normal end-of-queue behavior when disabled. Broader similarity ranking remains a future quality improvement, not a second dashboard shelf.

### 6. Differentiation, then optional connected features

Status (21 October 2026): first native private-network host/guest implementation added: expiring pairing links, explicit one-way playlist snapshot sync with local-conflict preservation, and host-led listening with per-device source resolution and approximate clock correction. No hosted relay or login. Physical cross-device network and Android runtime verification remain required; it is not production-ready internet sync. A PC-only expanded cover/lyrics player reuses the existing audio owner and lyric engine; Android keeps its mini-player.

Validate a focused multilingual listening experience with testers: original/romanized/translated lyrics, passage repeat and personal corrections. Prioritize demonstrated demand. Device sync needs identity, conflict handling and a storage choice; listening together needs separate stream resolution per device, clock synchronization and server lifecycle work. Define their cost/privacy model before implementation. Neither is a prerequisite for fixing basic playback.

## Verification and distribution

After each milestone, update CURRENT-STATUS with actual checks and remaining limits. Use fresh profiles as well as an existing library. Build traceable Windows/Android release artifacts only after the relevant platform acceptance checks. Do not overwrite the published 1.0.4 preview or claim a signed updater upgrade is tested until it is exercised. Publishing remains a separate release action.
