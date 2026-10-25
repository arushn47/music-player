use std::cell::RefCell;
use tauri::{Emitter, Manager, WebviewWindow};
use windows::{core::w, Win32::{Foundation::{HWND, LPARAM, LRESULT, WPARAM}, System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER}, UI::{HiDpi::{GetDpiForWindow, GetSystemMetricsForDpi}, Shell::{DefSubclassProc, ITaskbarList3, RemoveWindowSubclass, SetWindowSubclass, TaskbarList, THUMBBUTTON, THB_FLAGS, THB_ICON, THB_TOOLTIP, THBF_DISABLED, THBF_ENABLED}, WindowsAndMessaging::{CreateIconFromResourceEx, DestroyIcon, RegisterWindowMessageW, HICON, WM_COMMAND, WM_NCDESTROY, WM_TIMER, WM_DPICHANGED, SetTimer, KillTimer, SM_CXICON, LR_DEFAULTCOLOR}}}};

struct Icon(HICON);
impl Drop for Icon { fn drop(&mut self) { unsafe { let _ = DestroyIcon(self.0); } } }
struct Toolbar { api: ITaskbarList3, app: tauri::AppHandle, hwnd: HWND, ready_message: u32, icons: Vec<Icon>, installed: bool, playing: bool, enabled: bool, loading: bool, frame: usize }
thread_local! { static TOOLBAR: RefCell<Option<Toolbar>> = const { RefCell::new(None) }; }

fn action(wparam: usize) -> Option<&'static str> {
    if (wparam >> 16) & 0xffff != 0x1800 { return None; }
    match wparam & 0xffff { 1 => Some("previous"), 2 => Some("toggle"), 3 => Some("next"), _ => None }
}

const TIMER: usize = 0x4c554e;
const ICON_DATA: [&[u8]; 12] = [
    include_bytes!("../icons/taskbar/0.png"), include_bytes!("../icons/taskbar/1.png"),
    include_bytes!("../icons/taskbar/2.png"), include_bytes!("../icons/taskbar/3.png"),
    include_bytes!("../icons/taskbar/4.png"), include_bytes!("../icons/taskbar/5.png"),
    include_bytes!("../icons/taskbar/6.png"), include_bytes!("../icons/taskbar/7.png"),
    include_bytes!("../icons/taskbar/8.png"), include_bytes!("../icons/taskbar/9.png"),
    include_bytes!("../icons/taskbar/10.png"), include_bytes!("../icons/taskbar/11.png"),
];

fn icons(hwnd: HWND) -> windows::core::Result<Vec<Icon>> {
    // Use alpha artwork at the monitor's native icon size instead of scaling a 1-bit bitmap.
    let size = unsafe { GetSystemMetricsForDpi(SM_CXICON, GetDpiForWindow(hwnd)) }.max(32);
    ICON_DATA.iter().map(|data| unsafe {
        CreateIconFromResourceEx(data, true, 0x00030000, size, size, LR_DEFAULTCOLOR).map(Icon)
    }).collect()
}

impl Toolbar {
    fn buttons(&self) -> Vec<THUMBBUTTON> {
        ["Previous track", if self.loading { "Loading song" } else if self.playing { "Pause" } else { "Play" }, "Next track"].iter().enumerate().map(|(index, tip)| {
            let mut button = THUMBBUTTON { dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS, iId: index as u32 + 1,
                hIcon: self.icons[match index { 0 => 0, 1 => if self.loading { 4 + self.frame } else if self.playing { 2 } else { 1 }, _ => 3 }].0,
                dwFlags: if self.enabled { THBF_ENABLED } else { THBF_DISABLED }, ..Default::default() };
            for (slot, value) in button.szTip.iter_mut().zip(tip.encode_utf16()) { *slot = value; }
            button
        }).collect()
    }
    fn update(&mut self, install: bool) -> windows::core::Result<()> {
        let buttons = self.buttons();
        unsafe {
            if install || !self.installed { self.api.ThumbBarAddButtons(self.hwnd, &buttons)?; self.installed = true; }
            else { self.api.ThumbBarUpdateButtons(self.hwnd, &buttons)?; }
        }
        Ok(())
    }
}

unsafe extern "system" fn messages(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM, id: usize, _: usize) -> LRESULT {
    if message == WM_NCDESTROY {
        let _ = KillTimer(Some(hwnd), TIMER);
        let _ = RemoveWindowSubclass(hwnd, Some(messages), id);
        TOOLBAR.with(|state| state.borrow_mut().take());
    } else {
        TOOLBAR.with(|state| {
            let Ok(mut state) = state.try_borrow_mut() else { return; };
            if let Some(toolbar) = state.as_mut() {
                if message == WM_TIMER && wparam.0 == TIMER && toolbar.loading {
                    toolbar.frame = (toolbar.frame + 1) % 8;
                    if let Err(error) = toolbar.update(false) { log::warn!("Taskbar loading indicator: {error}"); }
                } else if message == WM_DPICHANGED {
                    match icons(hwnd) { Ok(icons) => { toolbar.icons = icons; let _ = toolbar.update(false); }, Err(error) => log::warn!("Taskbar DPI icons: {error}") }
                } else if message == toolbar.ready_message { if let Err(error) = toolbar.update(true) { log::warn!("Taskbar toolbar: {error}"); } }
                else if message == WM_COMMAND && toolbar.enabled {
                    if let Some(action) = action(wparam.0) { let _ = toolbar.app.emit_to("main", "taskbar-action", action); }
                }
            }
        });
    }
    DefSubclassProc(hwnd, message, wparam, lparam)
}

pub fn install(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|error| error.to_string())?.0 as usize;
    let app = window.app_handle().clone();
    window.run_on_main_thread(move || {
        let setup = || -> windows::core::Result<Toolbar> {
            let api: ITaskbarList3 = unsafe { CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER)? };
            unsafe { api.HrInit()?; }
            let icons = icons(HWND(hwnd as _))?;
            Ok(Toolbar { api, app, hwnd: HWND(hwnd as _), ready_message: unsafe { RegisterWindowMessageW(w!("TaskbarButtonCreated")) }, icons, installed: false, playing: false, enabled: false, loading: false, frame: 0 })
        };
        match setup() {
            Ok(mut toolbar) => {
                if unsafe { SetWindowSubclass(toolbar.hwnd, Some(messages), 0x4c554d, 0) }.as_bool() {
                    let _ = toolbar.update(false); // Explorer may not have created the taskbar button yet.
                    TOOLBAR.with(|state| *state.borrow_mut() = Some(toolbar));
                } else { log::warn!("Taskbar toolbar message handler could not be installed."); }
            }
            Err(error) => log::warn!("Taskbar toolbar unavailable: {error}"),
        }
    }).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn taskbar_publish(window: WebviewWindow, playing: bool, enabled: bool, loading: bool) -> Result<(), String> {
    if window.label() != "main" { return Err("Only the main window controls playback.".into()); }
    window.run_on_main_thread(move || TOOLBAR.with(|state| {
        if let Some(toolbar) = state.borrow_mut().as_mut() {
            toolbar.playing = playing; toolbar.enabled = enabled;
            if toolbar.loading != loading {
                toolbar.loading = loading;
                toolbar.frame = 0;
                unsafe {
                    if loading { if SetTimer(Some(toolbar.hwnd), TIMER, 100, None) == 0 { log::warn!("Taskbar loading timer unavailable."); } }
                    else { let _ = KillTimer(Some(toolbar.hwnd), TIMER); }
                }
            }
            if let Err(error) = toolbar.update(false) { log::warn!("Taskbar toolbar update: {error}"); }
        }
    })).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_thumbnail_button_notifications_map_to_playback_actions() {
        assert_eq!(action((0x1800 << 16) | 1), Some("previous"));
        assert_eq!(action((0x1800 << 16) | 2), Some("toggle"));
        assert_eq!(action((0x1800 << 16) | 3), Some("next"));
        assert_eq!(action(2), None);
        assert_eq!(action((0x1800 << 16) | 4), None);
        for data in ICON_DATA { assert_eq!(&data[..8], b"\x89PNG\r\n\x1a\n"); }
    }
    #[test]
    fn alpha_icons_load_at_high_dpi_sizes() {
        for size in [32, 48, 64, 128] {
            for data in ICON_DATA {
                let icon = unsafe { CreateIconFromResourceEx(data, true, 0x00030000, size, size, LR_DEFAULTCOLOR) }.unwrap();
                drop(Icon(icon));
            }
        }
    }
}
