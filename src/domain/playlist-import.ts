import type { CatalogTrack } from "../adapters/native";
import { item, type Playlist, type Track } from "./types";

export interface PlaylistImportOptions { source?: string; duplicate?: "merge" | "separate" }

export function playlistSource(link: string): string | undefined {
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" || url.username || url.password) return;
    const parts = url.pathname.split("/").filter(Boolean);
    if (["youtube.com", "www.youtube.com", "music.youtube.com"].includes(url.hostname)) {
      const id = url.searchParams.get("list");
      if (id && /^[\w-]{10,100}$/.test(id)) return `youtube:${id}`;
    }
    if (url.hostname === "open.spotify.com") {
      const id = parts[parts.indexOf("playlist") + 1];
      if (parts.includes("playlist") && /^[A-Za-z0-9]{22}$/.test(id || "")) return `spotify:${id}`;
    }
    if (url.hostname === "music.apple.com" && parts.includes("playlist")) {
      const id = parts.at(-1);
      if (id && /^pl\.[\w.-]{1,97}$/.test(id)) return `apple:${id}`;
    }
  } catch { /* Link validation and fetching are handled by the native adapter. */ }
}

export function importConflicts(playlists: Playlist[], name: string, source?: string): Playlist[] {
  const sameSource = source ? playlists.filter(p => p.importSources?.includes(source)) : [];
  return sameSource.length ? sameSource : playlists.filter(p => p.name.normalize("NFKC").trim().toLowerCase() === name.normalize("NFKC").trim().toLowerCase());
}

export function mergePlaylistImport(playlists: Playlist[], name: string, imported: Track[], saved: Track[], options: PlaylistImportOptions): { playlists: Playlist[]; playlist: Playlist; added: number; merged: boolean } {
  const conflicts = importConflicts(playlists, name, options.source);
  const sameSource = Boolean(options.source && conflicts.some(p => p.importSources?.includes(options.source!)));
  if (conflicts.length && !sameSource && !options.duplicate) throw Error("Choose Merge songs or Import separately for the matching playlist name.");
  const targets = sameSource || options.duplicate === "merge" ? conflicts : [];
  const existing = targets[0];
  const tracks = new Map([...saved, ...imported].map(track => [track.id, track]));
  const identity = (id: string) => tracks.get(id)?.metadataSourceId || id;
  const seen = new Set<string>();
  const items = targets.flatMap(p => p.items).filter(entry => { const key = identity(entry.trackId); if (seen.has(key)) return false; seen.add(key); return true; });
  const before = items.length;
  for (const track of imported) {
    const key = identity(track.id);
    if (!seen.has(key)) { seen.add(key); items.push(item(track.id)); }
  }
  const playlist: Playlist = { ...(existing || {}), id: existing?.id || crypto.randomUUID(), name: existing?.name || name, items, importSources: [...new Set([...targets.flatMap(p => p.importSources || []), ...(options.source ? [options.source] : [])])] };
  const removed = new Set(targets.map(p => p.id));
  return { playlists: existing ? playlists.flatMap(p => p.id === existing.id ? [playlist] : removed.has(p.id) ? [] : [p]) : [...playlists, playlist], playlist, added: items.length - before, merged: Boolean(existing) };
}

export interface ImportRow { title: string; artist: string; album: string; duration: number }
const normalized = (text: string) => text.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function parsePlaylist(text: string): ImportRow[] {
  if (text.length > 1_000_000) throw Error("Choose a playlist smaller than 1 MB.");
  text = text.replace(/^\uFEFF/, "");
  if (/^#EXTM3U/m.test(text)) {
    const rows = [...text.matchAll(/^#EXTINF:([^,]*),([^\r\n]+)/gm)].map((match) => {
      const parts = match[2].split(" - ");
      return { title: parts.length > 1 ? parts.slice(1).join(" - ").trim() : parts[0].trim(), artist: parts.length > 1 ? parts[0].trim() : "", album: "", duration: Math.max(0, Number(match[1]) || 0) };
    });
    if (!rows.length || rows.length > 500) throw Error("Use an extended M3U containing 1–500 titled tracks. File paths are not imported.");
    return rows;
  }
  const delimiter = text.split(/\r?\n/, 1)[0].includes("\t") ? "\t" : ",";
  const table: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === delimiter || char === "\n")) {
      row.push(field.replace(/\r$/, "")); field = "";
      if (char === "\n") { if (row.some(value => value.trim())) table.push(row); row = []; }
    } else field += char;
    if (field.length > 12000 || table.length > 501) throw Error("Playlist is too large: use at most 500 tracks.");
  }
  if (quoted) throw Error("Unclosed quote in playlist file.");
  row.push(field.replace(/\r$/, "")); if (row.some(value => value.trim())) table.push(row);
  const headers = table.shift()?.map(normalized) || [];
  const index = (...names: string[]) => headers.findIndex(header => names.includes(header));
  const title = index("track name", "song name", "title", "name"), artist = index("artist name s", "artist name", "artists", "artist"), album = index("album name", "album");
  const duration = index("duration ms", "duration", "total time");
  if (title < 0 || !table.length || table.length > 500) throw Error("Use a CSV/TSV export with Title or Track Name and up to 500 tracks.");
  return table.map(cells => {
    const milliseconds = duration >= 0 && ["duration ms", "total time"].includes(headers[duration]);
    return { title: (cells[title] || "").trim().slice(0, 4000), artist: (cells[artist] || "").trim().slice(0, 4000), album: (cells[album] || "").trim().slice(0, 4000), duration: Math.max(0, Number(cells[duration]) || 0) / (milliseconds ? 1000 : 1) };
  }).filter(row => row.title);
}

export function certainMatch(row: ImportRow, candidates: CatalogTrack[]): CatalogTrack | null {
  const matches = candidates.filter(track => normalized(track.title) === normalized(row.title) && row.artist &&
    row.artist.split(/;|,| & /).some(credit => normalized(credit).length > 1 && ` ${normalized(track.artist)} `.includes(` ${normalized(credit)} `)) &&
    (!row.duration || Math.abs(track.duration - row.duration) < 15));
  return matches.length === 1 ? matches[0] : null;
}
