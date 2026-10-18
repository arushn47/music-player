import { useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { Music2 } from "lucide-react";

const pending = new Map<string, Promise<string | null>>();

function displayArtworkUrl(url?: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "i.ytimg.com") return url;
    const match = parsed.pathname.match(/^\/vi(?:_webp)?\/([\w-]{11})\//);
    return match ? `https://i.ytimg.com/vi/${match[1]}/mqdefault.jpg` : url;
  } catch {
    return url;
  }
}

function cached(url: string) {
  let request = pending.get(url);
  if (!request) {
    if (pending.size >= 256) pending.delete(pending.keys().next().value!);
    request = invoke<string>("cached_artwork", { url })
      .then(convertFileSrc)
      .catch(() => null);
    pending.set(url, request);
  }
  return request;
}

export interface ArtworkProps {
  url?: string | null;
  className?: string;
}

export function Artwork({
  url,
  className = "",
}: ArtworkProps) {
  const displayUrl = displayArtworkUrl(url);
  const [failed, setFailed] = useState<string | null>(null);
  const [local, setLocal] = useState<{ url: string; path: string } | null>(
    null,
  );
  const [visible, setVisible] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (displayUrl && visible && isTauri())
      void cached(displayUrl).then((path) => {
        if (!cancelled) {
          if (path) setLocal({ url: displayUrl, path });
          else if (displayUrl.startsWith("local:")) setFailed(displayUrl);
          else setFallback(displayUrl);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [displayUrl, visible]);

  return (
    <span className={`cover ${className}`} ref={ref}>
      {displayUrl &&
      failed !== displayUrl &&
      (!isTauri() || local?.url === displayUrl || fallback === displayUrl) ? (
        <img
          src={local?.url === displayUrl ? local.path : displayUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(displayUrl)}
        />
      ) : (
        <Music2 size={20} />
      )}
    </span>
  );
}
