# Lumaire v1.0.7

Less waiting when you replay a song, more consistent listening history, and a more comfortable Lumaire on your phone. This update is available for Windows and Android.

## Playback that gets along better

- Android no longer fetches the same stream twice just to start playback. In our Motorola Edge 50 Pro tests, selecting the same song again went from about 5.5 seconds to 1.1 seconds. First-time song searches can still take a while.
- Searches no longer cancel each other unexpectedly. Switching songs still cancels the old request, so a late result cannot take over your player.
- Better candidate checking avoids unnecessary lookups while keeping the checks for the right artist, recording and version.
- Streaming and downloads enforce audio-only formats. Older affected downloads can be repaired without re-encoding their audio.

## Your music across devices

- Listening history uses the metadata saved with each play, fixing artist and album counts that could differ between your phone and PC.
- Favorites can sync alongside playlists and listening history on the same Wi-Fi. A separate Favorites switch lets you choose what to share; both devices need this update for favorite syncing.
- Autoplay keeps the language of the song you started with. When genre or mood information is missing, it uses same-language recommendations rather than guessing.

## A little easier every day

- Refined Android navigation, player controls and layouts. Home-screen widgets now use colors from the cover art, cleaner controls and balanced spacing. The lyrics widget keeps the song title at the top and fills the available space with upcoming lines.
- Android Back closes the current panel or returns through your screens. Double-tap Discover to jump into search.
- Clearer lyric settings and word-timed lyrics when available, plus smaller fixes to playlist saving, notifications and library controls.

## Installing the update

**Windows:** use Settings → About → Check for updates, or run the Windows installer below. Keep your existing installation to retain your library and settings.

**Android:** download the ARM64 APK from the Android release and install it over an existing public Lumaire build. Do not uninstall first; your library and settings stay in place. Development-signed builds use a different certificate and cannot be upgraded with the public APK. Android updates are installed manually.

Playback was checked on Windows and a Motorola Edge 50 Pro. Online audio still depends on its provider: a new song may take time to start, and temporary availability errors can still happen. Background Autoplay across the end of a song remains a known Android limitation. Optional AI lyric features require your own configured key.
