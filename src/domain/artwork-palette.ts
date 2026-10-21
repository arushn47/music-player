export type ArtworkColor = readonly [number, number, number];
export type ArtworkPalette = readonly [ArtworkColor, ArtworkColor];

/** Population-weighted color buckets on a tiny thumbnail; no playback-frame work. */
export function artworkPalette(pixels: ArrayLike<number>): ArtworkPalette | null {
  const buckets = new Map<number, { count: number; sum: number[] }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bucket = buckets.get(key) || { count: 0, sum: [0, 0, 0] };
    bucket.count++;
    bucket.sum[0] += r; bucket.sum[1] += g; bucket.sum[2] += b;
    buckets.set(key, bucket);
  }
  let ranked = [...buckets.values()].sort((a, b) => b.count - a.count);
  const chromatic = ranked.filter(bucket => {
    const channels = bucket.sum.map(value => value / bucket.count);
    return Math.max(...channels) - Math.min(...channels) >= 32;
  });
  // Ignore neutral borders only when the cover contains a meaningful colored area.
  if (chromatic.reduce((count, bucket) => count + bucket.count, 0) >= ranked.reduce((count, bucket) => count + bucket.count, 0) * 0.08)
    ranked = chromatic;
  if (!ranked.length) return null;
  const average = (bucket: typeof ranked[number]): ArtworkColor => bucket.sum.map(value => Math.round(value / bucket.count)) as [number, number, number];
  const first = average(ranked[0]);
  const second = ranked.slice(1).find(bucket => average(bucket).some((value, i) => Math.abs(value - first[i]) > 60));
  // Desaturate toward the channel mean so even neon covers remain quiet.
  const soften = (color: ArtworkColor): ArtworkColor => {
    const mean = (color[0] + color[1] + color[2]) / 3;
    return color.map(value => Math.round(value * 0.6 + mean * 0.4)) as [number, number, number];
  };
  return [soften(first), soften(second ? average(second) : first)];
}
