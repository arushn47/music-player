import { Heart } from "lucide-react";
import type { JSX } from "react";
import type { CatalogTrack } from "../../adapters/native";
import type { Track } from "../../domain/types";
import { IconButton } from "./IconButton";

export type CatalogAction = "save" | "next" | "queue" | "favorite" | "playlist" | "download" | "delete-offline" | "remove" | "refresh";
export interface CatalogActionHandlers {
  savedTracks: Track[];
  favorites: string[];
  onCatalogAction: (track: CatalogTrack, action: CatalogAction) => void;
}

export function CatalogTrackActions({ track, savedTracks, favorites, onCatalogAction, disabled }: CatalogActionHandlers & {
  track: CatalogTrack; disabled: boolean;
}): JSX.Element {
  const saved = savedTracks.find(saved => saved.metadataSourceId === track.id);
  const favorite = saved ? favorites.includes(saved.id) : false;
  const run = (event: React.MouseEvent<HTMLButtonElement>, action: CatalogAction) => {
    event.currentTarget.closest("details")?.removeAttribute("open");
    onCatalogAction(track, action);
  };
  return <>
    <IconButton label={`${favorite ? "Unfavorite" : "Favorite"} ${track.title}`} active={favorite} disabled={disabled} onClick={() => onCatalogAction(track, "favorite")}>
      <Heart size={17} fill={favorite ? "currentColor" : "none"} />
    </IconButton>
    <details className="track-menu">
      <summary aria-label={`Actions for ${track.title}`}>•••</summary>
      <div className="menu-popover">
        <button disabled={disabled} onClick={event => run(event, saved ? "remove" : "save")}>{saved ? "Remove from library" : "Save to library"}</button>
        <button disabled={disabled} onClick={event => run(event, saved?.offline ? "delete-offline" : "download")}>{saved?.offline ? "Delete offline copy" : "Download for offline"}</button>
        <button disabled={disabled} onClick={event => run(event, "next")}>Play next</button>
        <button disabled={disabled} onClick={event => run(event, "queue")}>Add to queue</button>
        <button disabled={disabled} onClick={event => run(event, "refresh")}>Refresh metadata</button>
        <button disabled={disabled} onClick={event => run(event, "playlist")}>Save to playlist</button>
      </div>
    </details>
  </>;
}
