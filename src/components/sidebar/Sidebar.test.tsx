import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from './Sidebar';
import { libraryCollections } from '../../domain/collections';
import { item, type Track } from '../../domain/types';

it('matches playlist covers with a four-cover collage, single cover or empty fallback', () => {
  for (const count of [0, 1, 3, 4]) {
    const tracks = Array.from({ length: count }, (_, i) => ({ id: String(i), artworkUrl: `https://example.com/${i}.jpg` } as Track));
    const playlists = [{ id: 'mix', name: 'My mix', items: tracks.map(track => item(track.id)) }];
    const html = renderToStaticMarkup(<Sidebar view="mix" setView={()=>{}} onHome={()=>{}} collectionsCount={1} playlists={playlists} collections={libraryCollections(tracks, playlists)} hasLyricsDoc={false} onCreatePlaylist={()=>{}} />);
    expect(html).toContain('title="My mix"');
    expect(html).toContain('class="selected"');
    expect((html.match(/class="cover /g) || []).length).toBe(count >= 4 ? 4 : count ? 1 : 0);
    expect(html.includes('sidebar-playlist-cover is-mosaic')).toBe(count >= 4);
    if (!count) expect(html).toContain('lucide-list-music');
  }
});
