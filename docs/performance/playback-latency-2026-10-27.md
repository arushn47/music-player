# Playback latency investigation — 27 October 2026

**Status: implementation, real Windows/Android measurements and Android correctness checks complete. Version remains 1.0.6; this report precedes 1.0.7 preparation.**

Android repeat playback improved by approximately **81%**, from a 5.517 s median to 1.061 s. Cold and ordinary queue medians did not improve materially. All 60 final Android selections succeeded, but one queue selection took 37.381 s. These changes remove duplicate extraction and resolver conflicts; they do not establish fast first-play performance.

The ordinary-track Windows benchmark does not establish a speedup. Its cold median improved modestly, but cold p95 worsened, and a later run of the unchanged baseline became faster than the changed build. Provider/network variability therefore prevents attributing those differences to the candidate change.

## Real Windows measurements

Windows, AMD Ryzen 5 5600H, real Tauri/WebView2, pinned yt-dlp 2026.08.19 and QuickJS-NG 0.17.0. Debug native builds with embedded production frontend assets; the executable hash is recorded in each raw report. No emulation or mocked audio/network.

Each main run contains 20 process-cold, 20 repeat, and 20 queue selections, all successful. Three fixed catalogue entries rotate through the run: Rick Astley — Never Gonna Give You Up; Luis Fonsi & Daddy Yankee — Despacito; Anirudh Ravichander, Vijay & Asal Kolaar — Naa Ready. Exact catalogue metadata is in [latency-catalog.json](latency-catalog.json).

| Selection | Baseline median | Baseline p95 | Candidate change median | Candidate change p95 |
| --- | ---: | ---: | ---: | ---: |
| Process-cold catalogue | 8.928 s | 9.837 s | 8.343 s | 10.694 s |
| Same recording, selected again | 0.206 s | 0.605 s | 0.208 s | 0.229 s |
| Next different catalogue song | 8.127 s | 9.202 s | 7.659 s | 9.240 s |

An additional **unchanged-baseline control**, six samples per scenario after the changed-build run, measured cold median **7.341 s**, p95 **8.176 s**. This is a confounding change in the environment/provider response, not evidence of a code improvement. The small control's empirical p95 is its maximum observation.

### Stages

Seconds, median / p95. Search is the combined elapsed window for each search phase, including concurrent requests. Verification includes matching and stream extraction; it cannot be interpreted as CPU-only matching time. Per-stage medians do not sum to the total median.

| Selection / stage | Baseline | Candidate change |
| --- | ---: | ---: |
| Cold: search | 4.113 / 4.428 | 3.272 / 5.117 |
| Cold: verify and extract | 3.962 / 4.693 | 3.680 / 4.685 |
| Cold: attach through loaded metadata | 0.399 / 0.701 | 0.434 / 0.745 |
| Cold: loaded metadata through playing | 0.391 / 0.408 | 0.406 / 0.440 |
| Repeat: search / extraction | Reused existing stream | Reused existing stream |
| Repeat: attach through loaded metadata | 0.016 / 0.019 | 0.016 / 0.020 |
| Repeat: loaded metadata through playing | 0.181 / 0.583 | 0.185 / 0.200 |
| Queue: search | 4.023 / 4.372 | 3.544 / 4.586 |
| Queue: verify and extract | 3.839 / 4.687 | 3.488 / 4.228 |
| Queue: attach through loaded metadata | 0.205 / 0.246 | 0.238 / 0.469 |
| Queue: loaded metadata through playing | 0.023 / 0.026 | 0.023 / 0.027 |

Raw evidence: [baseline, 60 selections](latency-windows-baseline.json), [candidate change, 60 selections](latency-windows-candidate-fix.json), [baseline control, 18 selections](latency-windows-baseline-control.json). Recompute standard medians and nearest-rank p95 from the trials using `node tests/playback-latency-summary.mjs <report files>`. The earliest raw baseline's convenience summary uses nearest-rank p50; this report uses the average of the two middle observations for even sample sizes.

## Validated changes

- **Android duplicate extraction:** the native resolver reuses successful playback resolutions, including their required headers, for at most two minutes, shortened to thirty seconds before a URL's declared expiry. Expired entries are evicted lazily. This bridges frontend verification and Rust/native playback without a second extraction. Downloads use a separate request identity and bypass this playback cache. Concurrent equivalent requests coalesce.
- **Android request conflicts:** independent requests queue rather than implicitly cancelling one another. Explicit selection changes, timeout, disconnect and Activity destruction retain cancellation and worker teardown. Late replies are ignored. A player error invalidates the cache so retry can extract a fresh URL.
- **Bounds:** one active transport, at most eight queued jobs, at most sixteen callbacks per equivalent job, sixteen cached responses, at most 32,768 characters per cached response (approximately 1 MiB total cached text, excluding object overhead). Failures and larger responses are not cached. Nothing is persisted.
- **Trust boundaries:** cached responses must pass audio-only codec, HTTPS Googlevideo origin and scoped-header checks. Existing Python range probing, Rust codec checks, and Media3 header validation remain in place.
- **Candidate work:** complete credible matches are verified before extracting missing metadata for alternatives. Existing closest-duration ranking among complete candidates, fallback searches, title/artist/version/duration rules, and the three-check missing-artist limit remain. Every extracted candidate is checked again. Explicit cancellation now exits rather than triggering more fallback requests; ordinary provider failures still recover.

The representative corpus did not encounter missing-metadata candidates. Regression tests demonstrate the avoided extra extraction for that branch, but a hardware latency benefit for that case is **not established**. Do not describe this change as a general Windows speed improvement.

No new next-song preloading, worker keep-alive, runtime replacement, buffer/bitrate tuning, timeout reduction, dependency, account or service was added. Existing desktop near-end source warmup is unchanged. These queue trials deliberately select the next song early, before that existing warmup.

## Method and limits

`tests/playback-latency.mjs` seeds a separate empty profile with recording disabled, starts a fresh process for each cold cycle, then makes actual queue UI clicks. Repeat selects a second queue entry for the same song, rather than resuming paused audio. Queue selects a different song without restarting. Trials do not wait for near-end preloading. OS, DNS, extractor filesystem and CDN caches are not cleared.

The Windows endpoint is the real audio element's `playing` event. The Android runner waits for native playing state and a media clock above 50 ms, polling at 40 ms; those Android measurements include observation delay. Android native resolution, preparation and buffering are measured together because no separate loaded-metadata marker is available. Neither method measures acoustic speaker latency. Tests use local bounded diagnostics, not signed URLs or credentials. The user's library, queue and history are not used.

Sequential before/after runs, three popular songs, one Windows computer and one Android phone do not establish broad or statistically significant gains. p95 from twenty observations is coarse. All failures remain visible alongside successful-trial percentiles.

## Real Android measurements

Motorola Edge 50 Pro, Android API 36, actual native Media3/service playback. Three sequential cohorts each contain 20 cold/repeat/queue cycles. Seconds below are **median / p95 of successful starts**, with failures reported separately.

| Selection | Baseline | Resolver only | Combined final |
| --- | ---: | ---: | ---: |
| Process-cold catalogue | 14.470 / 109.459 | 13.622 / 14.786 | 14.653 / 16.183 |
| Same recording, selected again | 5.517 / 6.386 | 1.084 / 1.321 | 1.061 / 1.151 |
| Next different catalogue song | 14.822 / 21.782 | 13.492 / 14.456 | 14.980 / 16.686 |

Baseline: cold 19/20 successful (one 120-second timeout), repeat 19/20 (one HTTP 403), queue 19/19 actual attempts with one dependent cycle blocked after the preceding failure auto-advanced the queue. A successful baseline cold selection took 109.459 s following a resolver watchdog/fallback. Resolver-only: cold and repeat 20/20 each, queue 19/20 (one HTTP 403). Final: **60/60 successful**, plus a separate successful rapid catalogue replacement check. Final queue maximum was **37.381 s**, beyond the reported nearest-rank p95. The observed final success rate does not establish that upstream 403 failures are eliminated.

### Android stages

Seconds, median / p95; stage medians do not sum to total medians.

| Selection / stage | Baseline | Resolver only | Combined final |
| --- | ---: | ---: | ---: |
| Cold: search | 3.924 / 8.452 | 7.685 / 8.132 | 8.525 / 10.328 |
| Cold: verify and extract | 4.667 / 94.933 | 4.831 / 5.881 | 4.964 / 5.641 |
| Cold: native resolve, prepare and buffer | 5.807 / 13.982 | 1.062 / 1.125 | 1.061 / 1.118 |
| Repeat: native resolve, prepare and buffer | 5.517 / 6.386 | 1.084 / 1.321 | 1.061 / 1.151 |
| Queue: search | 4.042 / 8.242 | 7.781 / 8.473 | 8.721 / 10.752 |
| Queue: verify and extract | 4.842 / 12.847 | 4.655 / 5.739 | 5.144 / 5.845 |
| Queue: native resolve, prepare and buffer | 5.644 / 6.111 | 1.044 / 1.694 | 1.062 / 1.182 |

The native portion drops from approximately 5.8 s to 1.06 s because verification and playback share a resolution. Independent searches now complete through the one-worker FIFO rather than cancelling one another; the longer search window offsets the saved duplicate extraction on first play. Complete-candidate ranking and recording verification are retained. The combined run does not demonstrate an additional ordinary-track matching speedup over the resolver-only run. Network drift also limits comparisons across sequential cohorts.

Raw evidence: [baseline](latency-android-baseline.json), [resolver only](latency-android-resolver-fix.json), [combined final](latency-android-combined-fix.json). Setup pilots are excluded; baseline resume notes and genuine failures are retained. The runner asserts the verified source matches the native playing ID, so queue skips cannot count as successful selections.

Baseline, resolver-only and combined APKs remain in `.test-data/latency/`, with hashes in [android-benchmark-builds.json](android-benchmark-builds.json). To reproduce, install the corresponding APK and run `node tests/playback-latency.mjs --platform android --label <baseline|resolver-fix|combined-fix> --samples 20`. These APKs use the separate `app.lumaire.player.latency` ID. Fixture setup operates only on its stopped, isolated SQLite profile and verifies file integrity and transfer hashes. The benchmark app was removed after validation; the regular installed Lumaire and its data were untouched. Temporary stay-awake was returned to normal timeout (`stay_on_while_plugged_in=0`).

### Live correctness and recovery

`node tests/android-playback-correctness.mjs` passed **9/9 checks** on the final APK: local audio clock advancement; verified audio-only source reuse without another transport dispatch; pause/seek/resume; concurrent independent searches while incumbent audio advances; explicit cancellation of an observed active worker; replacement of a pending online load with local playback and no stale takeover; uncached unavailable-source retries followed by valid recovery; eight seconds of screen-off playback with a foreground service; and actual two-minute cache expiry followed by a fresh extraction. [Full evidence](android-playback-correctness.json).

The final catalogue harness separately interrupted a real active resolver with a different catalogue selection: the newer verified recording played, the cancelled selection launched no fallback searches, and no stale result replaced it. Signed-URL expiry parsing and early-expiry bounds are covered by JVM tests; the device test waited out the actual cache TTL, not a multi-hour signed-URL expiry. Arbitrary media-server failures were not injected.

No next-song preload was added: these measurements do not establish a memory/data/battery budget or justify speculative background downloads. Search remains the primary first-play target for a separately measured follow-up.

## Verification

- Frontend production build and Windows debug build pass; real Windows benchmark apps start and play without panics.
- The final Windows binary also passed a separate three-selection smoke check after cancellation-guard refinement: [final smoke evidence](latency-windows-final-smoke.json). These three samples are excluded from the comparison statistics.
- Full Vitest suite: **85 files, 540 tests pass**, including new verification-order and cancellation/fallback regressions.
- Android debug build passes. **11 JVM tests pass**, including six new queue/cache cases covering FIFO/coalescing, stale replies, cancellation, signed-URL expiry, invalidation, failure retry, limits and oversized responses.
- Benchmark median/p95 and overlapping-search stage self-checks pass; real Android checks pass as detailed above.
- No version bump, installer or release preparation. **The requested device evidence is now available for review before preparing 1.0.7.** First-play latency and occasional provider failures remain limitations.
