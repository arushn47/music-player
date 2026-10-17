# Lyrics system specification

Status: proposed architecture; research checked 17 October 2026. No dependencies, models, application code, or executable tests were installed or run for this specification. Provider availability and language quality have not been benchmarked.

## Recommendation and scope

Make original lyrics, romanisation, and translation parallel views over one immutable timed document. Phase 1.5 revises the original mandatory-conversion proposal: P0 covers user-imported LRC/plain text and authorized supplied translation/romanisation variants. First reading pair is Tamil original / supplied Latin / supplied English meaning. Deterministic Tamil→ISO 15919 conversion is conditional P1 after exact artifact and reviewer validation. Automatic translation is also conditional P1, requiring model distribution, quality, memory, latency and device evidence. No paid API or public demo endpoint is a core dependency.

TuneScript 1.3.2 was located and source-reviewed in Phase 1.5. Its current processing is Gemini cloud inference, with browser-specific transport/storage and no established reuse licence. Local script maps are for comparison, not validated pronunciation. Reserve an optional adapter boundary; the required reader works without TuneScript. [Detailed findings and source hashes](12-phase-1.5-validation.md).

Related planning: see [architecture](04-architecture.md), [music sources](05-source-feasibility.md), [UX](07-ui-ux.md), and [risks](08-licensing-risks.md). See the [package index](README.md) for the complete plan.

## Rights and source selection

Music playback permission does not automatically permit lyric display, translation, caching, export, or redistribution. Software/model licenses do not license input lyrics. User import is a workflow, not proof that every imported lyric may be published. No default public sharing or lyric upload service is proposed.

| Input | MVP treatment | Unresolved boundary |
|---|---|---|
| User-authored/authorized LRC or plain text | Suitable local input; retain provenance | User must have appropriate rights for any subsequent sharing |
| Creator-provided lyrics with explicit permission | Suitable for permissions actually granted | Record display, adaptation, offline, export, and attribution separately |
| LRCLIB | Optional candidate, not a cleared commercial lyric catalogue | Permission for hosted lyrics, derivative translations, persistent caching and redistribution remains unverified |
| Lyrics scraped from other services | Excluded from baseline | Accessible text does not establish authorization |

An initial fetch of the official [LRCLIB documentation](https://lrclib.net/docs) returned no extractable text; the subsequent source review retrieved readable guidance describing keyless access and CORS support. See the [source matrix](05-source-feasibility.md) for the reconciled service findings. These are documentation claims: live API behavior and response headers were not tested. Its [server repository](https://github.com/tranxuanthang/lrclib) supplies implementation evidence, but its software license does not clear lyric copyright. Display, translation, caching and redistribution rights remain unresolved; do not invent a rate-limit allowance. No lyric downloads were tested in this phase.

## Implementation-independent contracts

These are proposed data contracts, not an asserted existing API or application implementation.

| Boundary | Required information/behavior |
|---|---|
| Lyric source | Source ID, source record ID, retrieval time, attribution, canonical URL, original bytes hash, rights status and permitted operations; returns timed, plain, instrumental, missing or error |
| Timed document | Stable document/revision and line IDs, ordered original text, optional language/script per segment, start/end milliseconds, global offset, optional token spans/times, parser warnings |
| Translation adapter | Explicit supported language pairs; receives identified text units and optional context; returns text mapped to the same unit IDs, model/version, status and warnings |
| Romanisation adapter | Explicit language/script/scheme capabilities; receives original segments; returns text plus engine/rules version and optional source-span mapping |
| Playback clock | Current media time, seek, playback rate and discontinuity notifications; lyrics never become the playback clock |
| Cache policy | Whether storage is allowed, scope, expiry, provenance, deletion and export rights; unknown permission is not unrestricted permission |

An adapter must distinguish unsupported language, uninstalled model, missing lyrics, network failure, denied operation and invalid content. A translation engine's self-reported confidence must not be invented if the engine supplies none. All external text is plain untrusted text; do not interpret lyric markup as HTML or instructions.

## LRC parsing and synchronization proposal

1. Preserve original file bytes separately from normalized display text. Support UTF-8 with optional BOM initially; ambiguous legacy encodings need explicit user selection rather than silent corruption.
2. Define supported line timestamp forms, centisecond/millisecond precision, repeated timestamps, metadata tags and offset semantics in parser fixtures. LRC variants are inconsistent; these are product choices to test, not a claim of one universal standard.
3. Expand repeated timestamps into distinct timed occurrences with stable IDs. Keep equal-time ordering stable. Warn about malformed/negative/out-of-range times. Do not silently discard the whole document for one bad line.
4. Keep offsets separate from source timestamps. Product convention: effective cue = source timestamp + file offset + user offset; positive means lyrics appear later. Display-time comparison is media time minus both offsets. Example: 10,000 + 200 − 50 = 10,150 ms. Last valid file-offset tag wins with a multiple-tag warning. Never apply an offset twice; this is our explicit parser convention, not a universal LRC-standard claim.
5. Determine the active interval from media time on every seek/rate/discontinuity update. Infer a line end from the next later timestamp where needed; final-line behavior uses known duration or an explicit unknown end.
6. Plain lyrics remain readable without fake synchronization. Instrumental and missing lyrics are different states.
7. Enhanced word timing is an optional later parser capability. Never manufacture word timing by dividing line duration equally or applying source word times directly to translated words.

Translations and romanisations inherit the source line interval, not a newly generated timestamp. Context-aware translation can use adjacent lines, but its output must map back to original IDs. If a model merges/splits lines and alignment is uncertain, show a labeled stanza translation without karaoke highlighting. Source edits invalidate affected generated variants; generated variants never overwrite the original.

## Zero-cost engine feasibility

| Candidate | Verified fact | Decision and open work |
|---|---|---|
| Sanscript.js | MIT; JavaScript transliteration package; focuses on Sanskrit, with partial support for other languages | Good browser candidate for explicit script schemes. Its maps are a separate dependency; pin and audit both packages. No installation or output-quality test yet. [Project](https://github.com/indic-transliteration/sanscript.js), [maps license](https://github.com/indic-transliteration/common_maps/blob/master/LICENSE) |
| Python indic-transliteration | MIT Python package | Desktop/local service candidate; browser does not execute Python packages natively. Not needed if JS adapter suffices. [Project](https://github.com/indic-transliteration/indic_transliteration_py) |
| ICU | Script transforms; Unicode-3.0 license plus third-party notices in current tree | Alternative broader transform engine. Native ICU is not automatically exposed as a browser transliteration API; binding/data size need investigation. [Transform documentation](https://unicode-org.github.io/icu/userguide/transforms/general/), [license](https://github.com/unicode-org/icu/blob/main/LICENSE) |
| Argos Translate | Offline Python library, MIT/CC0 dual licensed; installable language packages; optional language pivoting | Desktop experiment. Verify each exact model's license and language direction independently; a runtime license is insufficient. Pivot translations may reduce quality. [Project](https://github.com/argosopentech/argos-translate) |
| CTranslate2 | MIT inference runtime with CPU/GPU and quantization support | Native/local runtime candidate, not a translation model or a drop-in browser solution. Conversion and exact architecture support must be checked. [Project](https://github.com/OpenNMT/CTranslate2), [conversion documentation](https://opennmt.net/CTranslate2/conversion.html) |
| IndicTrans2 | Project documents 22 scheduled Indian languages and MIT model checkpoints | Strong Indic translation experiment. Select pair/direction, tokenizer, preprocessing and artifact revision together. No verified browser export or hardware result. [Project and artifact licenses](https://github.com/AI4Bharat/IndicTrans2) |
| ONNX Runtime Web | MIT runtime; documented WASM and WebGPU execution paths | Possible future browser inference. Exact model conversion, operator support, tokenizer and performance still need a proof of concept. Runtime availability does not prove model compatibility. [License](https://github.com/microsoft/onnxruntime/blob/main/LICENSE), [web documentation](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) |

Important current detail: the [official IndicTrans2 Indic-to-English distilled 200M card](https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M) requires accepting access conditions/contact sharing and recommends a newer Indic-Translate model. Its parameter count is not its download size or runtime RAM requirement. Access conditions were not accepted; successor licensing was not reviewed. Do not auto-download or run remote model code on the strength of the MIT badge.

All model downloads must be opt-in, show verified bytes/checksum, language direction, license, source and removable disk footprint. Exact package sizes, peak memory, speed, CPU/GPU support and battery impact are **unknown until measured on chosen artifacts/hardware**. Downloads and user electricity/data consume resources even without API charges. A permanently hosted inference server is outside the baseline ₹0 architecture. Public demo endpoints have no assumed free quota or availability promise.

## Language support matrix: proposed validation scope

Script conversion preserves spelling representations; it does not translate meaning or reliably reproduce sung pronunciation. A script identifier is not enough to select a language pronunciation model. ICU explicitly distinguishes transliteration from translation; Sanscript documents partial non-Sanskrit support and lossy mappings. The following is a test plan, not a claim of shipped language support.

| Language/script | Script-to-Latin candidate | Pronunciation limitations to label/test | Translation candidate |
|---|---|---|---|
| Tamil | Sanscript Tamil scheme | Context-dependent consonants, colloquial/sung forms; scholarly output differs from familiar Tanglish | IndicTrans2 Tamil pair; pending benchmark |
| Hindi/Devanagari | Sanscript or ICU | Schwa deletion and names require language-aware handling; Devanagari is also used by other languages | Argos exact pair or IndicTrans2; verify artifacts |
| Telugu, Kannada, Malayalam | Matching Sanscript schemes | Orthography, dialect, compounds and singing can diverge from literal mapping | IndicTrans2 exact pair; pending benchmark |
| Bengali/Assamese | Separate supported source schemes | Shared script family does not imply identical pronunciation; lossy conversions need warnings | IndicTrans2 exact pair; pending benchmark |
| Punjabi/Gurmukhi, Gujarati, Marathi | Matching script plus explicit language | Tone, schwa, language distinctions and loan words need native-reader review | IndicTrans2 exact pair; pending benchmark |
| Urdu/Perso-Arabic | Defer pronunciation promise | Missing short vowels, mixed-script spans and right-to-left layout require specialist evaluation | IndicTrans2 exact pair; pending benchmark |
| English/Latin | Preserve original; no redundant romanisation | English spelling is not a phonetic transcription | Specific installed target-language pair only |
| Other/code-switched | Preserve original by default | Do not guess one language from whole-document script | Offer explicit segment language or unsupported state |

Support should be published per operation and exact pair/scheme, with native-speaker review. A reversible academic scheme and an easy-to-read pronunciation mode should be separate options. No claim of universal phonetic romanisation is proposed.

## Combined reading experience

Default each timed group to original first, optional romanisation second, optional translation third. Label generated text and selected scheme/languages. Allow any view to be hidden; maintain hierarchy without making secondary text unreadable. Preserve the active group while toggling variants. In narrow layouts use stacked groups rather than three horizontal columns.

Provide text size/line spacing, reduced motion, high contrast, keyboard seek, offset adjustment with reset, follow/resume controls, per-span right-to-left direction, and accessible source/variant labels. Auto-scroll pauses while the reader browses. Screen readers should not announce every playback tick. Line seeking/looping is enabled only when the playback source supports it. Translation failure must leave original lyrics, queue and playback usable.

## Local caching, privacy and versioning

Use a cache key including original content hash/revision, source identity, source/target language, segment language overrides, scheme, engine/model/tokenizer/rules versions and preprocessing revision. Track offsets independently so adjusting timing does not require retranslating text. Keep manual corrections as local overlays with provenance; retain a reset path.

Persist only where authorized. Unknown online-provider caching rights should produce a disabled persistent-cache capability pending review, not an indefinite copy. User-authorized local material can use bounded local storage and explicit export controls. No public corpus of imported or generated lyrics is proposed. Eviction/expiry/deletion must remove derived entries too; model removal and cache clearing are separate controls. No lyric text or file paths in analytics or normal logs. External processing, if ever added, requires explicit disclosure and opt-in before uploading text.

## Proposed acceptance tests — not executed

- Parser fixtures use self-authored or explicitly licensed text: BOM, repeated/equal timestamps, offsets, invalid tags, combining marks, emoji, long lines, CRLF, and mixed scripts. Invalid data yields actionable warnings without executing markup.
- Playback fixtures verify seeking backward/forward, rate changes, pausing, track switching and offset reset; no cumulative drift from a lyric-side interval timer.
- Variant fixtures prove line IDs/times unchanged, source edits invalidate only relevant variants, merged translation output is labeled, and unsupported pairs do not silently substitute a language.
- Native-reader review covers each advertised romanisation mode; code-switching and lyric slang are included. Translation accuracy must be assessed on actual authorized lyric samples, not inferred from general-text benchmarks.
- Local processing is verified offline after explicit model install; record latency, peak memory, artifact sizes and playback responsiveness on selected target devices before defining a performance claim.
- Rights/privacy fixtures verify caching/export capability enforcement, clear/delete behavior, opt-in downloads, no outbound lyric transmission by default, and safe failure when storage/model/network is unavailable.

Release gate, revised in Phase 1.5: P0 ships synchronized supplied original lyrics and authorized supplied variants, including the Tamil/Latin/English reading journey. Generated conversion and translation are conditional P1. See [validation](12-phase-1.5-validation.md) for import bounds, repeated/equal timestamp rules, confirmed occurrence-ID mapping, labels/corrections and objective acceptance protocols. Generated translation additionally needs a pinned model, dependency/model notices, distribution permission, native-reader quality review and device measurements.
