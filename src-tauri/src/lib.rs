use lofty::{
    file::{AudioFile, TaggedFileExt},
    prelude::Accessor,
    probe::Probe,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::Duration,
};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

mod ytdlp;

struct Store(Mutex<Connection>);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Track {
    id: String,
    title: String,
    artist: String,
    album: String,
    duration: f64,
    file_name: String,
    missing: bool,
    format: String,
    #[serde(default)]
    source: Option<RemoteSource>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteSource {
    provider_id: String,
    source_id: String,
    page_url: String,
    license: String,
    license_url: String,
    attribution: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoteTrack {
    id: String,
    title: String,
    artist: String,
    album: String,
    duration: f64,
    file_name: String,
    missing: bool,
    format: String,
    source: RemoteSource,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ResolvedMedia {
    url: String,
    mime_type: String,
}

#[derive(Serialize)]
struct Snapshot {
    tracks: Vec<Track>,
    session: Option<serde_json::Value>,
}
#[derive(Serialize)]
struct Imported {
    tracks: Vec<Track>,
    warnings: Vec<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TextInput {
    text: String,
    file_name: String,
}

type Result<T> = std::result::Result<T, String>;
fn err(_: impl std::fmt::Display) -> String {
    "The local library operation failed. Check available disk space and file permissions.".into()
}

fn initialize(db: &mut Connection) -> Result<()> {
    db.busy_timeout(Duration::from_secs(5)).map_err(err)?;
    db.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;")
        .map_err(err)?;
    let version: i64 = db
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(err)?;
    if version > 1 {
        return Err(
            "This library was created by a newer Lumaire version. Your data has been preserved."
                .into(),
        );
    }
    let tx = db.transaction().map_err(err)?;
    tx.execute_batch("CREATE TABLE IF NOT EXISTS tracks (id TEXT PRIMARY KEY, path TEXT UNIQUE, metadata TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
      PRAGMA user_version=1;").map_err(err)?;
    tx.commit().map_err(err)
}

fn snapshot(db: &Connection) -> Result<Snapshot> {
    let mut stmt = db
        .prepare("SELECT metadata,path FROM tracks ORDER BY rowid")
        .map_err(err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?))
        })
        .map_err(err)?;
    let mut tracks = Vec::new();
    for row in rows {
        let (json, path) = row.map_err(err)?;
        let mut track: Track = serde_json::from_str(&json).map_err(err)?;
        track.missing = path.as_ref().is_none_or(|p| !Path::new(p).is_file());
        tracks.push(track);
    }
    let raw: Option<String> = db
        .query_row("SELECT data FROM app_state WHERE id=1", [], |r| r.get(0))
        .optional()
        .map_err(err)?;
    let session = raw
        .map(|s| serde_json::from_str(&s))
        .transpose()
        .map_err(err)?;
    Ok(Snapshot { tracks, session })
}

async fn work<T: Send + 'static>(
    app: AppHandle,
    f: impl FnOnce(&AppHandle, &mut Connection) -> Result<T> + Send + 'static,
) -> Result<T> {
    tauri::async_runtime::spawn_blocking(move || {
        let state: State<Store> = app.state();
        let mut db = state.inner().0.lock().map_err(err)?;
        f(&app, &mut db)
    })
    .await
    .map_err(err)?
}

fn allow(app: &AppHandle, path: &Path) -> Result<()> {
    app.asset_protocol_scope().allow_file(path).map_err(err)
}

fn inspect(path: &Path, id: String) -> Track {
    let file_name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let stem = path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let mut track = Track {
        id,
        title: stem,
        artist: "Unknown artist".into(),
        album: "Local collection".into(),
        duration: 0.0,
        file_name,
        missing: false,
        format: path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_uppercase(),
        source: None,
    };
    if let Ok(file) = Probe::open(path).and_then(|p| p.read()) {
        track.duration = file.properties().duration().as_secs_f64();
        if let Some(tag) = file.primary_tag().or_else(|| file.first_tag()) {
            if let Some(v) = tag.title() {
                track.title = v.chars().take(1000).collect();
            }
            if let Some(v) = tag.artist() {
                track.artist = v.chars().take(1000).collect();
            }
            if let Some(v) = tag.album() {
                track.album = v.chars().take(1000).collect();
            }
        }
    }
    track
}

const COMMONS_API: &str = "https://commons.wikimedia.org/w/api.php";
const COMMONS_PROVIDER: &str = "wikimedia-commons";

fn commons_client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("Lumaire/0.1 (Wikimedia Commons audio discovery)")
        .build()
        .map_err(|_| "Could not start the online music connection.".to_string())
}

fn plain_metadata(value: &serde_json::Value) -> String {
    let html = value["value"].as_str().unwrap_or_default();
    let mut output = String::with_capacity(html.len().min(1000));
    let mut inside_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => inside_tag = true,
            '>' => inside_tag = false,
            _ if !inside_tag => output.push(ch),
            _ => {}
        }
    }
    output
        .replace("&amp;", "&")
        .replace("&#39;", "'")
        .replace("&quot;", "\"")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .trim()
        .chars()
        .take(500)
        .collect()
}

fn licensed_audio(mime: &str, license: &str) -> bool {
    let known_license = license.starts_with("cc-by-")
        || license.starts_with("cc-by-sa-")
        || license == "cc0"
        || license.starts_with("pd-")
        || license == "public domain";
    known_license && matches!(mime, "audio/mpeg" | "audio/ogg" | "audio/wav" | "audio/flac")
}

fn commons_track(page: &serde_json::Value) -> Option<RemoteTrack> {
    let page_id = page["pageid"].as_i64()?;
    let file_title = page["title"].as_str()?;
    let info = page["imageinfo"].as_array()?.first()?;
    let mime = info["mime"].as_str()?.to_ascii_lowercase();
    let metadata = &info["extmetadata"];
    let license = metadata["License"].get("value")?.as_str()?.to_ascii_lowercase();
    if !licensed_audio(&mime, &license) {
        return None;
    }
    let page_url = info["descriptionurl"].as_str()?;
    if !page_url.starts_with("https://commons.wikimedia.org/wiki/File:") {
        return None;
    }
    let object_name = plain_metadata(&metadata["ObjectName"]);
    let title = if object_name.is_empty() {
        file_title.strip_prefix("File:").unwrap_or(file_title).to_string()
    } else {
        object_name
    };
    let artist = ["Artist", "Author"]
        .iter()
        .map(|key| plain_metadata(&metadata[*key]))
        .find(|value| !value.is_empty())
        .unwrap_or_else(|| "Unknown artist".into());
    let credit = plain_metadata(&metadata["Credit"]);
    let attribution = if credit.is_empty() || credit == artist {
        artist.clone()
    } else {
        format!("{artist} · {credit}")
    };
    let license_name = plain_metadata(&metadata["LicenseShortName"]);
    let license_url = plain_metadata(&metadata["LicenseUrl"]);
    let duration = info["duration"].as_f64().unwrap_or(0.0);
    let extension = match mime.as_str() {
        "audio/mpeg" => "MP3",
        "audio/ogg" => "OGG",
        "audio/wav" => "WAV",
        "audio/flac" => "FLAC",
        _ => return None,
    };
    Some(RemoteTrack {
        id: format!("{COMMONS_PROVIDER}:{page_id}"),
        title,
        artist,
        album: "Wikimedia Commons · individually licensed".into(),
        duration,
        file_name: file_title.strip_prefix("File:").unwrap_or(file_title).into(),
        missing: false,
        format: extension.into(),
        source: RemoteSource {
            provider_id: COMMONS_PROVIDER.into(),
            source_id: page_id.to_string(),
            page_url: page_url.into(),
            license: if license_name.is_empty() { license } else { license_name },
            license_url,
            attribution,
        },
    })
}

#[tauri::command]
async fn search_commons_audio(query: String) -> Result<Vec<RemoteTrack>> {
    let query = query.trim();
    if query.len() < 2 || query.len() > 200 {
        return Err("Enter at least two characters to search.".into());
    }
    let response = commons_client()?
        .get(COMMONS_API)
        .query(&[
            ("action", "query"),
            ("generator", "search"),
            ("gsrnamespace", "6"),
            ("gsrlimit", "30"),
            ("gsrsearch", query),
            ("prop", "imageinfo"),
            ("iiprop", "url|mime|size|extmetadata"),
            ("iiurlwidth", "0"),
            ("format", "json"),
        ])
        .send()
        .await
        .map_err(|_| "Wikimedia Commons could not be reached. Check your connection and retry.".to_string())?;
    if !response.status().is_success() {
        return Err("Wikimedia Commons search is temporarily unavailable.".into());
    }
    if response.content_length().is_some_and(|n| n > 2_000_000) {
        return Err("The music search response exceeded its size limit.".into());
    }
    let bytes = response.bytes().await.map_err(|_| "The music search response could not be read.".to_string())?;
    if bytes.len() > 2_000_000 {
        return Err("The music search response exceeded its size limit.".into());
    }
    let body: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|_| "Wikimedia Commons returned an unreadable search response.".to_string())?;
    let mut results = body["query"]["pages"]
        .as_object()
        .into_iter()
        .flat_map(|pages| pages.values())
        .filter_map(commons_track)
        .filter(|track| track.duration > 0.0 && track.duration.is_finite())
        .collect::<Vec<_>>();
    results.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    results.truncate(20);
    Ok(results)
}

#[tauri::command]
async fn resolve_commons_audio(source_id: String) -> Result<ResolvedMedia> {
    let page_id: i64 = source_id
        .parse()
        .map_err(|_| "This online track identity is invalid.".to_string())?;
    if page_id <= 0 {
        return Err("This online track identity is invalid.".into());
    }
    let response = commons_client()?
        .get(COMMONS_API)
        .query(&[
            ("action", "query"),
            ("pageids", &page_id.to_string()),
            ("prop", "imageinfo"),
            ("iiprop", "url|mime|extmetadata"),
            ("format", "json"),
        ])
        .send()
        .await
        .map_err(|_| "This Commons track could not be refreshed. Check your connection and retry.".to_string())?;
    if !response.status().is_success() {
        return Err("This Commons track is temporarily unavailable.".into());
    }
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|_| "Commons returned an unreadable track response.".to_string())?;
    let page = &body["query"]["pages"][page_id.to_string()];
    let info = page["imageinfo"].as_array().and_then(|items| items.first())
        .ok_or_else(|| "This track is no longer available on Wikimedia Commons.".to_string())?;
    let mime = info["mime"].as_str().unwrap_or_default().to_ascii_lowercase();
    let license = info["extmetadata"]["License"].get("value").and_then(|v| v.as_str()).unwrap_or_default().to_ascii_lowercase();
    if !licensed_audio(&mime, &license) {
        return Err("This Commons file has no supported audio format or recognized reuse license.".into());
    }
    let url = info["url"].as_str().unwrap_or_default();
    if !url.starts_with("https://upload.wikimedia.org/") {
        return Err("Commons returned an unsupported media location.".into());
    }
    Ok(ResolvedMedia { url: url.into(), mime_type: mime })
}
fn is_audio(path: &Path) -> bool {
    path.extension().and_then(|s| s.to_str()).is_some_and(|s| {
        ["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus"]
            .contains(&s.to_ascii_lowercase().as_str())
    })
}

// Deterministic native I/O for end-to-end tests. Compiled out of release builds;
// only a launch-time environment variable can enable it, never a web command.
fn test_picker(kind: &str) -> Option<Option<PathBuf>> {
    #[cfg(debug_assertions)]
    if let Some(root) = std::env::var_os("LUMAIRE_TEST_PICKER") {
        let root = PathBuf::from(root);
        let name = fs::read_to_string(root.join(format!("next-{kind}"))).ok()?;
        let name = name.trim();
        if name == "CANCEL" {
            return Some(None);
        }
        if Path::new(name).components().count() != 1 || name.contains(['/', '\\']) {
            return Some(None);
        }
        return Some(Some(root.join(name)));
    }
    let _ = kind;
    None
}
fn pick_audio_file(title: &str) -> Option<PathBuf> {
    if let Some(path) = test_picker("audio") {
        return path;
    }
    rfd::FileDialog::new()
        .set_title(title)
        .add_filter(
            "Audio",
            &["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus"],
        )
        .pick_file()
}

// Only the native picker can introduce file paths. The renderer receives opaque track IDs.
fn import_selected(app: &AppHandle, db: &mut Connection, paths: Vec<PathBuf>) -> Result<Imported> {
    let mut tracks = Vec::new();
    let mut warnings = Vec::new();
    let tx = db.transaction().map_err(err)?;
    for path in paths.into_iter().take(10000) {
        let Ok(path) = path.canonicalize() else {
            warnings.push("A selected file could not be read.".into());
            continue;
        };
        if !is_audio(&path) || !path.is_file() {
            continue;
        }
        let path_text = path.to_string_lossy().to_string();
        let existing: Option<(String, String)> = tx
            .query_row(
                "SELECT id,metadata FROM tracks WHERE path=?1",
                [&path_text],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(err)?;
        let track = if let Some((_, metadata)) = existing {
            serde_json::from_str(&metadata).map_err(err)?
        } else {
            inspect(&path, Uuid::new_v4().to_string())
        };
        allow(app, &path)?;
        tx.execute("INSERT INTO tracks(id,path,metadata) VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata",params![track.id,path_text,serde_json::to_string(&track).map_err(err)?]).map_err(err)?;
        if !tracks.iter().any(|t: &Track| t.id == track.id) {
            tracks.push(track);
        }
    }
    tx.commit().map_err(err)?;
    Ok(Imported { tracks, warnings })
}

#[tauri::command]
async fn load_library(app: AppHandle) -> Result<Snapshot> {
    work(app, |_, db| snapshot(db)).await
}
#[tauri::command]
async fn import_audio(app: AppHandle, folder: bool) -> Result<Imported> {
    // Dialog and metadata reads run outside the UI thread.
    work(app, move |app, db| {
        let paths = if let Some(path) = test_picker("audio") {
            path.into_iter().collect()
        } else if folder {
            let Some(root) = rfd::FileDialog::new()
                .set_title("Choose a music folder")
                .pick_folder()
            else {
                return Ok(Imported {
                    tracks: vec![],
                    warnings: vec![],
                });
            };
            walkdir::WalkDir::new(root)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file() && is_audio(e.path()))
                .take(10000)
                .map(|e| e.into_path())
                .collect()
        } else {
            rfd::FileDialog::new()
                .set_title("Add music to Lumaire")
                .add_filter(
                    "Audio",
                    &["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus"],
                )
                .pick_files()
                .unwrap_or_default()
        };
        import_selected(app, db, paths)
    })
    .await
}
#[tauri::command]
async fn media_path(app: AppHandle, id: String) -> Result<String> {
    work(app, move |app, db| {
        let stored: Option<String> = db
            .query_row("SELECT path FROM tracks WHERE id=?1", [id], |r| r.get(0))
            .optional()
            .map_err(err)?
            .flatten();
        let Some(path) = stored else {
            return Err(
                "This file needs to be relinked. Choose its location from the track menu.".into(),
            );
        };
        let path = Path::new(&path).canonicalize().map_err(|_| {
            "The file has moved or is unavailable. Use Relink to choose it again.".to_string()
        })?;
        allow(app, &path)?;
        Ok(path.to_string_lossy().into_owned())
    })
    .await
}
#[tauri::command]
async fn relink_audio(app: AppHandle, id: String) -> Result<Option<Track>> {
    work(app,move |app,db|{
        let exists:bool=db.query_row("SELECT EXISTS(SELECT 1 FROM tracks WHERE id=?1)",[&id],|r|r.get(0)).map_err(err)?;
        if !exists {return Err("The track no longer exists.".into());}
        let Some(path)=pick_audio_file("Relink this recording — choose the matching audio file") else {return Ok(None);};
        let path=path.canonicalize().map_err(err)?;
        if !is_audio(&path) {return Err("Choose an audio file.".into());}
        allow(app,&path)?;
        let track=inspect(&path,id.clone());
        db.execute("UPDATE tracks SET path=?1,metadata=?2 WHERE id=?3",params![path.to_string_lossy(),serde_json::to_string(&track).map_err(err)?,id]).map_err(|_|"That file is already in your library. Choose the matching recording, or use the existing entry.".to_string())?;
        Ok(Some(track))
    }).await
}

#[tauri::command]
async fn save_session(app: AppHandle, session: serde_json::Value) -> Result<()> {
    work(app,move |_,db|{
        validate_session(&session)?;
        let json=serde_json::to_string(&session).map_err(err)?;
        if json.len()>20*1024*1024 {return Err("Library text is too large to save (20 MB limit).".into());}
        db.execute("INSERT INTO app_state(id,data) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET data=excluded.data",[json]).map_err(err)?;
        Ok(())
    }).await
}
fn validate_session(s: &serde_json::Value) -> Result<()> {
    if !s.is_object()
        || !s["queue"].is_array()
        || !s["playlists"].is_array()
        || !s["settings"].is_object()
    {
        return Err("Invalid library data. The previous library was preserved.".into());
    }
    for key in ["queue", "playlists", "favorites", "history"] {
        if s[key].as_array().is_none_or(|a| a.len() > 50000) {
            return Err("Invalid or oversized library data.".into());
        }
    }
    Ok(())
}
fn read_text(path: &Path, limit: u64) -> Result<String> {
    if fs::metadata(path).map_err(err)?.len() > limit {
        return Err("This text file exceeds the import size limit.".into());
    }
    fs::read_to_string(path).map_err(|_| {
        "Use a UTF-8 encoded text file. The selected file could not be decoded.".into()
    })
}
#[tauri::command]
async fn pick_lyrics(app: AppHandle) -> Result<Option<TextInput>> {
    work(app, |_, _| {
        let Some(path) = test_picker("lyrics").unwrap_or_else(|| {
            rfd::FileDialog::new()
                .set_title("Attach authorized lyrics or supplied text")
                .add_filter("Lyrics", &["lrc", "txt"])
                .pick_file()
        }) else {
            return Ok(None);
        };
        Ok(Some(TextInput {
            text: read_text(&path, 1_048_576)?,
            file_name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
        }))
    })
    .await
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
enum LyricResult {
    #[serde(rename = "synced")]
    Synced { lrc: String },
    #[serde(rename = "plain")]
    Plain { text: String },
    #[serde(rename = "instrumental")]
    Instrumental,
    #[serde(rename = "not_found")]
    NotFound,
}

/// Clean YouTube title by removing common video metadata suffixes
fn clean_title_for_lyrics(title: &str) -> String {
    let patterns = [
        "(Official Video)",
        "(Official Music Video)",
        "(Official Audio)",
        "(Lyric Video)",
        "(Lyrics)",
        "[Official Video]",
        "[Official Music Video]",
        "[Official Audio]",
        "[Lyric Video]",
        "[Lyrics]",
        "(Audio)",
        "[Audio]",
        "(HD)",
        "[HD]",
        "(HQ)",
        "[HQ]",
        "(4K)",
        "[4K]",
        "- Topic",
    ];
    
    let mut cleaned = title.to_string();
    for pattern in &patterns {
        cleaned = cleaned.replace(pattern, "");
    }
    
    // Remove excessive whitespace
    cleaned = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    cleaned.trim().to_string()
}

/// Extract artist from "Artist - Title" format common in YouTube titles
fn clean_artist_for_lyrics(artist: &str, title: &str) -> (String, String) {
    // If artist is empty or looks like a placeholder, try to extract from title
    if artist.is_empty() || artist == "Unknown Artist" {
        if let Some(dash_pos) = title.find(" - ") {
            let extracted_artist = title[..dash_pos].trim().to_string();
            let extracted_title = title[dash_pos + 3..].trim().to_string();
            return (extracted_artist, clean_title_for_lyrics(&extracted_title));
        }
    }
    
    (artist.to_string(), clean_title_for_lyrics(title))
}

/// Fetch lyrics from LRCLIB. Called from the renderer; runs in Tauri's async runtime.
/// Duration is required so LRCLIB can filter to the correct recording length.
#[tauri::command]
async fn fetch_lyrics(
    title: String,
    artist: String,
    album: String,
    duration: f64,
) -> Result<LyricResult> {
    if title.is_empty() {
        return Ok(LyricResult::NotFound);
    }
    
    // Clean YouTube metadata from title and extract artist if needed
    let (clean_artist, clean_title) = clean_artist_for_lyrics(&artist, &title);
    
    log::info!(
        "LRCLIB lookup: original='{}' by '{}' → cleaned='{}' by '{}'",
        title, artist, clean_title, clean_artist
    );
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut params: Vec<(&str, String)> = vec![("track_name", clean_title.clone())];
    // Only add artist_name/album_name when non-empty — LRCLIB returns 400 on empty string params.
    if !clean_artist.is_empty() {
        params.push(("artist_name", clean_artist.clone()));
    }
    if !album.is_empty() && album != "Local collection" {
        params.push(("album_name", album.clone()));
    }
    // Duration helps LRCLIB reject wrong versions (e.g. radio edits vs album cuts).
    if duration > 0.0 {
        params.push(("duration", format!("{:.0}", duration)));
    }

    let resp = client
        .get("https://lrclib.net/api/get")
        .query(&params)
        .header("Lrclib-Client", "Lumaire/0.1 (https://github.com/lumaire)")
        .send()
        .await
        .map_err(|e| format!("Lyrics lookup failed: {e}"))?;

    if resp.status() == 404 {
        return Ok(LyricResult::NotFound);
    }
    if !resp.status().is_success() {
        return Err(format!("LRCLIB returned status {}", resp.status()));
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LrclibResp {
        instrumental: bool,
        synced_lyrics: Option<String>,
        plain_lyrics: Option<String>,
    }

    let body: LrclibResp = resp.json().await.map_err(|e| e.to_string())?;

    if body.instrumental {
        return Ok(LyricResult::Instrumental);
    }
    if let Some(lrc) = body.synced_lyrics.filter(|s| !s.trim().is_empty()) {
        return Ok(LyricResult::Synced { lrc });
    }
    if let Some(text) = body.plain_lyrics.filter(|s| !s.trim().is_empty()) {
        return Ok(LyricResult::Plain { text });
    }
    Ok(LyricResult::NotFound)
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Archive {
    format: String,
    version: u32,
    tracks: Vec<Track>,
    session: serde_json::Value,
}

#[tauri::command]
async fn export_library(app: AppHandle, session: serde_json::Value) -> Result<bool> {
    work(app, move |_, db| {
        validate_session(&session)?;
        let Some(path) = test_picker("export").unwrap_or_else(|| {
            rfd::FileDialog::new()
                .set_title("Export library metadata — no audio or lyric text")
                .set_file_name("Lumaire-library.json")
                .add_filter("Lumaire library", &["json"])
                .save_file()
        }) else {
            return Ok(false);
        };
        let mut session = session;
        session["lyrics"] = serde_json::json!({});
        session["history"] = serde_json::json!([]);
        let tracks = snapshot(db)?.tracks;
        let archive = Archive {
            format: "lumaire-library".into(),
            version: 1,
            tracks,
            session,
        };
        // Serialize completely before opening the chosen destination.
        let bytes = serde_json::to_vec_pretty(&archive).map_err(err)?;
        fs::write(path, bytes).map_err(err)?;
        Ok(true)
    })
    .await
}
#[tauri::command]
async fn import_library(app: AppHandle) -> Result<Option<Snapshot>> {
    work(app,|_,db|{
        let Some(path)=test_picker("backup").unwrap_or_else(||rfd::FileDialog::new().set_title("Import a Lumaire library backup").add_filter("Lumaire library",&["json"]).pick_file()) else {return Ok(None);};
        let mut archive:Archive=serde_json::from_str(&read_text(&path,10*1024*1024)?).map_err(|_|"This is not a valid Lumaire library backup.".to_string())?;
        if archive.format!="lumaire-library"||archive.version!=1||archive.tracks.len()>10000 {return Err("Unsupported backup version or too many tracks.".into());}
        validate_session(&archive.session)?;
        // Never trust a backup to grant file access. New entries require explicit relinking.
        let existing = snapshot(db)?.session;
        // A metadata-only backup must not erase already attached local texts/history.
        // Ignore text/history in the untrusted archive and retain this device's data.
        archive.session["lyrics"] = existing.as_ref().and_then(|s|s.get("lyrics")).cloned().unwrap_or_else(||serde_json::json!({}));
        archive.session["history"] = existing.as_ref().and_then(|s|s.get("history")).cloned().unwrap_or_else(||serde_json::json!([]));
        let tx=db.transaction().map_err(err)?;
        for mut track in archive.tracks {
            if track.id.len()>100 || track.title.len()>4000 || track.artist.len()>4000 || track.album.len()>4000 || !track.duration.is_finite() || track.duration<0.0 {return Err("Invalid track metadata in backup.".into());}
            track.missing=true;
            tx.execute("INSERT OR IGNORE INTO tracks(id,path,metadata) VALUES(?1,NULL,?2)",params![track.id,serde_json::to_string(&track).map_err(err)?]).map_err(err)?;
        }
        tx.execute("INSERT INTO app_state(id,data) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET data=excluded.data",[serde_json::to_string(&archive.session).map_err(err)?]).map_err(err)?;
        tx.commit().map_err(err)?;
        Ok(Some(snapshot(db)?))
    }).await
}

pub fn run() {
    #[allow(unused_mut)]
    let mut context = tauri::generate_context!();
    #[cfg(debug_assertions)]
    if let Some(root) = std::env::var_os("LUMAIRE_DATA_DIR") {
        for window in &mut context.config_mut().app.windows {
            window.data_directory = Some(PathBuf::from(&root).join("webview"));
        }
    }
    tauri::Builder::default()
        .setup(|app| {
            // Tests may isolate data; release builds always use the normal app-private directory.
            let root = if cfg!(debug_assertions) {
                std::env::var_os("LUMAIRE_DATA_DIR")
                    .map(PathBuf::from)
                    .unwrap_or(app.path().app_data_dir()?)
            } else {
                app.path().app_data_dir()?
            };
            fs::create_dir_all(&root)?;
            let mut db = Connection::open(root.join("library.sqlite3"))?;
            initialize(&mut db).map_err(std::io::Error::other)?;
            #[cfg(debug_assertions)]
            if let Some(fixtures) = std::env::var_os("LUMAIRE_TEST_FIXTURES") {
                let paths = fs::read_dir(fixtures)?
                    .filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| is_audio(p))
                    .collect();
                import_selected(app.handle(), &mut db, paths).map_err(std::io::Error::other)?;
            }
            app.manage(Store(Mutex::new(db)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_library,
            import_audio,
            media_path,
            relink_audio,
            save_session,
            pick_lyrics,
            fetch_lyrics,
            export_library,
            import_library,
            search_commons_audio,
            resolve_commons_audio,
            ytdlp::ytdlp_check_available,
            ytdlp::ytdlp_search,
            ytdlp::ytdlp_get_stream
        ])
        .run(context)
        .expect("Lumaire could not start");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn schema_and_state_survive_reopen() {
        let path = std::env::temp_dir().join(format!("lumaire-{}.db", Uuid::new_v4()));
        {
            let mut db = Connection::open(&path).unwrap();
            initialize(&mut db).unwrap();
            db.execute("INSERT INTO app_state VALUES(1,'{\"queue\":[]}' )", [])
                .unwrap();
        }
        {
            let mut db = Connection::open(&path).unwrap();
            initialize(&mut db).unwrap();
            assert!(snapshot(&db).unwrap().session.is_some());
        }
        let _ = fs::remove_file(path);
    }
    #[test]
    fn future_schema_is_preserved() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch("PRAGMA user_version=100").unwrap();
        assert!(initialize(&mut db).is_err());
        assert_eq!(
            db.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            100
        );
    }
    #[test]
    fn invalid_session_is_rejected() {
        assert!(validate_session(&serde_json::json!({"queue":[]})).is_err());
    }
}
