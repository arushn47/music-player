import React, { useEffect, useState } from "react";
import { library } from "../../adapters/native";
import type { DiscoveryViewProps } from "./DiscoveryView";
import { ChevronLeft, CircleAlert, Loader2 } from "lucide-react";
import { Artwork, ArtistLinks } from "../common";
import { CatalogTrackList } from "../common/CatalogTrackList";
import type { CatalogActionHandlers } from "../common/CatalogTrackActions";

interface AlbumViewProps extends CatalogActionHandlers {
  albumId: string;
  onSaveDiscovery: DiscoveryViewProps["onSaveDiscovery"];
  busy: boolean;
  downloads: Record<string, string>;
  onBack: () => void;
  onNavigateArtist?: (artistId: string) => void;
}

type AlbumData = Awaited<ReturnType<typeof library.lookupAlbum>>;

export function AlbumView({ albumId, onSaveDiscovery, busy, downloads, onBack, onNavigateArtist, savedTracks, favorites, onCatalogAction }: AlbumViewProps) {
  const [data, setData] = useState<AlbumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    library
      .lookupAlbum(albumId)
      .then(result => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [albumId, attempt]);

  if (loading) {
    return (
      <div className="empty page-loading" role="status">
        <Loader2 size={32} className="spin" />
        <p>Loading album...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="empty page-error" role="alert">
        <CircleAlert size={32} />
        <h2>Album unavailable</h2>
        <p>{error || "Failed to load album"}</p>
        <div className="heading-actions">
          <button onClick={() => setAttempt(value => value + 1)} className="primary">Retry</button>
          <button onClick={onBack} className="subtle">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="album-page">
      <div className="catalog-toolbar">
        <button onClick={onBack} className="subtle"><ChevronLeft size={16} />Back</button>
      </div>
      <div className="page-heading catalog-hero album-header">
        <Artwork url={data.info.artworkUrl} className="album-cover" />
        <div className="album-info">
          <p className="eyebrow">ALBUM</p>
          <h1>{data.info.title}</h1>
          <p className="subtitle album-by">
            by{" "}
            <ArtistLinks
              artists={data.info.artists}
              artistString={data.info.artist}
              onNavigateArtist={onNavigateArtist}
            />
          </p>
          <div className="subtitle album-meta">
            {data.info.year != null && <span>{data.info.year}</span>}
            <span>{data.tracks.length} tracks</span>
          </div>
        </div>
      </div>
      {data.partial && <p className="subtitle">Tracks found in catalog search. This may be an incomplete album.</p>}
      {data.tracks.length === 0 && <p className="subtitle catalog-empty">No tracks are currently available for this album.</p>}

      {data.tracks.length > 0 && (
        <section className="album-tracks">
          <CatalogTrackList savedTracks={savedTracks} favorites={favorites} onCatalogAction={onCatalogAction} tracks={data.tracks} busy={busy} downloads={downloads} onSaveDiscovery={onSaveDiscovery} onNavigateArtist={onNavigateArtist} />
        </section>
      )}
    </div>
  );
}
