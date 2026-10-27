import { useEffect, useState } from "react";
import { artworkImageSource } from "../common/Artwork";
import type { Track } from "../../domain/types";

async function loadCover(url: string): Promise<string | null> {
  const source = await artworkImageSource(url);
  if (!source) return null;
  return new Promise(resolve => {
    const image = new Image();
    const finish = (value: string | null) => { clearTimeout(timer); image.onload = null; image.onerror = null; resolve(value); };
    const timer = setTimeout(() => { finish(null); image.src = ""; }, 5000);
    image.referrerPolicy = "no-referrer";
    image.onload = () => finish(source);
    image.onerror = () => finish(null);
    image.src = source;
  });
}

export function ImmersiveBackground({ track }: { track?: Track | null }) {
  const [covers, setCovers] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const show = (url: string | null) => {
      if (!cancelled) setCovers(previous => url ? previous.at(-1) === url ? previous : [...previous.slice(-1), url] : []);
    };
    if (track?.artworkUrl) void loadCover(track.artworkUrl).then(show).catch(() => show(null));
    else show(null);
    return () => { cancelled = true; };
  }, [track?.id, track?.artworkUrl]);
  return <div className="immersive-scenery" aria-hidden="true">{covers.map(url => <div key={url} className="immersive-scene is-cover" style={{ backgroundImage: `url(${JSON.stringify(url)})` }} />)}</div>;
}
