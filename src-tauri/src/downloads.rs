use crate::{allow, err, resolve_commons_audio, work, Result, Track};
use rusqlite::{params, OptionalExtension};
use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::Duration,
};
use tauri::Manager;

fn jobs() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    static JOBS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}
struct Job(String);
impl Drop for Job {
    fn drop(&mut self) {
        if let Ok(mut jobs) = jobs().lock() {
            jobs.remove(&self.0);
        }
    }
}
struct Partial(PathBuf);
impl Drop for Partial {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

fn root(app: &tauri::AppHandle) -> Result<PathBuf> {
    #[cfg(debug_assertions)]
    let data = std::env::var_os("LUMAIRE_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or(app.path().app_data_dir().map_err(err)?);
    #[cfg(not(debug_assertions))]
    let data = app.path().app_data_dir().map_err(err)?;
    let root = data.join("downloads");
    fs::create_dir_all(&root).map_err(err)?;
    let resolved = root.canonicalize().map_err(err)?;
    if resolved != data.canonicalize().map_err(err)?.join("downloads") {
        return Err("Managed download storage must not be a directory link.".into());
    }
    Ok(resolved)
}

pub fn cleanup_incomplete(directory: &std::path::Path) {
    if directory.canonicalize().ok()
        != directory
            .parent()
            .and_then(|parent| parent.canonicalize().ok())
            .map(|parent| parent.join("downloads"))
    {
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("part")
            || path
                .file_stem()
                .and_then(|stem| stem.to_str())
                .is_none_or(|stem| uuid::Uuid::parse_str(stem).is_err())
        {
            continue;
        }
        if let Ok(metadata) = entry.metadata() {
            if metadata.is_file()
                && metadata
                    .modified()
                    .ok()
                    .and_then(|time| time.elapsed().ok())
                    .is_some_and(|age| age > Duration::from_secs(86_400))
            {
                let _ = fs::remove_file(path);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn download_locations_are_provider_scoped_including_redirects() {
        for (url, youtube, expected) in [
            (
                "https://rr1---sn-example.googlevideo.com/videoplayback?token=private",
                true,
                true,
            ),
            (
                "https://upload.wikimedia.org/wikipedia/commons/audio.ogg",
                false,
                true,
            ),
            ("https://evilgooglevideo.com/audio", true, false),
            ("https://googlevideo.com.evil.test/audio", true, false),
            ("https://rr1.googlevideo.com:8443/audio", true, false),
            ("http://rr1.googlevideo.com/audio", true, false),
            (
                "https://user:password@rr1.googlevideo.com/audio",
                true,
                false,
            ),
            ("https://127.0.0.1/audio", true, false),
            ("https://upload.wikimedia.org/audio", true, false),
            ("https://rr1.googlevideo.com/audio", false, false),
        ] {
            assert_eq!(
                download_location_allowed(&reqwest::Url::parse(url).unwrap(), youtube),
                expected
            );
        }
    }
    fn wav() -> String {
        let mut bytes = b"RIFF".to_vec();
        bytes.extend(52u32.to_le_bytes());
        bytes.extend(b"WAVEfmt ");
        bytes.extend(16u32.to_le_bytes());
        bytes.extend(1u16.to_le_bytes());
        bytes.extend(1u16.to_le_bytes());
        bytes.extend(8000u32.to_le_bytes());
        bytes.extend(8000u32.to_le_bytes());
        bytes.extend(1u16.to_le_bytes());
        bytes.extend(8u16.to_le_bytes());
        bytes.extend(b"data");
        bytes.extend(16u32.to_le_bytes());
        bytes.extend([0u8; 16]);
        String::from_utf8(bytes).unwrap()
    }
    #[test]
    fn downloaded_audio_is_validated_and_partial_files_are_removed_on_failure_or_cancel() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        for (status, body, cancel, success) in [
            ("200 OK", wav(), false, true),
            ("200 OK", "not audio".into(), false, false),
            ("200 OK", wav(), true, false),
            ("206 Partial Content", wav(), false, false),
            ("403 Forbidden", wav(), false, false),
        ] {
            let (url, server) = crate::provider_http::tests::server(vec![(status, body)]);
            let path = std::env::temp_dir().join(format!("{}.part", uuid::Uuid::new_v4()));
            {
                let _partial = Partial(path.clone());
                let outcome = runtime.block_on(async {
                    let response = reqwest::get(url).await.unwrap();
                    transfer_audio(response, &path, &AtomicBool::new(cancel)).await
                });
                assert_eq!(outcome.is_ok(), success);
            }
            assert!(!path.exists());
            server.join().unwrap();
        }
    }

    #[test]
    #[ignore = "explicit licensed Commons transfer check; requires network"]
    fn live_licensed_commons_audio_transfer() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        runtime.block_on(async {
            let tracks = crate::search_commons_audio("piano".into()).await.unwrap();
            assert!(!tracks.is_empty(), "No licensed audio returned");
            let source = &tracks[0].source;
            let media = crate::resolve_commons_audio(source.source_id.clone())
                .await
                .unwrap();
            let path = std::env::temp_dir().join(format!("{}.part", uuid::Uuid::new_v4()));
            let _partial = Partial(path.clone());
            let response = reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .timeout(Duration::from_secs(30))
                .user_agent("Lumaire/0.1 licensed offline audio")
                .build()
                .unwrap()
                .get(&media.url)
                .send()
                .await
                .unwrap();
            transfer_audio(response, &path, &AtomicBool::new(false))
                .await
                .unwrap();
            assert!(fs::metadata(&path).unwrap().len() > 44);
            eprintln!(
                "Verified licensed audio: {} | {} | {} | {}",
                tracks[0].title, source.attribution, source.license, source.page_url
            );
        });
    }
}

#[tauri::command]
pub fn cancel_download(id: String) -> Result<()> {
    if let Some(cancel) = jobs().lock().map_err(err)?.get(&id) {
        cancel.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub async fn download_track(app: tauri::AppHandle, id: String) -> Result<Track> {
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut jobs = jobs().lock().map_err(err)?;
        if jobs.contains_key(&id) {
            return Err("This download is already running.".into());
        }
        jobs.insert(id.clone(), cancel.clone());
    }
    let _job = Job(id.clone());
    let lookup = id.clone();
    let existing = work(app.clone(), move |_, db| {
        let (metadata, path): (String, Option<String>) = db
            .query_row(
                "SELECT metadata,path FROM tracks WHERE id=?1",
                [lookup],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(err)?;
        let track: Track = serde_json::from_str(&metadata).map_err(err)?;
        Ok((track, path))
    })
    .await?;
    let mut track = existing.0;
    if track.offline
        && existing
            .1
            .as_ref()
            .is_some_and(|path| std::path::Path::new(path).is_file())
    {
        return Ok(track);
    }
    let source = track
        .source
        .as_ref()
        .ok_or("Local files are already available offline.")?;
    // Resolve the selected source in the backend. Never transfer a renderer URL.
    // Commons reuse eligibility is rechecked; YouTube availability is not a license.
    let youtube = source.provider_id == "youtube";
    let (url, extension) = if youtube {
        let audio = crate::ytdlp::download_audio(source.source_id.clone()).await?;
        let extension = match audio.container.as_deref() {
            Some("m4a") => "m4a",
            // YouTube's public Android client may only expose a progressive
            // MP4 when the normal web client is bot-challenged. It remains
            // directly playable offline and is safe to store as MP4.
            Some("mp4") => "mp4",
            _ => return Err("This video has no supported offline audio stream.".into()),
        };
        (audio.stream_url, extension)
    } else if source.provider_id == "wikimedia-commons" {
        let media = resolve_commons_audio(source.source_id.clone()).await?;
        if let Some(source) = track.source.as_mut() {
            source.license = media.license;
            source.license_url = media.license_url;
            source.attribution = media.attribution;
        }
        let extension = match media.mime_type.as_str() {
            "audio/mpeg" => "mp3",
            "audio/ogg" => "ogg",
            "audio/wav" => "wav",
            "audio/flac" => "flac",
            _ => return Err("Unsupported audio format.".into()),
        };
        (media.url, extension)
    } else {
        return Err("This source does not support offline downloads.".into());
    };
    if cancel.load(Ordering::Relaxed) {
        return Err("Download cancelled.".into());
    }
    let directory = root(&app)?;
    let token = uuid::Uuid::new_v4();
    let partial = Partial(directory.join(format!("{token}.part")));
    let destination = directory.join(format!("{token}.{extension}"));
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(180))
        .user_agent("Mozilla/5.0 Lumaire/0.1 offline audio")
        .build()
        .map_err(err)?;
    let response = audio_response_for(&client, &url, &cancel, youtube).await?;
    transfer_audio(response, &partial.0, &cancel).await?;
    fs::rename(&partial.0, &destination).map_err(err)?;
    let mut complete = Partial(destination.clone());
    track.offline = true;
    track.missing = false;
    let saved_path = destination.to_string_lossy().into_owned();
    let saved = work(app, move |app, db| {
        allow(app, &destination)?;
        let exists: bool = db
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM tracks WHERE id=?1)",
                [&track.id],
                |row| row.get(0),
            )
            .map_err(err)?;
        if !exists {
            return Err("The track was removed while downloading.".into());
        }
        db.execute(
            "UPDATE tracks SET path=?1,metadata=?2 WHERE id=?3",
            params![
                saved_path,
                serde_json::to_string(&track).map_err(err)?,
                track.id
            ],
        )
        .map_err(err)?;
        Ok(track)
    })
    .await?;
    complete.0.clear(); // ownership transferred to the persisted library
    Ok(saved)
}

#[tauri::command]
pub async fn delete_download(app: tauri::AppHandle, id: String, confirmed: bool) -> Result<Track> {
    if !confirmed {
        return Err("Confirm deletion of the app-owned offline copy.".into());
    }
    let directory = root(&app)?;
    work(app, move |_, db| {
        let (metadata, path): (String, Option<String>) = db
            .query_row(
                "SELECT metadata,path FROM tracks WHERE id=?1",
                [&id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(err)?
            .ok_or("This track is no longer in the library.")?;
        let mut track: Track = serde_json::from_str(&metadata).map_err(err)?;
        if !track.offline || track.source.is_none() {
            return Err("This is not an app-owned offline copy.".into());
        }
        if let Some(path) = path {
            let path = PathBuf::from(path);
            if path
                .parent()
                .and_then(|parent| parent.canonicalize().ok())
                .as_ref()
                != Some(&directory)
                || path
                    .file_stem()
                    .and_then(|stem| stem.to_str())
                    .is_none_or(|stem| uuid::Uuid::parse_str(stem).is_err())
            {
                return Err("The stored file is outside managed download storage.".into());
            }
            match fs::symlink_metadata(&path) {
                Ok(metadata) => {
                    if metadata.file_type().is_symlink() {
                        return Err("Refusing to delete a linked file.".into());
                    }
                    fs::remove_file(path).map_err(err)?;
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => (),
                Err(error) => return Err(error.to_string()),
            }
        }
        track.offline = false;
        db.execute(
            "UPDATE tracks SET path=NULL,metadata=?1 WHERE id=?2",
            params![serde_json::to_string(&track).map_err(err)?, id],
        )
        .map_err(err)?;
        Ok(track)
    })
    .await
}

fn download_location_allowed(location: &reqwest::Url, youtube: bool) -> bool {
    let host = location.host_str().unwrap_or_default();
    location.scheme() == "https"
        && (if youtube {
            host.ends_with(".googlevideo.com")
        } else {
            host == "upload.wikimedia.org"
        })
        && location.username().is_empty()
        && location.password().is_none()
        && location.port_or_known_default() == Some(443)
}

async fn audio_response_for(
    client: &reqwest::Client,
    url: &str,
    cancel: &AtomicBool,
    youtube: bool,
) -> Result<reqwest::Response> {
    let mut location = reqwest::Url::parse(url).map_err(|_| "Invalid download URL.")?;
    for _ in 0..5 {
        if cancel.load(Ordering::Relaxed) {
            return Err("Download cancelled.".into());
        }
        if !download_location_allowed(&location, youtube) {
            return Err("Unsupported download location.".into());
        }
        let response =
            tokio::time::timeout(Duration::from_secs(20), client.get(location.clone()).send())
                .await
                .map_err(|_| "Download connection timed out.")?
                .map_err(|_| "Could not start the download.")?;
        if !response.status().is_redirection() {
            return Ok(response);
        }
        let redirect = response
            .headers()
            .get("location")
            .and_then(|header| header.to_str().ok())
            .ok_or("Invalid media redirect.")?;
        location = location
            .join(redirect)
            .map_err(|_| "Invalid media redirect.")?;
    }
    Err("Too many media redirects.".into())
}

async fn transfer_audio(
    mut response: reqwest::Response,
    path: &std::path::Path,
    cancel: &AtomicBool,
) -> Result<()> {
    const MAX: u64 = 200 * 1024 * 1024;
    if response.status() != reqwest::StatusCode::OK
        || response.content_length().is_some_and(|bytes| bytes > MAX)
    {
        return Err(format!(
            "Audio transfer failed (HTTP {}, 200 MB size limit).",
            response.status()
        ));
    }
    let expected = response.content_length();
    let mut file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .map_err(err)?;
    let mut received = 0u64;
    let started = std::time::Instant::now();
    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err("Download cancelled.".into());
        }
        if started.elapsed() > Duration::from_secs(180) {
            return Err("Download timed out. Retry when your connection is available.".into());
        }
        let chunk = match tokio::time::timeout(Duration::from_secs(2), response.chunk()).await {
            Err(_) => continue,
            Ok(chunk) => {
                chunk.map_err(|_| "The download was interrupted. Retry to start again.")?
            }
        };
        let Some(chunk) = chunk else {
            break;
        };
        received += chunk.len() as u64;
        if received > MAX {
            return Err("Audio exceeds the 200 MB download limit.".into());
        }
        file.write_all(&chunk).map_err(err)?;
    }
    if received == 0 || expected.is_some_and(|length| received != length) {
        return Err("The audio download was incomplete.".into());
    }
    file.sync_all().map_err(err)?;
    drop(file);
    lofty::probe::Probe::open(path)
        .and_then(|probe| Ok(probe.guess_file_type()?))
        .and_then(|probe| probe.read())
        .map_err(|_| "The downloaded file is not readable audio.".to_string())?;
    if cancel.load(Ordering::Relaxed) {
        return Err("Download cancelled.".into());
    }
    Ok(())
}
