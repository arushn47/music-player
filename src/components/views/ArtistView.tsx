import { MusicMetadataDetails } from "../common/MusicMetadataDetails";
import React, { useEffect, useState } from "react";
import { library } from "../../adapters/native";
import type { DiscoveryViewProps } from "./DiscoveryView";
import { ChevronLeft, CircleAlert, Loader2, Heart, Play } from "lucide-react";
import { Artwork } from "../common";
import { CatalogTrackList } from "../common/CatalogTrackList";
import type { CatalogActionHandlers } from "../common/CatalogTrackActions";

interface ArtistViewProps extends CatalogActionHandlers {
  artistId: string;
  favoriteArtists: import("../../domain/types").Session["favoriteArtists"];
  onFavoriteArtist: (artist: import("../../adapters/native").CatalogArtist) => void;
  onNavigateAlbum: (albumId: string) => void;
  onNavigateArtist: (artistId: string) => void;
  onSaveDiscovery: DiscoveryViewProps["onSaveDiscovery"];
  busy: boolean;
  downloads: Record<string, string>;
  onBack: () => void;
  onPlayAlbum?: (albumId: string) => void;
}

type ArtistData = Awaited<ReturnType<typeof library.lookupArtist>>;

export function ArtistView({
  favoriteArtists,
  onFavoriteArtist,
  artistId,
  onNavigateAlbum,
  onNavigateArtist,
  onSaveDiscovery,
  busy,
  downloads,
  onBack,
  savedTracks,
  favorites,
  onCatalogAction,
  onPlayAlbum,
}: ArtistViewProps) {
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

  const isFavorite = favoriteArtists.some(artist => artist.id === data.info.id);

  return (
    <div className="artist-page">
      <div className="catalog-toolbar">
        <button onClick={onBack} className="subtle"><ChevronLeft size={16} />Back</button>
      </div>
      <div className="page-heading catalog-hero artist-header">
        <div className="artist-cover-wrap">
          <Artwork url={data.info.artworkUrl} className="artist-cover" kind="artist" />
        </div>
        <div className="artist-info">
          <p className="eyebrow">ARTIST</p>
          <h1 className="artist-name">{data.info.name}</h1>
          <p className="subtitle artist-subtitle">Popular tracks and available releases</p>
          <div className="artist-actions">
            <button
              type="button"
              className={`subtle artist-favorite-btn ${isFavorite ? "is-active" : ""}`}
              aria-pressed={isFavorite}
              title={isFavorite ? "Remove from favorite artists" : "Add to favorite artists"}
              onClick={() => onFavoriteArtist(data.info)}
            >
              <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
              <span>{isFavorite ? "Favorited" : "Favorite artist"}</span>
            </button>
          </div>
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
          <div className="albums-grid artist-albums-grid">
            {data.albums.map((album) => (
              <button
                key={album.id}
                type="button"
                className="album-card discover-album-card"
                onClick={() => onNavigateAlbum(album.id)}
                aria-label={`Open album ${album.title}`}
              >
                <div className="album-card-cover-wrap">
                  <Artwork url={album.artworkUrl} className="album-card-cover" />
                  <div
                    className="album-hover-play"
                    aria-label={`Play ${album.title}`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      if (onPlayAlbum) {
                        e.stopPropagation();
                        onPlayAlbum(album.id);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (onPlayAlbum) {
                          e.stopPropagation();
                          onPlayAlbum(album.id);
                        }
                      }
                    }}
                  >
                    <Play size={18} fill="currentColor" color="currentColor" />
                  </div>
                </div>
                <div className="album-card-info">
                  <div className="album-title" title={album.title}>
                    {album.title}
                  </div>
                  <div
                    className="album-year"
                    title={`${album.year ?? "Release"}${album.trackCount != null ? ` · ${album.trackCount} tracks` : ""}`}
                  >
                    {album.year ?? "Release"}{album.trackCount != null ? ` · ${album.trackCount} tracks` : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      {data.albums.length === 0 && <p className="subtitle catalog-empty">No releases are available for this artist.</p>}

      <MusicMetadataDetails key={data.info.id} kind="artist" title={data.info.name} />
    </div>
  );
}
