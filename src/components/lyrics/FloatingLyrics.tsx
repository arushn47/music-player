import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import { GripHorizontal, Lock, LockOpen, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { overlayOpacity, type OverlaySnapshot } from '../../domain/lyric-overlay';
import { applyTheme, readStoredTheme, THEME_STORAGE_KEY, type ThemePreference } from '../../theme';
import './floating-lyrics.css';

const applyOverlayTheme = (pref: ThemePreference) => {
  // PiP floating overlay is a dark glass HUD; use dark-surface contrast tokens for luminous glow
  applyTheme({
    themeMode: 'dark',
    accentColor: pref.accentColor,
  });
};

export function FloatingLyrics() {
  const [snapshot, setSnapshot] = useState<OverlaySnapshot>({ title: 'Floating lyrics', artist: '', status: 'idle', message: 'Connecting to Lumaire…', lines: [] });
  const [error, setError] = useState('');
  const [interaction, setInteraction] = useState({ locked: false, hovered: false, shortcutAvailable: false });
  const [opacity, setOpacity] = useState(() => {
    try { return overlayOpacity(Number(localStorage.getItem('lyric-overlay-opacity') ?? '45')); } catch { return 45; }
  });
  const effectiveOpacity = interaction.locked ? 0 : opacity;
  async function control(action: string) {
    try { await invoke('lyric_overlay_control', { action }); setError(''); }
    catch (e) { setError(String(e)); }
  }
  useEffect(() => {
    let disposed = false;
    applyOverlayTheme(readStoredTheme());

    const themeListener = listen<ThemePreference>('lumaire:theme-change', event => {
      if (!disposed && event.payload) {
        applyOverlayTheme(event.payload);
      }
    });

    const handleStorage = (event: StorageEvent) => {
      if (!disposed && event.key === THEME_STORAGE_KEY) {
        applyOverlayTheme(readStoredTheme());
      }
    };
    window.addEventListener('storage', handleStorage);

    const subscription = listen<OverlaySnapshot>('lyric-overlay-state', event => { if (!disposed) setSnapshot(event.payload); });
    const controls = listen<typeof interaction>('lyric-overlay-status', event => { if (!disposed) setInteraction(event.payload); });
    const errors = listen<string>('lyric-overlay-error', event => { if (!disposed) setError(event.payload); });
    const listeners = Promise.all([subscription, controls, errors, themeListener]);
    void listeners.then(async () => {
      if (disposed) return;
      const initial = await invoke<OverlaySnapshot>('lyric_overlay_control', { action: 'ready' });
      if (!disposed) setSnapshot(initial);
    }).catch(e => setError(String(e)));
    return () => {
      disposed = true;
      window.removeEventListener('storage', handleStorage);
      void listeners.then(unlisteners => unlisteners.forEach(unlisten => unlisten())).catch(() => {});
    };
  }, []);
  const playing = snapshot.status === 'playing';
  async function adjustWindow(key: string, resize = false) {
    const window = getCurrentWindow();
    const dx = key === 'ArrowRight' ? 20 : key === 'ArrowLeft' ? -20 : 0;
    const dy = key === 'ArrowDown' ? 20 : key === 'ArrowUp' ? -20 : 0;
    try {
      if (resize) { const size = await window.innerSize(); const scale = await window.scaleFactor(); await window.setSize(new PhysicalSize(Math.max(300 * scale, size.width + dx), Math.max(180 * scale, size.height + dy))); }
      else { const position = await window.outerPosition(); await window.setPosition(new PhysicalPosition(position.x + dx, position.y + dy)); }
    } catch (e) { setError(String(e)); }
  }
  const lockHint = interaction.shortcutAvailable ? 'Ctrl+Alt+L to lock or unlock' : 'Hover the top-right corner to unlock · Shortcut unavailable';
  return <main className={`floating-lyrics${interaction.locked ? ' is-locked' : ''}`} data-hovered={interaction.hovered} aria-label="Floating lyrics"
    style={{ backgroundColor: `rgb(15 17 14 / ${effectiveOpacity}%)`, borderColor: effectiveOpacity === 0 ? 'transparent' : undefined, boxShadow: effectiveOpacity === 0 ? 'none' : undefined }}>
    {interaction.locked && <button className="floating-unlock" aria-label="Unlock floating lyrics" title={`Unlock lyrics · ${lockHint}`} onClick={() => void control('unlock')}><LockOpen size={17} /></button>}
    <header className="floating-toolbar" inert={interaction.locked} aria-hidden={interaction.locked}>
      <button aria-label="Move lyric window" title="Drag or use arrow keys to move" onKeyDown={event => { if (event.key.startsWith('Arrow')) { event.preventDefault(); void adjustWindow(event.key); } }} onMouseDown={event => { if (event.button === 0) void getCurrentWindow().startDragging().catch(e => setError(String(e))); }}><GripHorizontal size={18} /></button>
      <span className="floating-title" title={`${snapshot.title} · ${snapshot.artist}`}>
        <span className="floating-title-main">{snapshot.title}</span>
        {snapshot.artist && <span className="floating-artist"> · {snapshot.artist}</span>}
      </span>
      <button aria-label="Enable click-through" title={`Show lyrics only · ${lockHint}`} onClick={() => void control('lock')}><Lock size={15} /></button>
      <button aria-label="Close floating lyrics" onClick={() => void control('close')}><X size={18} /></button>
    </header>
    <section className="floating-lines" aria-label="Current lyrics" aria-live="off" tabIndex={0}>
      {snapshot.message && <p className="floating-message">{snapshot.message}</p>}
      {snapshot.lines.map((line, index) => <div key={index} className={line.active ? 'floating-line active' : 'floating-line'}>
        <div className="floating-primary">{line.text}</div>
        {line.active && line.secondary && <small className="floating-secondary">{line.secondary}</small>}
      </div>)}
    </section>
    <footer className="floating-toolbar" inert={interaction.locked} aria-hidden={interaction.locked}>
      <button aria-label="Previous track" onClick={() => void control('previous')}><SkipBack size={17} /></button>
      <button aria-label={playing ? 'Pause' : 'Play'} disabled={['idle', 'loading', 'buffering'].includes(snapshot.status)} onClick={() => void control('toggle')}>{playing ? <Pause size={19} /> : <Play size={19} />}</button>
      <button aria-label="Next track" onClick={() => void control('next')}><SkipForward size={17} /></button>
      <label className="floating-opacity">Background<input aria-label="Background opacity" title="Background opacity" type="range" min="0" max="85" value={opacity} onChange={event => { const value = Number(event.target.value); setOpacity(value); try { localStorage.setItem('lyric-overlay-opacity', String(value)); } catch { /* Opacity still works without storage. */ } }} /></label>
      {['loading', 'buffering'].includes(snapshot.status) && <span role="status">Loading…</span>}
    </footer>
    {!interaction.locked && <span className="floating-lock-hint">{lockHint}</span>}
    {error && <p className="floating-error" role="alert">{error}</p>}
    {!interaction.locked && <>{(['North', 'South', 'East', 'West', 'NorthEast', 'NorthWest', 'SouthWest'] as const).map(direction => <div key={direction} className={`floating-resize ${direction}`} onMouseDown={event => { if (event.button === 0) void getCurrentWindow().startResizeDragging(direction).catch(e => setError(String(e))); }} />)}
    <button className="floating-resize SouthEast" aria-label="Resize lyric window" title="Drag or use arrow keys to resize" onKeyDown={event => { if (event.key.startsWith('Arrow')) { event.preventDefault(); void adjustWindow(event.key, true); } }} onMouseDown={event => { if (event.button === 0) void getCurrentWindow().startResizeDragging('SouthEast').catch(e => setError(String(e))); }} /></>}
  </main>;
}
