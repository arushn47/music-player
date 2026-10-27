//! Lossless repair of legacy app-owned Windows progressive MP4 downloads.
use crate::{err, Result};
use std::{fs, path::{Path, PathBuf}, process::{Command, Stdio}, time::{Duration, Instant}};

fn tool(program: &str, args: &[&std::ffi::OsStr]) -> Result<Vec<u8>> {
    let mut command = Command::new(program);
    command.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
    #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
    let mut child = command.spawn().map_err(|_| format!("{program} is required for lossless legacy repair; original retained."))?;
    let start = Instant::now();
    loop {
        if child.try_wait().map_err(err)?.is_some() { break; }
        if start.elapsed() > Duration::from_secs(120) {
            let _ = child.kill(); let _ = child.wait();
            return Err("Legacy audio repair timed out; original retained.".into());
        }
        std::thread::sleep(Duration::from_millis(30));
    }
    let output = child.wait_with_output().map_err(err)?;
    if !output.status.success() { return Err(format!("{program} could not verify lossless audio repair; original retained.")); }
    Ok(output.stdout)
}

struct Candidate(PathBuf);
impl Drop for Candidate { fn drop(&mut self) { if !self.0.as_os_str().is_empty() { let _ = fs::remove_file(&self.0); } } }

pub(crate) fn remux(source: &Path, destination: &Path) -> Result<()> {
    let audio = tool("ffprobe", &["-v".as_ref(), "error".as_ref(), "-select_streams".as_ref(), "a".as_ref(), "-show_entries".as_ref(), "stream=codec_name".as_ref(), "-of".as_ref(), "csv=p=0".as_ref(), source.as_os_str()])?;
    let codecs = std::str::from_utf8(&audio).map_err(err)?;
    if codecs.trim().is_empty() || codecs.lines().any(|codec| codec.trim() != "aac") {
        return Err("Legacy audio codec needs a different lossless container; original retained.".into());
    }
    let before = crate::audio_container::mp4_tracks(source)?.ok_or("Not an MP4 download.")?;
    if before.video == 0 { return Err("This download is already audio-only.".into()); }
    tool("ffmpeg", &["-nostdin".as_ref(), "-v".as_ref(), "error".as_ref(), "-n".as_ref(), "-protocol_whitelist".as_ref(), "file,pipe".as_ref(), "-i".as_ref(), source.as_os_str(), "-map".as_ref(), "0:a".as_ref(), "-map_metadata".as_ref(), "0".as_ref(), "-c:a".as_ref(), "copy".as_ref(), "-vn".as_ref(), "-sn".as_ref(), "-dn".as_ref(), "-movflags".as_ref(), "+faststart".as_ref(), "-f".as_ref(), "ipod".as_ref(), destination.as_os_str()])?;
    let after = crate::audio_container::mp4_tracks(destination)?.ok_or("Repair returned an invalid container.")?;
    if after.video != 0 || after.audio != before.audio { return Err("Repaired media track verification failed; original retained.".into()); }
    let hash = |path: &Path| tool("ffmpeg", &["-nostdin".as_ref(), "-v".as_ref(), "error".as_ref(), "-protocol_whitelist".as_ref(), "file,pipe".as_ref(), "-i".as_ref(), path.as_os_str(), "-map".as_ref(), "0:a".as_ref(), "-c:a".as_ref(), "copy".as_ref(), "-f".as_ref(), "hash".as_ref(), "-hash".as_ref(), "sha256".as_ref(), "-".as_ref()]);
    if hash(source)? != hash(destination)? { return Err("Encoded audio changed during remux; original retained.".into()); }
    // Decode every audio packet before retiring the old file; no re-encoding is written.
    tool("ffmpeg", &["-nostdin".as_ref(), "-v".as_ref(), "error".as_ref(), "-xerror".as_ref(), "-protocol_whitelist".as_ref(), "file,pipe".as_ref(), "-i".as_ref(), destination.as_os_str(), "-map".as_ref(), "0:a".as_ref(), "-f".as_ref(), "null".as_ref(), "-".as_ref()])?;
    fs::OpenOptions::new().write(true).open(destination).map_err(err)?.sync_all().map_err(err)?;
    Ok(())
}

pub(crate) fn replace_record(db: &rusqlite::Connection, old: &str, new: &str) -> Result<usize> {
    // Compare the persisted path, so cancellation/deletion cannot resurrect an offline download.
    db.execute("UPDATE tracks SET path=?1 WHERE path=?2", rusqlite::params![new,old]).map_err(err)
}

#[cfg(windows)]
pub(crate) async fn repair_existing(app: tauri::AppHandle) -> Result<()> {
    let directory = crate::downloads::root(&app)?;
    let paths = crate::work(app.clone(), |_,db| {
        let mut statement = db.prepare("SELECT DISTINCT path FROM tracks WHERE path IS NOT NULL").map_err(err)?;
        let rows = statement.query_map([], |r| r.get::<_,String>(0)).map_err(err)?;
        rows.collect::<std::result::Result<Vec<_>,_>>().map_err(err)
    }).await?;
    for path in paths {
        let source = PathBuf::from(&path);
        if source.parent().and_then(|p|p.canonicalize().ok()).as_ref() != Some(&directory)
            || source.file_stem().and_then(|s|s.to_str()).is_none_or(|s|uuid::Uuid::parse_str(s).is_err())
            || fs::symlink_metadata(&source).is_ok_and(|m|m.file_type().is_symlink()) { continue; }
        if !matches!(crate::audio_container::mp4_tracks(&source), Ok(Some(tracks)) if tracks.video > 0) { continue; }
        let source_copy = source.clone();
        let destination = directory.join(format!("{}.m4a",uuid::Uuid::new_v4()));
        let mut candidate = Candidate(destination.clone());
        let dest_copy = destination.clone();
        let old_metadata = fs::metadata(&source).map_err(err)?;
        let result = tauri::async_runtime::spawn_blocking(move || remux(&source_copy,&dest_copy)).await.map_err(err)?;
        if let Err(error) = result { log::warn!("Offline repair: {error}"); continue; }
        let new_length = fs::metadata(&candidate.0).map_err(err)?.len();
        let current = fs::metadata(&source).map_err(err)?;
        if current.len() != old_metadata.len() || current.modified().ok() != old_metadata.modified().ok() { continue; }
        let next_path = destination.to_string_lossy().into_owned();
        let saved = crate::work(app.clone(), move |app,db| { crate::allow(app,&destination)?; replace_record(db,&path,&next_path) }).await?;
        if saved == 0 { continue; }
        candidate.0.clear();
        match fs::remove_file(&source) {
            Ok(()) => log::info!("Repaired audio-only download; saved {} bytes",old_metadata.len().saturating_sub(new_length)),
            Err(error) => log::warn!("Audio repair committed; original still in use and retained: {error}"),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn real_legacy_mp4_preserves_encoded_audio_and_decodes_after_remux() {
        let Some(input)=std::env::var_os("LUMAIRE_LEGACY_MEDIA") else { return; };
        let destination=std::env::temp_dir().join(format!("{}.m4a",uuid::Uuid::new_v4()));
        let _candidate=super::Candidate(destination.clone());
        super::remux(std::path::Path::new(&input),&destination).unwrap();
        assert!(destination.metadata().unwrap().len() < std::fs::metadata(input).unwrap().len());
    }
    #[test]
    fn repair_updates_paths_without_replacing_metadata_and_does_not_resurrect_removed_downloads() {
        let db=rusqlite::Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE tracks(id TEXT, path TEXT, metadata TEXT); INSERT INTO tracks VALUES('a','old.mp4','latest favorite and credits'),('b',NULL,'removed');").unwrap();
        assert_eq!(super::replace_record(&db,"old.mp4","new.m4a").unwrap(),1);
        assert_eq!(super::replace_record(&db,"old.mp4","other.m4a").unwrap(),0);
        assert_eq!(db.query_row("SELECT metadata FROM tracks WHERE id='a'",[],|r|r.get::<_,String>(0)).unwrap(),"latest favorite and credits");
    }
}
