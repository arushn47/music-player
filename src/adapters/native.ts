import type { DownloadProgress } from "../domain/downloads";
import { Channel, convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import type { EngineInstallProgress, Session, Snapshot, Track } from "../domain/types";

export interface RemoteTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  fileName: string;
  missing: boolean;
  format: string;
  source: {
    providerId: string;
    sourceId: string;
    pageUrl: string;
    license: string;
    licenseUrl: string;
    attribution: string;
  };
}

export interface YtdlpSearchResult {
  id: string;
  title: string;
  duration: number | null;
  thumbnail: string | null;
  channel: string | null;
  track?: string | null;
  artist?: string | null;
  album?: string | null;
}

export interface YtdlpStreamInfo {
  streamUrl: string;
  duration: number | null;
  title: string | null;
  container: string | null;
  codec: string | null;
  track?: string | null;
  artist?: string | null;
  album?: string | null;
}

export interface CanonicalMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number | null;
  sourceId: string | null;
  artworkUrl?: string | null;
}

export interface CatalogTrack {
  playCount?: number | null;
  genre?: string | null;
  language?: string | null;
  id: string;
  title: string;
  artist: string;
  artistId?: string | null;
  artists: CatalogArtistCredit[];
  album: string;
  albumId?: string | null;
  duration: number;
  artworkUrl?: string | null;
}

export interface CatalogArtistCredit {
  name: string;
  id?: string | null;
}

export interface CatalogArtist {
  id: string;
  name: string;
  artworkUrl?: string | null;
}

export interface CatalogAlbum {
  id: string;
  title: string;
  artist: string;
  artists: CatalogArtistCredit[];
  artworkUrl?: string | null;
  year?: number | null;
  trackCount?: number | null;
}

export interface MusicMetadata {
  provider: string;
  sourceUrl: string;
  name: string;
  credits: string[];
  releaseDate: string | null;
  country: string | null;
  entityType: string | null;
  disambiguation: string | null;
}
export interface AppleChart {
  country: string;
  source: string;
  updatedAt: string | null;
  entries: { id: string; title: string; artist: string; artworkUrl: string | null }[];
  stale: boolean;
  warning: string | null;
}

export interface DiscoverPage {
  newAlbums: CatalogAlbum[];
  newSingles: CatalogTrack[];
  trending: CatalogTrack[];
  trendingItems?: TrendingItem[];
  charts?: CatalogChart[];
  topSongs: CatalogTrack[];
  chartTitle: string;
  warnings: string[];
}

export type TrendingItem =
  | { kind: "song"; item: CatalogTrack }
  | { kind: "album"; item: CatalogAlbum }
  | { kind: "playlist"; item: { id: string; title: string; subtitle: string; artworkUrl?: string | null; url: string } };

export interface CatalogChart {
  id: string;
  title: string;
  subtitle: string;
  artworkUrl?: string | null;
  trackCount?: number | null;
}
export interface ChartDetails {
  info: CatalogChart;
  tracks: CatalogTrack[];
  partial: boolean;
  warning?: string;
}

export interface CatalogEntities {
  artists: CatalogArtist[];
  albums: CatalogAlbum[];
  warning: string | null;
}

export interface ResolvedMedia {
  url: string;
  mimeType: string;
}

export interface EntityArtwork {
  url: string;
  sourceUrl: string;
  credit: string;
}

export interface LibraryPort {
  load(): Promise<Snapshot>;
  save(session: Session): Promise<void>;
  remove(id: string, session: Session): Promise<Snapshot>;
  download(id: string, onProgress?: (progress: DownloadProgress) => void): Promise<Track>;
  cancelDownload(id: string): Promise<void>;
  deleteDownload(id: string): Promise<Track>;
  importAudio(
    folder: boolean,
  ): Promise<{ tracks: Track[]; warnings: string[] }>;
  media(id: string): Promise<string>;
  relink(id: string): Promise<Track | null>;
  lyrics(): Promise<{ text: string; fileName: string } | null>;
  export(session: Session): Promise<boolean>;
  import(): Promise<Snapshot | null>;
  saveOnline(track: Track, updateOnly?: boolean): Promise<Track>;
  searchCommons(query: string): Promise<RemoteTrack[]>;
  resolveCommons(sourceId: string): Promise<ResolvedMedia>;
  ytdlpCheckAvailable(): Promise<boolean>;
  ytdlpInstallEngine(onProgress?: (progress: EngineInstallProgress) => void): Promise<void>;
  ytdlpCancelInstall(): Promise<void>;
  discoverAlbums(language: string): Promise<CatalogAlbum[]>;
  discoverPage(languages: string[]): Promise<DiscoverPage>;
  musicMetadata(kind: "artist" | "album", title: string, artist: string): Promise<MusicMetadata | null>;
  appleChart(country: string, refresh: boolean): Promise<AppleChart>;
  ytdlpSearch(query: string, maxResults?: number, catalog?: boolean): Promise<YtdlpSearchResult[]>;
  ytdlpGetStream(videoId: string): Promise<YtdlpStreamInfo>;
  searchCatalog(query: string, limit?: number): Promise<CatalogTrack[]>;
  searchCatalogEntities(query: string): Promise<CatalogEntities>;
  recommendCatalog(id: string): Promise<CatalogTrack[]>;
  lookupCatalog(id: string): Promise<CatalogTrack>;
  lookupArtist(id: string): Promise<{ info: CatalogArtist; topTracks: CatalogTrack[]; albums: CatalogAlbum[]; similarArtists: CatalogArtist[] }>;
  lookupAlbum(id: string): Promise<{ info: CatalogAlbum; tracks: CatalogTrack[]; partial: boolean }>;
  lookupChart(id: string): Promise<ChartDetails>;
  lookupMetadata(
    title: string,
    artist: string,
    duration: number,
  ): Promise<CanonicalMetadata | null>;
  entityArtwork(kind: "artist" | "album", name: string, artist: string, trackTitle: string): Promise<EntityArtwork | null>;

}
export const desktop = isTauri();
export const mobile = desktop && /Android/i.test(navigator.userAgent);
const needDesktop = async <T>(): Promise<T> => {
  throw new Error(
    "Open the Lumaire desktop app to choose files and use the SQLite library. Run npm run desktop.",
  );
};
const metadataRequests = new Map<string, Promise<CanonicalMetadata | null>>();
const artistRequests = new Map<string, Promise<Awaited<ReturnType<LibraryPort["lookupArtist"]>>>>();
function lookupArtist(id: string): ReturnType<LibraryPort["lookupArtist"]> {
  let request = artistRequests.get(id);
  if (!request) {
    if (artistRequests.size >= 256) artistRequests.delete(artistRequests.keys().next().value!);
    request = invoke<Awaited<ReturnType<LibraryPort["lookupArtist"]>>>("lookup_artist", { id })
      .catch(error => { artistRequests.delete(id); throw error; });
    artistRequests.set(id, request);
  }
  return request;
}
function lookupMetadata(title: string, artist: string, duration: number): Promise<CanonicalMetadata | null> {
  const key = JSON.stringify([title, artist, duration]);
  let request = metadataRequests.get(key);
  if (!request) {
    if (metadataRequests.size >= 256) metadataRequests.delete(metadataRequests.keys().next().value!);
    request = invoke<CanonicalMetadata | null>("lookup_metadata", { title, artist, duration })
      .then(value => { if (!value) metadataRequests.delete(key); return value; })
      .catch(error => { metadataRequests.delete(key); throw error; });
    metadataRequests.set(key, request);
  }
  return request;
}
export const library: LibraryPort = desktop
  ? {
      load: () => invoke("load_library"),
      save: (session) => invoke("save_session", { session }),
      remove: (id, session) => invoke("remove_track", { id, session }),
      download: (id, onProgress) => {
        if (!onProgress) return invoke("download_track", { id });
        const channel = new Channel<DownloadProgress>();
        channel.onmessage = onProgress;
        return invoke("download_track", { id, onProgress: channel });
      },
      cancelDownload: (id) => invoke("cancel_download", { id }),
      deleteDownload: (id) =>
        invoke("delete_download", { id, confirmed: true }),
      importAudio: (folder) => invoke("import_audio", { folder }),
      media: async (id) =>
        convertFileSrc(await invoke<string>("media_path", { id })),
      relink: (id) => invoke("relink_audio", { id }),
      lyrics: () => invoke("pick_lyrics"),
      export: (session) => invoke("export_library", { session }),
      import: () => invoke("import_library"),
      saveOnline: (track, updateOnly = false) =>
        invoke("save_online_track", { track, updateOnly }),
      searchCommons: (query) => invoke("search_commons_audio", { query }),
      resolveCommons: (sourceId) =>
        invoke("resolve_commons_audio", { sourceId }),
      ytdlpCheckAvailable: () => mobile
        ? invoke<{ available: boolean }>("android_source", { operation: "probe" }).then((r) => r.available)
        : invoke("ytdlp_check_available"),
      ytdlpInstallEngine: (onProgress) => {
        if (mobile) return Promise.reject(new Error("Android already includes its streaming engine."));
        const channel = new Channel<EngineInstallProgress>();
        channel.onmessage = progress => onProgress?.(progress);
        return invoke("install_youtube_engine", { onProgress: channel });
      },
      ytdlpCancelInstall: () => invoke("cancel_youtube_engine_install"),
      discoverAlbums: (language) => invoke("discover_albums", { language }),
      discoverPage: (languages) => invoke("discover_page", { languages }),
      musicMetadata: (kind, title, artist) => invoke("music_metadata", { kind, title, artist }),
      appleChart: (country, refresh) => invoke("apple_chart", { country, refresh }),
      ytdlpSearch: (query, maxResults, catalog = false) =>
        mobile
          ? invoke<{ results: YtdlpSearchResult[] }>("android_source", { operation: "search", query, maxResults }).then((r) => r.results)
          : invoke("ytdlp_search", { query, maxResults, catalog }),
      ytdlpGetStream: (videoId) => mobile
        ? invoke<YtdlpStreamInfo & { url: string }>("android_source", { operation: "resolve", videoId }).then((r) => ({ ...r, streamUrl: r.url }))
        : invoke("ytdlp_get_stream", { videoId }),
      lookupMetadata,
      searchCatalog: (query, limit) => invoke("search_catalog", { query, limit }),
      recommendCatalog: (id) => invoke("recommend_catalog", { id }),
      lookupCatalog: (id) => invoke("lookup_catalog", { id }),
      lookupArtist,
      searchCatalogEntities: (query) => invoke("search_catalog_entities", { query }),
      lookupAlbum: (id) => invoke("lookup_album", { id }),
      lookupChart: (id) => invoke("lookup_chart", { id }),
      entityArtwork: (kind, name, artist, trackTitle) =>
        invoke("lookup_entity_artwork", { kind, name, artist, trackTitle }),
    }
  : {
      load: async () => ({ tracks: [], session: null }),
      save: async () => {},
      remove: needDesktop,
      download: needDesktop,
      cancelDownload: needDesktop,
      deleteDownload: needDesktop,
      importAudio: needDesktop,
      media: needDesktop,
      relink: needDesktop,
      lyrics: needDesktop,
      export: needDesktop,
      import: needDesktop,
      saveOnline: needDesktop,
      searchCommons: async () => [],
      resolveCommons: needDesktop,
      ytdlpCheckAvailable: async () => false,
      ytdlpInstallEngine: needDesktop,
      ytdlpCancelInstall: needDesktop,
      discoverAlbums: needDesktop,
      discoverPage: needDesktop,
      musicMetadata: needDesktop,
      appleChart: needDesktop,
      ytdlpSearch: async () => [],
      ytdlpGetStream: needDesktop,
      lookupMetadata: async () => null,
      searchCatalog: async () => [],
      recommendCatalog: needDesktop,
      lookupCatalog: needDesktop,
      lookupArtist: needDesktop,
      searchCatalogEntities: needDesktop,
      lookupAlbum: needDesktop,
      lookupChart: needDesktop,
      entityArtwork: async () => null,
    };
