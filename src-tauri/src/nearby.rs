use serde::{Deserialize, Serialize};
use std::{io::{Read, Write}, net::{IpAddr, Ipv4Addr, TcpListener, TcpStream, UdpSocket}, sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}}, time::{Duration, Instant}};
use crate::Track;

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SharedState { pub playlists: Vec<SharedPlaylist>, pub now: Option<SharedNow> }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SharedPlaylist { pub id: String, pub name: String, pub tracks: Vec<Track> }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SharedNow { pub track: Track, pub position: f64, pub playing: bool }
struct Host { stop: Arc<AtomicBool>, data: Arc<Mutex<(SharedState, Instant)>> }
#[derive(Default)]
pub struct Nearby(Mutex<Option<Host>>);
const MAX: usize = 1_000_000;
const LIFETIME: Duration = Duration::from_secs(2 * 3600);

fn private(ip: Ipv4Addr) -> bool { ip.is_private() || ip.is_loopback() }
fn clean_track(track: &mut Track) -> Result<(), String> {
    if track.title.is_empty() || [&track.title, &track.artist, &track.album].iter().any(|s| s.len() > 4000) || !track.duration.is_finite() || !(0.0..=86400.0).contains(&track.duration) { return Err("Invalid shared track metadata.".into()) }
    if track.format == "catalog" {
        if !crate::collection_io::valid(track) { return Err("Invalid shared catalog identity.".into()) }
    } else {
        let source = track.source.as_mut().ok_or("Local files cannot be shared.")?;
        let youtube = source.provider_id == "youtube" && source.source_id.len() == 11 && source.source_id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-');
        let commons = source.provider_id == "wikimedia-commons" && source.source_id.parse::<u64>().is_ok_and(|id| id > 0);
        if (!youtube && !commons) || track.id != format!("{}:{}", source.provider_id, source.source_id) { return Err("Invalid shared source identity.".into()) }
        source.page_url = if youtube { format!("https://www.youtube.com/watch?v={}", source.source_id) } else { format!("https://commons.wikimedia.org/?curid={}", source.source_id) };
    }
    track.file_name.clear(); track.offline = false; track.missing = false;
    track.artwork_url = track.artwork_url.take().filter(|url| url.len() <= 4000 && url.starts_with("https://"));
    Ok(())
}
fn validate(data: &mut SharedState) -> Result<(), String> {
    if data.playlists.len() > 50 || data.playlists.iter().map(|p| p.tracks.len()).sum::<usize>() > 500 { return Err("Share up to 50 playlists and 500 tracks at a time.".into()) }
    for playlist in &mut data.playlists {
        if playlist.id.is_empty() || playlist.id.len() > 200 || playlist.name.is_empty() || playlist.name.len() > 400 { return Err("Invalid shared playlist.".into()) }
        for track in &mut playlist.tracks { clean_track(track)?; }
    }
    if let Some(now) = &mut data.now { clean_track(&mut now.track)?; if !now.position.is_finite() || !(0.0..=86400.0).contains(&now.position) { return Err("Invalid playback position.".into()) } }
    if serde_json::to_vec(data).map_err(|e| e.to_string())?.len() > MAX { return Err("Shared collection exceeds 1 MB.".into()) }
    Ok(())
}

fn serve(mut stream: TcpStream, token: &str, data: &Arc<Mutex<(SharedState, Instant)>>, stop: &AtomicBool) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
    let mut bytes = Vec::new(); let mut part = [0; 1024];
    while bytes.len() < 8192 && !bytes.windows(4).any(|s| s == b"\r\n\r\n") {
        match stream.read(&mut part) { Ok(0) | Err(_) => return, Ok(n) => bytes.extend_from_slice(&part[..n]) }
    }
    let Ok(headers) = std::str::from_utf8(&bytes) else { return };
    let mut lines = headers.split("\r\n");
    let request = lines.next().unwrap_or("");
    let authorized = lines.clone().any(|line| line.split_once(':').is_some_and(|(name, value)| name.eq_ignore_ascii_case("authorization") && value.trim() == format!("Bearer {token}")));
    let origin = lines.any(|line| line.to_ascii_lowercase().starts_with("origin:"));
    let (status, body) = if request != "GET /v1/state HTTP/1.1" || !authorized || origin || stop.load(Ordering::Relaxed) { ("403 Forbidden", "Pairing refused.".as_bytes().to_vec()) } else {
        let Ok(state) = data.lock() else { return };
        let mut snapshot = state.0.clone();
        if let Some(now) = &mut snapshot.now { if now.playing { now.position += state.1.elapsed().as_secs_f64(); } }
        ("200 OK", serde_json::to_vec(&snapshot).unwrap_or_default())
    };
    let _ = write!(stream, "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: {}\r\n\r\n", body.len());
    let _ = stream.write_all(&body);
}

#[tauri::command]
pub fn nearby_start(state: tauri::State<'_, Nearby>) -> Result<String, String> {
    let mut host = state.0.lock().map_err(|_| "Nearby state unavailable.")?;
    if host.is_some() { return Err("A nearby session is already open. Stop it before starting again.".into()) }
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.connect("192.0.2.1:80").map_err(|_| "Connect to Wi-Fi first.")?;
    let IpAddr::V4(ip) = socket.local_addr().map_err(|e| e.to_string())?.ip() else { return Err("An IPv4 Wi-Fi network is required.".into()) };
    if !private(ip) { return Err("Use a private Wi-Fi network for nearby sharing.".into()) }
    let listener = TcpListener::bind((Ipv4Addr::UNSPECIFIED, 0)).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let token = uuid::Uuid::new_v4().simple().to_string();
    let link = format!("http://{ip}:{port}/#{token}");
    let stop = Arc::new(AtomicBool::new(false)); let data = Arc::new(Mutex::new((SharedState::default(), Instant::now())));
    let thread_stop = stop.clone(); let thread_data = data.clone();
    std::thread::spawn(move || {
        let started = Instant::now();
        while !thread_stop.load(Ordering::Relaxed) && started.elapsed() < LIFETIME {
            match listener.accept() {
                Ok((stream, peer)) if matches!(peer.ip(), IpAddr::V4(ip) if private(ip)) => serve(stream, &token, &thread_data, &thread_stop),
                _ => std::thread::sleep(Duration::from_millis(40)),
            }
        }
        thread_stop.store(true, Ordering::Relaxed);
    });
    *host = Some(Host { stop, data }); Ok(link)
}
#[tauri::command]
pub fn nearby_stop(state: tauri::State<'_, Nearby>) -> Result<(), String> {
    if let Some(host) = state.0.lock().map_err(|_| "Nearby state unavailable.")?.take() { host.stop.store(true, Ordering::Relaxed); }
    Ok(())
}
#[tauri::command]
pub fn nearby_publish(state: tauri::State<'_, Nearby>, mut data: SharedState) -> Result<(), String> {
    validate(&mut data)?;
    let host = state.0.lock().map_err(|_| "Nearby state unavailable.")?;
    let host = host.as_ref().ok_or("Start sharing first.")?;
    if host.stop.load(Ordering::Relaxed) { return Err("Nearby session expired. Start a new session.".into()) }
    *host.data.lock().map_err(|_| "Nearby state unavailable.")? = (data, Instant::now()); Ok(())
}
fn destination(link: &str) -> Result<(reqwest::Url, String), String> {
    let mut url = reqwest::Url::parse(link.trim()).map_err(|_| "Paste a Lumaire pairing link.")?;
    let ip = url.host_str().and_then(|s| s.parse::<Ipv4Addr>().ok()).filter(|ip| private(*ip)).ok_or("Only private Wi-Fi IPv4 addresses are allowed.")?;
    let token = url.fragment().filter(|s| s.len() == 32 && s.bytes().all(|c| c.is_ascii_hexdigit())).ok_or("Invalid pairing code.")?.to_owned();
    if url.scheme() != "http" || url.port().is_none() || !url.username().is_empty() || url.password().is_some() || url.path() != "/" || url.query().is_some() || ip.is_unspecified() { return Err("Invalid nearby pairing link.".into()) }
    url.set_fragment(None); url.set_path("/v1/state"); Ok((url, token))
}
#[tauri::command]
pub async fn nearby_fetch(link: String) -> Result<SharedState, String> {
    let (url, token) = destination(&link)?;
    let client = reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(5)).build().map_err(|_| "Could not start nearby connection.")?;
    let mut response = client.get(url).bearer_auth(token).send().await.map_err(|_| "Cannot reach the other device. Check Wi-Fi, firewall permission and the pairing link.")?;
    if !response.status().is_success() { return Err("Pairing refused or expired. Ask the host for a new link.".into()) }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Nearby connection interrupted.")? { if bytes.len() + chunk.len() > MAX { return Err("Shared response is too large.".into()) } bytes.extend_from_slice(&chunk); }
    let mut data = serde_json::from_slice(&bytes).map_err(|_| "The other device returned invalid collection data.")?;
    validate(&mut data)?; Ok(data)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restricts_pairing_to_explicit_private_addresses_without_redirects_or_credentials() {
        let token = "1234567890abcdef1234567890abcdef";
        assert!(destination(&format!("http://192.168.1.5:1234/#{token}")).is_ok());
        for base in ["https://192.168.1.5:1234/", "http://example.com:1234/", "http://169.254.169.254:80/", "http://8.8.8.8:1234/", "http://user@192.168.1.5:1234/", "http://192.168.1.5:1234/private"] { assert!(destination(&format!("{base}#{token}")).is_err()); }
    }
    #[test]
    fn rejects_local_files_and_invalid_state() {
        let mut state = SharedState { playlists: vec![], now: Some(SharedNow { track: serde_json::from_value(serde_json::json!({"id":"local","title":"Song","artist":"Artist","album":"","duration":100,"fileName":"C:/secret.mp3","format":"MP3","missing":false})).unwrap(), position: 0.0, playing: false }) };
        assert!(validate(&mut state).is_err()); state.now = None; assert!(validate(&mut state).is_ok());
    }
    #[test]
    fn actual_http_requires_pairing_and_returns_validated_metadata() {
        let token = "1234567890abcdef1234567890abcdef";
        let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        for authorized in [false, true] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let port = listener.local_addr().unwrap().port();
            let data = Arc::new(Mutex::new((SharedState::default(), Instant::now())));
            let worker = std::thread::spawn(move || { let (stream, _) = listener.accept().unwrap(); serve(stream, token, &data, &AtomicBool::new(false)); });
            let link = format!("http://127.0.0.1:{port}/#{}", if authorized { token } else { "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
            let response = runtime.block_on(nearby_fetch(link));
            assert_eq!(response.is_ok(), authorized);
            if let Ok(state) = response { assert!(state.playlists.is_empty()); assert!(state.now.is_none()); }
            worker.join().unwrap();
        }
    }
}
