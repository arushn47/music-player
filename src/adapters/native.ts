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
}

export interface YtdlpStreamInfo {
  streamUrl: string;
  duration: number | null;
  title: string | null;
  container: string | null;
  codec: string | null;
}

export interface ResolvedMedia {
  url: string;
  mimeType: string;
}

export interface LibraryPort {
  load(): Promise<Snapshot>;
  save(session: Session): Promise<void>;
  importAudio(
    folder: boolean,
  ): Promise<{ tracks: Track[]; warnings: string[] }>;
  media(id: string): Promise<string>;
  relink(id: string): Promise<Track | null>;
  lyrics(): Promise<{ text: string; fileName: string } | null>;
  export(session: Session): Promise<boolean>;
  import(): Promise<Snapshot | null>;
  searchCommons(query: string): Promise<RemoteTrack[]>;
  resolveCommons(sourceId: string): Promise<ResolvedMedia>;
  ytdlpCheckAvailable(): Promise<boolean>;
  ytdlpSearch(query: string, maxResults?: number): Promise<YtdlpSearchResult[]>;
  ytdlpGetStream(videoId: string): Promise<YtdlpStreamInfo>;
}
export const desktop = isTauri();
const needDesktop = async <T>(): Promise<T> => {
  throw new Error(
    "Open the Lumaire desktop app to choose files and use the SQLite library. Run npm run desktop.",
  );
};
export const library: LibraryPort = desktop
  ? {
      load: () => invoke("load_library"),
      save: (session) => invoke("save_session", { session }),
      importAudio: (folder) => invoke("import_audio", { folder }),
      media: async (id) =>
        convertFileSrc(await invoke<string>("media_path", { id })),
      relink: (id) => invoke("relink_audio", { id }),
      lyrics: () => invoke("pick_lyrics"),
      export: (session) => invoke("export_library", { session }),
      import: () => invoke("import_library"),
      searchCommons: (query) => invoke("search_commons_audio", { query }),
      resolveCommons: (sourceId) => invoke("resolve_commons_audio", { sourceId }),
      ytdlpCheckAvailable: () => invoke("ytdlp_check_available"),
      ytdlpSearch: (query, maxResults) => invoke("ytdlp_search", { query, maxResults }),
      ytdlpGetStream: (videoId) => invoke("ytdlp_get_stream", { videoId }),
    }
  : {
      load: async () => ({ tracks: [], session: null }),
      save: async () => {},
      importAudio: needDesktop,
      media: needDesktop,
      relink: needDesktop,
      lyrics: needDesktop,
      export: needDesktop,
      import: needDesktop,
      searchCommons: async () => [],
      resolveCommons: needDesktop,
      ytdlpCheckAvailable: async () => false,
      ytdlpSearch: async () => [],
      ytdlpGetStream: needDesktop,
    };
