import React from "react";
import { Download, FolderOpen, Globe2, ListMusic } from "lucide-react";
import type { Collection } from "../../domain/collections";
import { Artwork } from "../common/Artwork";

export function Collections({
  collections,
  query,
  open,
}: {
  collections: Collection[];
  query: string;
  open: (id: string) => void;
}) {
  const visible = collections.filter((collection) =>
    `${collection.name} ${collection.tracks.map((track) => `${track.title} ${track.artist}`).join(" ")}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );

  return (
    <section className="collection-grid" aria-label="Your collections">
      {visible.map((collection) => {
        const tracksWithArt = collection.tracks.filter((track) =>
          Boolean(track.artworkUrl),
        );
        const hasArt = tracksWithArt.length > 0;

        return (
          <button
            className="collection-card"
            key={collection.id}
            aria-label={`Open ${collection.name}`}
            onClick={() => open(collection.id)}
          >
            <div className="collection-art-wrap">
              <span className={`collection-art ${hasArt ? "with-covers" : "placeholder"}`}>
                {hasArt ? (
                  (() => {
                    const arts = tracksWithArt.slice(0, 4);
                    // Match YouTube Music:
                    // 1 track: 1 full cover (handled by :only-child)
                    // 2 tracks: repeat diagonally/cyclically [A, B, B, A] to form a full 2x2 grid
                    // 3 tracks: repeat 1st track in 4th slot [A, B, C, A] to form a full 2x2 grid
                    // 4+ tracks: [A, B, C, D]
                    const resolvedArts =
                      arts.length === 2
                        ? [arts[0], arts[1], arts[1], arts[0]]
                        : arts.length === 3
                          ? [arts[0], arts[1], arts[2], arts[0]]
                          : arts;

                    return resolvedArts.map((track, index) => (
                      <Artwork
                        url={track.artworkUrl}
                        key={`${track.id}-${index}`}
                      />
                    ));
                  })()
                ) : (
                  <div className="collection-art-placeholder">
                    {collection.id === "collection:local" ? (
                      <FolderOpen size={36} strokeWidth={1.5} />
                    ) : collection.id === "collection:online" ? (
                      <Globe2 size={36} strokeWidth={1.5} />
                    ) : collection.id === "collection:downloads" ? (
                      <Download size={36} strokeWidth={1.5} />
                    ) : (
                      <ListMusic size={36} strokeWidth={1.5} />
                    )}
                  </div>
                )}
              </span>
            </div>
            <div className="collection-info">
              <div className="collection-title-row">
                <span className="collection-title">{collection.name}</span>
                <span className="collection-track-count">
                  {collection.tracks.length}{" "}
                  {collection.tracks.length === 1 ? "track" : "tracks"}
                </span>
              </div>
              <span className="collection-description">
                {collection.description}
              </span>
            </div>
          </button>
        );
      })}
      {!visible.length && (
        <p className="muted">
          No matching collections. Add music or create a playlist to begin.
        </p>
      )}
    </section>
  );
}
