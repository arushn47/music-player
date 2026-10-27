import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { MobileTabBar } from './MobileTabBar';

const state = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useRef: () => state }));
let time = 0;
beforeEach(() => { state.current = null; time = 0; vi.spyOn(performance, 'now').mockImplementation(() => time); });
afterEach(() => vi.restoreAllMocks());
const render = (view: string, setView: (value: string) => void, search: () => void) =>
  (MobileTabBar({ view, setView, onDiscoverSearch: search }).props.children as ReactElement<{ onClick: () => void; 'aria-label': string }>[])
    .reduce<Record<string, () => void>>((all, button) => ({ ...all, [button.props['aria-label']]: button.props.onClick }), {});

it.each(['home', 'library', 'lyrics', 'history', 'settings', 'discover'])('double-taps Discover from %s without delaying or repeating navigation', view => {
  const navigate = vi.fn(), search = vi.fn();
  render(view, navigate, search).Discover();
  expect(navigate).toHaveBeenCalledWith('search'); expect(search).not.toHaveBeenCalled();
  time = 250;
  render('search', navigate, search).Discover();
  expect(search).toHaveBeenCalledTimes(1); expect(navigate).toHaveBeenCalledTimes(1);
});

it('resets the double-tap after another tab, a slow tap, or a completed pair', () => {
  const navigate = vi.fn(), search = vi.fn(); const tabs = render('home', navigate, search);
  tabs.Discover(); time = 100; tabs.Library(); time = 200; tabs.Discover();
  expect(search).not.toHaveBeenCalled();
  time = 600; tabs.Discover(); expect(search).not.toHaveBeenCalled();
  time = 800; tabs.Discover(); expect(search).toHaveBeenCalledTimes(1);
  time = 900; tabs.Discover(); expect(search).toHaveBeenCalledTimes(1);
});
