import { library, type AppleChart, type MusicMetadata } from "./native";

const metadataPending = new Map<string, Promise<MusicMetadata | null>>();
export function loadMusicMetadata(kind: "artist" | "album", title: string, artist: string): Promise<MusicMetadata | null> {
  const key = JSON.stringify([kind, title, artist]);
  const existing = metadataPending.get(key);
  if (existing) return existing;
  const request = library.musicMetadata(kind, title, artist).finally(() => metadataPending.delete(key));
  metadataPending.set(key, request);
  return request;
}
export const CHART_COUNTRIES = { in: "India", us: "United States", gb: "United Kingdom", ca: "Canada", au: "Australia", jp: "Japan", kr: "South Korea", de: "Germany", fr: "France" } as const;
export type ChartCountry = keyof typeof CHART_COUNTRIES;
export function chartCountry(): ChartCountry {
  try { const value = localStorage.getItem("lumaire-chart-country"); if (value && Object.prototype.hasOwnProperty.call(CHART_COUNTRIES, value)) return value as ChartCountry; } catch { /* Storage may be unavailable. */ }
  return "in";
}
export function saveChartCountry(value: ChartCountry): void {
  try { localStorage.setItem("lumaire-chart-country", value); } catch { /* The current chart still works. */ }
}
const chartPending = new Map<string, Promise<AppleChart>>();
export function loadAppleChart(country: ChartCountry, refresh = false): Promise<AppleChart> {
  const existing = chartPending.get(country);
  if (existing) return existing;
  const request = library.appleChart(country, refresh).finally(() => chartPending.delete(country));
  chartPending.set(country, request);
  return request;
}
