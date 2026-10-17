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
}
export interface Preferences {
  volume: number;
  repeat: "off" | "all" | "one";
  shuffle: boolean;
  romanisation: boolean;
  translation: boolean;
  lyricSize: number;
  historyEnabled: boolean;
}
export interface Session {
  queue: QueueItem[];
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
    lyricSize: 28,
    historyEnabled: true,
  },
});
export const item = (trackId: string): QueueItem => ({
  id: crypto.randomUUID(),
  trackId,
});
