import { FolderOpen, ListMusic } from "lucide-react";
import type { Collection } from "../domain/collections";
import { Artwork } from "./Artwork";

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
      {visible.map((collection) => (
        <button
          className="collection-card"
          key={collection.id}
          aria-label={`Open ${collection.name}`}
          onClick={() => open(collection.id)}
        >
          <span className="collection-art">
            {collection.tracks.length ? (
              collection.tracks
                .slice(0, 4)
                .map((track, index) => (
                  <Artwork
                    url={track.artworkUrl}
                    key={`${track.id}-${index}`}
                  />
                ))
            ) : (
              <ListMusic size={44} />
            )}
          </span>
          <span className="collection-title">
            {collection.id === "collection:local" && <FolderOpen size={18} />}
            {collection.name}
          </span>
          <span>
            {collection.tracks.length}{" "}
            {collection.tracks.length === 1 ? "track" : "tracks"} ·{" "}
            {collection.description}
          </span>
        </button>
      ))}
      {!visible.length && (
        <p className="muted">
          No matching collections. Add music or create a playlist to begin.
        </p>
      )}
    </section>
  );
}
