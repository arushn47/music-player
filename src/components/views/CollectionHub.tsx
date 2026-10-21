import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PlaylistImport } from "./PlaylistImport";
import { NearbyDevices } from "./NearbyDevices";
import type { PlaylistImportOptions } from "../../domain/playlist-import";
import type { Playlist, Track } from "../../domain/types";
import type { SharedState } from "../../domain/nearby";
import type { useNearby } from "../../hooks/useNearby";
import "./collections.css";

export function CollectionHub({
  initialTab = "import",
  onClose,
  onImport,
  playlists,
  nearby,
  onSync,
}: {
  initialTab?: "import" | "devices";
  onClose: () => void;
  playlists: Playlist[];
  onImport: (name: string, tracks: Track[], options: PlaylistImportOptions) => Promise<void>;
  nearby: ReturnType<typeof useNearby>;
  onSync: (data: SharedState) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"import" | "devices">(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog
      className="collection-hub"
      ref={dialog}
      aria-label="Playlists and devices"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="collection-hub-header">
        <div className="hub-segmented" role="tablist" aria-label="Collections navigation">
          <button
            type="button"
            role="tab"
            className={`hub-tab ${tab === "import" ? "active" : ""}`}
            aria-selected={tab === "import"}
            aria-pressed={tab === "import"}
            onClick={() => setTab("import")}
          >
            Playlist import
          </button>
          <button
            type="button"
            role="tab"
            className={`hub-tab ${tab === "devices" ? "active" : ""}`}
            aria-selected={tab === "devices"}
            aria-pressed={tab === "devices"}
            onClick={() => setTab("devices")}
          >
            Devices & listening together
          </button>
        </div>
        <button
          type="button"
          autoFocus
          className="hub-close"
          aria-label="Close playlists and devices"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </div>
      {tab === "import" ? (
        <PlaylistImport playlists={playlists} onImport={onImport} />
      ) : (
        <NearbyDevices nearby={nearby} onSync={onSync} />
      )}
    </dialog>
  );
}
