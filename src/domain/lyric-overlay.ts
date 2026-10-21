import type { LyricDocument, Preferences, Track } from './types';
import { lyricLayers } from './lyric-display';

export interface OverlaySnapshot {
  title: string;
  artist: string;
  status: string;
  message: string;
  lines: { text: string; secondary: string; active: boolean }[];
}

export function overlaySnapshot(track: Track | null | undefined, doc: LyricDocument | undefined, settings: Preferences, status: string, synced: boolean, active: string | null, lookup: string): OverlaySnapshot {
  const result: OverlaySnapshot = { title: (track?.title || 'Floating lyrics').slice(0, 800), artist: (track?.artist || '').slice(0, 800), status, message: '', lines: [] };
  if (!track) result.message = 'Choose a song in Lumaire.';
  else if (doc?.instrumental) result.message = 'Instrumental';
  else if (!doc?.lines.length) result.message = lookup === 'loading' ? 'Finding lyrics…' : lookup === 'error' ? 'Lyrics could not load. Retry in Lyric room.' : 'No lyrics available. Add lyrics in Lyric room.';
  else if (!synced) result.message = 'These lyrics are not time-synced. Open Lyric room to read them.';
  else {
    const index = doc.lines.findIndex(line => line.id === active);
    if (index < 0) result.message = 'Lyrics will appear when the vocals begin.';
    else result.lines = doc.lines.slice(Math.max(0, index - 1), index + 2).map(line => {
      const layers = lyricLayers(doc, line, settings);
      return { text: (layers[0]?.text || '♪').slice(0, 1800), secondary: layers.slice(1).map(layer => layer.text).join('\n').slice(0, 1800), active: line.id === active };
    });
  }
  return result;
}

export function overlayOpacity(manual: number): number {
  return Number.isFinite(manual) ? Math.max(0, Math.min(85, manual)) : 45;
}
