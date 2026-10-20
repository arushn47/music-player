use crate::{clean_artist_for_lyrics, lyric_identity, provider_http, LyricResult};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Record {
    #[serde(default)]
    id: Option<u64>,
    #[serde(default)]
    album_name: String,
    track_name: String,
    artist_name: String,
    duration: f64,
    #[serde(default)]
    instrumental: bool,
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchInfo {
    pub id: u64,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
}

fn match_info(record: &Record) -> Option<MatchInfo> {
    Some(MatchInfo {
        id: record.id?,
        title: record.track_name.clone(),
        artist: record.artist_name.clone(),
        album: record.album_name.clone(),
        duration: record.duration,
    })
}

fn synced(record: &Record) -> bool {
    record
        .synced_lyrics
        .as_ref()
        .is_some_and(|s| !s.trim().is_empty())
}

fn native_text(record: &Record) -> bool {
    lyric_identity::script(
        record
            .synced_lyrics
            .as_deref()
            .or(record.plain_lyrics.as_deref())
            .unwrap_or_default(),
    ) != "Latin / other"
}

fn timing_compatible(record: &Record, duration: f64) -> bool {
    if duration <= 0.0 || (record.duration - duration).abs() > 2.0 {
        return false;
    }
    let Some(lrc) = record
        .synced_lyrics
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    else {
        return false;
    };
    static STAMP: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let stamps = STAMP
        .get_or_init(|| regex::Regex::new(r"\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]").unwrap());
    let mut count = 0;
    for stamp in stamps.captures_iter(lrc) {
        let seconds =
            stamp[1].parse::<f64>().unwrap_or(0.0) * 60.0 + stamp[2].parse::<f64>().unwrap_or(0.0);
        if seconds > duration + 2.0 {
            return false;
        }
        count += 1;
    }
    count > 0
}

fn plain_text(record: &Record) -> Option<String> {
    if let Some(text) = record
        .plain_lyrics
        .as_ref()
        .filter(|s| !s.trim().is_empty())
    {
        return Some(text.clone());
    }
    static TAG: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let tags = TAG.get_or_init(|| regex::Regex::new(r"\[[^\]\r\n]*\]").unwrap());
    let text = record
        .synced_lyrics
        .as_deref()?
        .lines()
        .filter_map(|line| {
            if [
                "[ar:", "[ti:", "[al:", "[by:", "[offset:", "[length:", "[re:", "[ve:",
            ]
            .iter()
            .any(|tag| line.trim_start().starts_with(tag))
            {
                return None;
            }
            let text = tags.replace_all(line, "").trim().to_string();
            (!text.is_empty()).then_some(text)
        })
        .collect::<Vec<_>>()
        .join("\n");
    (!text.trim().is_empty()).then_some(text)
}

fn result(record: Record, duration: f64) -> LyricResult {
    let matched = match_info(&record);
    if timing_compatible(&record, duration) {
        return LyricResult::Synced {
            lrc: record.synced_lyrics.unwrap(),
            matched,
        };
    }
    if let Some(text) = plain_text(&record) {
        LyricResult::Plain { text, matched }
    } else if record.instrumental {
        LyricResult::Instrumental
    } else {
        LyricResult::NotFound
    }
}

fn candidate<'a>(
    records: &'a [Record],
    title: &str,
    artist: &str,
    duration: f64,
) -> Option<&'a Record> {
    records
        .iter()
        .filter(|r| {
            lyric_identity::title(&r.track_name) == lyric_identity::title(title)
                && (lyric_identity::primary_artist(artist).is_empty()
                    || lyric_identity::artists_match(&r.artist_name, artist)
                    || ((r.duration - duration).abs() <= 2.0
                        && duration > 0.0
                        && artist_name_extension(&r.artist_name, artist)))
                && (r.instrumental
                    || r.synced_lyrics
                        .as_ref()
                        .is_some_and(|v| !v.trim().is_empty())
                    || r.plain_lyrics
                        .as_ref()
                        .is_some_and(|v| !v.trim().is_empty()))
        })
        .min_by(|a, b| {
            let gap = |r: &Record| {
                if duration > 0.0 {
                    (r.duration - duration).abs()
                } else {
                    0.0
                }
            };
            // Closest recording first; at equal duration prefer synchronized lyrics.
            timing_compatible(b, duration)
                .cmp(&timing_compatible(a, duration))
                .then_with(|| gap(a).total_cmp(&gap(b)))
                .then_with(|| synced(b).cmp(&synced(a)))
                .then_with(|| native_text(b).cmp(&native_text(a)))
        })
}

// Accept a complete name token, such as Emiway / Emiway Bantai, only when
// title and recording duration also agree. Substrings and cover labels fail.
fn artist_name_extension(left: &str, right: &str) -> bool {
    let tokens = |name: &str| -> Vec<String> {
        name.to_lowercase()
            .split(|c: char| !c.is_alphanumeric())
            .filter(|token| !token.is_empty())
            .map(str::to_string)
            .collect()
    };
    lyric_identity::credits(left).iter().any(|left| {
        lyric_identity::credits(right).iter().any(|right| {
            let a = tokens(left);
            let b = tokens(right);
            let (short, long) = if a.len() < b.len() {
                (&a, &b)
            } else {
                (&b, &a)
            };
            !short.is_empty()
                && short != long
                && short[0].chars().count() >= 4
                && long.starts_with(short)
                && long.len() - short.len() <= 2
                && !long
                    .iter()
                    .any(|word| ["cover", "tribute", "karaoke", "remix"].contains(&word.as_str()))
        })
    })
}

pub async fn fetch(
    title: String,
    artist: String,
    album: String,
    duration: f64,
) -> Result<LyricResult, String> {
    fetch_from("https://lrclib.net/api", title, artist, album, duration).await
}

async fn fetch_from(
    base: &str,
    title: String,
    artist: String,
    album: String,
    duration: f64,
) -> Result<LyricResult, String> {
    if !duration.is_finite() || title.len() > 2000 || artist.len() > 2000 || album.len() > 2000 {
        return Err("Invalid track information for lyrics lookup.".into());
    }
    // Remove film decorations before trying Artist - Song extraction.
    let prepared_title = lyric_identity::query_title(&title);
    let (artist, title) = clean_artist_for_lyrics(&artist, &prepared_title);
    if title.trim().is_empty() {
        return Ok(LyricResult::NotFound);
    }
    // Serializing requests prevents track switches from flooding the provider.
    static GATE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
    let _guard = GATE.lock().await;
    let mut params = vec![
        ("track_name", title.clone()),
        ("artist_name", lyric_identity::primary_artist(&artist)),
    ];
    if !["", "youtube", "local collection", "unknown album"]
        .contains(&album.trim().to_lowercase().as_str())
    {
        params.push(("album_name", album.trim().to_string()));
    }
    if (1.0..=3600.0).contains(&duration) {
        params.push(("duration", format!("{duration:.0}")));
    }
    let mut fallback = None;
    let mut status = reqwest::StatusCode::NOT_FOUND;
    if !lyric_identity::primary_artist(&artist).is_empty() {
        let response = provider_http::get(&format!("{base}/get"), &params).await?;
        status = response.status();
        if status.is_success() {
            let record: Record = response
                .json()
                .await
                .map_err(|_| "LRCLIB returned an invalid lyric record.")?;
            if has_content(&record)
                && candidate(std::slice::from_ref(&record), &title, &artist, duration).is_some()
            {
                if timing_compatible(&record, duration) {
                    return Ok(result(record, duration));
                }
                fallback = Some(record);
            }
        } else if status.is_server_error() {
            // The exact endpoint and search can have different cache/load paths.
            // Try search after the final short cooldown, never bypassing 429/auth
            // responses or a long/unparseable Retry-After directive.
            let delay = response
                .headers()
                .get("retry-after")
                .map(|v| v.to_str().ok().and_then(|v| v.parse::<u64>().ok()));
            match delay {
                None => tokio::time::sleep(std::time::Duration::from_secs(1)).await,
                Some(Some(seconds)) if seconds <= 5 => {
                    tokio::time::sleep(std::time::Duration::from_secs(seconds.max(1))).await
                }
                _ => {
                    return Err(format!(
                        "LRCLIB is temporarily unavailable (HTTP {status}). Please retry later."
                    ))
                }
            }
        } else if status != reqwest::StatusCode::NOT_FOUND {
            // Temporary failures must remain retryable errors, not cached misses.
            return Err(format!(
                "LRCLIB is temporarily unavailable (HTTP {status}). Please retry shortly."
            ));
        }
    }
    let mut records = search_records(base, &title, &artist)
        .await
        .or_else(|error| {
            if let Some(record) = fallback.take() {
                Ok(vec![record])
            } else {
                Err(error)
            }
        })?;
    if let Some(record) = fallback {
        records.push(record);
    }
    if let Some(record) = candidate(&records, &title, &artist, duration) {
        let index = records
            .iter()
            .position(|r| std::ptr::eq(r, record))
            .unwrap();
        return Ok(result(records.swap_remove(index), duration));
    }
    if status.is_server_error() {
        return Err(format!("LRCLIB exact lookup was unavailable (HTTP {status}) and search found no verified match. Please retry."));
    }
    Ok(LyricResult::NotFound)
}

async fn search_records(base: &str, title: &str, artist: &str) -> Result<Vec<Record>, String> {
    let primary = lyric_identity::primary_artist(artist);
    let mut queries = vec![primary];
    if !queries[0].is_empty() {
        queries.push(String::new());
    }
    let mut records = Vec::new();
    for artist_query in queries {
        let mut params = vec![("track_name", lyric_identity::query_title(title))];
        if !artist_query.is_empty() {
            params.push(("artist_name", artist_query));
        }
        let response = provider_http::get(&format!("{base}/search"), &params).await?;
        if !response.status().is_success() {
            return Err(format!(
                "LRCLIB search is unavailable (HTTP {}). Please retry shortly.",
                response.status()
            ));
        }
        let found: Vec<Record> = response
            .json()
            .await
            .map_err(|_| "LRCLIB returned invalid search results.")?;
        for record in found {
            if !records
                .iter()
                .any(|existing: &Record| record.id.is_some() && record.id == existing.id)
            {
                records.push(record);
            }
        }
        // Matching identity is enough to select readable text. Only compatible
        // source durations are eligible for synchronized playback.
        if records.iter().any(|r| {
            has_content(r)
                && synced(r)
                && lyric_identity::title(&r.track_name) == lyric_identity::title(title)
                && lyric_identity::artists_match(&r.artist_name, artist)
        }) {
            break;
        }
    }
    Ok(records)
}

fn has_content(record: &Record) -> bool {
    record.instrumental
        || record
            .synced_lyrics
            .as_ref()
            .is_some_and(|s| !s.trim().is_empty())
        || record
            .plain_lyrics
            .as_ref()
            .is_some_and(|s| !s.trim().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn record(title: &str, artist: &str, duration: f64, synced: bool) -> Record {
        Record {
            id: None,
            album_name: String::new(),
            track_name: title.into(),
            artist_name: artist.into(),
            duration,
            instrumental: false,
            synced_lyrics: synced.then(|| "[00:01]test".into()),
            plain_lyrics: Some("test".into()),
        }
    }
    #[test]
    fn artist_extension_requires_complete_name_tokens_title_and_duration() {
        let records = vec![record("GUESS", "Emiway Bantai", 169.0, true)];
        assert!(candidate(&records, "GUESS", "Emiway", 169.0).is_some());
        assert!(candidate(&records, "GUESS", "Emiway", 190.0).is_none());
        assert!(candidate(&records, "GUESS", "Emi", 169.0).is_none());
        assert!(candidate(&records, "Other", "Emiway", 169.0).is_none());
        assert!(!artist_name_extension("Emiway Cover", "Emiway"));
    }

    #[test]
    fn guess_short_artist_name_uses_synced_search_result() {
        let (base, server) = provider_http::tests::server(vec![
            ("404 Not Found", "{}".into()),
            ("200 OK", r#"[{"id":6555308,"trackName":"GUESS","artistName":"Emiway Bantai","duration":169,"syncedLyrics":"[00:01]fixture"}]"#.into()),
            ("200 OK", "[]".into()),
        ]);
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        assert!(matches!(
            runtime
                .block_on(fetch_from(
                    &base,
                    "GUESS".into(),
                    "Emiway".into(),
                    "".into(),
                    169.0
                ))
                .unwrap(),
            LyricResult::Synced { .. }
        ));
        assert_eq!(server.join().unwrap().len(), 3);
    }
    #[test]
    fn search_rejects_wrong_artists_and_versions_but_accepts_video_intro_difference() {
        let records = vec![
            record("Snowman", "Cover artist", 173.0, true),
            record("Snowman", "Sia", 200.0, true),
            record("Snowman", "Sia", 166.0, true),
        ];
        assert_eq!(
            candidate(&records, "Snowman", "Sia", 173.0)
                .unwrap()
                .duration,
            166.0
        );
        assert!(candidate(&records, "Snowman", "", 173.0).is_some());
        assert!(candidate(&records, "Other song", "Sia", 173.0).is_none());
    }
    #[test]
    fn chooses_closest_recording_then_synced_lyrics() {
        let records = vec![
            record("Song", "Artist", 200.0, false),
            record("Song", "Artist", 200.0, true),
            record("Song", "Artist", 205.0, true),
        ];
        assert!(candidate(&records, "song", "artist", 200.0)
            .unwrap()
            .synced_lyrics
            .is_some());
    }
    #[test]
    fn unicode_titles_do_not_collapse_to_the_same_empty_string() {
        assert_ne!(lyric_identity::title("愛"), lyric_identity::title("雪"));
    }

    #[test]
    fn collaboration_and_film_titles_match_without_english_only_assumptions() {
        let records = vec![record(
            "Karuppa Kooda Va - From \"Karuppu\"",
            "Sai Abhyankkar, V.M. Mahalingam, Pa. Vijay",
            258.0,
            true,
        )];
        assert!(candidate(&records, "Karuppa Kooda Va", "Sai Abhyankkar", 258.0).is_some());
        let records = vec![record("Aarzu", "Noor", 188.0, true)];
        assert!(candidate(&records, "Aarzu", "Noor, Khan, Madhurxo", 188.0).is_some());
        assert!(matches!(
            result(
                candidate(&records, "Aarzu", "Noor, Khan, Madhurxo", 226.0)
                    .unwrap()
                    .clone(),
                226.0
            ),
            LyricResult::Plain { .. }
        ));
    }

    #[test]
    fn automatically_uses_the_nearest_native_edition_as_plain_text_for_different_audio() {
        let mut native = record("Aarzu", "Noor", 188.0, true);
        native.id = Some(1);
        native.synced_lyrics = Some("[00:01]पहली पंक्ति".into());
        let mut latin = record("Aarzu", "Noor", 188.0, true);
        latin.id = Some(2);
        let records = vec![latin, native];
        let best = candidate(&records, "Aarzu", "Noor, Khan", 226.0).unwrap();
        assert_eq!(best.id, Some(1));
        assert!(matches!(
            result(best.clone(), 226.0),
            LyricResult::Plain { .. }
        ));
    }

    #[test]
    fn unknown_artist_automatically_loads_title_and_duration_match() {
        let (base, server) = provider_http::tests::server(vec![("200 OK", r#"[{"id":1,"trackName":"கூட","artistName":"பாடகர்","duration":200,"syncedLyrics":"[00:01]முதல் வரி"}]"#.into())]);
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = runtime
            .block_on(fetch_from(
                &base,
                "கூட - From \"படம்\"".into(),
                "".into(),
                "".into(),
                200.0,
            ))
            .unwrap();
        assert!(matches!(result, LyricResult::Synced { .. }));
        let requests = server.join().unwrap();
        assert_eq!(requests.len(), 1);
        assert!(requests[0].starts_with("GET /search?"));
        assert!(!requests[0].contains("artist_name"));
    }

    #[test]
    #[ignore = "explicit multilingual live provider check; requires network"]
    fn live_multilingual_automatic_lyrics() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        runtime.block_on(async {
            let tamil = fetch(
                "Karuppa Kooda Va".into(),
                "Sai Abhyankkar".into(),
                "".into(),
                258.0,
            )
            .await
            .unwrap();
            assert!(matches!(tamil, LyricResult::Synced { .. }));
            let aarzu = fetch(
                "Aarzu".into(),
                "Noor, Khan, Madhurxo".into(),
                "".into(),
                226.0,
            )
            .await
            .unwrap();
            match aarzu {
                LyricResult::Plain { text, matched } => {
                    assert!(!text.contains("[00:"));
                    assert!(matched.is_some());
                }
                _ => panic!("Aarzu must load automatically as unsynced text for the longer video"),
            }
        });
    }

    #[test]
    fn exact_miss_uses_nearest_text_without_mislabeling_different_timing() {
        let (base, server) = provider_http::tests::server(vec![
            ("404 Not Found", "{}".into()),
            ("200 OK", r#"[{"trackName":"Snowman","artistName":"Sia","duration":166,"syncedLyrics":"[00:01]Original fixture","plainLyrics":null}]"#.into()),
        ]);
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = runtime
            .block_on(fetch_from(
                &base,
                "Snowman".into(),
                "Sia".into(),
                "YouTube".into(),
                173.0,
            ))
            .unwrap();
        assert!(matches!(result, LyricResult::Plain { .. }));
        let requests = server.join().unwrap();
        assert!(requests[0].starts_with("GET /get?"));
        assert!(!requests[0].contains("album_name"));
        assert!(requests[1].starts_with("GET /search?"));
        assert!(!requests[1].contains("duration="));
    }

    #[test]
    fn transient_exact_endpoint_overload_can_recover_through_search() {
        let (base, server) = provider_http::tests::server(vec![
            ("503 Service Unavailable", "{}".into()),
            ("503 Service Unavailable", "{}".into()),
            ("503 Service Unavailable", "{}".into()),
            ("200 OK", r#"[{"trackName":"Song","artistName":"Artist","duration":200,"syncedLyrics":"[00:01]Original fixture","plainLyrics":null}]"#.into()),
        ]);
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = runtime
            .block_on(fetch_from(
                &base,
                "Song".into(),
                "Artist".into(),
                "".into(),
                200.0,
            ))
            .unwrap();
        assert!(matches!(result, LyricResult::Synced { .. }));
        let requests = server.join().unwrap();
        assert_eq!(requests.len(), 4);
        assert!(requests[3].starts_with("GET /search?"));
    }

    #[test]
    fn prefers_synced_search_over_plain_exact_but_retains_plain_if_search_fails() {
        let plain = r#"{"trackName":"Song","artistName":"Artist","duration":200,"syncedLyrics":null,"plainLyrics":"Original fixture"}"#;
        for (status, search) in [
            (
                "200 OK",
                r#"[{"trackName":"Song","artistName":"Artist","duration":200,"syncedLyrics":"[00:01]Original fixture","plainLyrics":null}]"#,
            ),
            ("403 Forbidden", "{}"),
        ] {
            let (base, server) = provider_http::tests::server(vec![
                ("200 OK", plain.into()),
                (status, search.into()),
            ]);
            let runtime = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            let result = runtime
                .block_on(fetch_from(
                    &base,
                    "Song".into(),
                    "Artist".into(),
                    "".into(),
                    200.0,
                ))
                .unwrap();
            if status == "200 OK" {
                assert!(matches!(result, LyricResult::Synced { .. }));
            } else {
                assert!(matches!(result, LyricResult::Plain { .. }));
            }
            assert_eq!(server.join().unwrap().len(), 2);
        }
    }

    #[test]
    #[ignore = "explicit live provider check; requires network"]
    fn live_snowman_native_lookup() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = runtime
            .block_on(fetch(
                "Snowman".into(),
                "Sia".into(),
                "YouTube".into(),
                173.0,
            ))
            .unwrap();
        assert!(matches!(result, LyricResult::Synced { .. }));
    }
}
