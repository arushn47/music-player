import { useState } from "react";
import { ArrowLeft, Check, ListMusic, Plus, X } from "lucide-react";
import type { Track, Session } from "../../domain/types";

export interface SaveToPlaylistModalProps {
  playlistTarget: Track;
  tracks: Track[];
  session: Session;
  busy: boolean;
  onClose: () => void;
  onSave: (target: Track, playlistId: string, newName?: string) => Promise<void> | void;
  onRemove: (playlistId: string, trackId: string, playlistName: string) => void;
}

export function SaveToPlaylistModal({
  playlistTarget,
  tracks,
  session,
  busy,
  onClose,
  onSave,
  onRemove,
}: SaveToPlaylistModalProps) {
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  if (creatingPlaylist) {
    return (
      <form
        className="save-playlist-new-form"
        onSubmit={(event) => {
          event.preventDefault();
          const name = newPlaylistName.trim();
          if (name) {
            void onSave(playlistTarget, crypto.randomUUID(), name);
            setCreatingPlaylist(false);
          }
        }}
      >
        <div className="save-playlist-header">
          <div className="save-playlist-header-left">
            <button
              type="button"
              className="icon-button"
              aria-label="Back to playlists"
              onClick={() => setCreatingPlaylist(false)}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="save-playlist-title">New playlist</h2>
              <p className="save-playlist-subtitle ellipsis">
                Add &ldquo;{playlistTarget.title}&rdquo;
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button save-playlist-close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <label className="save-playlist-new-label">
          Playlist title
          <input
            autoFocus
            maxLength={100}
            placeholder="Enter playlist name"
            value={newPlaylistName}
            onChange={(event) => setNewPlaylistName(event.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <button
            className="subtle"
            type="button"
            onClick={() => setCreatingPlaylist(false)}
          >
            Back
          </button>
          <button
            className="primary"
            disabled={busy || !newPlaylistName.trim()}
          >
            Create and save
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="save-playlist-content">
      <div className="save-playlist-header">
        <div className="save-playlist-header-left">
          <h2 className="save-playlist-title">Save to playlist</h2>
          <p
            className="save-playlist-subtitle ellipsis"
            dir="auto"
            title={`${playlistTarget.title} · ${playlistTarget.artist}`}
          >
            {playlistTarget.title} · {playlistTarget.artist}
          </p>
        </div>
        <button
          type="button"
          className="icon-button save-playlist-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <div className="save-playlist-grid">
        {session.playlists.length === 0 ? (
          <div className="save-playlist-empty">
            <ListMusic size={34} />
            <p>No playlists yet</p>
            <small>Create your first playlist below to save tracks.</small>
          </div>
        ) : (
          session.playlists.map((playlist) => {
            const firstArtwork = playlist.items
              .map(
                (i) =>
                  tracks.find((t) => t.id === i.trackId)?.artworkUrl ||
                  session.queueTracks[i.trackId]?.artworkUrl,
              )
              .find(Boolean);
            const isAdded = playlist.items.some(
              (i) => i.trackId === playlistTarget.id,
            );

            return (
              <button
                key={playlist.id}
                type="button"
                className={`save-playlist-square-card ${isAdded ? "is-added" : ""}`}
                disabled={busy}
                onClick={() => {
                  if (isAdded) {
                    onRemove(playlist.id, playlistTarget.id, playlist.name);
                  } else {
                    void onSave(playlistTarget, playlist.id);
                  }
                }}
              >
                <div className="save-playlist-card-art">
                  {firstArtwork ? (
                    <img src={firstArtwork} alt="" />
                  ) : (
                    <div className="save-playlist-card-fallback">
                      <ListMusic size={26} />
                    </div>
                  )}
                  {isAdded && (
                    <span
                      className="save-playlist-card-badge"
                      title="Already in playlist"
                    >
                      <Check size={14} />
                    </span>
                  )}
                </div>
                <div className="save-playlist-card-meta">
                  <strong
                    className="save-playlist-card-title ellipsis"
                    dir="auto"
                    title={playlist.name}
                  >
                    {playlist.name}
                  </strong>
                  <span className="save-playlist-card-count">
                    {playlist.items.length}{" "}
                    {playlist.items.length === 1 ? "track" : "tracks"}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="save-playlist-footer">
        <button
          type="button"
          className="new-playlist-trigger-btn"
          onClick={() => {
            setNewPlaylistName("");
            setCreatingPlaylist(true);
          }}
        >
          <Plus size={16} />
          New playlist
        </button>
      </div>
    </div>
  );
}
