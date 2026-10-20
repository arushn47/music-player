import React, { useEffect, useState } from "react";
import { library } from "../../adapters/native";
import type { DiscoveryViewProps } from "./DiscoveryView";
import { ChevronLeft, CircleAlert, Loader2 } from "lucide-react";
import { Artwork } from "../common";
import { CatalogTrackList } from "../common/CatalogTrackList";
import type { CatalogActionHandlers } from "../common/CatalogTrackActions";

interface ArtistViewProps extends CatalogActionHandlers {
  artistId: string;
  onNavigateAlbum: (albumId: string) => void;
  onNavigateArtist: (artistId: string) => void;
  onSaveDiscovery: DiscoveryViewProps["onSaveDiscovery"];
  busy: boolean;
  downloads: Record<string, string>;
  onBack: () => void;
}

type ArtistData = Awaited<ReturnType<typeof library.lookupArtist>>;

export function ArtistView({ artistId, onNavigateAlbum, onNavigateArtist, onSaveDiscovery, busy, downloads, onBack, savedTracks, favorites, onCatalogAction }: ArtistViewProps) {
  const [data, setData] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    library
      .lookupArtist(artistId)
      .then(result => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [artistId, attempt]);

  if (loading) {
    return (
      <div className="empty page-loading" role="status">
        <Loader2 size={32} className="spin" />
        <p>Loading artist...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="empty page-error" role="alert">
        <CircleAlert size={32} />
        <h2>Artist unavailable</h2>
        <p>{error || "Failed to load artist"}</p>
        <div className="heading-actions">
          <button onClick={() => setAttempt(value => value + 1)} className="primary">Retry</button>
          <button onClick={onBack} className="subtle">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="artist-page">
      <div className="catalog-toolbar">
        <button onClick={onBack} className="subtle"><ChevronLeft size={16} />Back</button>
      </div>
      <div className="page-heading catalog-hero artist-header">
        <Artwork url={data.info.artworkUrl} className="artist-cover" />
        <div className="artist-info">
          <p className="eyebrow">ARTIST</p>
          <h1>{data.info.name}</h1>
          <p className="subtitle">Popular tracks and available releases</p>
        </div>
      </div>

      {data.topTracks.length > 0 && (
        <section className="catalog-section artist-section">
          <h2>Popular tracks</h2>
          <CatalogTrackList savedTracks={savedTracks} favorites={favorites} onCatalogAction={onCatalogAction} tracks={data.topTracks} onNavigateAlbum={onNavigateAlbum} busy={busy} downloads={downloads} onSaveDiscovery={onSaveDiscovery} onNavigateArtist={onNavigateArtist} />
        </section>
      )}
      {data.topTracks.length === 0 && <p className="subtitle catalog-empty">No popular tracks are available for this artist.</p>}

      {data.albums.length > 0 && (
        <section className="catalog-section artist-section">
          <h2>Albums &amp; releases</h2>
          <div className="collection-grid">
            {data.albums.map((album) => (
              <button key={album.id} className="collection-card" onClick={() => onNavigateAlbum(album.id)} aria-label={`Open album ${album.title}`}>
                <Artwork url={album.artworkUrl} className="collection-art catalog-release-cover" />
                <span className="collection-info">
                  <span className="collection-title">{album.title}</span>
                  <span className="collection-description">{album.year ?? "Release"}{album.trackCount != null ? ` · ${album.trackCount} tracks` : ""}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {data.albums.length === 0 && <p className="subtitle catalog-empty">No releases are available for this artist.</p>}


    </div>
  );
}
