import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { library, type CatalogTrack, type CatalogArtist, type CatalogAlbum } from "../../adapters/native";
import { Artwork } from "./Artwork";

export interface TopBarSearchProps {
  query: string;
  onChange?: (query: string) => void;
  onFocus?: () => void;
  onSubmit?: () => void;
  onSelectArtist?: (id: string) => void;
  onSelectAlbum?: (id: string) => void;
  onSelectTrack?: (track: CatalogTrack) => void;
}

export function TopBarSearch({ query, onChange, onFocus, onSubmit, onSelectArtist, onSelectAlbum, onSelectTrack }: TopBarSearchProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [matches, setMatches] = useState<{ query: string; tracks: CatalogTrack[]; artists: CatalogArtist[]; albums: CatalogAlbum[]; error: string; warning: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const trimmed = query.trim();
  const expanded = open && Boolean(trimmed);
  const current = matches?.query === trimmed ? matches : null;

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void Promise.allSettled([library.searchCatalog(trimmed, 5), library.searchCatalogEntities(trimmed)]).then(([songs, entities]) => {
        if (cancelled) return;
        setMatches({ query: trimmed, tracks: songs.status === "fulfilled" ? songs.value.slice(0, 5) : [],
          artists: entities.status === "fulfilled" ? entities.value.artists.slice(0, 3) : [],
          albums: entities.status === "fulfilled" ? entities.value.albums.slice(0, 3) : [],
          error: songs.status === "rejected" && entities.status === "rejected" ? "Suggestions unavailable. Press Enter to try a full search." : "",
          warning: songs.status === "rejected" || entities.status === "rejected" || (entities.status === "fulfilled" && entities.value.warning) ? "Some suggestions could not be loaded." : "" });
      });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [trimmed, expanded]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setOpen(false); setActive(-1); input.current?.blur(); } };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [open]);

  const options = [
    { key: "search", title: `Search for “${trimmed}”`, subtitle: "View all results", select: () => onSubmit?.() },
    ...(current?.artists ?? []).map(artist => ({ key: `artist:${artist.id}`, title: artist.name, subtitle: "Artist", artwork: artist.artworkUrl, select: () => onSelectArtist?.(artist.id) })),
    ...(current?.tracks ?? []).map(track => ({ key: `song:${track.id}`, title: track.title, subtitle: `Song · ${track.artist}`, artwork: track.artworkUrl, select: () => onSelectTrack?.(track) })),
    ...(current?.albums ?? []).map(album => ({ key: `album:${album.id}`, title: album.title, subtitle: `Album · ${album.artist}`, artwork: album.artworkUrl, select: () => onSelectAlbum?.(album.id) })),
  ];
  const choose = (index: number) => { options[index]?.select(); setOpen(false); setActive(-1); };

  return <div className="topbar-search" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <div className="topbar-search-wrap">
      <Search size={15} className="topbar-search-icon" />
      <input ref={input} type="text" className="topbar-search-input" aria-label="Search music" placeholder="Search for songs, artists, albums…" maxLength={200}
        role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined} autoComplete="off"
        value={query} onFocus={() => { setOpen(true); onFocus?.(); }}
        onChange={event => { onChange?.(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.key === "Escape") { setOpen(false); setActive(-1); }
          else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            const next = event.key === "ArrowDown" ? (active + 1) % options.length : (active < 0 ? options.length - 1 : (active - 1 + options.length) % options.length);
            setActive(next);
            document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" });
          } else if (event.key === "Enter" && trimmed) { event.preventDefault(); choose(expanded && active >= 0 ? active : 0); }
        }} />
      {query && <button type="button" className="topbar-search-clear" aria-label="Clear search" onClick={() => { onChange?.(""); setActive(-1); input.current?.focus(); }}><X size={13} /></button>}
    </div>
    {expanded && <div className="topbar-search-dropdown">
      <div id={listId} role="listbox" aria-label="Search suggestions">
        {options.map((option, index) => <button type="button" role="option" aria-selected={active === index} id={`${listId}-${index}`} key={option.key}
          className="topbar-search-option" onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
          {"artwork" in option ? <Artwork url={option.artwork} kind={option.subtitle === "Artist" ? "artist" : undefined} /> : <Search size={18} />}
          <span><strong>{option.title}</strong><small>{option.subtitle}</small></span>
        </button>)}
      </div>
      <div role="status" className="topbar-search-status">
        {!current ? <><Loader2 size={14} className="spin" /> Searching…</> : current.error || current.warning || (options.length === 1 ? "No matches found. Try another search." : "")}
      </div>
    </div>}
  </div>;
}
