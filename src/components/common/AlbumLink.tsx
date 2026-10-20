import type { JSX } from "react";
import { albumReference } from "../../domain/catalog-links";

export function AlbumLink({ title, artist, onNavigateAlbum }: {
  title: string; artist: string; onNavigateAlbum?: (id: string) => void;
}): JSX.Element {
  const id = albumReference(title, artist);
  return id && onNavigateAlbum ? <button type="button" className="link-button" onClick={event => {
    event.stopPropagation(); onNavigateAlbum(id);
  }}>{title}</button> : <>{title.trim() || "Unknown album"}</>;
}
