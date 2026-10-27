use std::{fs::File, io::{Read, Seek, SeekFrom}, path::Path};
use crate::{err, Result};

#[derive(Default, Debug, PartialEq)]
pub(crate) struct Tracks { pub audio: usize, pub video: usize }

// MP4 tags/cover art are not media tracks. Inspect handler boxes, not extensions or MIME labels.
pub(crate) fn mp4_tracks(path: &Path) -> Result<Option<Tracks>> {
    let mut file = File::open(path).map_err(err)?;
    let length = file.metadata().map_err(err)?.len();
    let mut header = [0; 12];
    if file.read(&mut header).map_err(err)? < 12 || &header[4..8] != b"ftyp" { return Ok(None); }
    let mut tracks = Tracks::default();
    let mut budget = 100_000usize;
    boxes(&mut file, 0, length, 0, &mut budget, &mut tracks)?;
    if tracks.audio == 0 { return Err("MP4 contains no verified audio track.".into()); }
    Ok(Some(tracks))
}

fn boxes(file: &mut File, mut position: u64, end: u64, depth: u8, budget: &mut usize, tracks: &mut Tracks) -> Result<()> {
    while position < end {
        if end - position < 8 || *budget == 0 { return Err("Invalid media container.".into()); }
        *budget -= 1;
        file.seek(SeekFrom::Start(position)).map_err(err)?;
        let mut header = [0; 8]; file.read_exact(&mut header).map_err(err)?;
        let size = u32::from_be_bytes(header[..4].try_into().unwrap()) as u64;
        let (size, header_size) = if size == 1 {
            let mut large = [0; 8]; file.read_exact(&mut large).map_err(err)?;
            (u64::from_be_bytes(large), 16)
        } else { (if size == 0 { end - position } else { size }, 8) };
        let next = position.checked_add(size).filter(|next| *next <= end && size >= header_size).ok_or("Invalid MP4 box size.")?;
        let kind = &header[4..8];
        if matches!((depth, kind), (0, b"moov") | (1, b"trak") | (2, b"mdia")) {
            boxes(file, position + header_size, next, depth + 1, budget, tracks)?;
        } else if depth == 3 && kind == b"hdlr" {
            if size < header_size + 12 { return Err("Invalid MP4 track handler.".into()); }
            let mut handler = [0; 12]; file.read_exact(&mut handler).map_err(err)?;
            match &handler[8..12] { b"soun" => tracks.audio += 1, b"vide" => tracks.video += 1, _ => {} }
        }
        position = next;
    }
    Ok(())
}

pub(crate) fn require_audio_only(path: &Path) -> Result<()> {
    if mp4_tracks(path)?.is_some_and(|tracks| tracks.video > 0) {
        return Err("The downloaded media contains video tracks; no offline copy was saved.".into());
    }
    let mut file = File::open(path).map_err(err)?;
    let mut beginning = vec![0; 65536]; let read = file.read(&mut beginning).map_err(err)?;
    if beginning[..read].starts_with(b"OggS") && beginning[..read].windows(7).any(|bytes| bytes == b"\x80theora") {
        return Err("Ogg video is not an audio-only download.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn atom(kind: &[u8; 4], content: Vec<u8>) -> Vec<u8> { [((content.len()+8) as u32).to_be_bytes().as_slice(),kind,&content].concat() }
    fn track(kind: &[u8; 4]) -> Vec<u8> { atom(b"trak", atom(b"mdia", atom(b"hdlr", [vec![0;8],kind.to_vec()].concat()))) }
    #[test]
    fn rejects_real_video_handlers_but_not_cover_metadata_and_checks_bounds() {
        let path = std::env::temp_dir().join(format!("{}.part",uuid::Uuid::new_v4()));
        let header = atom(b"ftyp",b"M4A \0\0\0\0".to_vec());
        std::fs::write(&path,[header.clone(),atom(b"moov",[track(b"soun"),atom(b"udta",b"vide cover art".to_vec())].concat())].concat()).unwrap();
        assert_eq!(mp4_tracks(&path).unwrap(),Some(Tracks{audio:1,video:0})); require_audio_only(&path).unwrap();
        std::fs::write(&path,[header.clone(),atom(b"moov",[track(b"soun"),track(b"vide")].concat())].concat()).unwrap();
        assert!(require_audio_only(&path).is_err());
        std::fs::write(&path,[header,vec![0xff;8]].concat()).unwrap(); assert!(mp4_tracks(&path).is_err());
        std::fs::remove_file(path).unwrap();
    }
}
