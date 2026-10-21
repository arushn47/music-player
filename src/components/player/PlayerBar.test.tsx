import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerBar, type PlayerBarProps } from "./PlayerBar";
import { defaults } from "../../domain/types";
it("offers expansion only on PC while keeping the mobile mini-player", () => {
  const noop = () => {};
  const props: PlayerBarProps = { tracks: [], session: defaults(), playback: { status: "idle", trackId: null, time: 0, duration: 0, error: null }, downloads: {}, busy: false, view: "discover", setView: noop, onSeek: noop, onTogglePlay: noop, onSkip: noop, onFavorite: noop, onChoosePlaylist: noop, onDownloadTrack: noop, onDeleteOffline: noop, onSaveOnline: noop, onCancelDownload: noop, onSetting: noop, onExpand: noop };
  expect(renderToStaticMarkup(<PlayerBar {...props} onFloatingLyrics={noop} />)).toContain('aria-label="Open floating lyrics"');
  expect(renderToStaticMarkup(<PlayerBar {...props} />)).toContain('aria-label="Open expanded player"');
  const phone = renderToStaticMarkup(<PlayerBar {...props} mobile onFloatingLyrics={noop} />);
  expect(phone).not.toContain('aria-label="Open floating lyrics"');
  expect(phone).not.toContain('aria-label="Open expanded player"'); expect(phone).toContain('aria-label="Playback controls"');
});

it("omits right-side transport clutter when expanded in cover mode", () => {
  const noop = () => {};
  const props: PlayerBarProps = {
    tracks: [],
    session: defaults(),
    playback: { status: "idle", trackId: null, time: 0, duration: 0, error: null },
    downloads: {},
    busy: false,
    view: "discover",
    setView: noop,
    onSeek: noop,
    onTogglePlay: noop,
    onSkip: noop,
    onFavorite: noop,
    onChoosePlaylist: noop,
    onDownloadTrack: noop,
    onDeleteOffline: noop,
    onSaveOnline: noop,
    onCancelDownload: noop,
    onSetting: noop,
    onExpand: noop,
    expanded: true,
  };
  for (const expanded of [false, true]) {
    const loading = renderToStaticMarkup(<PlayerBar {...props} expanded={expanded} autoplayLoading />);
    expect(loading).toContain('aria-label="Loading song"');
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('class="player-spinner"');
    expect(loading).not.toContain('class="spin"');
  }
  const html = renderToStaticMarkup(<PlayerBar {...props} onFloatingLyrics={noop} onToggleQueue={noop} />);
  expect(html).not.toContain('class="player-right"');
  expect(html).not.toContain('data-testid="playback-state"');
  expect(html).not.toContain('aria-label="Volume"');
  expect(html).not.toContain('aria-label="Open lyrics"');
  expect(html).not.toContain('aria-label="Show queue"');
  expect(html).toContain('class="player-center"');
});

