import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import type { Session, Snapshot, Track } from "../domain/types";

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

export interface SpotifyMetadata {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
  spotifyUrl: string;
  spotifyId: string;
}

export interface ResolvedMedia {
  url: string;
  mimeType: string;
}

export interface LibraryPort {
  load(): Promise<Snapshot>;
  save(session: Session): Promise<void>;
  remove(id: string, session: Session): Promise<Snapshot>;
  download(id: string): Promise<Track>;
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
  ytdlpSearch(query: string, maxResults?: number): Promise<YtdlpSearchResult[]>;
  ytdlpGetStream(videoId: string): Promise<YtdlpStreamInfo>;
  lookupMetadata(
    title: string,
    artist: string,
    duration: number,
  ): Promise<CanonicalMetadata | null>;
  spotifySearchTrack(
    title: string,
    artist: string,
    duration: number,
  ): Promise<SpotifyMetadata | null>;
}
export const desktop = isTauri();
export const mobile = desktop && /Android/i.test(navigator.userAgent);
const needDesktop = async <T>(): Promise<T> => {
  throw new Error(
    "Open the Lumaire desktop app to choose files and use the SQLite library. Run npm run desktop.",
  );
};
export const library: LibraryPort = desktop
  ? {
      load: () => invoke("load_library"),
      save: (session) => invoke("save_session", { session }),
      remove: (id, session) => invoke("remove_track", { id, session }),
      download: (id) => invoke("download_track", { id }),
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
      ytdlpCheckAvailable: () => invoke("ytdlp_check_available"),
      ytdlpSearch: (query, maxResults) =>
        invoke("ytdlp_search", { query, maxResults }),
      ytdlpGetStream: (videoId) => invoke("ytdlp_get_stream", { videoId }),
      lookupMetadata: (title, artist, duration) =>
        invoke("lookup_metadata", { title, artist, duration }),
      spotifySearchTrack: (title, artist, duration) =>
        invoke("spotify_search_track", { title, artist, duration }),
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
      ytdlpSearch: async () => [],
      ytdlpGetStream: needDesktop,
      lookupMetadata: async () => null,
      spotifySearchTrack: async () => null,
    };
