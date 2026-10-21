import { invoke } from "@tauri-apps/api/core";
import type { Track } from "../domain/types";
import type { SharedState } from "../domain/nearby";
import type { ImportRow } from '../domain/playlist-import';
export const collections = {
  readPlaylistFile: (): Promise<string | null> => invoke("read_playlist_file"),
  readPlaylistLink: (link: string): Promise<{ name: string; rows: (ImportRow & { track?: Track | null })[]; warning: string }> => invoke('read_playlist_link', { link }),
  saveCatalogTracks: (tracks: Track[]): Promise<Track[]> => invoke("save_catalog_tracks", { tracks }),
  startSharing: (): Promise<string> => invoke("nearby_start"),
  stopSharing: (): Promise<void> => invoke("nearby_stop"),
  publish: (data: SharedState): Promise<void> => invoke("nearby_publish", { data }),
  fetch: (link: string): Promise<SharedState> => invoke("nearby_fetch", { link }),
};
