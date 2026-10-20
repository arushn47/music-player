//! Public music metadata only; playback remains a separate source resolution.
use crate::{
    itunes_metadata::{self, CatalogTrack},
    provider_http,
};
use serde_json::Value;
use std::collections::HashSet;

const BASE: &str = "https://www.jiosaavn.com/api.php";

fn valid_id(id: &str) -> bool {
    id.len() == 8
        && id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}

fn text(value: &str) -> String {
    let mut decoded = value.to_string();
    for (entity, replacement) in [
        ("&quot;", "\""),
        ("&#039;", "'"),
        ("&#39;", "'"),
        ("&#x27;", "'"),
        ("&apos;", "'"),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&nbsp;", " "),
        ("&amp;", "&"),
    ] {
        decoded = decoded.replace(entity, replacement);
    }
    decoded.trim().to_string()
}

fn name(value: &Value) -> Option<String> {
    let value = text(value.as_str()?);
    (!value.is_empty() && value.chars().count() <= 4000 && !value.chars().any(char::is_control))
        .then_some(value)
}

fn entity_id(value: &Value) -> Option<String> {
    let id = value
        .as_str()
        .map(str::to_owned)
        .or_else(|| value.as_u64().map(|id| id.to_string()))?;
    let number = id.parse::<u64>().ok().filter(|id| *id > 0)?;
    (id == number.to_string()).then_some(id)
}

fn artwork(value: &Value) -> Option<String> {
    let url = reqwest::Url::parse(value.as_str()?).ok()?;
    (url.scheme() == "https"
        && url.host_str() == Some("c.saavncdn.com")
        && url.username().is_empty()
        && url.password().is_none()
        && url.port_or_known_default() == Some(443))
    .then(|| url.as_str().replace("150x150", "500x500"))
}

fn credits(value: &Value) -> Vec<itunes_metadata::CatalogArtistCredit> {
    let mut seen = HashSet::new();
    ["primary_artists", "featured_artists"]
        .iter()
        .flat_map(|key| value[key].as_array().into_iter().flatten())
        .filter_map(|artist| {
            let name = name(&artist["name"])?;
            let id = entity_id(&artist["id"])
                .map(|id| format!("saavn:artist:{id}"))
                .unwrap_or_else(|| format!("saavn:artist:name:{}", urlencoding::encode(&name)));
            seen.insert(id.clone())
                .then_some(itunes_metadata::CatalogArtistCredit { name, id: Some(id) })
        })
        .collect()
}

fn same_name(left: &str, right: &str) -> bool {
    left.trim().to_lowercase() == right.trim().to_lowercase()
}

fn canonical_artist_lookup_name(value: &str) -> String {
    if value.eq_ignore_ascii_case("Emiway") || value.eq_ignore_ascii_case("Emiway Bantai") {
        "Emiway Bantai".into()
    } else {
        value.into()
    }
}

fn track(value: &Value) -> Option<CatalogTrack> {
    if value["type"].as_str()? != "song" {
        return None;
    }
    let id = value["id"].as_str().filter(|id| valid_id(id))?;
    let title = name(&value["title"])?;
    let info = &value["more_info"];
    let duration = info["duration"]
        .as_str()?
        .parse::<u32>()
        .ok()
        .filter(|seconds| (1..=86400).contains(seconds))?;
    let artists_credits = credits(&info["artistMap"]);

    if artists_credits.is_empty() {
        return None;
    }

    let artist_names: Vec<String> = artists_credits.iter().map(|a| a.name.clone()).collect();
    let artist_id = artists_credits.first().and_then(|a| a.id.clone());

    let album_id = entity_id(&info["album_id"]).map(|id| format!("saavn:album:{id}"));
    let artwork_url = artwork(&value["image"]);
    Some(CatalogTrack {
        id: format!("saavn:{id}"),
        title,
        artist: artist_names.join(", "),
        artist_id,
        artists: artists_credits,
        album: info["album"].as_str().map(text).unwrap_or_default(),
        album_id,
        duration: duration as f64,
        artwork_url,
    })
}

async fn request(base: &str, operation: &str, params: &[(&str, String)]) -> Result<Value, String> {
    // shortcut: this public metadata endpoint is undocumented, use Apple fallback if it changes.
    let mut query = vec![
        ("__call", operation.into()),
        ("_format", "json".into()),
        ("_marker", "0".into()),
        ("api_version", "4".into()),
        ("ctx", "web6dot0".into()),
    ];
    query.extend_from_slice(params);
    let response = provider_http::get(base, &query).await?;
    if !response.status().is_success() {
        return Err(format!(
            "Music catalog is unavailable (HTTP {}).",
            response.status()
        ));
    }
    response
        .json()
        .await
        .map_err(|_| "Invalid music catalog response.".into())
}

async fn search_from(base: &str, query: &str, limit: u32) -> Result<Vec<CatalogTrack>, String> {
    let response = request(
        base,
        "search.getResults",
        &[
            ("q", query.into()),
            ("n", limit.to_string()),
            ("p", "1".into()),
        ],
    )
    .await?;
    let rows = response["results"]
        .as_array()
        .ok_or("Invalid music catalog response.")?;
    let mut seen = HashSet::new();
    Ok(rows
        .iter()
        .filter_map(track)
        .filter(|track| seen.insert(track.id.clone()))
        .take(limit as usize)
        .collect())
}

#[tauri::command]
pub async fn search_catalog(
    query: String,
    limit: Option<u32>,
) -> Result<Vec<CatalogTrack>, String> {
    let query = query.trim();
    if !(1..=200).contains(&query.chars().count()) || query.chars().any(char::is_control) {
        return Err("Enter a catalog search between 1 and 200 characters.".into());
    }
    let limit = limit.unwrap_or(20).clamp(1, 30);
    match search_from(BASE, query, limit).await {
        Ok(tracks) if !tracks.is_empty() => Ok(tracks),
        _ => itunes_metadata::search_catalog(query.to_string(), Some(limit)).await,
    }
}

async fn lookup_from(base: &str, id: &str) -> Result<CatalogTrack, String> {
    let source = id
        .strip_prefix("saavn:")
        .filter(|id| valid_id(id))
        .ok_or("Invalid music catalog track ID.")?;
    let response = request(base, "song.getDetails", &[("pids", source.into())]).await?;
    response["songs"]
        .as_array()
        .ok_or("Invalid music catalog response.")?
        .iter()
        .filter_map(track)
        .find(|track| track.id == id)
        .ok_or_else(|| "This music catalog track is unavailable.".into())
}

#[tauri::command]
pub async fn lookup_catalog(id: String) -> Result<CatalogTrack, String> {
    if id.starts_with("itunes:") {
        return itunes_metadata::lookup_catalog(id).await;
    }
    lookup_from(BASE, &id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    fn song() -> Value {
        serde_json::json!({"id":"QAbmbZ7O","type":"song","title":"Sensitive &amp; &#039;Sure&#039;",
        "image":"https://c.saavncdn.com/517/album-150x150.jpg", "more_info":{
            "duration":"224", "album":"Yours &quot;Truly&quot;", "artistMap":{"primary_artists":[{"name":"KR$NA"},{"name":"Seedhe Maut"},{"name":"Hurricane"}]}
        }})
    }
    fn runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
    }
    #[test]
    fn catalog_metadata_preserves_credits_and_decodes_entities_without_media() {
        let catalog = track(&song()).unwrap();
        assert_eq!(catalog.id, "saavn:QAbmbZ7O");
        assert_eq!(catalog.title, "Sensitive & 'Sure'");
        assert_eq!(catalog.artist, "KR$NA, Seedhe Maut, Hurricane");
        assert_eq!(catalog.album, "Yours \"Truly\"");
        assert_eq!(catalog.duration, 224.0);
        assert_eq!(
            catalog.artwork_url.as_deref(),
            Some("https://c.saavncdn.com/517/album-500x500.jpg")
        );
        // Verify artist and album IDs are extracted when present
        let mut full_song = song();
        full_song["more_info"]["artistMap"]["primary_artists"][0]["id"] =
            serde_json::json!("123456");
        full_song["more_info"]["album_id"] = serde_json::json!("789012");
        let full_catalog = track(&full_song).unwrap();
        assert_eq!(
            full_catalog.artist_id.as_deref(),
            Some("saavn:artist:123456")
        );
        assert_eq!(full_catalog.album_id.as_deref(), Some("saavn:album:789012"));

        for id in ["", "short", "QAbmbZ7O?", "QAbmbZ7/", "１２３４５６７８"] {
            assert!(!valid_id(id));
        }
        for (key, value) in [
            ("id", serde_json::json!(42)),
            ("type", serde_json::json!("album")),
            ("title", serde_json::json!(" ")),
        ] {
            let mut row = song();
            row[key] = value;
            assert!(track(&row).is_none());
        }
        for value in [
            serde_json::json!(0),
            serde_json::json!("0"),
            serde_json::json!("86401"),
            serde_json::json!("NaN"),
            Value::Null,
        ] {
            let mut row = song();
            row["more_info"]["duration"] = value;
            assert!(track(&row).is_none());
        }
        let mut row = song();
        row["more_info"]["artistMap"]["primary_artists"] = serde_json::json!([]);
        assert!(track(&row).is_none());
        for url in [
            "http://c.saavncdn.com/a",
            "https://c.saavncdn.com.evil.test/a",
            "https://user@c.saavncdn.com/a",
            "https://c.saavncdn.com:444/a",
        ] {
            let mut row = song();
            row["image"] = url.into();
            assert!(track(&row).unwrap().artwork_url.is_none());
        }
    }
    #[test]
    fn actual_catalog_search_validates_deduplicates_and_bounds_one_list() {
        let response = serde_json::json!({"results":[song(), song(), {"id":"bad"}]}).to_string();
        let (base, server) = provider_http::tests::server(vec![("200 OK", response)]);
        let tracks = runtime()
            .block_on(search_from(&base, "Sensitive KR$NA", 20))
            .unwrap();
        assert_eq!(tracks.len(), 1);
        let requests = server.join().unwrap();
        assert_eq!(requests.len(), 1);
        assert!(requests[0].contains("__call=search.getResults"));
        assert!(requests[0].contains("q=Sensitive+KR%24NA"));
        assert!(requests[0].contains("n=20"));
    }
    #[test]
    fn exact_lookup_uses_only_selected_id_and_rejects_replacements() {
        let runtime = runtime();
        for (returned, success) in [("QAbmbZ7O", true), ("other123", false)] {
            let mut row = song();
            row["id"] = returned.into();
            let (base, server) = provider_http::tests::server(vec![(
                "200 OK",
                serde_json::json!({"songs":[row]}).to_string(),
            )]);
            let result = runtime.block_on(lookup_from(&base, "saavn:QAbmbZ7O"));
            assert_eq!(result.is_ok(), success);
            let requests = server.join().unwrap();
            assert!(requests[0].contains("pids=QAbmbZ7O"));
            assert!(requests[0].contains("__call=song.getDetails"));
            assert!(!requests[0].contains("q="));
        }
        assert!(runtime
            .block_on(lookup_from("invalid", "saavn:../file"))
            .is_err());
    }
    #[test]
    fn catalog_inputs_and_provider_failures_remain_errors() {
        let runtime = runtime();
        for query in ["".to_string(), "a".repeat(201), "a\nb".to_string()] {
            assert!(runtime.block_on(search_catalog(query, None)).is_err());
        }
        for (status, body) in [
            ("503 Service Unavailable", "{}"),
            ("200 OK", "not json"),
            ("200 OK", "{}"),
        ] {
            let (base, server) = provider_http::tests::server(vec![(status, body.into())]);
            assert!(runtime.block_on(search_from(&base, "Song", 20)).is_err());
            assert_eq!(server.join().unwrap().len(), 1);
        }
    }

    fn album_response() -> Value {
        let mut row = song();
        row["more_info"]["album_id"] = "42".into();
        serde_json::json!({"id":"42", "title":"Yours Truly", "type":"album", "year":"2025",
            "more_info":{"artistMap":{"primary_artists":[{"id":"123456", "name":"KR$NA"}]}},
            "list":[row.clone(), row]})
    }

    #[test]
    fn album_uses_real_nested_credits_and_list_without_optional_metadata() {
        let mut response = album_response();
        let album = album_details("42", &response).unwrap();
        assert_eq!(album.info.artist, "KR$NA");
        assert_eq!(
            album.info.artists[0].id.as_deref(),
            Some("saavn:artist:123456")
        );
        assert_eq!(album.info.year, Some(2025));
        assert_eq!(album.tracks.len(), 1);
        assert_eq!(album.info.track_count, Some(1));
        assert!(!album.partial);
        assert_eq!(
            serde_json::to_value(&album).unwrap()["info"]["artworkUrl"],
            Value::Null
        );
        response["more_info"] = Value::Null;
        response["year"] = Value::Null;
        assert!(album_details("42", &response).is_ok());
        response["list"] = serde_json::json!([]);
        assert!(album_details("42", &response).unwrap().tracks.is_empty());
        response["list"] = Value::Null;
        assert!(album_details("42", &response).is_err());
    }

    #[test]
    fn album_preserves_provider_order_and_rejects_malformed_or_wrong_tracks() {
        let mut response = album_response();
        response["list"][1]["id"] = "AAAAAAAA".into();
        let album = album_details("42", &response).unwrap();
        assert_eq!(
            album
                .tracks
                .iter()
                .map(|track| track.id.as_str())
                .collect::<Vec<_>>(),
            ["saavn:QAbmbZ7O", "saavn:AAAAAAAA"]
        );
        response["list"][1]["more_info"]["album_id"] = "99".into();
        assert!(album_details("42", &response).is_err());
        response["list"][1] = serde_json::json!({"id":"broken"});
        assert!(album_details("42", &response).is_err());
        assert!(album_details("99", &album_response()).is_err());
    }

    #[test]
    fn artist_filters_exact_identity_and_associated_releases_without_requiring_portrait() {
        let mut row = song();
        row["more_info"]["artistMap"]["primary_artists"][0]["id"] = "123456".into();
        row["more_info"]["album_id"] = "42".into();
        let mut unrelated = row.clone();
        unrelated["id"] = "AAAAAAAA".into();
        unrelated["more_info"]["artistMap"]["primary_artists"][0] =
            serde_json::json!({"id":"9", "name":"KR$NA Tribute"});
        let response = serde_json::json!({"artistId":"123456", "name":"KR$NA", "topSongs":[row.clone(), row, unrelated],
            "topAlbums":[{"id":"99", "title":"Unrelated", "more_info":{"artistMap":{"primary_artists":[{"id":"9", "name":"Other"}]}}}],
            "singles":[{"id":"42", "title":"Yours Truly", "year":"2025", "more_info":{"song_count":"15", "artistMap":{"primary_artists":[{"id":"123456", "name":"KR$NA"}]}}}]});
        let artist = artist_details("123456", &response).unwrap();
        assert_eq!(artist.top_tracks.len(), 1);
        assert_eq!(artist.albums.len(), 1);
        assert_eq!(artist.albums[0].year, Some(2025));
        assert!(artist.info.artwork_url.is_none());
        assert!(artist_details("9", &response).is_err());
        assert!(!same_name("KR$NA", "KR$NA Tribute"));
        assert!(!same_name("KR$NA", "NA"));
    }

    #[test]
    fn legacy_emiway_links_use_the_full_artist_credit() {
        assert_eq!(canonical_artist_lookup_name("Emiway"), "Emiway Bantai");
        assert_eq!(canonical_artist_lookup_name("EMIWAY BANTAI"), "Emiway Bantai");
        assert_eq!(canonical_artist_lookup_name("Emiway Tribute"), "Emiway Tribute");
    }

    #[test]
    fn numeric_and_legacy_artist_links_use_the_correct_provider_operation() {
        let runtime = runtime();
        let response = serde_json::json!({"artistId":"123456", "name":"KR$NA"}).to_string();
        let (base, server) = provider_http::tests::server(vec![("200 OK", response.clone())]);
        let artist = runtime
            .block_on(lookup_saavn_artist(&base, "saavn:artist:123456"))
            .unwrap();
        assert_eq!(artist.info.id, "saavn:artist:123456");
        let requests = server.join().unwrap();
        assert!(requests[0].contains("__call=artist.getArtistPageDetails"));
        assert!(requests[0].contains("artistId=123456"));
        let mut row = song();
        row["more_info"]["artistMap"]["primary_artists"][0]["id"] = "123456".into();
        let (base, server) = provider_http::tests::server(vec![
            ("200 OK", serde_json::json!({"results":[row]}).to_string()),
            ("200 OK", response),
        ]);
        assert!(runtime
            .block_on(lookup_saavn_artist(&base, "saavn:artist:KR%24NA"))
            .is_ok());
        assert_eq!(server.join().unwrap().len(), 2);
    }

    #[test]
    fn album_search_matches_title_and_credit_then_opens_the_full_release() {
        let runtime = runtime();
        let mut row = song();
        row["more_info"]["album"] = "Yours Truly".into();
        row["more_info"]["album_id"] = "42".into();
        let mut wrong = row.clone();
        wrong["id"] = "AAAAAAAA".into();
        wrong["more_info"]["artistMap"]["primary_artists"] = serde_json::json!([{"name":"Other"}]);
        let (base, server) = provider_http::tests::server(vec![
            (
                "200 OK",
                serde_json::json!({"results":[wrong, row]}).to_string(),
            ),
            ("200 OK", album_response().to_string()),
        ]);
        let album = runtime
            .block_on(lookup_saavn_album(
                &base,
                "saavn:album:search:KR%24NA:Yours%20Truly",
            ))
            .unwrap();
        assert_eq!(album.info.id, "saavn:album:42");
        assert!(!album.partial);
        assert_eq!(server.join().unwrap().len(), 2);
        for id in [
            "spotify:42",
            "saavn:album:0",
            "saavn:album:../file",
            "saavn:album:unknown:Yours Truly",
            "saavn:album:search::",
        ] {
            assert!(runtime.block_on(lookup_saavn_album("invalid", id)).is_err());
        }
    }

    #[test]
    fn entity_search_returns_provider_ids_deduplicates_and_keeps_partial_success() {
        let artist = serde_json::json!({"id":"123456", "name":"Artist", "type":"artist"});
        let (base, server) = provider_http::tests::server(vec![
            ("200 OK", serde_json::json!({"results":[artist.clone(), artist, {"id":"bad", "name":"Invalid", "type":"artist"}]}).to_string()),
            ("200 OK", serde_json::json!({"results":[album_response()]}).to_string()),
        ]);
        let entities = runtime()
            .block_on(search_entities_from(&base, "Artist"))
            .unwrap();
        assert_eq!(entities.artists.len(), 1);
        assert_eq!(entities.artists[0].id, "saavn:artist:123456");
        assert_eq!(entities.albums[0].id, "saavn:album:42");
        assert!(entities.warning.is_none());
        let requests = server.join().unwrap();
        assert!(requests[0].contains("search.getArtistResults"));
        assert!(requests[1].contains("search.getAlbumResults"));
        let (base, server) = provider_http::tests::server(vec![
            ("200 OK", "{}".into()),
            (
                "200 OK",
                serde_json::json!({"results":[album_response()]}).to_string(),
            ),
        ]);
        let entities = runtime()
            .block_on(search_entities_from(&base, "Album"))
            .unwrap();
        assert!(entities.artists.is_empty());
        assert_eq!(entities.albums.len(), 1);
        assert!(entities.warning.is_some());
        assert_eq!(server.join().unwrap().len(), 2);
    }

    #[test]
    fn album_search_labels_partial_results_and_rejects_ambiguous_releases() {
        let mut row = song();
        row["more_info"]["album"] = "Yours Truly".into();
        let (base, server) = provider_http::tests::server(vec![(
            "200 OK",
            serde_json::json!({"results":[row.clone()]}).to_string(),
        )]);
        let album = runtime()
            .block_on(lookup_saavn_album_by_search(&base, "KR$NA", "Yours Truly"))
            .unwrap();
        assert!(album.partial);
        assert_eq!(album.info.id, "saavn:album:search:KR%24NA:Yours%20Truly");
        assert_eq!(server.join().unwrap().len(), 1);
        row["more_info"]["album_id"] = "42".into();
        let mut another = row.clone();
        another["id"] = "AAAAAAAA".into();
        another["more_info"]["album_id"] = "99".into();
        let (base, server) = provider_http::tests::server(vec![(
            "200 OK",
            serde_json::json!({"results":[row,another]}).to_string(),
        )]);
        assert!(runtime()
            .block_on(lookup_saavn_album_by_search(&base, "KR$NA", "Yours Truly"))
            .is_err());
        assert_eq!(server.join().unwrap().len(), 1);
        assert!(runtime()
            .block_on(lookup_saavn_artist("invalid", "saavn:artist:0"))
            .is_err());
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogArtist {
    pub id: String,
    pub name: String,
    pub artwork_url: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogAlbum {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub artists: Vec<itunes_metadata::CatalogArtistCredit>,
    pub artwork_url: Option<String>,
    pub year: Option<u32>,
    pub track_count: Option<u32>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistDetails {
    pub info: CatalogArtist,
    pub top_tracks: Vec<CatalogTrack>,
    pub albums: Vec<CatalogAlbum>,
    pub similar_artists: Vec<CatalogArtist>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumDetails {
    pub info: CatalogAlbum,
    pub tracks: Vec<CatalogTrack>,
    pub partial: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntities {
    pub artists: Vec<CatalogArtist>,
    pub albums: Vec<CatalogAlbum>,
    pub warning: Option<String>,
}

fn artist_summary(row: &Value) -> Option<CatalogArtist> {
    if row["type"].as_str()? != "artist" {
        return None;
    }
    Some(CatalogArtist {
        id: format!("saavn:artist:{}", entity_id(&row["id"])?),
        name: name(&row["name"])?,
        artwork_url: artwork(&row["image"]),
    })
}

fn album_summary(row: &Value) -> Option<CatalogAlbum> {
    if row["type"].as_str()? != "album" {
        return None;
    }
    let artists = credits(&row["more_info"]["artistMap"]);
    Some(CatalogAlbum {
        id: format!("saavn:album:{}", entity_id(&row["id"])?),
        title: name(&row["title"])?,
        artist: artists
            .iter()
            .map(|a| a.name.as_str())
            .collect::<Vec<_>>()
            .join(", "),
        artists,
        artwork_url: artwork(&row["image"]),
        year: positive_number(&row["year"]),
        track_count: positive_number(&row["more_info"]["song_count"]),
    })
}

#[tauri::command]
pub async fn search_catalog_entities(query: String) -> Result<CatalogEntities, String> {
    let query = query.trim();
    if !(1..=200).contains(&query.chars().count()) || query.chars().any(char::is_control) {
        return Err("Enter a catalog search between 1 and 200 characters.".into());
    }
    search_entities_from(BASE, query).await
}

async fn search_entities_from(base: &str, query: &str) -> Result<CatalogEntities, String> {
    let params = [("q", query.into()), ("n", "6".into()), ("p", "1".into())];
    let artists = request(base, "search.getArtistResults", &params).await;
    let albums = request(base, "search.getAlbumResults", &params).await;
    let rows = |response: Result<Value, String>| -> Result<Vec<Value>, String> {
        response?["results"]
            .as_array()
            .cloned()
            .ok_or("The catalog search response has no results list.".into())
    };
    let artists = rows(artists);
    let albums = rows(albums);
    if artists.is_err() && albums.is_err() {
        return Err("Artist and album search is unavailable. Please retry.".into());
    }
    let warning = if artists.is_err() {
        Some("Artist results are unavailable. Please retry.".into())
    } else if albums.is_err() {
        Some("Album results are unavailable. Please retry.".into())
    } else {
        None
    };
    let mut seen = HashSet::new();
    let artists = artists
        .unwrap_or_default()
        .iter()
        .filter_map(artist_summary)
        .filter(|a| seen.insert(a.id.clone()))
        .take(6)
        .collect();
    let mut seen = HashSet::new();
    let albums = albums
        .unwrap_or_default()
        .iter()
        .filter_map(album_summary)
        .filter(|a| seen.insert(a.id.clone()))
        .take(6)
        .collect();
    Ok(CatalogEntities {
        artists,
        albums,
        warning,
    })
}

fn lookup_name(encoded: &str) -> Result<String, String> {
    let decoded = urlencoding::decode(encoded).map_err(|_| "Invalid catalog name encoding.")?;
    let value = decoded.trim();
    if !(1..=200).contains(&value.chars().count()) || value.chars().any(char::is_control) {
        return Err("Catalog names must contain between 1 and 200 characters.".into());
    }
    Ok(value.to_string())
}

fn album_reference(track: &CatalogTrack, artist: &str) -> String {
    track.album_id.clone().unwrap_or_else(|| {
        format!(
            "saavn:album:search:{}:{}",
            urlencoding::encode(artist),
            urlencoding::encode(&track.album)
        )
    })
}

fn track_albums(tracks: &[CatalogTrack], artist: &str) -> Vec<CatalogAlbum> {
    let mut seen = HashSet::new();
    tracks
        .iter()
        .filter(|track| !track.album.is_empty())
        .filter_map(|track| {
            let id = album_reference(track, artist);
            seen.insert(id.clone()).then(|| CatalogAlbum {
                id,
                title: track.album.clone(),
                artist: track.artist.clone(),
                artists: track.artists.clone(),
                artwork_url: track.artwork_url.clone(),
                year: None,
                track_count: None,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn lookup_artist(id: String) -> Result<ArtistDetails, String> {
    if id.starts_with("itunes:") {
        return itunes_metadata::lookup_artist(id).await;
    }
    lookup_saavn_artist(BASE, &id).await
}

async fn lookup_saavn_artist(base: &str, id: &str) -> Result<ArtistDetails, String> {
    let source = id
        .strip_prefix("saavn:artist:")
        .ok_or("Unsupported artist ID. Reopen the artist from Discover.")?;
    if let Some(number) = entity_id(&Value::String(source.into())) {
        let response = request(
            base,
            "artist.getArtistPageDetails",
            &[("artistId", number.clone())],
        )
        .await?;
        return artist_details(&number, &response);
    }
    if !source.is_empty() && source.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err("Invalid Saavn artist ID. Reopen the artist from Discover.".into());
    }
    // Legacy links encoded names without a name: tag; numeric links remain provider IDs.
    let artist_name = lookup_name(source.strip_prefix("name:").unwrap_or(source))?;
    let artist_name = canonical_artist_lookup_name(&artist_name);
    let tracks: Vec<_> = search_from(base, &artist_name, 30)
        .await?
        .into_iter()
        .filter(|track| {
            track
                .artists
                .iter()
                .any(|credit| same_name(&credit.name, &artist_name))
        })
        .collect();
    if tracks.is_empty() {
        return Err(format!(
            "No catalog tracks credit the artist '{artist_name}'."
        ));
    }
    if let Some(source) = tracks
        .iter()
        .flat_map(|track| &track.artists)
        .filter(|credit| same_name(&credit.name, &artist_name))
        .filter_map(|credit| credit.id.as_deref()?.strip_prefix("saavn:artist:"))
        .find_map(|source| entity_id(&Value::String(source.into())))
    {
        let response = request(
            base,
            "artist.getArtistPageDetails",
            &[("artistId", source.clone())],
        )
        .await?;
        return artist_details(&source, &response);
    }
    let albums = track_albums(&tracks, &artist_name);
    Ok(ArtistDetails {
        info: CatalogArtist {
            id: format!("saavn:artist:name:{}", urlencoding::encode(&artist_name)),
            name: artist_name,
            artwork_url: None,
        },
        top_tracks: tracks.into_iter().take(10).collect(),
        albums,
        similar_artists: vec![],
    })
}

fn artist_details(source: &str, response: &Value) -> Result<ArtistDetails, String> {
    if entity_id(&response["artistId"]).as_deref() != Some(source) {
        return Err("This catalog artist is unavailable or returned a different artist.".into());
    }
    let artist_name = name(&response["name"]).ok_or("The catalog artist response has no name.")?;
    let id = format!("saavn:artist:{source}");
    let mut seen = HashSet::new();
    let top_tracks: Vec<_> = response["topSongs"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(track)
        .filter(|track| {
            track
                .artists
                .iter()
                .any(|credit| credit.id.as_deref() == Some(&id))
        })
        .filter(|track| seen.insert(track.id.clone()))
        .take(10)
        .collect();
    let mut albums = track_albums(&top_tracks, &artist_name);
    let mut seen: HashSet<_> = albums.iter().map(|album| album.id.clone()).collect();
    for row in ["topAlbums", "singles", "latest_release"]
        .iter()
        .flat_map(|key| response[key].as_array().into_iter().flatten())
    {
        let artists = credits(&row["more_info"]["artistMap"]);
        if !artists
            .iter()
            .any(|credit| credit.id.as_deref() == Some(&id))
        {
            continue;
        }
        if let (Some(source), Some(title)) = (entity_id(&row["id"]), name(&row["title"])) {
            let id = format!("saavn:album:{source}");
            let album = CatalogAlbum {
                id: id.clone(),
                title,
                artist: artists
                    .iter()
                    .map(|a| a.name.as_str())
                    .collect::<Vec<_>>()
                    .join(", "),
                artists,
                artwork_url: artwork(&row["image"]),
                year: positive_number(&row["year"]),
                track_count: positive_number(&row["more_info"]["song_count"]),
            };
            if seen.insert(id.clone()) {
                albums.push(album);
            } else if let Some(existing) = albums.iter_mut().find(|album| album.id == id) {
                *existing = album;
            }
        }
    }
    Ok(ArtistDetails {
        info: CatalogArtist {
            id,
            name: artist_name,
            artwork_url: artwork(&response["image"]),
        },
        top_tracks,
        albums,
        similar_artists: response["similarArtists"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|row| {
                Some(CatalogArtist {
                    id: format!("saavn:artist:{}", entity_id(&row["id"])?),
                    name: name(&row["name"])?,
                    artwork_url: artwork(&row["image_url"]).or_else(|| artwork(&row["image"])),
                })
            })
            .take(5)
            .collect(),
    })
}

fn positive_number(value: &Value) -> Option<u32> {
    value
        .as_str()
        .and_then(|v| v.parse().ok())
        .or_else(|| value.as_u64().and_then(|v| u32::try_from(v).ok()))
        .filter(|v| *v > 0)
}

#[tauri::command]
pub async fn lookup_album(id: String) -> Result<AlbumDetails, String> {
    if id.starts_with("itunes:") {
        return itunes_metadata::lookup_album(id).await;
    }
    lookup_saavn_album(BASE, &id).await
}

async fn lookup_saavn_album(base: &str, id: &str) -> Result<AlbumDetails, String> {
    let source = id
        .strip_prefix("saavn:album:")
        .ok_or("Unsupported album ID. Reopen the album from Discover.")?;
    if let Some(search) = source.strip_prefix("search:") {
        let (artist, title) = search
            .split_once(':')
            .ok_or("The album search link is missing its credited artist or title.")?;
        return lookup_saavn_album_by_search(base, &lookup_name(artist)?, &lookup_name(title)?)
            .await;
    }
    if source.starts_with("unknown:") {
        return Err(
            "This older album link has no credited artist. Reopen the album from its artist page."
                .into(),
        );
    }
    let source = entity_id(&Value::String(source.into()))
        .ok_or("Invalid Saavn album ID. Reopen the album from Discover.")?;
    let response = request(
        base,
        "content.getAlbumDetails",
        &[("albumid", source.clone())],
    )
    .await?;
    album_details(&source, &response)
}

fn album_details(source: &str, response: &Value) -> Result<AlbumDetails, String> {
    if entity_id(&response["id"]).as_deref() != Some(source) {
        return Err("This catalog album is unavailable or returned a different album.".into());
    }
    let title = name(&response["title"]).ok_or("The catalog album response has no title.")?;
    let songs = response["list"]
        .as_array()
        .or_else(|| response["songs"].as_array())
        .ok_or("The catalog album response has no track list.")?;
    let id = format!("saavn:album:{source}");
    let mut seen = HashSet::new();
    let mut tracks = Vec::new();
    for row in songs {
        let mut track =
            track(row).ok_or("The catalog returned a malformed album track. Please retry.")?;
        if track
            .album_id
            .as_ref()
            .is_some_and(|album_id| album_id != &id)
        {
            return Err("The catalog returned tracks from a different album.".into());
        }
        track.album_id = Some(id.clone());
        if track.album.is_empty() {
            track.album = title.clone();
        }
        if seen.insert(track.id.clone()) {
            tracks.push(track);
        }
    }
    let mut artists = credits(&response["more_info"]["artistMap"]);
    if artists.is_empty() {
        let mut seen = HashSet::new();
        artists = tracks
            .iter()
            .flat_map(|track| track.artists.clone())
            .filter(|credit| seen.insert(credit.id.clone().unwrap_or_else(|| credit.name.clone())))
            .collect();
    }
    let artist = artists
        .iter()
        .map(|a| a.name.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    Ok(AlbumDetails {
        info: CatalogAlbum {
            id,
            title,
            artist,
            artists,
            artwork_url: artwork(&response["image"]),
            year: positive_number(&response["year"]),
            track_count: Some(tracks.len() as u32),
        },
        tracks,
        partial: false,
    })
}

async fn lookup_saavn_album_by_search(
    base: &str,
    artist: &str,
    title: &str,
) -> Result<AlbumDetails, String> {
    let tracks: Vec<_> = search_from(base, &format!("{title} {artist}"), 30)
        .await?
        .into_iter()
        .filter(|track| {
            same_name(&track.album, title)
                && track
                    .artists
                    .iter()
                    .any(|credit| same_name(&credit.name, artist))
        })
        .collect();
    let ids: HashSet<_> = tracks
        .iter()
        .filter_map(|track| track.album_id.as_deref())
        .collect();
    if ids.len() > 1 {
        return Err("Several releases match this album and artist. Open a result with a catalog album ID from Discover.".into());
    }
    if let Some(id) = ids.into_iter().next() {
        let source = id
            .strip_prefix("saavn:album:")
            .ok_or("Invalid search album ID.")?;
        let response = request(
            base,
            "content.getAlbumDetails",
            &[("albumid", source.into())],
        )
        .await?;
        let album = album_details(source, &response)?;
        if !same_name(&album.info.title, title)
            || !album.tracks.iter().any(|track| {
                track
                    .artists
                    .iter()
                    .any(|credit| same_name(&credit.name, artist))
            })
        {
            return Err("The resolved album does not match the requested title and artist.".into());
        }
        return Ok(album);
    }
    let first = tracks
        .first()
        .ok_or("No catalog tracks match both this album title and credited artist.")?;
    Ok(AlbumDetails {
        info: CatalogAlbum {
            id: album_reference(first, artist),
            title: title.into(),
            artist: first.artist.clone(),
            artists: first.artists.clone(),
            artwork_url: first.artwork_url.clone(),
            year: None,
            track_count: Some(tracks.len() as u32),
        },
        tracks,
        partial: true,
    })
}
