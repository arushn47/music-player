# Account-free collections and listening

These are initial implementations, not a claim of Spotify/YouTube account integration or production-ready internet synchronization.

## Playlist import

Open **Import playlists · Connect devices** and paste a full, public shared playlist URL from YouTube Music/YouTube, Spotify or Apple Music. Preview before saving. No service login, browser extension or cookies are used. Shortened links must first be opened and copied as full playlist URLs. Maximum 500 entries. YouTube imports use the existing Windows engine; Apple Music imports retain original catalog IDs. Spotify exposes public metadata inconsistently and may return only a preview; partial imports are disclosed and unavailable/private pages give recoverable errors. Spotify song titles and artist credits are matched to the existing catalog with explicit review.

CSV/TSV and extended M3U remain under **Import an existing playlist file instead** for people who already have exports. These files are optional, not required. Maximum 1 MB. Android can paste links or exports; the native file picker and YouTube executable are desktop features.

Match tracks explicitly. This sends title/artist queries to the existing catalog providers. Review candidate choices before importing; ambiguous matches and missing artists are not selected automatically. Repeated catalog IDs can be skipped or retained in order. Only selected rows are imported. Existing playlists remain intact. Delete the new playlist to remove its membership; imported metadata remains in the library until removed separately.

Import stores stable catalog/YouTube identities, not downloaded audio or expiring URLs. Playback uses the existing resolution pipeline. A listed entry does not guarantee accessible audio. File paths embedded in M3U are not opened. Private service libraries remain unsupported. Requests use fixed HTTPS service hosts, reject credentials/custom ports and do not follow redirects; page size, entry count and network duration are bounded.

## Autoplay

The dashboard's **Made for your listening** card has been removed. Toggle **∞** on the playback bar to enable **Autoplay**. It defaults off and persists on this device. When the normal queue ends, Lumaire searches real catalog entries related to the last artist credit and queues one fresh song at a time. Explicit queue entries and Repeat take precedence. Songs already in the queue are excluded by identity and normalized title. Resolution happens through the normal player; inaccessible audio produces the normal recoverable playback error. A loading indicator appears while recommendations are fetched. Changing tracks, pausing or disabling Autoplay cancels stale results; network failures leave the queue intact. Turning it off lets the current track finish without generating another. No account, LLM or model download. This initial continuation is artist-based, not a Spotify-grade similarity model, and entries still need accessible audio.

## Floating lyrics (Windows)

Click the picture-in-picture icon beside the lyric button on the playback bar. A separate borderless, always-on-top window follows the existing audio owner and lyric settings. No new playback instance or translation request is created. Hover or focus the window to reveal play/pause, previous/next, background-opacity and close controls. Opacity zero leaves just text; the preference is saved locally. Drag the grip to move; drag any edge/corner to resize. Keyboard users can focus the grip or bottom-right resize control and use arrow keys.

The lock shows only lyric text and enables click-through. Hover over the lyric window to reveal its corner unlock icon; only that small corner accepts clicks, so the lyric area does not block work beneath it. **Ctrl+Alt+L** toggles lock globally while the overlay is open. If another app owns that shortcut, the hover hint says it is unavailable. The main player's **Unlock floating lyrics** remains a fallback. Unlock restores the previous background opacity and controls. Closing the main app closes the overlay and releases the shortcut. Unavailable/instrumental/untimed lyrics have honest empty states; unsynced text is not presented as synchronized. Mobile overlays and exclusive-fullscreen game compatibility are not implemented.

## Nearby devices

On the host, open **Devices & listening together → Share from this device**. On another Lumaire installation on the same private network, paste the link and connect. No cloud service is used. The host must remain open. Pairing links expire after two hours and are revoked by **Disconnect & stop sharing** or process exit. Nothing listens on the network until sharing is explicitly started.

The host uses a small read-only native HTTP endpoint, reachable only from private IPv4/loopback peers and protected by a random 128-bit bearer token. The client accepts only literal private IPv4 URLs, a fixed endpoint and a valid pairing token; redirects, proxies, credentials and arbitrary paths are rejected. Responses and metadata are bounded. Browser-origin requests are rejected. Tokens are kept in memory and never persisted by Lumaire.

Traffic is **not encrypted**. Use a trusted private network; anyone who obtains the pairing link can read the shared playlist and playback metadata. Audio files, file paths, keys, lyrics and listening history are excluded. Limit: 50 playlists / 500 portable tracks per host session. Windows firewall permission, VPN routing and guest-network isolation can prevent connections. The initial address follows the default IPv4 route; if a VPN chooses the wrong adapter, replace it with the host's Wi-Fi IPv4 address. Internet relay, automatic discovery, QR pairing and background/mobile hosting are not implemented.

**Sync playlists now** pulls the current shared snapshot into the receiving device. Refresh first when the host has edited playlists. Repeated snapshots are idempotent. Updates to untouched synced playlists apply; concurrent local edits are kept, with incoming changes placed in a device copy. Host deletions do not delete receiver playlists. Synced copies are not re-broadcast. This first version is explicit, one-way snapshot sync; swap host/guest roles to share originals in the other direction.

**Listen together** follows the host's current portable track, play/pause and position. Each device resolves its own source (or uses its own cached copy). State is sampled every 1.5 seconds, compensates for round-trip delay and corrects drift over two seconds. It is approximate listening alignment, not sample-accurate multi-speaker audio. Local-only recordings cannot be streamed to guests. Source failures are visible; three consecutive connection failures pause the guest and stop following. Stop listening together before taking independent control. Closing the devices dialog keeps an active session running; disconnect explicitly to revoke it.

## Expanded player

PC only: hover or focus the player cover and press its expand button. The cover grows into a focused view with ambient artwork, the existing transport and lyric renderer. There is one audio owner and one lyric document/processor. Escape or Close returns to the previous page and restores keyboard focus. Reduced-motion/transparency preferences are respected. Android retains its existing mini-player without an expand button.

## BitChord research

Inspected the public source, without installing an extension or accessing any account:

- [YouTube authentication](https://github.com/kushagrasinghx/BitChord/blob/main/web/extension/lib/ytAuth.ts): uses the browser's signed-in YouTube cookies and SAPISID authorization.
- [Spotify integration](https://github.com/kushagrasinghx/BitChord/blob/main/web/extension/lib/spotify.ts): reads the browser session cookie and obtains Spotify web-player tokens to fetch library metadata.
- [Extension permissions](https://github.com/kushagrasinghx/BitChord/blob/main/web/extension/wxt.config.ts): declares cookie and service-host permissions.

That explains the personalized dashboard: authentication is inherited from the browser. It is not anonymous access to private playlists. Lumaire does not copy that authentication approach or any of that source code. The supplied deployed page could not be fetched in this environment; this explanation is based on the linked repository source, not a verified build identity for that deployment.
