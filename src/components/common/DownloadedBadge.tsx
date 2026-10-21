import { CircleArrowDown } from "lucide-react";
import type { JSX } from "react";
import type { Track } from "../../domain/types";

export function DownloadedBadge({ track }: { track?: Pick<Track, "offline" | "missing"> }): JSX.Element | null {
  return track?.offline && !track.missing
    ? <span className="downloaded-badge" role="img" aria-label="Downloaded" title="Downloaded · Available offline"><CircleArrowDown size={14} aria-hidden="true" /></span>
    : null;
}
