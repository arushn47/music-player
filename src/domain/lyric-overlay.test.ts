import { expect, it } from 'vitest';
import { overlaySnapshot, overlayOpacity } from './lyric-overlay';
import { parseLyrics } from './lyrics';
import { defaults, type Track } from './types';

const track = { title: 'Test', artist: 'Lumaire' } as Track;
it('follows the actual active line and preserves enabled lyric layers', () => {
  const doc = parseLyrics('[00:01]One\n[00:02]Two\n[00:03]Three\n[00:04]Four');
  doc.translation[doc.lines[1].id] = 'Deux';
  const result = overlaySnapshot(track, doc, { ...defaults().settings, translation: true }, 'playing', true, doc.lines[1].id, 'found');
  expect(result.lines.map(line => line.text)).toEqual(['One', 'Two', 'Three']);
  expect(result.lines[1]).toMatchObject({ active: true, secondary: 'Deux' });
  expect(overlaySnapshot(track, doc, defaults().settings, 'paused', true, null, 'found').lines).toEqual([]);
});
it('does not invent synchronization or retain lyrics for unavailable or instrumental tracks', () => {
  const doc = parseLyrics('Plain lyrics');
  expect(overlaySnapshot(track, doc, defaults().settings, 'playing', false, null, 'found').message).toContain('not time-synced');
  expect(overlaySnapshot(track, undefined, defaults().settings, 'playing', false, null, 'loading').message).toBe('Finding lyrics…');
  doc.instrumental = true;
  expect(overlaySnapshot(track, doc, defaults().settings, 'playing', false, null, 'found').message).toBe('Instrumental');
});

it('preserves manual opacity and validates stored values', () => {
  expect(overlayOpacity(23)).toBe(23);
  expect(overlayOpacity(0)).toBe(0);
  expect(overlayOpacity(-1)).toBe(0);
  expect(overlayOpacity(NaN)).toBe(45);
  expect(overlayOpacity(200)).toBe(85);
});
