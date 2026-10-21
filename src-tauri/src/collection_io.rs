use crate::{err, work, AppHandle, Track};
use rusqlite::params;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use std::{fs::File, io::Read};

#[tauri::command]
pub async fn read_playlist_file() -> Result<Option<String>, String> {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    { return Err("Paste a CSV/TSV or extended M3U export on this device.".into()); }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    tauri::async_runtime::spawn_blocking(|| {
        let Some(path) = rfd::FileDialog::new().add_filter("Playlist export", &["csv", "tsv", "txt", "m3u", "m3u8"]).pick_file() else { return Ok(None) };
        let mut text = String::new();
        File::open(path).map_err(err)?.take(1_000_001).read_to_string(&mut text).map_err(err)?;
        if text.len() > 1_000_000 { return Err("Playlist export exceeds 1 MB.".into()) }
        Ok(Some(text))
    }).await.map_err(err)?
}

pub(crate) fn valid(track: &Track) -> bool {
    let id = track.id.as_str();
    let identity = id.strip_prefix("itunes:").is_some_and(|n| n.parse::<u64>().is_ok_and(|value| value > 0 && value.to_string() == n)) ||
        id.strip_prefix("saavn:").is_some_and(|n| n.len() == 8 && n.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-'));
    identity && track.metadata_source_id.as_deref() == Some(id) && track.format == "catalog" && track.source.is_none() &&
        !track.title.trim().is_empty() && [&track.title, &track.artist, &track.album].iter().all(|s| s.len() <= 4000) && track.duration.is_finite() && (0.0..=86400.0).contains(&track.duration)
}

#[tauri::command]
pub async fn save_catalog_tracks(app: AppHandle, tracks: Vec<Track>) -> Result<Vec<Track>, String> {
    if tracks.len() > 500 || tracks.iter().any(|t| !valid(t)) { return Err("Invalid imported catalog metadata (maximum 500 tracks).".into()) }
    work(app, move |_, db| {
        let tx = db.transaction().map_err(err)?;
        let mut saved = Vec::new();
        for mut track in tracks {
            track.file_name.clear(); track.missing = false; track.offline = false;
            track.artwork_url = track.artwork_url.filter(|s| s.len() <= 4000 && s.starts_with("https://"));
            tx.execute("INSERT OR IGNORE INTO tracks(id,path,metadata) VALUES(?1,NULL,?2)", params![track.id, serde_json::to_string(&track).map_err(err)?]).map_err(err)?;
            saved.push(track);
        }
        tx.commit().map_err(err)?;
        Ok(saved)
    }).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_paths_and_streams_as_catalog_entries() {
        let mut t: Track = serde_json::from_value(serde_json::json!({"id":"itunes:1","metadataSourceId":"itunes:1","title":"Song","artist":"Artist","album":"Album","duration":100,"fileName":"","format":"catalog","missing":false})).unwrap();
        assert!(valid(&t)); t.id = "C:/secret.mp3".into(); assert!(!valid(&t));
        t.id = "itunes:18446744073709551616".into(); assert!(!valid(&t));
    }
    #[test]
    fn imported_metadata_remains_playable_after_sqlite_reload_without_a_file_path() {
        let mut db = rusqlite::Connection::open_in_memory().unwrap(); crate::initialize(&mut db).unwrap();
        let metadata = serde_json::json!({"id":"itunes:1","metadataSourceId":"itunes:1","title":"Song","artist":"Artist","album":"Album","duration":100,"fileName":"","format":"catalog","missing":false});
        db.execute("INSERT INTO tracks(id,path,metadata) VALUES('itunes:1',NULL,?1)", [metadata.to_string()]).unwrap();
        let restored = crate::snapshot(&db).unwrap(); assert_eq!(restored.tracks.len(), 1); assert!(!restored.tracks[0].missing);
    }
}
