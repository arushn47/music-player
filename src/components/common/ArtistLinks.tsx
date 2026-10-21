import React from "react";
import type { CatalogArtistCredit } from "../../adapters/native";
import { artistCredits, artistReference } from "../../domain/catalog-links";

export interface ArtistLinksProps {
  artists?: CatalogArtistCredit[];
  artistString?: string;
  onNavigateArtist?: (artistId: string) => void;
  className?: string;
}

export function ArtistLinks({
  artists,
  artistString,
  onNavigateArtist,
  className = "",
}: ArtistLinksProps) {
  artists = artists?.length ? artists : artistCredits(artistString || "");
  artists = artists.map(credit => ({ ...credit, id: credit.id || (artistCredits(credit.name).length ? artistReference(credit.name) : undefined) }));
  // If we have structured artist data with IDs, render individual links
  if (artists && artists.length > 0 && onNavigateArtist) {
    return (
      <span className={className}>
        {artists.map((artist, idx) => (
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
      </span>
    );
  }

  // Fallback to plain text if no structured data or navigation handler
  return <span className={className}>{artistString || ""}</span>;
}
