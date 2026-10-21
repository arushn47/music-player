import { library, type CatalogAlbum } from "./native";

export const DISCOVERY_LANGUAGES = ["hindi", "english", "tamil", "telugu", "malayalam", "kannada", "punjabi", "bengali", "marathi"] as const;
export type DiscoveryLanguage = typeof DISCOVERY_LANGUAGES[number];
const SETTINGS_KEY = "lumaire-discovery";
const CACHE_KEY = "lumaire-discovery-albums-";
const MAX_AGE = 6 * 60 * 60 * 1000;
const pending = new Map<string, Promise<HomeAlbums>>();
export interface HomeAlbums { albums: CatalogAlbum[]; updatedAt: number }

function read(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Browsing works when local storage is unavailable. */ }
}
export function discoveryPreferences(): { language: DiscoveryLanguage; searches: string[] } {
  const value = read(SETTINGS_KEY) as { language?: unknown; searches?: unknown } | null;
  return {
    language: DISCOVERY_LANGUAGES.includes(value?.language as DiscoveryLanguage) ? value!.language as DiscoveryLanguage : "hindi",
    searches: Array.isArray(value?.searches) ? value.searches.filter((query): query is string => typeof query === "string" && query.trim().length > 0 && query.length <= 200 && !/[\u0000-\u001f]/.test(query)).slice(0, 6) : [],
  };
}
export function setDiscoveryLanguage(language: DiscoveryLanguage): void {
  write(SETTINGS_KEY, { ...discoveryPreferences(), language });
}
export function rememberDiscoverySearch(query: string): string[] {
  const preferences = discoveryPreferences();
  const clean = query.trim().slice(0, 200);
  const searches = clean ? [clean, ...preferences.searches.filter(old => old.toLocaleLowerCase() !== clean.toLocaleLowerCase())].slice(0, 6) : preferences.searches;
  write(SETTINGS_KEY, { ...preferences, searches });
  return searches;
}
export function clearDiscoverySearches(): void {
  write(SETTINGS_KEY, { ...discoveryPreferences(), searches: [] });
}
export function cachedHomeAlbums(language: DiscoveryLanguage): HomeAlbums | null {
  const value = read(CACHE_KEY + language) as Partial<HomeAlbums> | null;
  if (!value || !Number.isFinite(value.updatedAt) || value.updatedAt! <= 0 || value.updatedAt! > Date.now() || !Array.isArray(value.albums)) return null;
  const albums: CatalogAlbum[] = value.albums.slice(0, 12).filter(album => album && typeof album.id === "string" && /^saavn:album:[1-9]\d{0,19}$/.test(album.id)
    && typeof album.title === "string" && album.title.length > 0 && album.title.length <= 4000 && typeof album.artist === "string" && album.artist.length <= 4000)
    .map(album => ({ id: album.id, title: album.title, artist: album.artist, artists: [],
      artworkUrl: typeof album.artworkUrl === "string" && /^https:\/\/c\.saavncdn\.com\//.test(album.artworkUrl) ? album.artworkUrl : null,
      year: Number.isInteger(album.year) && album.year! >= 1900 && album.year! <= 2200 ? album.year : null }));
  return { albums, updatedAt: value.updatedAt! };
}
export function loadHomeAlbums(language: DiscoveryLanguage, refresh = false): Promise<HomeAlbums> {
  const cached = cachedHomeAlbums(language);
  if (!refresh && cached && Date.now() - cached.updatedAt < MAX_AGE) return Promise.resolve(cached);
  let request = pending.get(language);
  if (!request) {
    request = library.discoverAlbums(language).then(albums => {
      const result = { albums, updatedAt: Date.now() };
      write(CACHE_KEY + language, result);
      return result;
    }).finally(() => { pending.delete(language); });
    pending.set(language, request);
  }
  return request;
}
