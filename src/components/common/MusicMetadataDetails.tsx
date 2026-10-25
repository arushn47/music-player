import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { loadMusicMetadata } from "../../adapters/music-providers";
import type { MusicMetadata } from "../../adapters/native";

export function MusicMetadataDetails({ kind, title, artist = "" }: { kind: "artist" | "album"; title: string; artist?: string }) {
  const [value, setValue] = useState<MusicMetadata | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [linkError, setLinkError] = useState("");
  useEffect(() => {
    let active = true;
    setValue(null); setUnavailable(false);
    const timer = window.setTimeout(() => {
      void loadMusicMetadata(kind, title, artist).then(metadata => {
        if (active) { setValue(metadata); setUnavailable(!metadata); }
      }).catch(() => { if (active) setUnavailable(true); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [kind, title, artist]);
  if (!value) return null;
  return <aside className="music-metadata-details" aria-label={`${value.provider} metadata`}>
    <dl>
      {value.releaseDate && <div className="metadata-entry"><dt>{value.provider === "MusicBrainz" ? "First released" : "Released"}:</dt><dd>{value.releaseDate}</dd></div>}
      {value.entityType && <div className="metadata-entry"><dt>Type:</dt><dd>{value.entityType}</dd></div>}
      {!!value.credits.length && <div className="metadata-entry"><dt>Credits:</dt><dd>{value.credits.join(", ")}</dd></div>}
      {value.country && <div className="metadata-entry"><dt>Country:</dt><dd>{value.country}</dd></div>}
      {value.disambiguation && <div className="metadata-entry"><dt>About:</dt><dd>{value.disambiguation}</dd></div>}
    </dl>
    <p className="metadata-source">Metadata · <a href={value.sourceUrl} target="_blank" rel="noreferrer" onClick={event => {
      if (!isTauri()) return;
      event.preventDefault(); void openUrl(value.sourceUrl).catch(() => setLinkError("Couldn’t open the metadata source in your browser."));
    }}>{value.provider} ↗</a></p>
    {linkError && <p role="status">{linkError}</p>}
  </aside>;
}
