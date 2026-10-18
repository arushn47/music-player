//! Read-only catalogue lookup. Never log URLs containing the user's API key.
use crate::{lyric_identity, provider_http, CanonicalMetadata};
use serde_json::Value;
use std::time::Duration;

pub async fn lookup(
    title: &str,
    artist: &str,
    duration: f64,
) -> Result<Option<CanonicalMetadata>, String> {
    let Ok(key) = std::env::var("LASTFM_API_KEY") else {
        return Ok(None);
    };
    if key.trim().is_empty() {
        return Ok(None);
    }
    lookup_from(
        "https://ws.audioscrobbler.com/2.0/",
        key.trim(),
        title,
        artist,
        duration,
    )
    .await
}

async fn request(
    base: &str,
    key: &str,
    method: &str,
    params: &[(&str, String)],
) -> Result<Value, String> {
    static GATE: tokio::sync::Mutex<Option<tokio::time::Instant>> =
        tokio::sync::Mutex::const_new(None);
    let mut last = GATE.lock().await;
    if let Some(previous) = *last {
        tokio::time::sleep_until(previous + Duration::from_millis(300)).await;
    }
    let mut query = vec![
        ("method", method.to_string()),
        ("api_key", key.to_string()),
        ("format", "json".into()),
    ];
    query.extend_from_slice(params);
    // Shared helper redacts transport errors and logs the base URL only.
    let response = provider_http::get(base, &query).await;
    *last = Some(tokio::time::Instant::now());
    drop(last);
    let response = response.map_err(|_| "Could not reach Last.fm metadata.".to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "Last.fm metadata unavailable (HTTP {}).",
            response.status()
        ));
    }
    let body: Value = response
        .json()
        .await
        .map_err(|_| "Invalid Last.fm metadata response.".to_string())?;
    match body.get("error").and_then(number) {
        Some(6 | 7) => Ok(Value::Null), // A missing catalogue entry is not an outage.
        Some(10 | 26) => {
            Err("Last.fm API key is invalid or suspended. Check LASTFM_API_KEY.".into())
        }
        Some(29) => Err("Last.fm metadata rate limit reached. Try again later.".into()),
        Some(_) => Err("Last.fm metadata service could not complete the lookup.".into()),
        None => Ok(body),
    }
}

fn number(value: &Value) -> Option<u64> {
    value.as_u64().or_else(|| value.as_str()?.parse().ok())
}

fn matched(track: &Value, title: &str, artist: &str, duration: f64) -> Option<CanonicalMetadata> {
    let name = track.get("name")?.as_str()?;
    let performer = track.pointer("/artist/name")?.as_str()?;
    let unknown = lyric_identity::primary_artist(artist).is_empty();
    if lyric_identity::title(title).is_empty()
        || lyric_identity::title(name) != lyric_identity::title(title)
        || lyric_identity::primary_artist(performer).is_empty()
        || (!unknown && !lyric_identity::artists_match(performer, artist))
    {
        return None;
    }
    let seconds = track
        .get("duration")
        .and_then(number)
        .filter(|n| *n > 0)
        .map(|n| n as f64 / 1000.0);
    match seconds {
        Some(seconds) if duration > 0.0 => {
            let tolerance = if unknown {
                12.0
            } else {
                (duration * 0.2).clamp(12.0, 45.0)
            };
            if (seconds - duration).abs() > tolerance {
                return None;
            }
        }
        _ if unknown => return None,
        _ => (),
    }
    let mut album = track
        .pointer("/album/title")
        .and_then(Value::as_str)
        .filter(|s| !s.trim().is_empty() && !["undefined", "null"].contains(&s.trim()))
        .unwrap_or_default();
    // A credit can be useful without timing. Require independent catalogue
    // activity for an otherwise empty identity; never trust an echoed request.
    // An untimed clean/remix album must not change the inferred recording version.
    if seconds.is_none()
        && ["clean", "remix", "instrumental"]
            .iter()
            .any(|tag| album.to_lowercase().contains(tag) && !title.to_lowercase().contains(tag))
    {
        album = "";
    }
    if seconds.is_none()
        && album.is_empty()
        && track.get("listeners").and_then(number).unwrap_or(0) == 0
    {
        return None;
    }
    Some(CanonicalMetadata {
        title: name.into(),
        artist: performer.into(),
        album: album.into(),
        duration: seconds,
        source_id: Some(format!(
            "lastfm:{}:{}",
            lyric_identity::fingerprint(performer),
            lyric_identity::title(name)
        )),
        artwork_url: track
            .pointer("/album/image")
            .and_then(Value::as_array)
            .and_then(|images| {
                images
                    .iter()
                    .rev()
                    .filter_map(|image| image.get("#text")?.as_str())
                    .find(|url| {
                        url.starts_with("https://lastfm-img.freetls.fastly.net/")
                            && !url.contains("2a96cbd8b46e442fc41c2b86b821562f")
                    })
            })
            .map(str::to_string),
    })
}

async fn lookup_from(
    base: &str,
    key: &str,
    title: &str,
    artist: &str,
    duration: f64,
) -> Result<Option<CanonicalMetadata>, String> {
    let primary = lyric_identity::primary_artist(artist);
    let unknown = primary.is_empty();
    let mut best = None;
    let mut seen = std::collections::HashSet::new();
    if !unknown {
        let body = request(
            base,
            key,
            "track.getInfo",
            &[
                ("track", title.into()),
                ("artist", artist.trim().to_string()),
                ("autocorrect", "0".into()),
            ],
        )
        .await?;
        best = body
            .get("track")
            .and_then(|track| matched(track, title, artist, duration));
        seen.insert((title.to_string(), artist.trim().to_string()));
        if best
            .as_ref()
            .is_some_and(|metadata| metadata.duration.is_some() && !metadata.album.is_empty())
        {
            return Ok(best);
        }
    }
    if unknown && duration <= 0.0 {
        return Ok(None);
    }
    let body = match request(
        base,
        key,
        "track.search",
        &[("track", title.into()), ("limit", "30".into())],
    )
    .await
    {
        Ok(body) => body,
        Err(_) if best.is_some() => return Ok(best),
        Err(error) => return Err(error),
    };
    let tracks = match body.pointer("/results/trackmatches/track") {
        Some(Value::Array(tracks)) => tracks.clone(),
        Some(track @ Value::Object(_)) => vec![track.clone()],
        _ => return Ok(best),
    };
    let mut candidates = vec![];
    for track in &tracks {
        let name = track
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let performer = track
            .get("artist")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if lyric_identity::title(name) == lyric_identity::title(title)
            && !lyric_identity::primary_artist(performer).is_empty()
            && (unknown || lyric_identity::artists_match(performer, artist))
        {
            candidates.push((
                name.to_string(),
                performer.to_string(),
                track.get("listeners").and_then(number).unwrap_or(0),
            ));
        }
    }
    // Popularity orders bounded requests; it never bypasses identity/timing checks.
    candidates.sort_by(|left, right| right.2.cmp(&left.2));
    let quality = |metadata: &CanonicalMetadata| {
        u32::from(!metadata.album.is_empty()) * 10
            + u32::from(metadata.duration.is_some()) * 5
            + lyric_identity::credits(&metadata.artist).len().min(5) as u32
    };
    let mut timed_matches: Vec<CanonicalMetadata> = vec![];
    // Unknown artists require inspecting every candidate in this bounded search.
    // If too many identities exist, keep the unknown rather than guess from popularity.
    if unknown && candidates.len() > 30 {
        return Ok(None);
    }
    for (name, performer, _) in candidates
        .into_iter()
        .filter(|(name, performer, _)| seen.insert((name.clone(), performer.clone())))
        .take(if unknown { 30 } else { 6 })
    {
        let body = match request(
            base,
            key,
            "track.getInfo",
            &[
                ("track", name),
                ("artist", performer),
                ("autocorrect", "0".into()),
            ],
        )
        .await
        {
            Ok(body) => body,
            Err(_) if best.is_some() => return Ok(best),
            Err(error) => return Err(error),
        };
        let Some(metadata) = body
            .get("track")
            .and_then(|track| matched(track, title, artist, duration))
        else {
            continue;
        };
        if unknown {
            timed_matches.push(metadata);
            continue;
        }
        if metadata.duration.is_some() && !metadata.album.is_empty() {
            return Ok(Some(metadata));
        }
        if best
            .as_ref()
            .is_none_or(|current| quality(&metadata) > quality(current))
        {
            best = Some(metadata);
        }
    }
    if unknown {
        let Some(first) = timed_matches.first() else {
            return Ok(None);
        };
        if timed_matches
            .iter()
            .any(|candidate| !lyric_identity::artists_match(&first.artist, &candidate.artist))
        {
            return Ok(None);
        }
        return Ok(timed_matches.into_iter().max_by_key(quality));
    }
    Ok(best)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn track() -> Value {
        json!({"name":"Karuppa Kooda Va", "artist":{"name":"Sai Abhyankkar"}, "duration":"258000", "album":{"title":"Karuppu"}})
    }
    #[test]
    fn validates_unicode_identity_version_artist_and_duration() {
        assert!(matched(&track(), "Karuppa Kooda Va", "Unknown artist", 258.0).is_some());
        assert!(matched(&track(), "Karuppa Kooda Va", "Other artist", 258.0).is_none());
        assert!(matched(
            &track(),
            "Karuppa Kooda Va (Remix)",
            "Sai Abhyankkar",
            258.0
        )
        .is_none());
        assert!(matched(&track(), "Karuppa Kooda Va", "Unknown artist", 190.0).is_none());
        let mut native = track();
        native["name"] = json!("காலை ஒளி");
        assert!(matched(&native, "காலை ஒளி", "Sai Abhyankkar", 258.0).is_some());
    }
    #[test]
    fn missing_duration_cannot_infer_unknown_artist_or_invent_timing() {
        let mut value = track();
        value["duration"] = json!("0");
        value["album"]["title"] = json!("undefined");
        assert!(matched(&value, "Karuppa Kooda Va", "Unknown artist", 258.0).is_none());
        assert!(matched(&value, "Karuppa Kooda Va", "Sai Abhyankkar", 258.0).is_none());
        value["album"]["title"] = json!("Karuppu");
        assert!(matched(&value, "Karuppa Kooda Va", "Sai Abhyankkar", 258.0)
            .unwrap()
            .duration
            .is_none());
    }
    #[test]
    fn http_contract_and_key_errors_are_redacted() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let (url, server) = provider_http::tests::server(vec![
            ("200 OK", json!({"track":track()}).to_string()),
            (
                "200 OK",
                json!({"error":10,"message":"private-test-key"}).to_string(),
            ),
        ]);
        runtime.block_on(async {
            assert!(lookup_from(
                &url,
                "private-test-key",
                "Karuppa Kooda Va",
                "Sai Abhyankkar",
                258.0
            )
            .await
            .unwrap()
            .is_some());
            let error = lookup_from(&url, "private-test-key", "Song", "Artist", 258.0)
                .await
                .unwrap_err();
            assert!(!error.contains("private-test-key"));
            assert!(error.contains("invalid"));
        });
        let requests = server.join().unwrap();
        assert!(requests[0].contains("method=track.getInfo"));
        assert!(requests[0].contains("api_key=private-test-key"));
        assert!(!requests[0].contains("api_sig"));
    }
    #[test]
    fn search_does_not_promote_an_ambiguous_artist() {
        let (url, server) = provider_http::tests::server(vec![
            ("200 OK", json!({"results":{"trackmatches":{"track":[{"name":"Song","artist":"One"},{"name":"Song","artist":"Two"}]}}}).to_string()),
            ("200 OK", json!({"track":{"name":"Song","artist":{"name":"One"},"duration":"180000"}}).to_string()),
            ("200 OK", json!({"track":{"name":"Song","artist":{"name":"Two"},"duration":"181000"}}).to_string()),
        ]);
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                assert!(lookup_from(&url, "test", "Song", "Unknown artist", 180.0)
                    .await
                    .unwrap()
                    .is_none());
            });
        assert_eq!(server.join().unwrap().len(), 3);
    }
    #[test]
    fn duration_disambiguates_unknown_artist_and_preserves_album_art() {
        let (url, server) = provider_http::tests::server(vec![
            ("200 OK", json!({"results":{"trackmatches":{"track":[
                {"name":"Boom Shaka","artist":"Kr$na","listeners":"6638"},
                {"name":"Boom Shaka","artist":"Muzi","listeners":"1403"}
            ]}}}).to_string()),
            ("200 OK", json!({"track":{"name":"Boom Shaka","artist":{"name":"Kr$na"},"duration":"218000","album":{"title":"Boom Shaka","image":[{"#text":"https://lastfm-img.freetls.fastly.net/i/u/300x300/cover.png"}]}}}).to_string()),
            ("200 OK", json!({"track":{"name":"Boom Shaka","artist":{"name":"Muzi"},"duration":"187000"}}).to_string()),
        ]);
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                let result = lookup_from(&url, "test", "Boom Shaka", "Unknown artist", 218.0)
                    .await
                    .unwrap()
                    .unwrap();
                assert_eq!(result.artist, "Kr$na");
                assert_eq!(result.album, "Boom Shaka");
                assert!(result.artwork_url.unwrap().contains("cover.png"));
            });
        assert_eq!(server.join().unwrap().len(), 3);
    }
    #[test]
    fn incomplete_exact_recording_searches_the_populated_release_title() {
        let empty = json!({"track":{"name":"Radhimaa","artist":{"name":"Sai Abhyankkar"},"duration":"0","listeners":"9"}});
        let search = json!({"results":{"trackmatches":{"track":[
            {"name":"RADHIMAA UNPLUGGED","artist":"DJ","listeners":"9999"},
            {"name":"Radhimaa - From \"Think Indie\"","artist":"Sai Abhyankkar","listeners":"1373"}
        ]}}});
        let detail = json!({"track":{"name":"Radhimaa - From \"Think Indie\"","artist":{"name":"Sai Abhyankkar"},"duration":"259000","album":{"title":"Radhimaa (From \"Think Indie\")"}}});
        let (url, server) = provider_http::tests::server(vec![
            ("200 OK", empty.to_string()),
            ("200 OK", search.to_string()),
            ("200 OK", detail.to_string()),
        ]);
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                let result = lookup_from(&url, "test", "Radhimaa", "Sai Abhyankkar", 260.0)
                    .await
                    .unwrap()
                    .unwrap();
                assert_eq!(result.duration, Some(259.0));
                assert!(result.album.contains("Think Indie"));
            });
        assert_eq!(server.join().unwrap().len(), 3);
    }
    #[test]
    fn full_collaboration_and_supported_partial_identity_are_preserved() {
        let detail = json!({"track":{"name":"Aarzu","artist":{"name":"Noor, Khan, Madhurxo"},"duration":"0","listeners":"665"}});
        assert!(matched(&detail["track"], "Aarzu", "Unknown artist", 188.0).is_none());
        let (url, server) = provider_http::tests::server(vec![
            ("200 OK", detail.to_string()),
            (
                "200 OK",
                json!({"results":{"trackmatches":{"track":[]}}}).to_string(),
            ),
        ]);
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                let result = lookup_from(&url, "test", "Aarzu", "Noor, Khan, Madhurxo", 188.0)
                    .await
                    .unwrap()
                    .unwrap();
                assert_eq!(result.artist, "Noor, Khan, Madhurxo");
                assert!(result.duration.is_none());
                assert!(result.album.is_empty());
            });
        let requests = server.join().unwrap();
        assert!(requests[0].contains("artist=Noor%2C+Khan%2C+Madhurxo"));
    }
    #[test]
    #[ignore = "explicit live check; requires LASTFM_API_KEY and network"]
    fn live_lastfm_regional_coverage() {
        assert!(
            std::env::var("LASTFM_API_KEY").is_ok(),
            "Configure LASTFM_API_KEY locally"
        );
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                for (title, artist, duration) in [
                    ("Snowman", "Sia", 173.0),
                    ("Boom Shaka", "Unknown artist", 218.0),
                    ("Alaakaa Loova", "Sai Abhyankkar", 217.0),
                    ("Alaakaa Loova", "Unknown artist", 217.0),
                    ("Karuppa Kooda Va", "Sai Abhyankkar", 258.0),
                    ("Radhimaa", "Sai Abhyankkar", 260.0),
                    ("Aarzu", "Noor", 188.0),
                    ("Aarzu", "Noor, Khan, Madhurxo", 188.0),
                    ("Karuppa Kooda Va", "Unknown artist", 258.0),
                ] {
                    let result = lookup(title, artist, duration).await.unwrap();
                    println!(
                        "Last.fm coverage {title} / {artist}: {}",
                        serde_json::to_string(&result).unwrap()
                    );
                    if title == "Snowman" {
                        assert!(result.is_some(), "Known control track did not resolve");
                    }
                    if title == "Boom Shaka" || title == "Alaakaa Loova" {
                        let metadata = result
                            .as_ref()
                            .expect("Reported regional metadata must resolve");
                        assert!(!metadata.album.is_empty());
                        assert!(metadata.artwork_url.is_some());
                    }
                    if title == "Radhimaa" {
                        let metadata = result
                            .as_ref()
                            .expect("Populated release-title variant was missed");
                        assert!(metadata.album.contains("Think Indie"));
                        assert_eq!(metadata.duration, Some(259.0));
                    }
                    if title == "Aarzu" {
                        let metadata = result
                            .as_ref()
                            .expect("Supported partial artist identity was discarded");
                        assert!(metadata.artist.contains("Noor"));
                        assert!(
                            metadata.duration.is_none(),
                            "Never invent timing for this untimed entry"
                        );
                    }
                }
            });
    }
}
