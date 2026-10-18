use log::{debug, error};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct YtdlpSearchResult {
    pub id: String,
    pub title: String,
    pub duration: Option<f64>,
    pub thumbnail: Option<String>,
    pub channel: Option<String>,
    pub track: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct YtdlpStreamInfo {
    pub stream_url: String,
    pub duration: Option<f64>,
    pub title: Option<String>,
    pub container: Option<String>,
    pub codec: Option<String>,
    pub track: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
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
    track: Option<String>,
    artist: Option<String>,
    artists: Option<Vec<String>>,
    album: Option<String>,
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
    cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());

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
        return Err(format!(
            "yt-dlp error: {}",
            stderr.lines().take(3).collect::<Vec<_>>().join(" ")
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn run_ytdlp_with_client(args: &[&str], client: &str) -> Result<String, String> {
    let mut owned = args
        .iter()
        .map(|arg| (*arg).to_string())
        .collect::<Vec<_>>();
    owned.push("--extractor-args".to_string());
    owned.push(format!("youtube:player_client={client}"));
    let refs = owned.iter().map(String::as_str).collect::<Vec<_>>();
    run_ytdlp(&refs)
}

fn is_youtube_verification_error(error: &str) -> bool {
    let lower = error.to_ascii_lowercase();
    lower.contains("sign in to confirm")
        || lower.contains("not a bot")
        || lower.contains("confirm you're not a bot")
}

fn friendly_stream_error(error: String) -> String {
    if is_youtube_verification_error(&error) {
        return "YouTube asked for verification and did not provide a playable stream. Try another upload or retry later.".into();
    }
    error
}

fn parse_ndjson_entries(stdout: &str) -> Vec<YtdlpJson> {
    stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            serde_json::from_str::<YtdlpJson>(line)
                .map_err(|e| {
                    debug!("[yt-dlp] Failed to parse line: {}", e);
                    e
                })
                .ok()
        })
        .collect()
}

/// Heuristic filter to identify likely music content vs random YouTube videos.
/// Helps avoid tutorials, podcasts, vlogs, gameplay, etc. being classified as songs.
fn is_likely_music(result: &YtdlpSearchResult) -> bool {
    let title = result.title.to_lowercase();
    let channel = result.channel.as_deref().unwrap_or_default().to_lowercase();
    let words: Vec<_> = title
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .collect();
    let excluded = [
        "podcast",
        "interview",
        "tutorial",
        "review",
        "unboxing",
        "vlog",
        "gameplay",
        "walkthrough",
        "reaction",
        "explained",
        "documentary",
        "news",
        "trailer",
        "lecture",
        "lesson",
        "course",
        "episode",
    ];
    if excluded.iter().any(|w| words.contains(w)) || title.contains("how to ") {
        return false;
    }
    if result
        .duration
        .is_some_and(|d| !d.is_finite() || !(30.0..=1200.0).contains(&d))
    {
        return false;
    }
    // Generic channel words (official/music) and substrings (ep/visual) aren't
    // evidence of a song. Positive evidence is required, including when duration
    // is absent. Unknown content is omitted, never silently promoted to music.
    if result
        .track
        .as_ref()
        .is_some_and(|track| !track.trim().is_empty())
        && result
            .artist
            .as_ref()
            .is_some_and(|artist| !artist.trim().is_empty())
    {
        return true;
    }
    [
        "official audio",
        "official music video",
        "lyric video",
        "official lyric",
        "visualizer",
    ]
    .iter()
    .any(|label| title.contains(label))
        || words.contains(&"lyrics")
        || words.contains(&"lyrical")
        || channel.ends_with(" - topic")
        || channel.ends_with("vevo")
        || (title.contains(" - ")
            && (title.contains("official video") || channel.ends_with(" records")))
}

#[tauri::command]
pub async fn ytdlp_search(
    query: String,
    max_results: Option<u32>,
) -> Result<Vec<YtdlpSearchResult>, String> {
    tauri::async_runtime::spawn_blocking(move || search(query, max_results))
        .await
        .map_err(|e| e.to_string())?
}

fn search(query: String, max_results: Option<u32>) -> Result<Vec<YtdlpSearchResult>, String> {
    let limit = max_results.unwrap_or(10).clamp(1, 50);
    debug!("[yt-dlp] Searching: {} (limit: {})", query, limit);

    let search_url = format!("ytsearch{}:{}", limit, query);
    let args = [
        "--ignore-config",
        "--skip-download",
        "--dump-json",
        "--flat-playlist",
        "--no-warnings",
        &search_url,
    ];
    let stdout = match run_ytdlp(&args) {
        Ok(stdout) => stdout,
        Err(error) if is_youtube_verification_error(&error) => {
            run_ytdlp_with_client(&args, "android").map_err(friendly_stream_error)?
        }
        Err(error) => return Err(friendly_stream_error(error)),
    };

    let all_results: Vec<YtdlpSearchResult> = parse_ndjson_entries(&stdout)
        .into_iter()
        .filter_map(|entry| {
            entry.id.map(|id| YtdlpSearchResult {
                id: id.clone(),
                title: entry.title.unwrap_or_else(|| "Unknown".to_string()),
                duration: entry.duration,
                thumbnail: entry
                    .thumbnail
                    .or_else(|| Some(format!("https://i.ytimg.com/vi/{id}/hqdefault.jpg"))),
                channel: entry.channel,
                track: entry.track,
                artist: entry
                    .artist
                    .or_else(|| entry.artists.map(|artists| artists.join(", "))),
                album: entry.album,
            })
        })
        .collect();

    // Apply music classification filter
    let results: Vec<YtdlpSearchResult> = all_results
        .into_iter()
        .filter(|result| {
            let is_music = is_likely_music(result);
            if !is_music {
                debug!(
                    "[yt-dlp] Filtered out non-music: '{}' by '{}'",
                    result.title,
                    result.channel.as_deref().unwrap_or("Unknown")
                );
            }
            is_music
        })
        .collect();

    debug!(
        "[yt-dlp] Found {} results ({} after filtering)",
        results.len(),
        results.len()
    );
    Ok(results)
}

#[tauri::command]
pub async fn ytdlp_get_stream(video_id: String) -> Result<YtdlpStreamInfo, String> {
    if video_id.len() != 11
        || !video_id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
    {
        return Err("Invalid YouTube source ID.".into());
    }
    tauri::async_runtime::spawn_blocking(move || resolve(video_id))
        .await
        .map_err(|e| e.to_string())?
}

fn resolve(video_id: String) -> Result<YtdlpStreamInfo, String> {
    resolve_audio(video_id, "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio")
}

pub async fn download_audio(video_id: String) -> Result<YtdlpStreamInfo, String> {
    if video_id.len() != 11
        || !video_id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
    {
        return Err("Invalid YouTube source ID.".into());
    }
    // Store a native-playable audio container without conversion or video tracks.
    tokio::time::timeout(
        std::time::Duration::from_secs(60),
        tauri::async_runtime::spawn_blocking(move || resolve_audio(video_id, "bestaudio[ext=m4a]")),
    )
    .await
    .map_err(|_| "YouTube audio lookup timed out. Try again when online.".to_string())?
    .map_err(|e| e.to_string())?
}

fn resolve_audio(video_id: String, format: &str) -> Result<YtdlpStreamInfo, String> {
    let url = format!("https://www.youtube.com/watch?v={}", video_id);

    debug!("[yt-dlp] Getting stream for: {}", url);

    let args = [
        "--ignore-config",
        "--skip-download",
        "-f",
        format,
        "--socket-timeout",
        "10",
        "--retries",
        "2",
        "--extractor-retries",
        "2",
        "--dump-json",
        "--no-playlist",
        "--no-warnings",
        &url,
    ];

    let stdout = match run_ytdlp(&args) {
        Ok(stdout) => stdout,
        Err(error) if is_youtube_verification_error(&error) => {
            // YouTube may challenge the default web client. The public Android
            // client often still exposes a progressive audio-bearing format;
            // use it only for this source and only after the normal path fails.
            let fallback_args = [
                "--ignore-config",
                "--skip-download",
                "-f",
                "best[acodec!=none]/bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
                "--socket-timeout",
                "10",
                "--retries",
                "2",
                "--extractor-retries",
                "2",
                "--dump-json",
                "--no-playlist",
                "--no-warnings",
                &url,
            ];
            run_ytdlp_with_client(&fallback_args, "android").map_err(friendly_stream_error)?
        }
        Err(error) => return Err(friendly_stream_error(error)),
    };

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
        track: info.track,
        artist: info
            .artist
            .or_else(|| info.artists.map(|artists| artists.join(", "))),
        album: info.album,
    })
}

#[tauri::command]
pub fn ytdlp_check_available() -> bool {
    find_ytdlp().is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn entry(title: &str, channel: &str) -> YtdlpSearchResult {
        YtdlpSearchResult {
            id: "abcdefghijk".into(),
            title: title.into(),
            duration: Some(173.0),
            thumbnail: None,
            channel: Some(channel.into()),
            track: None,
            artist: None,
            album: None,
        }
    }
    #[test]
    fn generic_official_channels_and_substrings_are_not_music_evidence() {
        assert!(!is_likely_music(&entry(
            "Deep cleaning my kitchen",
            "Official Channel"
        )));
        assert!(!is_likely_music(&entry(
            "New visual design",
            "Music Talk Official"
        )));
        assert!(!is_likely_music(&entry(
            "How to play Snowman (Official Audio)",
            "SiaVEVO"
        )));
        assert!(!is_likely_music(&entry("Snowman reaction", "Sia - Topic")));
    }
    #[test]
    fn recognizes_topic_vevo_and_explicit_music_labels() {
        assert!(is_likely_music(&entry(
            "Alaakaa Loova Lyrical (Tamil) | OM | Dhanush",
            "Divo Music and 3 more"
        )));
        assert!(is_likely_music(&entry("Snowman", "Sia - Topic")));
        assert!(is_likely_music(&entry("Sia - Snowman", "SiaVEVO")));
        assert!(is_likely_music(&entry(
            "Sia - Snowman (Official Audio)",
            "Sia"
        )));
    }

    #[test]
    fn recognizes_youtube_verification_errors_without_requiring_cookies() {
        assert!(is_youtube_verification_error(
            "Sign in to confirm you're not a bot"
        ));
        assert!(is_youtube_verification_error(
            "Please verify you are not a bot"
        ));
        assert!(!is_youtube_verification_error(
            "Requested format is not available"
        ));
        assert_eq!(
            friendly_stream_error("Sign in to confirm you're not a bot".into()),
            "YouTube asked for verification and did not provide a playable stream. Try another upload or retry later."
        );
    }
}
