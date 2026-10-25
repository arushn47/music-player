import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryView, type LibraryViewProps } from "./LibraryView";
import { defaults } from "../../domain/types";

it("keeps favorite songs, albums and artists in separate library views", () => {
  const noop = () => {};
  const session = defaults();
  session.favoriteAlbums = [{ id: "itunes:42", title: "Saved Album", artist: "Album Artist" }];
  session.favoriteArtists = [{ id: "itunes:43", name: "Saved Artist" }];
  const track = { id: "local", title: "Song", album: "Unsaved Album", artist: "Unsaved Artist", duration: 10, fileName: "song.wav", format: "WAV", missing: false };
  const props: LibraryViewProps = { view: "favorites", heading: "Liked songs", tracks: [track], visible: [], rows: [], playbackStatus: "idle", session, downloads: {}, collections: [], query: "", busy: false, mobile: false, desktop: true, onSetQuery: noop, onSelectView: noop, onPlayAll: noop, onPlayTrackInList: noop, onImportMusic: noop, onFavorite: noop, onRemoveTrack: noop, onDownloadTrack: noop, onDeleteOffline: noop, onQueueTrack: noop, onRelinkTrack: noop, onChoosePlaylist: noop };
  const songs = renderToStaticMarkup(<LibraryView {...props} />);
  expect(songs).toContain('aria-label="Library sections"');
  expect(songs).toContain('aria-current="page">Songs</button>');
  expect(songs).toContain('aria-label="Listening history"');
  expect(songs).not.toContain("Saved Album");
  expect(songs).not.toContain("Saved Artist");
  const albums = renderToStaticMarkup(<LibraryView {...props} view="albums" />);
  expect(albums).toContain('aria-current="page">Albums</button>');
  expect(albums).toContain("Saved Album");
  expect(albums).not.toContain("Unsaved Album");
  const artists = renderToStaticMarkup(<LibraryView {...props} view="artists" />);
  expect(artists).toContain("Saved Artist");
  expect(artists).not.toContain("Unsaved Artist");
  expect(renderToStaticMarkup(<LibraryView {...props} view="artists" query="nothing" />)).not.toContain("Saved Artist");
});

it("renders Import button beside New playlist in playlists view when onOpenImport is provided", () => {
  const noop = () => {};
  const session = defaults();
  const props: LibraryViewProps = {
    view: "library",
    heading: "Playlists",
    tracks: [],
    visible: [],
    rows: [],
    playbackStatus: "idle",
    session,
    downloads: {},
    collections: [],
    query: "",
    busy: false,
    mobile: false,
    desktop: true,
    onSetQuery: noop,
    onSelectView: noop,
    onPlayAll: noop,
    onPlayTrackInList: noop,
    onImportMusic: noop,
    onFavorite: noop,
    onRemoveTrack: noop,
    onDownloadTrack: noop,
    onDeleteOffline: noop,
    onQueueTrack: noop,
    onRelinkTrack: noop,
    onChoosePlaylist: noop,
    onCreatePlaylist: noop,
    onOpenImport: noop,
  };
  const html = renderToStaticMarkup(<LibraryView {...props} />);
  expect(html).toContain("New playlist");
  expect(html).toContain("Import");
  expect(html).toContain('title="Import playlists from Spotify, YouTube, Apple Music or files"');
});

