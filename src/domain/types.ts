export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  fileName: string;
  missing: boolean;
  format: string;
  /** Stable provider identity only. Expiring stream URLs are never persisted. */
  source?: RemoteSource;
  artworkUrl?: string | null;
  /** Backend-owned offline copy, never a renderer-provided filesystem path. */
  offline?: boolean;
}
export interface RemoteSource {
  providerId: string;
  sourceId: string;
  pageUrl: string;
  license: string;
  licenseUrl: string;
  attribution: string;
}
export interface QueueItem {
  id: string;
  trackId: string;
  requested?: boolean;
}
export interface Playlist {
  id: string;
  name: string;
  items: QueueItem[];
}
export interface LyricLine {
  id: string;
  time: number | null;
  text: string;
}
export interface LyricDocument {
  origin?: "provider" | "imported";
  id: string;
  raw: string;
  fileName: string;
  lines: LyricLine[];
  fileOffset: number;
  userOffset: number;
  warnings: string[];
  romanisation: Record<string, string>;
  translation: Record<string, string>;
  instrumental?: boolean;
  timingMode?: "synced" | "unsynced";
  source?: {
    provider: "lrclib";
    recordId: number;
    title: string;
    artist: string;
    duration: number;
  };
}
export interface Preferences {
  volume: number;
  repeat: "off" | "all" | "one";
  shuffle: boolean;
  romanisation: boolean;
  translation: boolean;
  originalScript: boolean;
  originalFirst: boolean;
  autoOpenLyrics: boolean;
  estimatedScroll: boolean;
  geminiModel: string;
  lyricSize: number;
  historyEnabled: boolean;
}
export interface Session {
  queue: QueueItem[];
  /** Remote metadata needed for this listening session, never library membership. */
  queueTracks: Record<string, Track>;
  currentId: string | null;
  position: number;
  favorites: string[];
  playlists: Playlist[];
  lyrics: Record<string, LyricDocument>;
  settings: Preferences;
  history: { trackId: string; at: string }[];
}
export interface Snapshot {
  tracks: Track[];
  session: Session | null;
}
export const defaults = (): Session => ({
  queue: [],
  queueTracks: {},
  currentId: null,
  position: 0,
  favorites: [],
  playlists: [],
  lyrics: {},
  history: [],
  settings: {
    volume: 0.75,
    repeat: "off",
    shuffle: false,
    romanisation: true,
    translation: true,
    originalScript: true,
    originalFirst: true,
    autoOpenLyrics: false,
    estimatedScroll: true,
    geminiModel: "gemini-3.5-flash-lite",
    lyricSize: 28,
    historyEnabled: true,
  },
});
export const item = (trackId: string): QueueItem => ({
  id: crypto.randomUUID(),
  trackId,
});
