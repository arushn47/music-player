import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiscoveryView, initialDiscoveryViewState, type DiscoveryViewProps } from './DiscoveryView';

vi.mock('./DiscoverShelves', () => ({ DiscoverShelves: () => null }));

it('uses category-specific imagery rather than unrelated library or release covers', () => {
  const noop = vi.fn();
  const props: DiscoveryViewProps = {
    state: initialDiscoveryViewState(), onStateChange: noop, mobile: true, busy: false,
    savedTracks: [{ id: 'test', title: 'Unrelated soundtrack', artist: 'Artist', album: 'Album', artworkUrl: 'https://example.com/unrelated-album.jpg', duration: 100, fileName: '', format: 'MP3', missing: false }],
    favorites: [], downloads: {}, ytdlpAvailable: true, engineState: 'installed', engineError: '', engineProgress: null, engineCancelling: false,
    onInstallYoutubeEngine: async () => {}, onCancelYoutubeEngineInstall: async () => {},
    onCatalogAction: noop, onPlayCollection: noop, onPlayAlbum: async () => {}, onSaveDiscovery: noop,
    onChoosePlaylist: noop, onDownloadTrack: noop, onSaveCommons: noop, onQueueRemote: noop,
    recentRecords: [], historyEnabled: true, onReplay: noop, onImportMusic: noop, onOpenLibrary: noop,
  };
  const html = renderToStaticMarkup(<DiscoveryView {...props} />);
  expect(html).toContain('Moods &amp; moments');
  expect(html).toContain('Genres');
  expect(html).toContain('images.unsplash.com/photo-1518495973542-4542c06a5843');
  expect(html).not.toContain('unrelated-album.jpg');
  expect(html).not.toContain('featured-hero.jpg');
});
