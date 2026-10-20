//! Explicit, pinned Windows streaming-component installation; never modifies PATH.
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

const SET: &str = "youtube-2026.08.19-quickjs-0.17.0";
const MAX_BYTES: usize = 64 * 1024 * 1024;
struct Component {
    name: &'static str,
    url: &'static str,
    sha256: &'static str,
}
const COMPONENTS: [Component; 2] = [
    Component {
        name: "yt-dlp.exe",
        url: "https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp.exe",
        sha256: "66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a",
    },
    Component {
        name: "qjs.exe",
        url:
            "https://github.com/quickjs-ng/quickjs/releases/download/v0.17.0/qjs-windows-x86_64.exe",
        sha256: "2aeabf0092c3262d6b2609824418f7dd7ed1f1df939f73b2b15645230cac0d77",
    },
];
static INSTALLING: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn root() -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    if let Some(root) = std::env::var_os("LUMAIRE_DATA_DIR") {
        return Ok(PathBuf::from(root).join("components"));
    }
    let root = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .filter(|p| p.is_absolute())
        .ok_or("Windows local app data directory is unavailable.")?;
    Ok(root.join("app.lumaire.player").join("components"))
}

pub fn managed_engine() -> Option<PathBuf> {
    if !cfg!(windows) {
        return None;
    }
    let folder = root().ok()?.join(SET);
    COMPONENTS
        .iter()
        .all(|c| folder.join(c.name).is_file())
        .then(|| folder.join("yt-dlp.exe"))
}

pub fn managed_runtime(engine: &Path) -> Option<PathBuf> {
    let runtime = engine.parent()?.join("qjs.exe");
    runtime.is_file().then_some(runtime)
}

fn verify(bytes: &[u8], expected: &str) -> Result<(), String> {
    if bytes.len() > MAX_BYTES || !bytes.starts_with(b"MZ") {
        return Err("The component is not a supported Windows executable.".into());
    }
    let digest = format!("{:x}", Sha256::digest(bytes));
    if digest != expected {
        return Err(
            "Component checksum did not match. Nothing was installed; please retry.".into(),
        );
    }
    Ok(())
}

fn already_installed(folder: &Path) -> bool {
    COMPONENTS.iter().all(|component| {
        let path = folder.join(component.name);
        std::fs::metadata(&path).is_ok_and(|m| m.len() <= MAX_BYTES as u64)
            && std::fs::read(path).is_ok_and(|bytes| verify(&bytes, component.sha256).is_ok())
    })
}

async fn download(client: &reqwest::Client, component: &Component) -> Result<Vec<u8>, String> {
    let mut response = client
        .get(component.url)
        .send()
        .await
        .map_err(|e| format!("Could not download {}: {e}", component.name))?
        .error_for_status()
        .map_err(|e| format!("Could not download {}: {e}", component.name))?;
    if response
        .content_length()
        .is_some_and(|n| n > MAX_BYTES as u64)
    {
        return Err("Component download exceeded its size limit.".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        if bytes.len().saturating_add(chunk.len()) > MAX_BYTES {
            return Err("Component download exceeded its size limit.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    verify(&bytes, component.sha256)?;
    Ok(bytes)
}

fn promote(staging: &Path, destination: &Path, previous: &Path) -> Result<(), String> {
    let had_previous = destination.exists();
    if had_previous {
        std::fs::rename(destination, previous)
            .map_err(|e| format!("Close active online playback and retry installation: {e}"))?;
    }
    if let Err(error) = std::fs::rename(staging, destination) {
        if had_previous {
            let _ = std::fs::rename(previous, destination);
        }
        return Err(format!(
            "Could not activate the downloaded components: {error}"
        ));
    }
    // Keep a previous managed set recoverable instead of deleting it during repair.
    Ok(())
}

#[tauri::command]
pub async fn install_youtube_engine() -> Result<(), String> {
    if !cfg!(all(windows, target_arch = "x86_64")) {
        return Err(
            "This component installer is for 64-bit Windows. Android includes its engine.".into(),
        );
    }
    let _guard = INSTALLING
        .try_lock()
        .map_err(|_| "Component installation is already running.")?;
    let root = root()?;
    let destination = root.join(SET);
    if already_installed(&destination) {
        return Ok(());
    }
    let client = reqwest::Client::builder()
        .https_only(true)
        .user_agent("Lumaire/1.0.1 component-installer")
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;
    let staging = root.join(format!("staging-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
    let result = async {
        for component in &COMPONENTS {
            let bytes = download(&client, component).await?;
            std::fs::write(staging.join(component.name), bytes).map_err(|e| e.to_string())?;
        }
        promote(
            &staging,
            &destination,
            &root.join(format!("previous-{}", uuid::Uuid::new_v4())),
        )
    }
    .await;
    if result.is_err() {
        for component in &COMPONENTS {
            let _ = std::fs::remove_file(staging.join(component.name));
        }
        let _ = std::fs::remove_dir(staging);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_tampering_and_non_executables() {
        let bytes = b"MZfixture";
        let digest = format!("{:x}", Sha256::digest(bytes));
        assert!(verify(bytes, &digest).is_ok());
        assert!(verify(b"MZtampered", &digest).is_err());
        assert!(verify(b"<html>error</html>", &digest).is_err());
    }

    #[test]
    fn only_complete_sets_are_activated_and_previous_set_survives() {
        let root =
            std::env::temp_dir().join(format!("lumaire-components-{}", uuid::Uuid::new_v4()));
        let old = root.join("active");
        let staged = root.join("staged");
        let previous = root.join("previous");
        std::fs::create_dir_all(&old).unwrap();
        std::fs::create_dir_all(&staged).unwrap();
        std::fs::write(old.join("yt-dlp.exe"), b"old").unwrap();
        std::fs::write(staged.join("yt-dlp.exe"), b"new").unwrap();
        std::fs::write(staged.join("qjs.exe"), b"runtime").unwrap();
        promote(&staged, &old, &previous).unwrap();
        assert_eq!(std::fs::read(old.join("yt-dlp.exe")).unwrap(), b"new");
        assert_eq!(std::fs::read(previous.join("yt-dlp.exe")).unwrap(), b"old");
        assert!(managed_runtime(&old.join("yt-dlp.exe")).is_some());
        assert!(!already_installed(&old));
        let missing = root.join("missing");
        assert!(promote(&missing, &old, &root.join("rollback")).is_err());
        assert_eq!(std::fs::read(old.join("yt-dlp.exe")).unwrap(), b"new");
        std::fs::remove_dir_all(root).unwrap();
    }
}
