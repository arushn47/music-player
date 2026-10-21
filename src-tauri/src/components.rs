//! Explicit, pinned Windows streaming-component installation; never modifies PATH.
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

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
static CANCELLED: AtomicBool = AtomicBool::new(false);

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgress {
    stage: &'static str,
    component: &'static str,
    received: usize,
    total: Option<u64>,
    attempt: u8,
}

fn cancelled() -> Result<(), String> {
    if CANCELLED.load(Ordering::Relaxed) {
        Err("Installation cancelled. You can try again whenever you're ready.".into())
    } else {
        Ok(())
    }
}

async fn interruptible<T>(future: impl std::future::Future<Output = T>) -> Result<T, String> {
    tokio::pin!(future);
    loop {
        cancelled()?;
        if let Ok(result) = tokio::time::timeout(Duration::from_millis(100), future.as_mut()).await
        {
            return Ok(result);
        }
    }
}

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

fn retryable_status(status: reqwest::StatusCode) -> bool {
    status == reqwest::StatusCode::TOO_MANY_REQUESTS || status.is_server_error()
}

async fn download(
    client: &reqwest::Client,
    component: &Component,
    report: &impl Fn(InstallProgress),
) -> Result<Vec<u8>, String> {
    let mut last_error = String::new();
    for attempt in 1..=3 {
        report(InstallProgress {
            stage: if attempt == 1 {
                "connecting"
            } else {
                "retrying"
            },
            component: component.name,
            received: 0,
            total: None,
            attempt,
        });
        match download_once(client, component, attempt, report).await {
            Ok(bytes) => return Ok(bytes),
            Err((message, retry)) => {
                last_error = message;
                cancelled()?;
                if !retry || attempt == 3 {
                    break;
                }
                interruptible(tokio::time::sleep(Duration::from_secs(
                    u64::from(attempt) * 2,
                )))
                .await?;
            }
        }
    }
    Err(last_error)
}

async fn download_once(
    client: &reqwest::Client,
    component: &Component,
    attempt: u8,
    report: &impl Fn(InstallProgress),
) -> Result<Vec<u8>, (String, bool)> {
    let mut response = interruptible(tokio::time::timeout(Duration::from_secs(30), client.get(component.url).send())).await.map_err(|e| (e, false))?
        .map_err(|_| (format!("The official download server did not respond for {}. Please retry.", component.name), true))?
        .map_err(|e| (format!("Could not connect to the official download for {}. Check your connection and retry. Details: {e}", component.name), e.is_timeout() || e.is_connect() || e.is_request()))?;
    let status = response.status();
    if !status.is_success() {
        return Err((format!("The official download server returned HTTP {status} for {}. Please try again later.", component.name), retryable_status(status)));
    }
    if response
        .content_length()
        .is_some_and(|n| n > MAX_BYTES as u64)
    {
        return Err((
            "Component download exceeded its size limit. Nothing was installed.".into(),
            false,
        ));
    }
    let total = response.content_length();
    let mut bytes = Vec::new();
    let mut last_report = Instant::now();
    report(InstallProgress {
        stage: "downloading",
        component: component.name,
        received: 0,
        total,
        attempt,
    });
    while let Some(chunk) = interruptible(tokio::time::timeout(Duration::from_secs(30), response.chunk())).await.map_err(|e| (e, false))?
        .map_err(|_| (format!("The download of {} stopped responding for 30 seconds. Check your connection and retry.", component.name), true))?
        .map_err(|e| (format!("The download of {} was interrupted. Please retry. Details: {e}", component.name), true))? {
        if bytes.len().saturating_add(chunk.len()) > MAX_BYTES {
            return Err(("Component download exceeded its size limit. Nothing was installed.".into(), false));
        }
        bytes.extend_from_slice(&chunk);
        if last_report.elapsed() >= Duration::from_millis(100) {
            report(InstallProgress { stage: "downloading", component: component.name, received: bytes.len(), total, attempt });
            last_report = Instant::now();
        }
    }
    report(InstallProgress {
        stage: "verifying",
        component: component.name,
        received: bytes.len(),
        total,
        attempt,
    });
    verify(&bytes, component.sha256).map_err(|e| (format!("{}: {e}", component.name), false))?;
    Ok(bytes)
}

pub fn test_executable(path: &Path, args: &[&str]) -> Result<(), String> {
    let mut command = std::process::Command::new(path);
    command
        .args(args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|e| format!("Windows could not start {}. Review Windows Security protection history and device policies, then retry. Details: {e}", path.file_name().unwrap_or_default().to_string_lossy()))?;
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => return Ok(()),
            Ok(Some(status)) => {
                return Err(format!(
                    "{} failed its startup test ({status}). No new components were activated.",
                    path.file_name().unwrap_or_default().to_string_lossy()
                ))
            }
            Ok(None) if started.elapsed() < Duration::from_secs(15) => {
                std::thread::sleep(Duration::from_millis(50))
            }
            result => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!(
                    "The component startup test did not finish. Please retry. Details: {result:?}"
                ));
            }
        }
    }
}

async fn test_set(folder: PathBuf) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        test_executable(&folder.join("yt-dlp.exe"), &["--version"])?;
        test_executable(
            &folder.join("qjs.exe"),
            &["-e", "if (6 * 7 !== 42) throw Error('Runtime test failed')"],
        )
    })
    .await
    .map_err(|e| e.to_string())?
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
pub async fn install_youtube_engine(
    on_progress: tauri::ipc::Channel<InstallProgress>,
) -> Result<(), String> {
    if !cfg!(all(windows, target_arch = "x86_64")) {
        return Err(
            "This component installer is for 64-bit Windows. Android includes its engine.".into(),
        );
    }
    let _guard = INSTALLING
        .try_lock()
        .map_err(|_| "Component installation is already running.")?;
    CANCELLED.store(false, Ordering::Relaxed);
    let report = |progress| {
        let _ = on_progress.send(progress);
    };
    let root = root()?;
    let destination = root.join(SET);
    report(InstallProgress {
        stage: "verifying",
        component: "installed components",
        received: 0,
        total: None,
        attempt: 1,
    });
    let existing = destination.clone();
    if tauri::async_runtime::spawn_blocking(move || already_installed(&existing))
        .await
        .map_err(|e| e.to_string())?
    {
        report(InstallProgress {
            stage: "testing",
            component: "installed components",
            received: 0,
            total: None,
            attempt: 1,
        });
        test_set(destination).await?;
        cancelled()?;
        return Ok(());
    }
    let client = reqwest::Client::builder()
        .https_only(true)
        .user_agent("Lumaire component-installer")
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;
    let staging = root.join(format!("staging-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&staging).map_err(|e| format!("Could not create Lumaire's component folder. Check disk space and folder permissions. Details: {e}"))?;
    let result = async {
        for component in &COMPONENTS {
            let bytes = download(&client, component, &report).await?;
            cancelled()?;
            std::fs::write(staging.join(component.name), bytes).map_err(|e| {
                format!(
                    "Could not save {}. Check disk space and folder permissions. Details: {e}",
                    component.name
                )
            })?;
        }
        report(InstallProgress {
            stage: "testing",
            component: "downloaded components",
            received: 0,
            total: None,
            attempt: 1,
        });
        test_set(staging.clone()).await?;
        cancelled()?;
        report(InstallProgress {
            stage: "activating",
            component: "downloaded components",
            received: 0,
            total: None,
            attempt: 1,
        });
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

#[tauri::command]
pub fn cancel_youtube_engine_install() {
    CANCELLED.store(true, Ordering::Relaxed);
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
    fn retries_only_transient_http_failures() {
        for code in [429, 500, 502, 503, 504] {
            assert!(retryable_status(
                reqwest::StatusCode::from_u16(code).unwrap()
            ));
        }
        for code in [200, 400, 401, 403, 404] {
            assert!(!retryable_status(
                reqwest::StatusCode::from_u16(code).unwrap()
            ));
        }
    }

    #[test]
    fn cancellation_interrupts_stalled_work() {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                let _guard = INSTALLING.lock().await;
                CANCELLED.store(true, Ordering::Relaxed);
                assert!(interruptible(std::future::pending::<()>())
                    .await
                    .unwrap_err()
                    .contains("cancelled"));
                CANCELLED.store(false, Ordering::Relaxed);
                assert_eq!(interruptible(async { 42 }).await.unwrap(), 42);
            });
    }

    #[test]
    fn startup_checks_reject_failed_processes() {
        let executable = std::env::current_exe().unwrap();
        assert!(test_executable(&executable, &["--list"]).is_ok());
        assert!(test_executable(&executable, &["--invalid-argument"]).is_err());
        assert!(
            test_executable(&executable.with_file_name("missing-component.exe"), &[])
                .unwrap_err()
                .contains("could not start")
        );
    }

    #[test]
    fn transient_server_failure_retries_and_reports_real_bytes_before_verification() {
        tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap().block_on(async {
        use std::io::{Read, Write};
        let _guard = INSTALLING.lock().await;
        CANCELLED.store(false, Ordering::Relaxed);
        let server = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/fixture", server.local_addr().unwrap());
        let thread = std::thread::spawn(move || {
            for status in ["503 Service Unavailable", "200 OK"] {
                let (mut socket, _) = server.accept().unwrap();
                let _ = socket.read(&mut [0; 1024]);
                write!(socket, "HTTP/1.1 {status}\r\nContent-Length: 9\r\nConnection: close\r\n\r\nMZfixture").unwrap();
            }
        });
        let component = Component { name: "fixture.exe", url: Box::leak(url.into_boxed_str()), sha256: Box::leak(format!("{:x}", Sha256::digest(b"MZfixture")).into_boxed_str()) };
        let events = std::sync::Mutex::new(Vec::new());
        let bytes = download(&reqwest::Client::new(), &component, &|event| events.lock().unwrap().push(event)).await.unwrap();
        thread.join().unwrap();
        assert_eq!(bytes, b"MZfixture");
        let events = events.lock().unwrap();
        assert!(events.iter().any(|event| event.stage == "retrying" && event.attempt == 2));
        assert!(events.iter().any(|event| event.stage == "downloading" && event.total == Some(9)));
        let last = events.last().unwrap();
        assert_eq!(last.stage, "verifying");
        assert_eq!(last.received, 9);
        });
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
