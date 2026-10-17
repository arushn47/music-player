# Lumaire

A Windows desktop music player built with React, TypeScript, Vite, Tauri 2, Rust and SQLite. The existing design/research package remains unchanged in [docs/phase-1](docs/phase-1/README.md). The current implementation follows its **local-first P0 scope**; the later user instruction authorizes implementation beyond the historical documentation-only phase.

## Run locally

```powershell
npm install
npm run desktop
```

The launcher uses the existing Rust installation and a project-local Cargo cache. It recognizes this machine's `D:\Rust` installation without changing system PATH or the default toolchain. You can also set `RUSTUP_HOME` and `RUSTUP_TOOLCHAIN` explicitly. MSVC build tools, Windows SDK and WebView2 are required. No paid dependency, backend, account or API key is needed.

`npm run dev` opens only the shared UI; file selection and the persistent library require the native desktop app. `npm run desktop:build` builds a standalone, unsigned Windows executable without downloading an installer framework or installing anything on the system.

## Use

- **Add music / Add folder:** import local files. The same canonical path preserves one library asset; separate copies remain separate. Import never starts playback automatically.
- **Discover:** search Wikimedia Commons for freely licensed audio (Creative Commons & public domain). Each track displays its license and attribution. Click to play, add to queue, or view the source page. Requires internet connectivity.
- **Library:** search title/artist/album, favorite tracks, play next, add to queue, add to a playlist or explicitly relink a moved recording. Files are never deleted. Online and local tracks coexist.
- **Queue:** play any entry, move entries up/down, remove, clear and undo. Repeated entries retain their own item identities. Shuffle and repeat are in the persistent transport.
- **Lyric room:** attach UTF-8 LRC/TXT, then supplied Latin romanisation and English meaning. Confirm line mappings before attachment. Timed variants need identical timestamps; plain variants need one row per original occurrence. Offsets never rewrite source timestamps or IDs. Positive timing offsets show lines later. Scroll away, then resume following. Instrumental recordings have a separate marked state.
- **Settings:** export/import versioned library metadata and settings, clear history or supplied lyric cache, review enabled sources, and review local source behavior and shortcuts. Export excludes audio, lyric text, history and absolute paths. Imported entries cannot grant access to files; new entries require Relink. Import replaces the saved queue/playlists/settings after explicit confirmation.

Playback restores paused. The SQLite database normally lives in the OS app-data directory for `app.lumaire.player`. Library operations run on a native background thread. The renderer cannot execute shell commands, SQL or arbitrary file reads. Selected canonical audio paths are granted individually to Tauri's scoped media protocol; whole audio files are not loaded as base64. Online track URLs are resolved just-in-time and never persisted.

## Music Sources

**Local files:** Full offline playback of your own audio collection. Supports MP3, WAV, FLAC, OGG, M4A, AAC, and Opus formats (codec availability depends on your system).

**Wikimedia Commons:** Search and stream freely licensed audio directly from Commons. Each recording has its own license (Creative Commons or public domain) with specific attribution requirements. View the source page to confirm license terms. Streaming requires internet connectivity. No account or API key needed.

## Verify

```powershell
npm run build
npm test
npm run fixtures
npm run desktop -- --no-watch
# In another terminal, while the Vite dev server is available:
npm run test:e2e
```

The desktop tests launch an isolated debug app, use its actual WebView2 and native SQLite/file commands, and write results/screenshots under `test-results/`. OS picker responses are deterministic debug-only fixtures; they are not a test of Windows' file-dialog accessibility. The debug test environment is compiled out of release builds. Fixture audio and lyric text are original synthetic test content. If an existing FFmpeg is available, it encodes MP3/FLAC fixtures for tests only; FFmpeg is not a player dependency and is not bundled.

Native verification status and remaining limits are recorded in [docs/implementation-status.md](docs/implementation-status.md). Media clock/decoder tests cannot establish human-perceived audible quality, one-hour continuity, screen-reader conformance or language quality.

## Boundaries

Wikimedia Commons integration provides access to freely licensed audio. Other online catalogues, yt-dlp integration, scraped lyrics, automatic transliteration/translation, model downloads, scrobbling, DSP and public distribution are outside current scope. Provider permissions and software/media licences remain separate. No Nuclear or TuneScript code, branding or media has been copied. The installed Nuclear identity was checked with REA and the pre-existing research was reused; this is an independent implementation.

Each Commons track has its own license and attribution requirements. The application displays license information but users must verify terms on the source page. No guarantee of catalog completeness, availability, or indefinite free access. Streaming URLs may expire; re-selection resolves a fresh URL.

Resolved JavaScript versions and supplied upstream notices are in `package-lock.json`, `THIRD_PARTY_NOTICES.md` and `THIRD_PARTY_LICENSES.txt`. Rust versions are recorded in `src-tauri/Cargo.lock`; an exact Rust inventory is added once the native build resolves. The original-core distribution licence remains the owner's decision from the existing documentation; no public release is performed by these local builds.
