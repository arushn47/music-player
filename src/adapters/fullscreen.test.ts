import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { toggleNativeFullscreen } from "./fullscreen";

function windowStub(maximized = true, fullscreen = false) {
  return {
    isFullscreen: vi.fn(async () => fullscreen),
    isMaximized: vi.fn(async () => maximized),
    unmaximize: vi.fn(async () => { maximized = false; }),
    maximize: vi.fn(async () => { maximized = true; }),
    setFullscreen: vi.fn(async (value: boolean) => { fullscreen = value; }),
  };
}

it("removes maximization before fullscreen so Windows does not reserve the taskbar area", async () => {
  const win = windowStub();
  const restore = { current: false };
  expect(await toggleNativeFullscreen(win, restore)).toBe(true);
  expect(win.unmaximize).toHaveBeenCalledOnce();
  expect(win.unmaximize.mock.invocationCallOrder[0]).toBeLessThan(win.setFullscreen.mock.invocationCallOrder[0]);
  expect(restore.current).toBe(true);
  expect(await toggleNativeFullscreen(win, restore)).toBe(false);
  expect(win.setFullscreen).toHaveBeenLastCalledWith(false);
  expect(win.maximize).toHaveBeenCalledOnce();
  expect(win.setFullscreen.mock.invocationCallOrder[1]).toBeLessThan(win.maximize.mock.invocationCallOrder[0]);
  expect(restore.current).toBe(false);
});

it("keeps a previously restored window restored after leaving fullscreen", async () => {
  const win = windowStub(false);
  const restore = { current: false };
  await toggleNativeFullscreen(win, restore);
  await toggleNativeFullscreen(win, restore);
  expect(win.unmaximize).not.toHaveBeenCalled();
  expect(win.maximize).not.toHaveBeenCalled();
});

it("restores maximization if entering fullscreen fails", async () => {
  const win = windowStub();
  win.setFullscreen.mockRejectedValueOnce(new Error("fullscreen failed"));
  const restore = { current: false };
  await expect(toggleNativeFullscreen(win, restore)).rejects.toThrow("fullscreen failed");
  expect(win.maximize).toHaveBeenCalledOnce();
  expect(restore.current).toBe(false);
});


it("grants the native restore and maximize commands needed for the taskbar workaround", () => {
  const capability = JSON.parse(readFileSync("src-tauri/capabilities/main.json", "utf8"));
  expect(capability.windows).toEqual(["main"]);
  for (const action of ["maximize", "unmaximize", "set-fullscreen"]) expect(capability.permissions).toContain(`core:window:allow-${action}`);
});
