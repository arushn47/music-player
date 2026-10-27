use crate::{err, Track};
use serde::Serialize;
use serde_json::{json, Value};
use std::time::Duration;

#[derive(Serialize)]
pub struct Entry { title: String, artist: String, album: String, duration: f64, track: Option<Track> }
#[derive(Serialize)]
pub struct Playlist { name: String, rows: Vec<Entry>, warning: String }

fn target(link: &str) -> Result<(String, String), String> {
    let url = reqwest::Url::parse(link.trim()).map_err(|_| "Paste a valid playlist link.")?;
    if link.len() > 2000 || url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() || url.port_or_known_default() != Some(443) { return Err("Use a public HTTPS playlist link.".into()); }
    match url.host_str().unwrap_or("") {
        "youtube.com" | "www.youtube.com" | "music.youtube.com" if matches!(url.path(), "/playlist" | "/watch") => {
            let id = url.query_pairs().find(|(key, _)| key == "list").map(|(_, value)| value.into_owned()).ok_or("This link needs a playlist ID.")?;
            if id.len() < 10 || id.len() > 100 || !id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-') { return Err("Invalid YouTube playlist ID.".into()); }
            Ok(("youtube".into(), format!("https://www.youtube.com/playlist?list={id}")))
        }
        "open.spotify.com" => {
            let parts: Vec<_> = url.path_segments().into_iter().flatten().collect();
            let index = parts.iter().position(|part| *part == "playlist").ok_or("Use a Spotify playlist link, not a song or album.")?;
            let id = parts.get(index + 1).filter(|id| id.len() == 22 && id.bytes().all(|c| c.is_ascii_alphanumeric())).ok_or("Invalid Spotify playlist ID.")?;
            Ok(("spotify".into(), format!("https://open.spotify.com/embed/playlist/{id}")))
        }
        "music.apple.com" => {
            let parts: Vec<_> = url.path_segments().into_iter().flatten().collect();
            if parts.len() < 3 || parts[0].len() != 2 || !parts[0].bytes().all(|c| c.is_ascii_alphabetic()) || parts[1] != "playlist" || !parts.last().is_some_and(|id| id.starts_with("pl.") && id.len() <= 100 && id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'.' || c == b'-')) { return Err("Use a public Apple Music playlist link.".into()); }
            let mut clean = url.clone(); clean.set_query(None); clean.set_fragment(None);
            Ok(("apple".into(), clean.to_string()))
        }
        _ => Err("Supported links: public YouTube, YouTube Music, Spotify and Apple Music playlists. Short links must be opened and copied as the full playlist URL.".into()),
    }
}

fn text(value: &Value) -> String { value.as_str().unwrap_or("").chars().filter(|c| !c.is_control()).take(1000).collect::<String>().trim().to_owned() }
fn catalog_track(id: &str, title: &str, artist: &str, album: &str, duration: f64, artwork: Option<String>) -> Option<Track> {
    let id = format!("itunes:{id}");
    let track: Track = serde_json::from_value(json!({"id":id,"metadataSourceId":id,"title":title,"artist":artist,"album":album,"duration":duration,"format":"catalog","fileName":"","missing":false,"artworkUrl":artwork})).ok()?;
    crate::collection_io::valid(&track).then_some(track)
}

fn parse_apple(data: &Value) -> Result<Playlist, String> {
    let sections = data["data"][0]["data"]["sections"].as_array().ok_or("Apple Music did not expose this playlist. It may be private or unavailable.")?;
    let mut result = Playlist { name: "Apple Music playlist".into(), rows: vec![], warning: String::new() };
    let mut total = None;
    for value in sections.iter().flat_map(|section| section["items"].as_array().into_iter().flatten()) {
        if value["id"].as_str().is_some_and(|id| id.starts_with("playlist-detail-header")) { result.name = text(&value["title"]); total = value["trackCount"].as_u64(); }
        if value["contentDescriptor"]["kind"] != "song" { continue; }
        let title = text(&value["title"]); let artist = text(&value["artistName"]);
        if title.is_empty() { continue; }
        let album = text(&value["tertiaryLinks"][0]["title"]);
        let duration = value["duration"].as_f64().unwrap_or(0.0) / 1000.0;
        let id = value["contentDescriptor"]["identifiers"]["storeAdamID"].as_str().unwrap_or("");
        let artwork = value["artwork"]["dictionary"]["url"].as_str().map(|url| url.replace("{w}", "300").replace("{h}", "300").replace("{f}", "webp"));
        result.rows.push(Entry { track: catalog_track(id, &title, &artist, &album, duration, artwork), title, artist, album, duration });
        if result.rows.len() == 500 { break; }
    }
    if total.is_some_and(|count| count as usize > result.rows.len()) { result.warning = format!("Apple Music exposed {} of {} tracks. This will be a partial import.", result.rows.len(), total.unwrap()); }
    finish(result)
}

fn parse_spotify(data: &Value) -> Result<Playlist, String> {
    let entity = &data["props"]["pageProps"]["state"]["data"]["entity"];
    let tracks = entity["trackList"].as_array().ok_or("Spotify did not expose the playlist's tracks without signing in. Try a public playlist or another service; no login or cookies will be requested.")?;
    let rows: Vec<_> = tracks.iter().take(500).filter_map(|value| {
        let title = text(&value["title"]);
        (!title.is_empty()).then(|| Entry { title, artist: text(&value["subtitle"]), album: String::new(), duration: value["duration"].as_f64().unwrap_or(0.0) / 1000.0, track: None })
    }).collect();
    let count = entity["trackCount"].as_u64();
    let warning = if count.is_some_and(|count| count as usize == rows.len()) { String::new() } else { "Spotify may expose only a preview. Review the track count before importing; the full playlist is not guaranteed.".into() };
    finish(Playlist { name: text(&entity["name"]), rows, warning })
}

fn finish(mut playlist: Playlist) -> Result<Playlist, String> {
    if playlist.rows.is_empty() { return Err("No public tracks were available. Private, removed and sign-in-only playlists cannot be imported without an account.".into()); }
    if playlist.name.is_empty() { playlist.name = "Imported playlist".into(); }
    Ok(playlist)
}

fn script_json(html: &str, id: &str) -> Result<Value, String> {
    let start = html.find(&format!("id=\"{id}\"")).ok_or("The service's public playlist format is unavailable. Retry later or use another service.")?;
    let after = &html[start..]; let after = after.split_once('>').ok_or("Invalid playlist page.")?.1;
    let script = after.split_once("</script>").ok_or("Incomplete playlist page.")?.0;
    serde_json::from_str(script).map_err(|_| "The service returned invalid playlist data.".into())
}

fn parse_youtube(data: &Value) -> Result<Playlist, String> {
    let entries = data["entries"].as_array().ok_or("No public playlist entries were returned.")?;
    let mut rows = Vec::new(); let mut skipped = 0;
    for value in entries.iter().take(500) {
        let id = value["id"].as_str().unwrap_or(""); let title = text(&value["title"]);
        if id.len() != 11 || !id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-') || title.is_empty() || matches!(title.as_str(), "[Private video]" | "[Deleted video]") { skipped += 1; continue; }
        let artist = { let artist = text(&value["artist"]); if artist.is_empty() { text(&value["channel"]) } else { artist } };
        let duration = value["duration"].as_f64().filter(|v| v.is_finite() && (0.0..=86400.0).contains(v)).unwrap_or(0.0);
        let track = serde_json::from_value(json!({"id":format!("youtube:{id}"),"title":title,"artist":artist,"album":"","duration":duration,"format":"YouTube","fileName":"","missing":false,"artworkUrl":format!("https://i.ytimg.com/vi/{id}/hqdefault.jpg"),"source":{"providerId":"youtube","sourceId":id,"pageUrl":format!("https://www.youtube.com/watch?v={id}"),"license":"YouTube","licenseUrl":"https://www.youtube.com/t/terms","attribution":artist}})).map_err(err)?;
        rows.push(Entry { title, artist, album: String::new(), duration, track: Some(track) });
    }
    finish(Playlist { name: text(&data["title"]), rows, warning: if entries.len() > 500 || skipped > 0 { format!("Imported at most 500 entries; {skipped} private, deleted or invalid entries were skipped. Review the track count.") } else { String::new() } })
}

#[tauri::command]
pub async fn read_playlist_link(_app: tauri::AppHandle, link: String) -> Result<Playlist, String> {
    let (provider, url) = target(&link)?;
    if provider == "youtube" {
        #[cfg(target_os = "android")]
        {
            let data = crate::android::call(&_app, "resolveSource", json!({"operation":"playlist", "url":url})).await?;
            if data.to_string().len() > 8_000_000 { return Err("Playlist metadata exceeds 8 MB. Use a smaller playlist.".into()); }
            return parse_youtube(&data);
        }
        #[cfg(not(target_os = "android"))]
        return tauri::async_runtime::spawn_blocking(move || {
            let output = crate::ytdlp::run_ytdlp(&["--ignore-config", "--no-warnings", "--flat-playlist", "--skip-download", "--playlist-end", "501", "--dump-single-json", "--socket-timeout", "10", "--", &url])?;
            if output.len() > 8_000_000 { return Err("Playlist metadata exceeds 8 MB. Use a smaller playlist.".into()); }
            let data: Value = serde_json::from_str(&output).map_err(err)?;
            parse_youtube(&data)
        }).await.map_err(err)?;
    }
    let client = reqwest::Client::builder().user_agent("Mozilla/5.0 (compatible; Lumaire playlist import)")
        .redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(25)).build().map_err(err)?;
    let mut response = client.get(url).send().await.map_err(|_| "Could not reach the playlist service. Check your connection and retry.")?;
    if !response.status().is_success() { return Err(format!("The playlist service refused access (HTTP {}). Use a public full playlist link.", response.status().as_u16())); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(err)? { if bytes.len() + chunk.len() > 6_000_000 { return Err("Playlist page exceeds 6 MB. Use a smaller playlist.".into()); } bytes.extend(chunk); }
    let html = String::from_utf8(bytes).map_err(err)?;
    if provider == "apple" { parse_apple(&script_json(&html, "serialized-server-data")?) } else { parse_spotify(&script_json(&html, "__NEXT_DATA__")?) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_only_fixed_public_playlist_hosts_and_canonicalizes_tracking_urls() {
        assert_eq!(target("https://music.youtube.com/playlist?list=PLabcdefghijk&si=tracking").unwrap().1, "https://www.youtube.com/playlist?list=PLabcdefghijk");
        for url in ["http://127.0.0.1/playlist", "https://youtube.com.evil.test/playlist?list=PLabcdefghijk", "https://user@youtube.com/playlist?list=PLabcdefghijk", "https://open.spotify.com/track/123", "https://music.apple.com/us/album/123"] { assert!(target(url).is_err()); }
    }
    #[test]
    fn reads_ordered_apple_ids_and_reports_partial_public_pages() {
        let data = json!({"data":[{"data":{"sections":[{"items":[{"id":"playlist-detail-header - pl.test","title":"Mix","trackCount":3}]},{"items":[{"title":"Song","artistName":"Singer","duration":123000,"contentDescriptor":{"kind":"song","identifiers":{"storeAdamID":"123"}}}]}]}}]});
        let list = parse_apple(&data).unwrap(); assert_eq!(list.name, "Mix"); assert_eq!(list.rows[0].track.as_ref().unwrap().id, "itunes:123"); assert!(list.warning.contains("partial"));
        assert!(parse_spotify(&json!({"props":{"pageProps":{"status":500}}})).is_err());
    }
    #[test]
    fn youtube_preserves_video_identity_and_discloses_skipped_private_entries() {
        let list = parse_youtube(&json!({"title":"Mix","entries":[{"id":"abcdefghijk","title":"Song","artist":"Singer","duration":120},{"id":"12345678901","title":"[Private video]"},{"id":"bad/path","title":"Unsafe"}]})).unwrap();
        assert_eq!(list.rows.len(), 1);
        let track = list.rows[0].track.as_ref().unwrap();
        assert_eq!(track.id, "youtube:abcdefghijk"); assert_eq!(track.source.as_ref().unwrap().source_id, "abcdefghijk"); assert!(list.warning.contains("2 private"));
    }
    #[test]
    fn spotify_reads_public_credits_and_never_claims_unknown_completeness() {
        let list = parse_spotify(&json!({"props":{"pageProps":{"state":{"data":{"entity":{"name":"Mix","trackList":[{"title":"Song","subtitle":"Singer, Guest","duration":120000}]}}}}}})).unwrap();
        assert_eq!(list.rows[0].artist, "Singer, Guest"); assert_eq!(list.rows[0].duration, 120.0); assert!(list.rows[0].track.is_none()); assert!(!list.warning.is_empty());
    }
}
