import React from "react";
import type { CatalogArtistCredit } from "../../adapters/native";
import { artistCredits, artistReference } from "../../domain/catalog-links";

export interface ArtistLinksProps {
  artists?: CatalogArtistCredit[];
  artistString?: string;
  onNavigateArtist?: (artistId: string) => void;
  className?: string;
  maxArtists?: number;
}

export function ArtistLinks({
  artists,
  artistString,
  onNavigateArtist,
  className = "",
  maxArtists,
}: ArtistLinksProps) {
  artists = artists?.length ? artists : artistCredits(artistString || "");
  artists = artists.flatMap(credit => { const parts = artistCredits(credit.name); return /[,;]|\s+and\s+/i.test(credit.name) && parts.length > 1 ? parts : [credit]; });
  artists = artists.filter((credit, index, all) => all.findIndex(other => other.name.toLowerCase() === credit.name.toLowerCase()) === index);
  artists = artists.map(credit => ({ ...credit, id: credit.id || (artistCredits(credit.name).length ? artistReference(credit.name) : undefined) }));
  const hasMore = Boolean(maxArtists && artists.length > maxArtists);
  const displayedArtists = maxArtists && artists.length > maxArtists ? artists.slice(0, maxArtists) : artists;

  // If we have structured artist data with IDs, render individual links
  if (displayedArtists && displayedArtists.length > 0 && onNavigateArtist) {
    return (
      <span className={className}>
        {displayedArtists.map((artist, idx) => (
          <span key={idx}>
            {idx > 0 && ", "}
            {artist.id ? (
              <button
                type="button"
                className="link-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateArtist(artist.id!);
                }}
              >
                {artist.name}
              </button>
            ) : (
              artist.name
            )}
          </span>
        ))}
        {hasMore && "…"}
      </span>
    );
  }

  // Fallback to plain text if no structured data or navigation handler
  if (hasMore) {
    return (
      <span className={className}>
        {displayedArtists.map(a => a.name).join(", ")}…
      </span>
    );
  }
  return <span className={className}>{artistString || ""}</span>;
}
