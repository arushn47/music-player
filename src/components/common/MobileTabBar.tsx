import { Activity, Compass, FileText, Home, Library } from "lucide-react";
import { useRef } from 'react';

export interface MobileTabBarProps {
  view: string;
  setView: (view: string) => void;
  onDiscoverSearch?: () => void;
}

export function MobileTabBar({ view, setView, onDiscoverSearch }: MobileTabBarProps) {
  const lastTap = useRef<{ destination: string; time: number } | null>(null);
  function tap(destination: string) {
    const time = performance.now();
    const doubleTap = destination === 'search' && lastTap.current?.destination === destination && time - lastTap.current.time <= 350;
    lastTap.current = doubleTap ? null : { destination, time };
    if (doubleTap && onDiscoverSearch) onDiscoverSearch();
    else setView(destination);
  }
  const library = !["home", "search", "discover", "lyrics", "history", "settings"].includes(view);
  const active = view === "home" ? "home" : view === "lyrics" ? "lyrics" : view === "history" ? "history" : library ? "library" : ["search", "discover"].includes(view) ? "search" : "";
  return (
    <nav className="mobile-tab-bar" aria-label="Mobile navigation">
      {[
        { view: "home", label: "Home", Icon: Home },
        { view: "search", label: "Discover", Icon: Compass },
        { view: "library", label: "Library", Icon: Library },
        { view: "lyrics", label: "Lyrics", Icon: FileText },
        { view: "history", label: "Tracker", Icon: Activity },
      ].map(({ view: destination, label, Icon }) => (
        <button key={destination} type="button" className={`mobile-tab ${active === destination ? "active" : ""}`}
          aria-label={label} aria-current={active === destination ? "page" : undefined} onClick={() => tap(destination)}>
          <Icon size={23} strokeWidth={active === destination ? 2.2 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
