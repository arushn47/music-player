//! Android-only platform boundary. Desktop keeps its existing adapters.
/// Generates an original test tone inside this app only. No arbitrary paths,
/// external media, or credentials. Disabled in release builds.
#[tauri::command]
pub async fn android_demo_track(app: tauri::AppHandle) -> crate::Result<crate::Imported> {
    #[cfg(all(debug_assertions, target_os = "android"))]
    {
        use tauri::Manager;
        crate::work(app, |app, db| {
            let folder = app
                .path()
                .app_data_dir()
                .map_err(crate::err)?
                .join("test-fixtures");
            std::fs::create_dir_all(&folder).map_err(crate::err)?;
            let path = folder.join("Lumaire - Android prototype.wav");
            if !path.exists() {
                const RATE: u32 = 8000;
                const COUNT: u32 = RATE * 40;
                let mut wav = Vec::with_capacity(44 + COUNT as usize * 2);
                wav.extend(b"RIFF");
                wav.extend((36 + COUNT * 2).to_le_bytes());
                wav.extend(b"WAVEfmt ");
                wav.extend(16u32.to_le_bytes());
                wav.extend(1u16.to_le_bytes());
                wav.extend(1u16.to_le_bytes());
                wav.extend(RATE.to_le_bytes());
                wav.extend((RATE * 2).to_le_bytes());
                wav.extend(2u16.to_le_bytes());
                wav.extend(16u16.to_le_bytes());
                wav.extend(b"data");
                wav.extend((COUNT * 2).to_le_bytes());
                for sample in 0..COUNT {
                    let value = ((sample as f64 * 330.0 * std::f64::consts::TAU / RATE as f64)
                        .sin()
                        * 1000.0) as i16;
                    wav.extend(value.to_le_bytes());
                }
                std::fs::write(&path, wav).map_err(crate::err)?;
            }
            crate::import_selected(app, db, vec![path])
        })
        .await
    }
    #[cfg(not(all(debug_assertions, target_os = "android")))]
    {
        let _ = app;
        Err("Synthetic device fixture is available only in Android debug builds.".into())
    }
}
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("lumaire-android")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                use tauri::Manager;
                let handle = _api.register_android_plugin("app.lumaire.player", "LumairePlugin")?;
                _app.manage(Android(handle));
            }
            Ok(())
        })
        .build()
}

#[cfg(target_os = "android")]
pub struct Android<R: Runtime>(tauri::plugin::PluginHandle<R>);

#[cfg(target_os = "android")]
static LOAD_GENERATION: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

#[cfg(target_os = "android")]
pub async fn call(
    app: &tauri::AppHandle,
    command: &str,
    args: serde_json::Value,
) -> crate::Result<serde_json::Value> {
    use tauri::Manager;
    app.state::<Android<tauri::Wry>>()
        .0
        .run_mobile_plugin_async(command, args)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn android_playback(
    _app: tauri::AppHandle,
    action: String,
    id: Option<String>,
    position: Option<f64>,
    autoplay: Option<bool>,
    value: Option<f64>,
) -> crate::Result<serde_json::Value> {
    #[cfg(target_os = "android")]
    {
        use crate::*;
        let mut args = serde_json::json!({"action":action});
        match action.as_str() {
            "load" => {
                use std::sync::atomic::Ordering;
                let generation = LOAD_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
                let id = id.ok_or("Choose a track first.")?;
                let saved = work(_app.clone(), {
                    let id = id.clone();
                    move |_, db| {
                        db.query_row("SELECT metadata,path FROM tracks WHERE id=?1", [id], |r| {
                            Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?))
                        })
                        .optional()
                        .map_err(err)
                    }
                })
                .await?;
                let track = saved
                    .as_ref()
                    .map(|(json, _)| serde_json::from_str::<Track>(json))
                    .transpose()
                    .map_err(err)?;
                let uri = if saved.as_ref().is_some_and(|(_, path)| path.is_some()) {
                    let path = media_path(_app.clone(), id.clone()).await?;
                    reqwest::Url::from_file_path(path)
                        .map_err(|_| "Invalid local audio path.")?
                        .to_string()
                } else if let Some(source) = id.strip_prefix("wikimedia-commons:") {
                    resolve_commons_audio(source.to_string()).await?.url
                } else {
                    return Err("YouTube playback is not available in the Android prototype. Choose local or Commons audio.".into());
                };
                args["uri"] = uri.into();
                if LOAD_GENERATION.load(Ordering::SeqCst) != generation {
                    return Err("Playback selection changed.".into());
                }
                args["id"] = id.into();
                args["title"] = track
                    .as_ref()
                    .map(|t| t.title.clone())
                    .unwrap_or("Online audio".into())
                    .into();
                args["artist"] = track
                    .as_ref()
                    .map(|t| t.artist.clone())
                    .unwrap_or_default()
                    .into();
                args["position"] = position
                    .filter(|v| v.is_finite() && *v >= 0.0)
                    .unwrap_or(0.0)
                    .into();
                args["autoplay"] = autoplay.unwrap_or(false).into();
            }
            "seek" | "volume" => {
                args["value"] = value
                    .filter(|v| v.is_finite() && *v >= 0.0)
                    .ok_or("Invalid playback value.")?
                    .into();
            }
            "stop" => {
                LOAD_GENERATION.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            }
            "play" | "pause" | "state" => {}
            _ => return Err("Unsupported playback action.".into()),
        }
        call(&_app, "playback", args).await
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (action, id, position, autoplay, value);
        Err("Android playback is available only in the Android app.".into())
    }
}
