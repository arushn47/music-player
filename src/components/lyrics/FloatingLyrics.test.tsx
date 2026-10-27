import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FloatingLyrics } from './FloatingLyrics';

const interaction = vi.hoisted(() => ({ locked: false }));
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const value = typeof initial === 'function' ? initial() : initial;
    return [value && typeof value === 'object' && 'locked' in value ? { ...value, locked: interaction.locked } : value, vi.fn()];
  },
}));
afterEach(() => { interaction.locked = false; vi.unstubAllGlobals(); });

it.each([false, true])('preserves selected opacity and black text when locked=%s', locked => {
  interaction.locked = locked;
  vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'lyric-overlay-opacity' ? '65' : 'black' });
  const html = renderToStaticMarkup(<FloatingLyrics />);
  expect(html).toContain('background-color:rgb(15 17 14 / 65%)');
  expect(html).toContain('data-text-color="black"');
  expect(html).toContain('aria-pressed="true"');
  expect(html.indexOf('aria-label="Black PiP text and controls"')).toBeLessThan(html.indexOf('aria-label="Enable click-through"'));
  expect(html.indexOf('aria-label="Black PiP text and controls"')).toBeLessThan(html.indexOf('<footer'));
});
it('defaults to white text when storage is unavailable', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Unavailable'); } });
  const html = renderToStaticMarkup(<FloatingLyrics />);
  expect(html).toContain('data-text-color="white"');
  expect(html).toContain('background-color:rgb(15 17 14 / 45%)');
});
