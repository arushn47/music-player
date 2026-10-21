import { useEffect, useRef, useState, type CSSProperties } from "react";
import { artworkPalette, type ArtworkPalette } from "../../domain/artwork-palette";
import { artworkImageSource } from "./Artwork";
import "./ambient.css";

const palettes = new Map<string, Promise<ArtworkPalette | null>>();
function paletteFor(url: string): Promise<ArtworkPalette | null> {
  const existing = palettes.get(url);
  if (existing) return existing;
  const request = artworkImageSource(url).then(source => new Promise<ArtworkPalette | null>(resolve => {
    if (!source) { resolve(null); return; }
    const img = new Image();
    const finish = (palette: ArtworkPalette | null) => {
      clearTimeout(timeout); img.onload = null; img.onerror = null; resolve(palette);
    };
    const timeout = window.setTimeout(() => { finish(null); img.src = ""; }, 5000);
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 32;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) { finish(null); return; }
        context.drawImage(img, 0, 0, 32, 32);
        finish(artworkPalette(context.getImageData(0, 0, 32, 32).data));
      } catch { finish(null); } // Unreadable/CORS-blocked art keeps the neutral theme.
    };
    img.onerror = () => finish(null);
    img.src = source;
  })).catch(() => null).then(palette => {
    if (!palette) palettes.delete(url);
    return palette;
  });
  if (palettes.size >= 64) palettes.delete(palettes.keys().next().value!);
  palettes.set(url, request);
  return request;
}

export function AmbientBackground({ artwork }: { artwork?: string | null }) {
  const [palette, setPalette] = useState<ArtworkPalette | null>(null);
  const [layers, setLayers] = useState([{ id: 0, palette: null as ArtworkPalette | null }]);
  const sequence = useRef(0);
  useEffect(() => {
    let active = true;
    if (!artwork) setPalette(null);
    else void paletteFor(artwork).then(value => { if (active) setPalette(value); });
    return () => { active = false; };
  }, [artwork]);
  useEffect(() => {
    const id = ++sequence.current;
    setLayers(previous => [...previous.slice(-3), { id, palette }]);
    const timer = window.setTimeout(() => setLayers(current => current.filter(layer => layer.id >= id)), 700);
    return () => clearTimeout(timer);
  }, [palette]);
  return <div className="ambient-background" aria-hidden="true">
    {layers.map(layer => <div key={layer.id} className="ambient-layer" style={{
      "--cover-primary": (layer.palette?.[0] || [18, 18, 18]).join(" "),
      "--cover-secondary": (layer.palette?.[1] || [18, 18, 18]).join(" "),
      "--cover-weight": layer.palette ? undefined : "0%",
    } as CSSProperties} />)}
  </div>;
}
