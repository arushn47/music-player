import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CatalogTrack } from "../../adapters/native";
import type { Track } from "../../domain/types";
import { CatalogTrackActions } from "./CatalogTrackActions";
import { ArtistLinks } from "./ArtistLinks";
import { CatalogTrackList } from "./CatalogTrackList";

const track: CatalogTrack = { id: "saavn:QAbmbZ7O", title: "Sensitive", artist: "Artist", album: "Album", artists: [], duration: 224 };
describe("shared catalog row controls", () => {
  it("keeps track playback and queueing enabled during a download", () => {
    const html = renderToStaticMarkup(<CatalogTrackList tracks={[track]} busy={false} downloads={{ [track.id]: "downloading" }} savedTracks={[]} favorites={[]} onCatalogAction={() => {}} onSaveDiscovery={() => {}} />);
    expect(html).toMatch(/aria-label="Play Sensitive"(?![^>]*disabled)/);
    expect(html).toMatch(/aria-label="Listen to Sensitive"(?![^>]*disabled)/);
    expect(html).toContain('aria-label="Downloading"');
    expect(html).toContain('<button disabled="">Downloading');
    expect(html).toContain('<button>Play next</button>');
  });
  it("offers Favorite and the full existing actions for an unsaved result", () => {
    const html = renderToStaticMarkup(<CatalogTrackActions track={track} savedTracks={[]} favorites={[]} disabled={false} onCatalogAction={() => {}} />);
    expect(html).toContain('aria-label="Favorite Sensitive"');
    expect(html).toContain('aria-label="Actions for Sensitive"');
    for (const label of ["Save to library", "Download for offline", "Play next", "Add to queue", "Refresh metadata", "Save to playlist"]) expect(html).toContain(label);
  });
  it("reflects saved favorite and offline state", () => {
    const saved: Track = { id: "youtube:abcdefghijk", metadataSourceId: track.id, title: track.title, artist: track.artist, album: track.album, duration: 224, fileName: "Sensitive", format: "YouTube", missing: false, offline: true };
    const html = renderToStaticMarkup(<CatalogTrackActions track={track} savedTracks={[saved]} favorites={[saved.id]} disabled={false} onCatalogAction={() => {}} />);
    expect(html).toContain('aria-label="Unfavorite Sensitive"');
    expect(html).toContain("Remove from library");
    expect(html).toContain("Delete offline copy");
  });
  it("turns legacy collaboration credits into individual artist links", () => {
    const html = renderToStaticMarkup(<ArtistLinks artistString="Emiway Bantai, Guest" onNavigateArtist={() => {}} />);
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain("Emiway Bantai");
    expect(renderToStaticMarkup(<ArtistLinks artistString="Unknown artist" onNavigateArtist={() => {}} />)).not.toContain("<button");
  });
});
