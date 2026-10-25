import { Activity, Compass, Home, Library } from "lucide-react";

export interface MobileTabBarProps {
  view: string;
  setView: (view: string) => void;
}

export function MobileTabBar({ view, setView }: MobileTabBarProps) {
  const library = !["home", "search", "discover", "lyrics", "history", "settings"].includes(view);
  const active = view === "home" ? "home" : view === "history" ? "history" : library ? "library" : ["search", "discover"].includes(view) ? "search" : "";
  return (
    <nav className="mobile-tab-bar" aria-label="Mobile navigation">
      {[
        { view: "home", label: "Home", Icon: Home },
        { view: "search", label: "Discover", Icon: Compass },
        { view: "library", label: "Library", Icon: Library },
        { view: "history", label: "Tracker", Icon: Activity },
      ].map(({ view: destination, label, Icon }) => (
        <button key={destination} type="button" className={`mobile-tab ${active === destination ? "active" : ""}`}
          aria-label={label} aria-current={active === destination ? "page" : undefined} onClick={() => setView(destination)}>
          <Icon size={23} strokeWidth={active === destination ? 2.2 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
