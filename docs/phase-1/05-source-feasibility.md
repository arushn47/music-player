# Music source feasibility

Research date: **17 October 2026 (Asia/Kolkata)**. Planning only; no credentials were created and no catalogue playback, regional availability, CORS, download, or account flow was tested. Related: [risk register](08-licensing-risks.md), [lyrics specification](06-lyrics-system.md).

## Decision and evidence standard

There is no verified source in this research that authorizes an unlimited, ad-free replacement for the entire Spotify/YouTube Music catalogue at ₹0. Metadata access and a playable URL are not audio distribution permission. Existing free clients demonstrate technical feasibility, not clearance.

- **Verified MVP (V):** documented basis sufficient for the specifically bounded use; not blanket legal clearance or runtime certification.
- **Conditional (C):** promising, but an identified permission, access, quality, or browser test remains.
- **Unsuitable (U):** fails the ₹0 constraint or the proposed unrestricted playback promise.
- **Confidence:** High = explicit primary documentation; Medium = incomplete terms or implementation validation outstanding; Low = inference without a verified contract.

The ₹0 assumption includes an existing computer, internet connection and storage. Free software can run locally without a service subscription. A hosted free service is a third party's finite allocation with mutable terms; neither is a guarantee of indefinite ₹0 operation.

## Feasibility matrix

| Source / purpose | Cost and access | Playback, offline and rights boundary | Reliability / region | Classification |
|---|---|---|---|---|
| User-selected local files | No API, account or hosting needed | Play lawfully held files locally; keep them private. Do not upload, redistribute or derive permission merely from possession | Codec support, permissions and missing/moved files need tests; no online catalogue | **V, High** for private local playback |
| Creator-authorized / CC0 fixtures | ₹0 where permission actually covers use; maintain license/provenance record | Recording, composition, lyrics and artwork each need suitable rights; CC0 does not guarantee that an uploader owned those rights | Small curated collection; link rot and territorial rights remain possible | **V, High** for individually cleared fixtures, not an arbitrary catalogue |
| Jamendo official API | Documented noncommercial access; production credential distribution needs clarification | Stream field documented; source-specific rights and attribution apply | Phase 1.5 metadata probe failed before HTTP status; public-client packaging unresolved | **C, Medium** for distributable integration; see [validation](12-phase-1.5-validation.md) |
| Audius official API | Documented free tier: 10 requests/second, 500,000/month; API key creation required for that plan | OML supports Music Players, but alternative licenses, API opt-outs and gated content matter. No blanket download permission inferred | Source/track restrictions and nodes can change; no catalogue or uptime guarantee | **C, Medium**: actual API terms fetch failed; review and integration tests required |
| YouTube official iframe | Embedding does not require user authorization; Data API search requires a project/quota | Visible official video playback; respect ads and player controls. No audio extraction, hidden/background player, or unauthorized offline copying | Embedding disabled, regional/age limits, deletions and browser autoplay restrictions | **C, High** for a separate compliant video mode; **U** for unrestricted audio-only promise |
| YouTube/YouTube Music unofficial extraction | Tools may be free software; resolver/server maintenance is not free capacity | No authorization established for separation of audio, ad removal, downloads or circumventing player restrictions | Client changes, expiring URLs, bot checks, region/account requirements; native tools not directly executable by websites | **U, High** as the compliant MVP foundation |
| Spotify API / playback | Development owner must have Premium; up to five authenticated users; broader public access requires approval | Metadata/library data is not audio. Spotify-authorized playback is subject to its own conditions; matching elsewhere does not transfer rights | Limited development access and changing quotas/endpoints | **U, High** for strict ₹0 dependency or free Spotify catalogue |
| SoundCloud API | New app registration requires paid Artist Pro | API access does not override creator availability or permissions | Access/territory restrictions; no full catalogue guarantee | **U, High** for new ₹0 custom API integration |
| SoundCloud official widget | Official iframe control API; distinct from paid custom API registration | API terms restrict alternative aggregation/mixed-service playback absent explicit licensing; widget-specific applicability must be confirmed | Individual embeds may disappear or be restricted; no new playback tested | **C, Medium** for Lumaire; defer default inclusion pending terms review |
| MusicBrainz | No API key; hosted API free for noncommercial use | Metadata only. Core data CC0; supplementary data CC BY-NC-SA 3.0; cover artwork is separate | Meaningful user agent; at most one call/second; handle no match and block/rate responses | **V, High** for optional noncommercial metadata lookup |
| ListenBrainz | Public API; user token for submissions | History/scrobbling/recommendation integration, not a licensed music delivery service; opt in before sending history | At most one call/second plus returned rate headers; account/network dependency | **C, High** for a later optional adapter, privacy/runtime gate |
| Last.fm | Noncommercial data license without charge; registered account/API key | Attribution/links; no music streaming entitlement. Contact before commercial or research/academic use | Dynamic rate restrictions and data caps; no fixed unlimited allowance | **C, High** for later discovery/scrobbling, not mandatory MVP |
| LRCLIB | Official documentation describes public no-key, CORS-enabled access; not measured here | Documentation retrieved in this source review; no live API/playback request tested. Blanket rightsholder authorization for displaying/translating every returned lyric not established | Documentation specifies 429/Retry-After and app identification; matching and timing incomplete | **C, Medium**; disable automatic catalogue lyrics until rights policy decided |
| Authorized local TXT/LRC lyrics | No hosted service | User-selected/authorized text only; no shared lyric corpus | Parsing and exact-recording timing tests needed | **V, High** for bounded local handling |
| Unofficial JioSaavn/Deezer/NetEase endpoints, unknown addons | A zero-price URL does not establish a free authorized integration | No public permission verified here; reject protected/private/token-extracted sources as default adapters | Reverse-engineered endpoints and unknown operators create failures and trust risks | **U, Medium** for MVP; future written permission could change classification |

## Important provider details

**Jamendo:** terms last modified 17 September 2013 remain published. Commercial advantage/advertising changes eligibility; terms reserve future pricing and restrictions. Official authentication docs say contact Jamendo when exceeding or expecting **500,000 hits**, without specifying a monthly period. Do not repeat an unverified “35,000/month” allowance. Offline is excluded even when a response exposes download-related fields. [API terms](https://devportal.jamendo.com/api_terms_of_use), [authentication/usage guidance](https://developer.jamendo.com/v3.0/authentication).

**Audius:** SDK documentation specifies public frontend API keys versus backend-only bearer tokens; OAuth PKCE is available. OML dated 2 July 2025 grants Music Player rights with limitations and uploader representations. The 8 July 2025 official explanation confirms artist API choices carry over. The current API terms URL linked from the foundation footer returned HTTP 500 in this research; the guessed `audius.org/api-terms-of-use` was inaccessible. Therefore do not call Audius fully cleared yet. [SDK/quotas](https://docs.audius.co/sdk/), [OML](https://audius.org/open-music-license.pdf), [official explanation](https://blog.audius.co/posts/audius-terms-of-service-update), [actual API terms](https://audius.co/legal/api-terms).

**Spotify:** February 2026's one-client-ID restriction is superseded by the **23 July 2026 update: 25 client IDs per developer, shared quota**. Premium-owner and five-user rules still appear in current quota docs. Do not use stale February limits. [Current quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [July update](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates).

**YouTube:** current quota calculator (updated 15 October 2026) specifies separate default buckets of 100 search calls/day, 100 upload calls/day and 10,000 units/day for other endpoints. Do not confuse this with iframe playback limits. Known video URLs can avoid a search API dependency, not player policies. [Quota calculator](https://developers.google.com/youtube/data/determine_quota_cost), [developer policies](https://developers.google.com/youtube/terms/developer-policies).

**LRCLIB:** the official [API documentation](https://lrclib.net/docs) was readable in this source review and documents anonymous no-key access, `Access-Control-Allow-Origin: *`, identification headers and honoring `Retry-After`. This is a documentation claim, not a tested response header or availability result. A separate lyrics research attempt returned no extractable text; both retrieval outcomes can occur. No numeric request allowance or content clearance is inferred.

## Browser and desktop boundary

**Current desktop update:** [04](04-architecture.md) and [14](14-desktop-transition-audit.md) supersede website-first delivery; [13](13-lumaire-web-provider-architecture.md) remains historical research. Nuclear's Rust media relay and yt-dlp host explain its native path. Lumaire proposes an optional controlled resolver, but source permission, binary distribution and playback remain separate unverified gates. The U classification for an unrestricted YouTube foundation is unchanged; it does not prohibit a later reviewed test against individually authorized automated-access fixtures. Current SoundCloud aggregation concerns remain.

Desktop native networking and tools do not imply browser compatibility. For every online adapter, implementation must later verify HTTPS, CORS/redirect handling, seek/range support, expiry, codec/container, cancellation, rate responses, regional errors and source identity. A proxy can add hosting/egress costs and does not create content rights. Do not plan a hosted audio proxy, transcode service, shared secret in frontend code, or pooled credentials to escape quotas. A scoped local native media transport is conditional on desktop tests and permission; it is not an open proxy or a rights workaround.

Background playback and offline capability must be per-source capabilities, never universal switches. A website/PWA also cannot guarantee background survival on every mobile OS. Offline MVP means local media plus local library state; it does not mean saving arbitrary streaming tracks.

## Remaining primary references

All checked 17 October 2026; publication/effective date not asserted unless stated above.

- [CC0 deed and limits](https://creativecommons.org/publicdomain/zero/1.0/).
- [SoundCloud registration](https://developers.soundcloud.com/docs/api/register-app), [official widget](https://developers.soundcloud.com/docs/api/html5-widget).
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API), [data licenses](https://musicbrainz.org/doc/About/Data_License).
- [ListenBrainz API/authentication/rate limits](https://listenbrainz.readthedocs.io/en/latest/users/api/index.html), [submission rules](https://listenbrainz.readthedocs.io/en/latest/users/api/core.html).
- [Last.fm API terms](https://www.last.fm/api/tos), [LRCLIB API documentation](https://lrclib.net/docs).

## Release gates

**Phase 1.5 correction:** Jamendo's former V status was too strong for this distributable-client design. Clause 2's credential language requires interpretation before public packaging. The documented testing ID is not a production credential. No playback was verified; [J1](12-phase-1.5-validation.md) records the failed metadata attempt and smallest next experiment. Local playback remains independent. Audius's actual API-contract page was retried but remained inaccessible. Earlier research statements above describe documentation, not new runtime results.

1. MVP must remain usable with every external provider disabled.
2. Store provider ID, canonical URL, permission/provenance link, attribution and supported capabilities separately from normalized song metadata.
3. External adapters must fail closed on permission/authentication errors and pause on quota exhaustion; no silent alternative source substitution.
4. Recheck live terms before release and monetization. No account creation or source approval is claimed by this report.
