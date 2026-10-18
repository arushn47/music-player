import { useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { Music2 } from "lucide-react";
const pending = new Map<string, Promise<string | null>>();
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

export function Artwork({
  url,
  className = "",
}: {
  url?: string | null;
  className?: string;
}) {
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
    if (url && visible && isTauri())
      void cached(url).then((path) => {
        if (!cancelled) {
          if (path) setLocal({ url, path });
          else if (url.startsWith("local:")) setFailed(url);
          else setFallback(url);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, visible]);
  return (
    <span className={`cover ${className}`} ref={ref}>
      {url &&
      failed !== url &&
      (!isTauri() || local?.url === url || fallback === url) ? (
        <img
          src={local?.url === url ? local.path : url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(url)}
        />
      ) : (
        <Music2 size={20} />
      )}
    </span>
  );
}
