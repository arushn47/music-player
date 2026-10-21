# Keyless lyric processing research — 21 October 2026

Gemini stays intact. No alternative has demonstrated equal lyric quality. An experimental on-demand keyless Google translation action is now implemented; no automatic provider default has changed.

## Verified implementations

- BitChord's shared `LyricsTranslation.kt` uses Google's unofficial `translate_a/single` endpoint: `dt=t` for translation and `dt=rm` for romanization. Its Latin-script retry uses Google Input Tools to recover native script before translating with an explicit source language. Requests are bounded, batched and cached; malformed line mappings are rejected.
- Unison exposes a keyless `/translate` proxy for Google's `lyrics_translate`, with positional line results and `needsTranslation`. It is another path to Google, not an independent translation model.
- Lumaire already has offline Sanscript-based Indic romanization. Script conversion alone does not establish contextual pronunciation or meaning.
- Google's ML Kit offers on-device translation on Android/iOS, intended for casual/simple translation. It is not a shared Windows solution. IndicTrans2 offers local Indian-language models, including 200M-parameter distilled English/Indic models; installation footprint, runtime and lyric quality remain untested.

## Live exploratory checks

Used short synthetic sentences, not song lyrics, on this machine. No Gemini calls or keys were used.

| Input | Direct Google web translation | Other path |
| --- | --- | --- |
| Tamil: நாளை மழை வந்தாலும் நான் உன்னுடன் நடப்பேன் | Expected meaning: even if it rains tomorrow, I will walk with you | Romanization returned `naalai mazhai vanthaalum naan unnudan nadappaen` |
| Romanized Tamil: naalai mazhai vanthaalum naan unnudan nadappen | Detected Tamil but returned input unchanged | Input Tools restored the intended Tamil sentence; explicit Tamil translation then returned the expected meaning |
| Mixed Hindi/English: मैं वापस आऊँगा, just wait for me | `I'll be back, just wait for me` | Not otherwise compared |
| Romanized Hindi/English: kal phir milenge, just wait for me | `tomorrow we will meet again, just wait for me` | Not otherwise compared |
| English control | Unchanged, detected English | Unison marked English as `needsTranslation=false` |

Five direct requests completed in approximately 0.36–1.78 seconds each. This is a small local observation, not a latency/reliability benchmark.

Unison's three-line request with explicit Tamil source translated the native Tamil correctly and preserved English with `needsTranslation=false`. It left romanized Tamil unchanged with `needsTranslation=false` and supplied no romanization for the native Tamil example. Therefore that flag alone cannot distinguish already-English text from untranslated romanized input.

## Next evaluation gate

### Expanded lightweight trial — 21 October 2026

Ran eight synthetic sentences through direct auto-detected translation, then native-script recovery plus explicit-source translation for the six ASCII romanized examples. Used no Gemini calls, credentials, user lyrics, added dependencies or model downloads. Reproducible exploratory harness and outputs: `test-results/translation-lightweight-probe.mjs` and `test-results/translation-lightweight-results.json` (generated research evidence).

| Language / control | Direct result | Recovery result |
| --- | --- | --- |
| Romanized Tamil | Unchanged despite detecting Tamil | Expected rain/walking meaning |
| Romanized Malayalam | Unchanged despite detecting Malayalam | Expected rain/walking meaning |
| Romanized Telugu | Unchanged despite detecting Telugu | Translated, but changed “even if it rains” to “when it rains” |
| Romanized Hindi | Expected meaning | Also expected meaning |
| Romanized Japanese | Unchanged despite detecting Japanese | Expected translated meaning; recovered kanji still needs native review |
| Romanized Korean | Wrongly detected Luo and produced nonsense | Input Tools supplied no recovery candidate |
| Native Hindi + English | Expected meaning, English clause preserved | Not requested |
| English | Preserved unchanged | Not requested |

Individual translation requests took 146–1609 ms on this run; this excludes script-recovery request latency and does not establish whole-song speed. These are informal semantic observations against intended synthetic meanings, not native-speaker ratings or a Gemini comparison. The supplied source language was known; reliable language selection for romanized real lyrics remains unresolved. Never interpret changed output as proof of successful translation.

The official IndicTrans2 Indic→English distilled 200M repository lists a **913 MB model.safetensors** checkpoint, before tokenizer/runtime files, and gates file access behind acceptance/contact sharing. It is a translation model rather than a chat LLM, but this published distribution is a poor fit for a small default Windows/Android installation. No weights were downloaded or executed; quantized size, speed, memory and quality remain unmeasured. Source: https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M/tree/main.

Conclusion: prioritize a bounded, optional BitChord-style network experiment over bundling IndicTrans2. Keep Gemini available. Further evaluation must cover real lyric ambiguity, names, idioms, mixed languages, line mapping and failures before changing defaults. Unofficial Google endpoints require internet, receive submitted text and can throttle/change; “keyless” does not mean offline or guaranteed availability.

Before proposing a default change, compare native and romanized Tamil, Malayalam, Hindi, Telugu, Japanese and Korean; mixed-script lines; idioms, slang, names and poetic context. Assess meaning and pronunciation separately, preserve line IDs, and include unchanged/partial output and network failures. Use existing Gemini results where available; any new baseline calls must be explicit and bounded. Independent language review is needed for a defensible quality claim. Do not automatically substitute output or spend Gemini quota to conduct this research.

Sources:

- https://github.com/kushagrasinghx/BitChord/blob/main/shared/src/jvmSharedMain/kotlin/com/music/bitchord/data/lyrics/LyricsTranslation.kt
- https://github.com/kushagrasinghx/BitChord/blob/main/docs/LYRICS_TRANSLATION.md
- https://github.com/better-lyrics/unison#translate-lyrics
- https://developers.google.com/ml-kit/language/translation
- https://github.com/AI4Bharat/IndicTrans2

Unofficial endpoints may change or throttle and send processed text to their operators. Their availability and lyric quality are not equivalent to a tested supported replacement.

## lrc.red versus LRCLIB: exploratory coverage check

No provider change was made. Queried both services sequentially for ten title/artist pairs; inspected metadata plus lrc.red TTML timing counts, without storing lyric bodies. Local metadata evidence is `test-results/lyrics-provider-comparison.json` (generated, not release content).

| Requested recording | lrc.red file for first search result |
| --- | --- |
| Golden Sparrow — G.V. Prakash Kumar | 75 timed paragraphs, 325 timed spans |
| Yedi — Dhanush | 44 paragraphs, 120 spans |
| Darshana — Hesham Abdul Wahab | 49 paragraphs, no timed spans |
| Inkem Inkem Inkem Kaavaale — Sid Sriram | 74 paragraphs, no timed spans |
| Tum Hi Ho — Arijit Singh | 36 paragraphs, 206 spans |
| Wavy — Karan Aujla | 59 paragraphs, 437 spans |
| Snowman — Sia | 32 paragraphs, 264 spans |
| Despacito — Luis Fonsi | 81 paragraphs, 534 spans |
| Idol — YOASOBI | 87 paragraphs, 1174 spans |
| Dynamite — BTS | First result was LIVE: do not count as verified studio match |

Additional Korean-language control: Spring Day — BTS returned the expected title/artist and a file with 788 timed spans and 623 Hangul characters. Dynamite itself is English-language, so it is not evidence of Korean-language coverage.

Important limits:

- Search hits and timing counts do not establish correct lyric text, exact recording alignment or word timing accuracy. No audio alignment/listening or native-language content review was performed.
- LRCLIB returned synchronized Wavy and Snowman results. Eight requests timed out at 12 seconds; these are availability observations, NOT eight missing songs. No comparative coverage percentage is justified.
- XML labels are not reliable language detection: Golden Sparrow declared `en` despite 1097 Tamil characters in body text; Wavy declared `id` with Latin-script body. Tum Hi Ho and the sampled Idol body were Latin-script. Native script, romanization and translation must be distinguished, and original-script availability is not guaranteed.
- Searches contain remixes, live recordings and covers. The first result cannot be accepted blindly. The initial exploratory `match.json?title=...` probe used an unverified parameter name and is excluded from the comparison; searches used the site's observed `search.json?q=` contract.
- Lumaire currently uses LRC/plain processing and has no TTML parser or propagated ISRC in its catalog model. Preserving word timing would need a tested TTML import path; simply replacing an API URL is insufficient.

Recommendation: retain LRCLIB and investigate lrc.red as an additional verified source, preferring the better correctly matched result. This sample supports potential richer timing and complementary coverage, not universal superiority. Source: https://lrc.red/ and https://github.com/binimum/am-lyrics#lyrics-matching.

## Approved implementation

### Keyless experiment

Added the approved lightweight translation trial to Lyric room as an explicit action, backed by shared Rust networking for Windows/Android. A source-language choice supports Input Tools recovery for unchanged romanized input. Requests are bounded and deduplicated, keep stable line IDs/timing, expose partial failures and persist results in the existing document. Whole English documents in automatic mode avoid translation; individual English hints are rechecked rather than used to suppress different translated text. Existing offline romanization and Gemini remain available. Google receives the submitted text; no model is installed. Android ARM64 compilation and real isolated desktop rendering/persistence passed, but no phone was connected for an installed APK check. This is not a quality-equivalence claim; see CURRENT-STATUS.md for exact verification.

### Lyric retrieval fallback

Implemented LRCLIB first, lrc.red fallback, after user approval. The `.lrc` download endpoint works with the existing parser, avoiding a TTML dependency. Enhanced inline word timestamps are removed for the line-based reader. Existing synced/instrumental LRCLIB results take precedence; matched lrc.red synchronized results can improve LRCLIB plain text. Existing plain text survives fallback failures. Source attribution and cache identity distinguish LRCLIB numeric IDs from lrc.red ISRCs. Gemini remains untouched.

Native live checks passed six recordings across Indian and international languages. A controlled LRCLIB outage in an isolated real desktop process confirmed actual lrc.red retrieval, clean line display, attribution and persistence. These checks do not establish word-level alignment, native-script availability for every song or universal lyric accuracy. See CURRENT-STATUS.md for exact tests and remaining limits.
