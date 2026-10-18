//! Catalog identity only: no previews, artwork, credentials or playback URLs.
use crate::{lyric_identity, provider_http, CanonicalMetadata};
use serde::Deserialize;
use std::time::Duration;

#[derive(Deserialize)]
struct Response {
    results: Vec<Song>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Song {
    kind: Option<String>,
    track_id: Option<u64>,
    track_name: Option<String>,
    artist_name: Option<String>,
    collection_name: Option<String>,
    track_time_millis: Option<u64>,
}

fn choose<'a>(songs: &'a [Song], title: &str, artist: &str, duration: f64) -> Option<&'a Song> {
    let unknown = lyric_identity::primary_artist(artist).is_empty();
    let mut matches: Vec<_> = songs
        .iter()
        .filter(|song| {
            let name = song.track_name.as_deref().unwrap_or_default();
            let performer = song.artist_name.as_deref().unwrap_or_default();
            song.kind.as_deref() == Some("song")
                && !lyric_identity::title(title).is_empty()
                && lyric_identity::title(name) == lyric_identity::title(title)
                && !lyric_identity::primary_artist(performer).is_empty()
                && (unknown || lyric_identity::artists_match(performer, artist))
                && match song.track_time_millis {
                    Some(ms) if duration > 0.0 => {
                        // Artist + exact song/version identify music in a video
                        // with an intro/outro. Unknown artists need tighter
                        // duration evidence before a performer can be inferred.
                        let tolerance = if unknown {
                            12.0
                        } else {
                            (duration * 0.2).clamp(12.0, 45.0)
                        };
                        (ms as f64 / 1000.0 - duration).abs() <= tolerance
                    }
                    _ => !unknown,
                }
        })
        .collect();
    matches.sort_by(|a, b| {
        let gap = |song: &Song| {
            song.track_time_millis
                .map(|ms| (ms as f64 / 1000.0 - duration).abs())
                .unwrap_or(f64::INFINITY)
        };
        gap(a).total_cmp(&gap(b))
    });
    let best = *matches.first()?;
    // A common title and similar length alone cannot identify two different
    // performers. Duplicate releases of the same credited recording are fine.
    if unknown
        && matches.iter().any(|song| {
            !lyric_identity::artists_match(
                song.artist_name.as_deref().unwrap_or_default(),
                best.artist_name.as_deref().unwrap_or_default(),
            )
        })
    {
        return None;
    }
    Some(best)
}

pub async fn lookup(
    title: &str,
    artist: &str,
    duration: f64,
) -> Result<Option<CanonicalMetadata>, String> {
    lookup_from("https://itunes.apple.com/search", title, artist, duration).await
}

async fn lookup_from(
    base: &str,
    title: &str,
    artist: &str,
    duration: f64,
) -> Result<Option<CanonicalMetadata>, String> {
    let primary = lyric_identity::primary_artist(artist);
    let term = if primary.is_empty() {
        title.to_string()
    } else {
        format!("{primary} {title}")
    };
    // Apple's documented approximate limit is 20/minute. Serialize calls and
    // keep at least 3.1 seconds between them, including storefront fallbacks.
    static GATE: tokio::sync::Mutex<Option<tokio::time::Instant>> =
        tokio::sync::Mutex::const_new(None);
    for country in ["IN", "US"] {
        let mut last = GATE.lock().await;
        if let Some(previous) = *last {
            tokio::time::sleep_until(previous + Duration::from_millis(3100)).await;
        }
        let response = provider_http::client()?
            .get(base)
            .query(&[
                ("term", term.clone()),
                ("entity", "song".into()),
                ("country", country.into()),
                ("limit", "50".into()),
            ])
            .send()
            .await
            .map_err(|_| "Could not reach Apple metadata.".to_string());
        *last = Some(tokio::time::Instant::now());
        drop(last);
        let response = response?;
        if !response.status().is_success() {
            return Err(format!(
                "Apple metadata is unavailable (HTTP {}).",
                response.status()
            ));
        }
        let response: Response = response
            .json()
            .await
            .map_err(|_| "Invalid Apple catalog response.")?;
        if let Some(song) = choose(&response.results, title, artist, duration) {
            return Ok(Some(CanonicalMetadata {
                title: song.track_name.clone().unwrap(),
                artist: song.artist_name.clone().unwrap(),
                album: song.collection_name.clone().unwrap_or_default(),
                duration: song.track_time_millis.map(|ms| ms as f64 / 1000.0),
                source_id: song.track_id.map(|id| format!("itunes:{id}")),
                artwork_url: None,
            }));
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn song(title: &str, artist: &str, seconds: u64) -> Song {
        serde_json::from_value(serde_json::json!({
            "kind":"song", "trackId":1, "trackName":title,
            "artistName":artist, "collectionName":"Album", "trackTimeMillis":seconds*1000
        }))
        .unwrap()
    }
    #[test]
    fn unknown_artist_can_be_identified_without_promoting_uploaders_or_remixes() {
        let songs = vec![
            song(
                "Karuppa Kooda Va (From \"Karuppu\")",
                "Sai Abhyankkar, V.M. Mahalingam & Pa Vijay",
                250,
            ),
            song("Karuppa Kooda Va (Remix)", "DJ", 258),
            song("Unrelated song", "Other", 258),
        ];
        let hit = choose(&songs, "Karuppa Kooda Va", "Unknown artist", 258.0).unwrap();
        assert!(hit
            .artist_name
            .as_ref()
            .unwrap()
            .starts_with("Sai Abhyankkar"));
        assert!(choose(&songs, "Karuppa Kooda Va", "Think Music India", 258.0).is_none());
        assert!(choose(&songs, "Karuppa Kooda Va", "", 0.0).is_none());
    }
    #[test]
    fn ambiguous_title_only_matches_are_rejected_but_collaboration_credits_work() {
        let songs = vec![
            song("Aarzu", "Noor, Khan & Madhurxo", 188),
            song("Aarzu", "Unrelated artist", 188),
        ];
        assert!(choose(&songs, "Aarzu", "", 188.0).is_none());
        assert!(choose(&songs, "Aarzu", "Noor, Khan, Madhurxo", 188.0).is_some());
        assert!(choose(&songs, "Aarzu", "Noor", 226.0).is_some());
        assert!(choose(&songs, "Aarzu", "", 226.0).is_none());
        assert!(choose(&songs, "Aarzu (Live)", "Noor", 226.0).is_none());
        assert!(choose(&songs, "Aarzu", "Noor", 400.0).is_none());
    }
    #[test]
    fn unicode_titles_and_versions_remain_distinct() {
        let songs = vec![song("கூட", "பாடகர்", 200), song("கட", "பாடகர்", 200)];
        assert_eq!(
            choose(&songs, "கூட", "", 200.0)
                .unwrap()
                .track_name
                .as_deref(),
            Some("கூட")
        );
        assert!(choose(&songs, "கூட (Live)", "பாடகர்", 200.0).is_none());
    }
    #[test]
    fn exact_catalog_query_recovers_artist_from_actual_http_response() {
        let (base, server) = provider_http::tests::server(vec![("200 OK", r#"{"results":[{"kind":"song","trackId":42,"trackName":"Karuppa Kooda Va (From \"Karuppu\")","artistName":"Sai Abhyankkar","collectionName":"Karuppu","trackTimeMillis":250000}]}"#.into())]);
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let metadata = runtime
            .block_on(lookup_from(
                &base,
                "Karuppa Kooda Va",
                "Unknown artist",
                258.0,
            ))
            .unwrap()
            .unwrap();
        assert_eq!(metadata.artist, "Sai Abhyankkar");
        assert_eq!(metadata.duration, Some(250.0));
        let requests = server.join().unwrap();
        assert!(!requests[0].contains("Unknown"));
        assert!(requests[0].contains("country=IN"));
    }
}
