use crate::{allow, Result};
use lofty::file::TaggedFileExt;
use std::{fs, io::Write, path::Path, time::Duration};
use tauri::Manager;

const MAX_IMAGE: u64 = 5 * 1024 * 1024;
const CACHE_BUDGET: u64 = 100 * 1024 * 1024;

fn allowed(url: &reqwest::Url) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.port_or_known_default() == Some(443)
        && url.host_str().is_some_and(|host| {
            matches!(
                host,
                "i.ytimg.com"
                    | "i.scdn.co"
                    | "upload.wikimedia.org"
                    | "coverartarchive.org"
                    | "archive.org"
            ) || host.ends_with(".archive.org")
        })
}

fn cache_name(url: &str) -> String {
    // Stable FNV-1a key; collisions cannot introduce paths or grant file access.
    let hash = url.bytes().fold(0xcbf29ce484222325u64, |hash, byte| {
        (hash ^ byte as u64).wrapping_mul(0x100000001b3)
    });
    format!("{hash:016x}.img")
}

fn store_image(root: &Path, path: &Path, bytes: &[u8]) -> Result<()> {
    let temporary = root.join(format!("{}.part", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temporary, path)
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(temporary);
        return Err(error.to_string());
    }
    Ok(())
}

fn prune(root: &Path, incoming: u64) -> Result<()> {
    let mut entries = fs::read_dir(root)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.len() != 20
                || !name.ends_with(".img")
                || !name[..16].bytes().all(|c| c.is_ascii_hexdigit())
            {
                return None;
            }
            let metadata = entry.metadata().ok()?;
            metadata
                .is_file()
                .then_some((entry.path(), metadata.len(), metadata.modified().ok()))
        })
        .collect::<Vec<_>>();
    let mut size: u64 = entries.iter().map(|entry| entry.1).sum();
    entries.sort_by_key(|entry| entry.2);
    for (path, bytes, _) in entries {
        if size + incoming <= CACHE_BUDGET {
            break;
        }
        if fs::remove_file(path).is_ok() {
            size -= bytes;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn cached_artwork(app: tauri::AppHandle, url: String) -> Result<String> {
    if let Some(id) = url.strip_prefix("local:") {
        let id = id.split("?v=").next().unwrap_or_default().to_string();
        if id.is_empty() || id.len() > 100 {
            return Err("Invalid artwork identity.".into());
        }
        return crate::work(app, move |app, db| {
            let source: Option<String> = db
                .query_row("SELECT path FROM tracks WHERE id=?1", [id], |row| {
                    row.get(0)
                })
                .map_err(crate::err)?;
            let source = source.ok_or("This track has no local file.")?;
            let root = app
                .path()
                .app_cache_dir()
                .map_err(crate::err)?
                .join("artwork");
            fs::create_dir_all(&root).map_err(crate::err)?;
            if root.canonicalize().map_err(crate::err)?
                != root
                    .parent()
                    .unwrap()
                    .canonicalize()
                    .map_err(crate::err)?
                    .join("artwork")
            {
                return Err("Artwork cache must not be a directory link.".into());
            }
            let path = root.join(cache_name(&url));
            if fs::symlink_metadata(&path).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
                return Err("Artwork entries must not be file links.".into());
            }
            if !path.exists() {
                let audio = lofty::probe::Probe::open(&source)
                    .and_then(|probe| probe.read())
                    .map_err(|_| "No embedded artwork is available.")?;
                let picture = audio
                    .primary_tag()
                    .or_else(|| audio.first_tag())
                    .and_then(|tag| tag.pictures().first())
                    .ok_or("No embedded artwork is available.")?;
                if picture.data().is_empty() || picture.data().len() as u64 > MAX_IMAGE {
                    return Err("Embedded artwork is empty or too large.".into());
                }
                prune(&root, picture.data().len() as u64)?;
                store_image(&root, &path, picture.data())?;
            }
            allow(app, &path)?;
            Ok(path.to_string_lossy().into_owned())
        })
        .await;
    }
    let mut location = reqwest::Url::parse(&url).map_err(|_| "Invalid artwork URL.")?;
    if !allowed(&location) || url.len() > 4000 {
        return Err("Unsupported artwork location.".into());
    }
    static GATE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
    let _guard = GATE.lock().await;
    let root = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("artwork");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    if root.canonicalize().map_err(|e| e.to_string())?
        != root
            .parent()
            .unwrap()
            .canonicalize()
            .map_err(|e| e.to_string())?
            .join("artwork")
    {
        return Err("Artwork cache must not be a directory link.".into());
    }
    let path = root.join(cache_name(&url));
    if fs::symlink_metadata(&path).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err("Artwork entries must not be file links.".into());
    }
    if path.is_file() {
        allow(&app, &path)?;
        return Ok(path.to_string_lossy().into_owned());
    }
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;
    for _ in 0..5 {
        let mut response = client
            .get(location.clone())
            .send()
            .await
            .map_err(|_| "Artwork unavailable.")?;
        if response.status().is_redirection() {
            let target = response
                .headers()
                .get("location")
                .and_then(|header| header.to_str().ok())
                .ok_or("Invalid artwork redirect.")?;
            location = location
                .join(target)
                .map_err(|_| "Invalid artwork redirect.")?;
            if !allowed(&location) {
                return Err("Unsupported artwork redirect.".into());
            }
            continue;
        }
        if !response.status().is_success()
            || response
                .content_length()
                .is_some_and(|bytes| bytes > MAX_IMAGE)
        {
            return Err("Artwork unavailable or too large.".into());
        }
        let mime = response
            .headers()
            .get("content-type")
            .and_then(|header| header.to_str().ok())
            .unwrap_or_default();
        if ![
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/avif",
        ]
        .iter()
        .any(|accepted| mime.split(';').next() == Some(accepted))
        {
            return Err("Unsupported artwork format.".into());
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "Artwork transfer failed.")?
        {
            if bytes.len() as u64 + chunk.len() as u64 > MAX_IMAGE {
                return Err("Artwork exceeds 5 MB.".into());
            }
            bytes.extend_from_slice(&chunk);
        }
        if bytes.is_empty() {
            return Err("Empty artwork response.".into());
        }
        prune(&root, bytes.len() as u64)?;
        store_image(&root, &path, &bytes)?;
        allow(&app, &path)?;
        return Ok(path.to_string_lossy().into_owned());
    }
    Err("Too many artwork redirects.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn artwork_locations_and_eviction_stay_in_the_managed_cache() {
        assert!(!allowed(
            &reqwest::Url::parse("https://127.0.0.1/image").unwrap()
        ));
        assert!(!allowed(
            &reqwest::Url::parse("https://i.ytimg.com.evil.test/image").unwrap()
        ));
        assert!(allowed(
            &reqwest::Url::parse("https://ia800100.us.archive.org/image.jpg").unwrap()
        ));
        let root = std::env::temp_dir().join(format!("lumaire-art-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        fs::write(root.join("keep.txt"), b"external").unwrap();
        fs::write(root.join(cache_name("https://i.ytimg.com/a.jpg")), b"cache").unwrap();
        prune(&root, CACHE_BUDGET).unwrap();
        assert!(root.join("keep.txt").exists());
        assert!(!root.join(cache_name("https://i.ytimg.com/a.jpg")).exists());
        fs::remove_dir_all(root).unwrap();
    }
}
