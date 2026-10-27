import { useEffect, useRef } from 'react';
import { addPluginListener, invoke } from '@tauri-apps/api/core';

interface BackOptions {
  canGoBack: boolean;
  goBack: () => void;
  dismiss: () => boolean;
}

export function androidBackHandler(read: () => BackOptions, native: (action: string) => void, now = () => performance.now()): { back: () => void; reset: () => void } {
  let firstPress: number | null = null;
  return {
    reset: () => { firstPress = null; },
    back: () => {
      const current = read();
      if (current.dismiss()) { firstPress = null; return; }
      if (current.canGoBack) { firstPress = null; current.goBack(); return; }
      const time = now();
      if (firstPress !== null && time - firstPress <= 2000) {
        firstPress = null;
        native('minimize');
      } else { firstPress = time; native('backHint'); }
    },
  };
}

/** Dismiss the innermost transient UI before its containing screen. */
export function dismissAndroidLayer(doc: Document = document, includeSearch = true): boolean {
  const select = doc.querySelector<HTMLButtonElement>('.apple-select-container.open button[aria-expanded="true"]');
  if (select) { select.click(); return true; }
  const menu = doc.querySelector<HTMLDetailsElement>('details.track-menu[open]');
  if (menu) {
    if (doc.defaultView?.history.state?.mobileActions) doc.defaultView.history.back();
    else menu.open = false;
    return true;
  }
  const dialogs = [...doc.querySelectorAll<HTMLDialogElement>('dialog[open]')];
  const dialog = doc.activeElement?.closest<HTMLDialogElement>('dialog[open]') || dialogs.at(-1);
  if (dialog) {
    if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
    return true;
  }
  const search = includeSearch && doc.querySelector<HTMLInputElement>('.topbar-search:has(.topbar-search-dropdown) input, .discover-search-bar.is-focused input');
  if (search) {
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    search.blur();
    return true;
  }
  return false;
}

export function useAndroidBack(enabled: boolean, screen: string, options: BackOptions): void {
  const latest = useRef(options);
  latest.current = options;
  const handler = useRef<ReturnType<typeof androidBackHandler> | null>(null);
  if (!handler.current) handler.current = androidBackHandler(() => latest.current, action => {
    void invoke('plugin:lumaire-android|navigation', { action }).catch(error => console.warn('Android navigation failed:', error));
  });
  useEffect(() => { handler.current?.reset(); }, [screen]);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    const listener = addPluginListener('app', 'back-button', () => { if (!disposed) handler.current?.back(); })
      .catch(error => { console.warn('Android Back listener unavailable:', error); return null; });
    return () => { disposed = true; void listener.then(value => value?.unregister()).catch(() => {}); };
  }, [enabled]);
}
