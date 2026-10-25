import type { Window } from "@tauri-apps/api/window";

type FullscreenWindow = Pick<Window, "isFullscreen" | "isMaximized" | "unmaximize" | "maximize" | "setFullscreen">;

export async function toggleNativeFullscreen(win: FullscreenWindow, restoreMaximized: { current: boolean }): Promise<boolean> {
  if (await win.isFullscreen()) {
    await win.setFullscreen(false);
    if (restoreMaximized.current) await win.maximize();
    restoreMaximized.current = false;
    return false;
  }
  restoreMaximized.current = await win.isMaximized();
  // shortcut: Tao 0.37 clamps maximized borderless clients to the taskbar work area, remove when its fullscreen NCCALCSIZE handling is fixed.
  if (restoreMaximized.current) await win.unmaximize();
  try {
    await win.setFullscreen(true);
  } catch (error) {
    if (restoreMaximized.current) await win.maximize();
    restoreMaximized.current = false;
    throw error;
  }
  return true;
}
