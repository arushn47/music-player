//! Catalog identity and cover art only; no previews, credentials or playback URLs.
use crate::{lyric_identity, provider_http, CanonicalMetadata};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::Duration;

#[derive(Deserialize)]
struct Response {
    results: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CatalogTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub artist_id: Option<String>,
    pub artists: Vec<CatalogArtistCredit>,
    pub album: String,
    pub album_id: Option<String>,
    pub duration: f64,
    pub artwork_url: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CatalogArtistCredit {
    pub name: String,
    pub id: Option<String>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Song {
    kind: Option<String>,
    track_id: Option<u64>,
    artist_id: Option<u64>,
    track_name: Option<String>,
    artist_name: Option<String>,
    collection_name: Option<String>,
    collection_id: Option<u64>,
    release_date: Option<String>,
    track_count: Option<u32>,
    disc_number: Option<u32>,
    track_number: Option<u32>,
    track_time_millis: Option<u64>,
    artwork_url100: Option<String>,
}

fn artwork_url(value: Option<&str>) -> Option<String> {
    let url = reqwest::Url::parse(value?).ok()?;
    (url.scheme() == "https"
        && url
            .host_str()
            .is_some_and(|host| host.ends_with(".mzstatic.com"))
        && url.username().is_empty()
        && url.password().is_none()
        && url.port_or_known_default() == Some(443))
    .then(|| url.as_str().replace("100x100bb", "600x600bb"))
}

fn catalog_track(song: Song) -> Option<CatalogTrack> {
    let id = song.track_id.filter(|id| *id > 0)?;
    let title = song.track_name?.trim().to_string();
    let artist = song.artist_name?.trim().to_string();
    let duration = song.track_time_millis.filter(|ms| *ms > 0)? as f64 / 1000.0;
    if song.kind.as_deref() != Some("song")
        || title.is_empty()
        || artist.is_empty()
        || title.chars().any(char::is_control)
        || artist.chars().any(char::is_control)
    {
        return None;
    }
    Some(CatalogTrack {
        id: format!("itunes:{id}"),
        title,
        artist: artist.clone(),
        artist_id: song.artist_id.map(|id| format!("itunes:{id}")),
        artists: vec![CatalogArtistCredit {
            name: artist,
            id: song.artist_id.map(|id| format!("itunes:{id}")),
        }],
        album: song.collection_name.unwrap_or_default().trim().to_string(),
        album_id: song.collection_id.map(|id| format!("itunes:{id}")),
        duration,
        artwork_url: artwork_url(song.artwork_url100.as_deref()),
    })
}

async fn request(base: &str, params: &[(&str, String)]) -> Result<Vec<Song>, String> {
    // Apple's approximate limit is 20/minute, shared by every catalog caller.
    static GATE: tokio::sync::Mutex<Option<tokio::time::Instant>> =
        tokio::sync::Mutex::const_new(None);
    let mut last = GATE.lock().await;
    if let Some(previous) = *last {
        tokio::time::sleep_until(previous + Duration::from_millis(3100)).await;
    }
    let response = provider_http::client()?
        .get(base)
        .query(params)
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
        .map_err(|_| "Invalid Apple catalog response.".to_string())?;
    Ok(response
        .results
        .into_iter()
        .filter_map(|value| serde_json::from_value(value).ok())
        .collect())
}

pub async fn search_catalog(
    query: String,
    limit: Option<u32>,
) -> Result<Vec<CatalogTrack>, String> {
    search_catalog_from("https://itunes.apple.com/search", &query, limit).await
}

async fn search_catalog_from(
    base: &str,
    query: &str,
    limit: Option<u32>,
) -> Result<Vec<CatalogTrack>, String> {
    let query = query.trim();
    if !(1..=200).contains(&query.chars().count()) || query.chars().any(char::is_control) {
        return Err("Enter a catalog search between 1 and 200 characters.".into());
    }
    let limit = limit.unwrap_or(20).clamp(1, 30) as usize;
    for country in ["IN", "US"] {
        let songs = request(
            base,
            &[
                ("term", query.into()),
                ("entity", "song".into()),
                ("country", country.into()),
                ("limit", limit.to_string()),
            ],
        )
        .await?;
        let mut seen = HashSet::new();
        let tracks: Vec<_> = songs
            .into_iter()
            .filter_map(catalog_track)
            .filter(|track| seen.insert(track.id.clone()))
            .take(limit)
            .collect();
        if !tracks.is_empty() {
            return Ok(tracks);
        }
    }
    Ok(vec![])
}

pub async fn lookup_catalog(id: String) -> Result<CatalogTrack, String> {
    lookup_catalog_from("https://itunes.apple.com/lookup", &id).await
}

async fn lookup_catalog_from(base: &str, id: &str) -> Result<CatalogTrack, String> {
    let track_id = id
        .strip_prefix("itunes:")
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value > 0 && id == format!("itunes:{value}"))
        .ok_or("Invalid Apple catalog track ID.")?;
    for country in ["IN", "US"] {
        let songs = request(
            base,
            &[
                ("id", track_id.to_string()),
                ("entity", "song".into()),
                ("country", country.into()),
            ],
        )
        .await?;
        if let Some(track) = songs
            .into_iter()
            .filter_map(catalog_track)
            .find(|track| track.id == id)
        {
            return Ok(track);
        }
    }
    Err("This Apple catalog track is unavailable.".into())
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
    for country in ["IN", "US"] {
        let songs = request(
            base,
            &[
                ("term", term.clone()),
                ("entity", "song".into()),
                ("country", country.into()),
                ("limit", "50".into()),
            ],
        )
        .await?;
        if let Some(song) = choose(&songs, title, artist, duration) {
            return Ok(Some(CanonicalMetadata {
                title: song.track_name.clone().unwrap(),
                artist: song.artist_name.clone().unwrap(),
                album: song.collection_name.clone().unwrap_or_default(),
                duration: song.track_time_millis.map(|ms| ms as f64 / 1000.0),
                source_id: song.track_id.map(|id| format!("itunes:{id}")),
                artwork_url: artwork_url(song.artwork_url100.as_deref()),
            }));
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    static HTTP: std::sync::Mutex<()> = std::sync::Mutex::new(());

    fn runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
    }

    const CATALOG_SONG: &str = r#"{"kind":"song","trackId":42,"trackName":"  கூட  ","artistName":"பாடகர்","collectionName":"Album","trackTimeMillis":200125,"artworkUrl100":"https://is1-ssl.mzstatic.com/image/100x100bb.jpg"}"#;

    #[test]
    fn catalog_rows_validate_identity_names_duration_and_artwork() {
        let valid: serde_json::Value = serde_json::from_str(CATALOG_SONG).unwrap();
        let track = catalog_track(serde_json::from_value(valid.clone()).unwrap()).unwrap();
        assert_eq!(track.id, "itunes:42");
        assert_eq!(track.title, "கூட");
        assert_eq!(track.duration, 200.125);
        assert_eq!(
            serde_json::to_value(&track).unwrap()["artworkUrl"],
            "https://is1-ssl.mzstatic.com/image/600x600bb.jpg"
        );
        for (key, value) in [
            ("kind", serde_json::json!("music-video")),
            ("trackId", serde_json::json!(0)),
            ("trackName", serde_json::json!("  ")),
            ("artistName", serde_json::json!("\n")),
            ("trackTimeMillis", serde_json::json!(0)),
            ("trackTimeMillis", serde_json::Value::Null),
        ] {
            let mut row = valid.clone();
            row[key] = value;
            assert!(
                catalog_track(serde_json::from_value(row).unwrap()).is_none(),
                "{key}"
            );
        }
        for url in [
            "http://is1.mzstatic.com/a.jpg",
            "https://mzstatic.com/a.jpg",
            "https://is1.mzstatic.com.evil.test/a.jpg",
            "https://user@is1.mzstatic.com/a.jpg",
            "https://is1.mzstatic.com:444/a.jpg",
            "file:///image.jpg",
        ] {
            assert!(artwork_url(Some(url)).is_none(), "{url}");
        }
    }

    #[test]
    fn catalog_search_publishes_one_deduplicated_validated_list() {
        let _http = HTTP.lock().unwrap();
        let (base, server) = provider_http::tests::server(vec![(
            "200 OK",
            format!(
                r#"{{"results":[{CATALOG_SONG},{CATALOG_SONG},{{"trackId":"bad"}},{{"kind":"song","trackId":7,"trackName":"Missing artist","trackTimeMillis":1000}}]}}"#
            ),
        )]);
        let tracks = runtime()
            .block_on(search_catalog_from(&base, " கூட ", Some(99)))
            .unwrap();
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].id, "itunes:42");
        let requests = server.join().unwrap();
        assert_eq!(requests.len(), 1);
        assert!(requests[0].contains("country=IN"));
        assert!(requests[0].contains("limit=30"));
    }

    #[test]
    fn catalog_search_falls_back_only_when_no_valid_songs_exist() {
        let _http = HTTP.lock().unwrap();
        let (base, server) = provider_http::tests::server(vec![
            ("200 OK", r#"{"results":[{"kind":"podcast"}]}"#.into()),
            ("200 OK", format!(r#"{{"results":[{CATALOG_SONG}]}}"#)),
        ]);
        assert_eq!(
            runtime()
                .block_on(search_catalog_from(&base, "Song & artist", Some(0)))
                .unwrap()
                .len(),
            1
        );
        let requests = server.join().unwrap();
        assert!(requests[0].contains("country=IN"));
        assert!(requests[1].contains("country=US"));
        assert!(requests[0].contains("term=Song+%26+artist"));
        assert!(requests[0].contains("limit=1"));
    }

    #[test]
    fn catalog_lookup_preserves_exact_identity_across_storefronts() {
        let _http = HTTP.lock().unwrap();
        let wrong = CATALOG_SONG.replace("\"trackId\":42", "\"trackId\":43");
        let (base, server) = provider_http::tests::server(vec![
            ("200 OK", format!(r#"{{"results":[{wrong}]}}"#)),
            ("200 OK", format!(r#"{{"results":[{CATALOG_SONG}]}}"#)),
        ]);
        assert_eq!(
            runtime()
                .block_on(lookup_catalog_from(&base, "itunes:42"))
                .unwrap()
                .id,
            "itunes:42"
        );
        for request in server.join().unwrap() {
            assert!(request.contains("id=42"));
            assert!(!request.contains("term="));
        }
        let (base, server) = provider_http::tests::server(vec![
            ("200 OK", format!(r#"{{"results":[{wrong}]}}"#)),
            ("200 OK", format!(r#"{{"results":[{wrong}]}}"#)),
        ]);
        assert!(runtime()
            .block_on(lookup_catalog_from(&base, "itunes:42"))
            .is_err());
        assert_eq!(server.join().unwrap().len(), 2);
    }

    #[test]
    fn catalog_rejects_invalid_inputs_and_surfaces_provider_errors() {
        let runtime = runtime();
        for query in ["".into(), " ".into(), "a".repeat(201), "a\nb".into()] {
            assert!(runtime
                .block_on(search_catalog_from("invalid", &query, None))
                .is_err());
        }
        for id in [
            "itunes:0",
            "itunes:-1",
            "itunes:1.0",
            "itunes:01",
            "itunes:+1",
            "other:42",
            "itunes:18446744073709551616",
        ] {
            assert!(runtime
                .block_on(lookup_catalog_from("invalid", id))
                .is_err());
        }
        let _http = HTTP.lock().unwrap();
        for (status, body) in [
            ("503 Service Unavailable", "{}"),
            ("200 OK", "invalid JSON"),
        ] {
            let (base, server) = provider_http::tests::server(vec![(status, body.into())]);
            assert!(runtime
                .block_on(search_catalog_from(&base, "Song", None))
                .is_err());
            assert_eq!(server.join().unwrap().len(), 1);
        }
    }
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
        let _http = HTTP.lock().unwrap();
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
    #[test]
    fn itunes_artwork_url_upgrades_to_high_resolution() {
        let _http = HTTP.lock().unwrap();
        let (base, _server) = provider_http::tests::server(vec![("200 OK", r#"{"results":[{"kind":"song","trackId":101,"trackName":"Boom Shaka","artistName":"Indie Artist","collectionName":"Single","trackTimeMillis":218000,"artworkUrl100":"https://is1-ssl.mzstatic.com/image/thumb/Music/100x100bb.jpg"}]}"#.into())]);
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let metadata = runtime
            .block_on(lookup_from(&base, "Boom Shaka", "Indie Artist", 218.0))
            .unwrap()
            .unwrap();
        assert_eq!(
            metadata.artwork_url.as_deref(),
            Some("https://is1-ssl.mzstatic.com/image/thumb/Music/600x600bb.jpg")
        );
    }
}


use crate::catalog::{AlbumDetails, ArtistDetails, CatalogAlbum, CatalogArtist};

pub async fn lookup_artist(id: String) -> Result<ArtistDetails, String> {
    let artist_id = id
        .strip_prefix("itunes:")
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value > 0 && id == format!("itunes:{value}"))
        .ok_or("Invalid Apple catalog artist ID.")?;

    let songs = request(
        "https://itunes.apple.com/lookup",
        &[
            ("id", artist_id.to_string()),
            ("entity", "song,album".into()),
            ("limit", "25".into()),
        ],
    )
    .await?;

    let songs: Vec<_> = songs.into_iter().filter(|song| song.artist_id == Some(artist_id)).collect();
    let mut top_tracks = Vec::new();
    let mut albums_map = std::collections::HashMap::new();
    let mut artist_name = songs.iter().find_map(|song| song.artist_name.clone()).unwrap_or_default();
    let mut artist_artwork = None;

    for song in songs {
        if let Some(track) = catalog_track(song.clone()) {
            if artist_name.is_empty() {
                artist_name = track.artist.clone();
            }
            if artist_artwork.is_none() {
                artist_artwork = track.artwork_url.clone();
            }
            if top_tracks.len() < 10 {
                top_tracks.push(track.clone());
            }
            if let Some(album_id) = song.collection_id {
                albums_map.entry(album_id).or_insert_with(|| CatalogAlbum {
                    id: format!("itunes:{album_id}"),
                    title: song.collection_name.clone().unwrap_or_default(),
                    artist: track.artist.clone(),
                    artists: track.artists.clone(),
                    artwork_url: track.artwork_url.clone(),
                    year: song.release_date.as_deref()
                        .and_then(|date| date.split('-').next())
                        .and_then(|year| year.parse().ok()),
                    track_count: song.track_count,
                });
            }
        }
    }

    if artist_name.trim().is_empty() {
        return Err("This Apple catalog artist is unavailable.".into());
    }
    let mut albums: Vec<_> = albums_map.into_values().collect();
    albums.sort_by(|a, b| a.title.cmp(&b.title));
    Ok(ArtistDetails {
        info: CatalogArtist {
            id,
            name: artist_name,
            artwork_url: artist_artwork,
        },
        top_tracks,
        albums,
        similar_artists: Vec::new(),
    })
}

pub async fn lookup_album(id: String) -> Result<AlbumDetails, String> {
    let album_id = id
        .strip_prefix("itunes:")
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value > 0 && id == format!("itunes:{value}"))
        .ok_or("Invalid Apple catalog album ID.")?;

    let songs = request(
        "https://itunes.apple.com/lookup",
        &[
            ("id", album_id.to_string()),
            ("entity", "song".into()),
        ],
    )
    .await?;

    album_details(id, album_id, songs)
}

fn album_details(id: String, album_id: u64, mut songs: Vec<Song>) -> Result<AlbumDetails, String> {
    songs.retain(|song| song.collection_id == Some(album_id));
    songs.sort_by_key(|song| (song.disc_number.unwrap_or(1), song.track_number.unwrap_or(u32::MAX)));
    let mut seen = HashSet::new();
    let mut tracks = Vec::new();
    let mut album_title = String::new();
    let mut album_artist = String::new();
    let mut album_artwork = None;
    let mut album_year = None;

    for song in songs {
        if !seen.insert(song.track_id) { continue; }
        if let Some(track) = catalog_track(song.clone()) {
            if album_title.is_empty() {
                album_title = track.album.clone();
                album_artist = track.artist.clone();
                album_artwork = track.artwork_url.clone();
                album_year = song.release_date.as_deref()
                    .and_then(|date| date.split('-').next())
                    .and_then(|year| year.parse().ok());
            }
            tracks.push(track);
        }
    }

    if album_title.trim().is_empty() {
        return Err("This Apple catalog album has no available tracks.".into());
    }
    let artists = tracks.first().map(|track| track.artists.clone()).unwrap_or_default();

    Ok(AlbumDetails {
        info: CatalogAlbum {
            id,
            title: album_title,
            artist: album_artist,
            artists,
            artwork_url: album_artwork,
            year: album_year,
            track_count: Some(tracks.len() as u32),
        },
        tracks,
        partial: false,
    })
}

#[cfg(test)]
mod entity_tests {
    use super::*;

    #[test]
    fn apple_album_orders_by_disc_and_track_and_rejects_another_collection() {
        let row = |id, disc, number, album| serde_json::from_value(serde_json::json!({
            "kind":"song", "trackId":id, "artistId":7, "trackName":"Track", "artistName":"Artist",
            "collectionId":album, "collectionName":"Album", "trackTimeMillis":60000,
            "discNumber":disc, "trackNumber":number
        })).unwrap();
        let album = album_details("itunes:42".into(), 42, vec![row(1,2,1,42), row(99,1,2,42), row(8,1,1,42), row(8,1,1,42), row(9,1,1,5)]).unwrap();
        assert_eq!(album.tracks.iter().map(|track| track.id.as_str()).collect::<Vec<_>>(), ["itunes:8", "itunes:99", "itunes:1"]);
        assert_eq!(album.info.artists[0].id.as_deref(), Some("itunes:7"));
        assert!(album_details("itunes:42".into(), 42, vec![row(1,1,1,5)]).is_err());
    }
}
