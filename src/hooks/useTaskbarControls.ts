import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { desktop, mobile } from "../adapters/native";

export function useTaskbarControls(playing: boolean, enabled: boolean, loading: boolean, toggle: () => void, skip: (direction: 1 | -1) => void): void {
  const callbacks = useRef({ toggle, skip });
  callbacks.current = { toggle, skip };
  const supported = desktop && !mobile && /Windows/i.test(navigator.userAgent);
  useEffect(() => {
    if (!supported) return;
    let disposed = false;
    const listener = listen<string>("taskbar-action", event => {
      if (disposed) return;
      if (event.payload === "toggle") callbacks.current.toggle();
      else if (event.payload === "previous") callbacks.current.skip(-1);
      else if (event.payload === "next") callbacks.current.skip(1);
    });
    void listener.then(unlisten => { if (disposed) unlisten(); }).catch(error => console.warn("Taskbar controls:", error));
    return () => { disposed = true; void listener.then(unlisten => unlisten()).catch(() => {}); };
  }, [supported]);
  useEffect(() => {
    if (supported) void invoke("taskbar_publish", { playing, enabled, loading }).catch(error => console.warn("Taskbar controls:", error));
  }, [supported, playing, enabled, loading]);
}
