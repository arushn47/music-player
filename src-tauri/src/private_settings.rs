//! User-owned credentials. Never part of SQLite, backups, logs, or renderer reads.
use crate::Result;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use tauri::Manager;

fn key_path(app: &tauri::AppHandle) -> Result<PathBuf> {
    #[cfg(debug_assertions)]
    let root = std::env::var_os("LUMAIRE_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or(
            app.path()
                .app_local_data_dir()
                .map_err(|_| "Private settings are unavailable.")?,
        );
    #[cfg(not(debug_assertions))]
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "Private settings are unavailable.")?;
    let directory = root.join("private");
    fs::create_dir_all(&directory).map_err(|_| "Could not open private local settings.")?;
    if directory
        .canonicalize()
        .map_err(|_| "Private settings are unavailable.")?
        != root
            .canonicalize()
            .map_err(|_| "Private settings are unavailable.")?
            .join("private")
    {
        return Err("Private settings must not be a directory link.".into());
    }
    let path = directory.join("gemini.dpapi");
    check_file(&path)?;
    Ok(path)
}

fn check_file(path: &Path) -> Result<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if !metadata.is_file() || metadata.file_type().is_symlink() => {
            Err("Private settings must be a regular file.".into())
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("Could not access private settings.".into()),
    }
}

#[cfg(windows)]
fn crypt(bytes: &[u8], decrypt: bool) -> Result<Vec<u8>> {
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
        },
    };
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    // Current-user DPAPI scope: deliberately never use LOCAL_MACHINE. No prompt
    // or plaintext renderer getter. The only caller of decrypted data is the
    // fixed Gemini lyric endpoint in translation.rs.
    let success = unsafe {
        if decrypt {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        }
    };
    if success == 0 {
        return Err(
            "Windows could not unlock private settings. Save your key again on this device.".into(),
        );
    }
    if output.pbData.is_null() || output.cbData == 0 {
        if !output.pbData.is_null() {
            unsafe {
                LocalFree(output.pbData as *mut _);
            }
        }
        return Err("Private settings are invalid. Save your key again.".into());
    }
    let result =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        for index in 0..output.cbData as usize {
            std::ptr::write_volatile(output.pbData.add(index), 0);
        }
        LocalFree(output.pbData as *mut _);
    }
    Ok(result)
}

#[cfg(not(windows))]
fn crypt(_: &[u8], _: bool) -> Result<Vec<u8>> {
    Err("Secure key storage is not available on this platform yet.".into())
}

fn save_at(path: &Path, key: &str) -> Result<()> {
    let key = key.trim();
    if key.is_empty() || key.len() > 512 || key.chars().any(|c| c.is_control() || c.is_whitespace())
    {
        return Err("Enter a valid Gemini API key.".into());
    }
    check_file(path)?;
    let protected = crypt(key.as_bytes(), false)?;
    let temporary = path.with_file_name(format!("{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)?;
        file.write_all(&protected)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(temporary);
        return Err("Could not save the key privately on this device.".into());
    }
    Ok(())
}

fn load_at(path: &Path) -> Result<Option<String>> {
    check_file(path)?;
    if fs::metadata(path).is_ok_and(|metadata| metadata.len() > 8192) {
        return Err("Private settings are invalid. Save your key again.".into());
    }
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("Could not read private settings.".into()),
    };
    if bytes.len() > 8192 {
        return Err("Private settings are invalid. Save your key again.".into());
    }
    let key =
        String::from_utf8(crypt(&bytes, true)?).map_err(|_| "Private settings are invalid.")?;
    Ok(Some(key))
}

pub(crate) fn gemini_key(app: &tauri::AppHandle) -> Result<String> {
    load_at(&key_path(app)?)?.ok_or("Save your Gemini API key in Lyrics settings first.".into())
}

#[tauri::command]
pub fn gemini_key_status(app: tauri::AppHandle) -> Result<bool> {
    Ok(load_at(&key_path(&app)?)?.is_some())
}

#[tauri::command]
pub fn save_gemini_key(app: tauri::AppHandle, key: String) -> Result<()> {
    save_at(&key_path(&app)?, &key)
}

#[tauri::command]
pub fn delete_gemini_key(app: tauri::AppHandle) -> Result<()> {
    let path = key_path(&app)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("Could not remove the saved key.".into()),
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn encrypted_key_survives_reopen_and_replacement_without_plaintext_files() {
        let root = std::env::temp_dir().join(format!("lumaire-private-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let path = root.join("gemini.dpapi");
        assert!(load_at(&path).unwrap().is_none());
        save_at(&path, "fixture-private-key-one").unwrap();
        let bytes = fs::read(&path).unwrap();
        assert!(!bytes
            .windows(23)
            .any(|part| part == b"fixture-private-key-one"));
        assert_eq!(load_at(&path).unwrap().unwrap(), "fixture-private-key-one");
        save_at(&path, "fixture-private-key-two").unwrap();
        assert_eq!(load_at(&path).unwrap().unwrap(), "fixture-private-key-two");
        assert!(save_at(&path, "bad\nkey").is_err());
        assert_eq!(fs::read_dir(&root).unwrap().count(), 1);
        fs::write(&path, b"corrupt").unwrap();
        assert!(load_at(&path).is_err());
        fs::remove_file(path).unwrap();
        fs::remove_dir(root).unwrap();
    }
}
