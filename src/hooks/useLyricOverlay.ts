import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { desktop, mobile } from '../adapters/native';
import type { OverlaySnapshot } from '../domain/lyric-overlay';

export function useLyricOverlay(snapshot: OverlaySnapshot, toggle: () => void, skip: (direction: 1 | -1) => void, error: (message: string) => void) {
  const supported = desktop && !mobile && /Windows/i.test(navigator.userAgent);
  const [status, setStatus] = useState({ open: false, locked: false });
  const [busy, setBusy] = useState(false);
  const callbacks = useRef({ toggle, skip, error });
  callbacks.current = { toggle, skip, error };
  const serialized = JSON.stringify(snapshot);
  useEffect(() => {
    if (!supported) return;
    let disposed = false;
    const subscriptions = [
      listen<typeof status>('lyric-overlay-status', event => { if (!disposed) setStatus(event.payload); }),
      listen<string>('lyric-overlay-action', event => {
        if (disposed) return;
        if (event.payload === 'toggle') callbacks.current.toggle();
        else if (event.payload === 'previous') callbacks.current.skip(-1);
        else if (event.payload === 'next') callbacks.current.skip(1);
      }),
    ];
    subscriptions.forEach(subscription => { void subscription.then(unlisten => { if (disposed) unlisten(); }).catch(e => callbacks.current.error(String(e))); });
    return () => { disposed = true; subscriptions.forEach(subscription => { void subscription.then(unlisten => unlisten()).catch(() => {}); }); };
  }, [supported]);
  useEffect(() => {
    if (supported) void invoke('lyric_overlay_publish', { snapshot: JSON.parse(serialized) }).catch(e => callbacks.current.error(String(e)));
  }, [supported, serialized]);
  async function control(action: string) {
    if (busy) return;
    setBusy(true);
    try { await invoke('lyric_overlay_control', { action }); }
    catch (e) { callbacks.current.error(`Floating lyrics: ${String(e)}`); }
    finally { setBusy(false); }
  }
  return { supported, ...status, busy, toggle: () => void control(status.open && !status.locked ? 'close' : 'open') };
}
