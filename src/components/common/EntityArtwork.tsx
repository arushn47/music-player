import { useEffect, useRef, useState } from "react";
import { library, type EntityArtwork as ImageCredit } from "../../adapters/native";
import { Artwork } from "./Artwork";
import { artistCredits, artistReference } from "../../domain/catalog-links";

const requests = new Map<string, Promise<ImageCredit | null>>();

export async function resolveEntityArtwork(kind: "artist" | "album", name: string, artist: string, trackTitle: string): Promise<ImageCredit | null> {
  if (kind === "artist" && artistCredits(name).length) {
    const profile = await library.lookupArtist(artistReference(name)).catch(() => null);
    if (profile?.info.artworkUrl) return { url: profile.info.artworkUrl, sourceUrl: "", credit: `${profile.info.name} · Catalog portrait` };
  }
  return library.entityArtwork(kind, name, artist, trackTitle);
}

export function EntityArtwork({ kind, name, artist = "", trackTitle = "" }: {
  kind: "artist" | "album"; name: string; artist?: string; trackTitle?: string;
}) {
  const key = JSON.stringify([kind, name, artist]);
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const [image, setImage] = useState<{ key: string; value: ImageCredit | null } | null>(null);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let request = requests.get(key);
    if (!request) {
      if (requests.size >= 256) requests.delete(requests.keys().next().value!);
      request = resolveEntityArtwork(kind, name, artist, trackTitle).then(value => {
        if (!value) requests.delete(key);
        return value;
      }).catch(() => {
        requests.delete(key);
        return null;
      });
      requests.set(key, request);
    }
    void request.then(value => { if (!cancelled) setImage({ key, value }); });
    return () => { cancelled = true; };
  }, [key, kind, name, artist, trackTitle, visible]);
  const value = image?.key === key ? image.value : null;
  const cover = <Artwork url={value?.url} className="listening-artwork" />;
  return <span ref={ref} className="entity-artwork" data-kind={kind}>{value?.sourceUrl
    ? <a href={value.sourceUrl} target="_blank" rel="noreferrer" title={value.credit} aria-label={`Photo credits for ${name}`}>{cover}</a>
    : cover}</span>;
}
