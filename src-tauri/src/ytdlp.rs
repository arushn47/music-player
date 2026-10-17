use log::{debug, error};
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::path::PathBuf;

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct YtdlpSearchResult {
    pub id: String,
    pub title: String,
    pub duration: Option<f64>,
    pub thumbnail: Option<String>,
    pub channel: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct YtdlpStreamInfo {
    pub stream_url: String,
    pub duration: Option<f64>,
    pub title: Option<String>,
    pub container: Option<String>,
    pub codec: Option<String>,
}

#[derive(Deserialize)]
struct YtdlpJson {
    id: Option<String>,
    title: Option<String>,
    duration: Option<f64>,
    url: Option<String>,
    thumbnail: Option<String>,
    ext: Option<String>,
    acodec: Option<String>,
    channel: Option<String>,
}

fn find_ytdlp() -> Result<PathBuf, String> {
    // Try current directory first (for bundled binary)
    let local_path = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.join("yt-dlp.exe")));
    
    if let Some(path) = local_path {
        if path.exists() {
            debug!("[yt-dlp] Found bundled binary at {:?}", path);
            return Ok(path);
        }
    }

    // Try system PATH
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("where").arg("yt-dlp").output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout);
                if let Some(first_line) = path_str.lines().next() {
                    let path = PathBuf::from(first_line.trim());
                    if path.exists() {
                        debug!("[yt-dlp] Found system binary at {:?}", path);
                        return Ok(path);
                    }
                }
            }
        }
    }

    Err("yt-dlp not found. Please install yt-dlp and ensure it's in your PATH, or place yt-dlp.exe next to the Lumaire executable.".to_string())
}

fn run_ytdlp(args: &[&str]) -> Result<String, String> {
    let program = find_ytdlp()?;
    
    let mut cmd = Command::new(&program);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    debug!("[yt-dlp] Executing: {:?} {:?}", program, args);

    let output = cmd.output().map_err(|error| {
        error!("[yt-dlp] Failed to execute: {}", error);
        format!("Failed to execute yt-dlp: {}. Is yt-dlp installed?", error)
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("[yt-dlp] Command failed: {}", stderr);
        return Err(format!("yt-dlp error: {}", stderr.lines().take(3).collect::<Vec<_>>().join(" ")));
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn parse_ndjson_entries(stdout: &str) -> Vec<YtdlpJson> {
    stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            serde_json::from_str::<YtdlpJson>(line).map_err(|e| {
                debug!("[yt-dlp] Failed to parse line: {}", e);
                e
            }).ok()
        })
        .collect()
}

#[tauri::command]
pub fn ytdlp_search(query: String, max_results: Option<u32>) -> Result<Vec<YtdlpSearchResult>, String> {
    let limit = max_results.unwrap_or(10);
    debug!("[yt-dlp] Searching: {} (limit: {})", query, limit);

    let search_url = format!("ytsearch{}:{}", limit, query);
    let stdout = run_ytdlp(&[
        "--dump-json",
        "--flat-playlist",
        "--no-warnings",
        &search_url,
    ])?;

    let results: Vec<YtdlpSearchResult> = parse_ndjson_entries(&stdout)
        .into_iter()
        .filter_map(|entry| {
            entry.id.map(|id| YtdlpSearchResult {
                id,
                title: entry.title.unwrap_or_else(|| "Unknown".to_string()),
                duration: entry.duration,
                thumbnail: entry.thumbnail,
                channel: entry.channel,
            })
        })
        .collect();

    debug!("[yt-dlp] Found {} results", results.len());
    Ok(results)
}

#[tauri::command]
pub fn ytdlp_get_stream(video_id: String) -> Result<YtdlpStreamInfo, String> {
    let url = if video_id.starts_with("http") {
        video_id
    } else {
        format!("https://www.youtube.com/watch?v={}", video_id)
    };
    
    debug!("[yt-dlp] Getting stream for: {}", url);

    let stdout = run_ytdlp(&[
        "-f",
        "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
        "--dump-json",
        "--no-playlist",
        "--no-warnings",
        &url,
    ])?;

    let info: YtdlpJson = serde_json::from_str(&stdout).map_err(|error| {
        error!("[yt-dlp] Failed to parse output: {}", error);
        format!("Failed to parse yt-dlp output: {}", error)
    })?;

    let stream_url = info.url.ok_or_else(|| {
        error!("[yt-dlp] No URL in output");
        "No stream URL returned by yt-dlp".to_string()
    })?;

    debug!(
        "[yt-dlp] Got stream for '{}', duration: {:?}s",
        info.title.as_deref().unwrap_or("Unknown"),
        info.duration
    );

    Ok(YtdlpStreamInfo {
        stream_url,
        duration: info.duration,
        title: info.title,
        container: info.ext,
        codec: info.acodec,
    })
}

#[tauri::command]
pub fn ytdlp_check_available() -> bool {
    find_ytdlp().is_ok()
}
