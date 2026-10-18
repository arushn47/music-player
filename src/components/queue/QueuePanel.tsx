import React from "react";
import { ArrowDown, ArrowUp, ListMusic, PanelRightClose, X } from "lucide-react";
import { Artwork, IconButton } from "../common";
import type { Session, Track } from "../../domain/types";

export interface QueuePanelProps {
  session: Session;
  listeningTracks: Track[];
  undo: Session["queue"] | null;
  onClose: () => void;
  onSelectQueue: (entryId: string, play: boolean) => void;
  onReorderUpcoming: (entryId: string, delta: 1 | -1) => void;
  onRemoveQueue: (entryId: string) => void;
  onUndoRemoval: () => void;
  onClearQueue: () => void;
}

export function QueuePanel({
  session,
  listeningTracks,
  undo,
  onClose,
  onSelectQueue,
  onReorderUpcoming,
  onRemoveQueue,
  onUndoRemoval,
  onClearQueue,
}: QueuePanelProps) {
  const currentIndex = session.queue.findIndex(
    (entry) => entry.id === session.currentId,
  );
  const upNextCount = session.queue.slice(currentIndex + 1).length;

  return (
    <aside className="queue-pane">
      <header>
        <h2>
          Up next <span>{upNextCount}</span>
        </h2>
        <IconButton label="Hide queue" onClick={onClose}>
          <PanelRightClose size={18} />
        </IconButton>
      </header>
      <div className="queue-caption">YOUR LISTENING SESSION</div>
      <div className="queue-items">
        {session.queue.length ? (
          session.queue.map((entry, index) => {
            if (index < currentIndex) return null;
            const t = listeningTracks.find((track) => track.id === entry.trackId);
            if (!t) return null;

            return (
              <div
                key={entry.id}
                className={`queue-entry ${entry.id === session.currentId ? "current" : ""}`}
              >
                <button
                  className="queue-select"
                  aria-label={`Play queued ${t.title}`}
                  onClick={() => onSelectQueue(entry.id, true)}
                >
                  <Artwork
                    url={t.artworkUrl}
                    className={`color-${index % 5}`}
                  />
                  <span>
                    <strong dir="auto">{t.title}</strong>
                    <small>
                      {entry.id === session.currentId
                        ? "Now playing"
                        : t.artist}
                    </small>
                  </span>
                </button>
                <div className="queue-controls">
                  <IconButton
                    label={`Move ${t.title} up`}
                    disabled={
                      entry.id === session.currentId ||
                      index <= currentIndex + 1
                    }
                    onClick={() => onReorderUpcoming(entry.id, -1)}
                  >
                    <ArrowUp size={13} />
                  </IconButton>
                  <IconButton
                    label={`Move ${t.title} down`}
                    disabled={
                      entry.id === session.currentId ||
                      index === session.queue.length - 1
                    }
                    onClick={() => onReorderUpcoming(entry.id, 1)}
                  >
                    <ArrowDown size={13} />
                  </IconButton>
                  <IconButton
                    label={`Remove queued ${t.title}`}
                    onClick={() => onRemoveQueue(entry.id)}
                  >
                    <X size={14} />
                  </IconButton>
                </div>
              </div>
            );
          })
        ) : (
          <div className="queue-empty">
            <ListMusic size={28} />
            <p>
              A good listening session
              <br />
              starts with one song.
            </p>
          </div>
        )}
      </div>
      <footer>
        {undo && (
          <button className="subtle" onClick={onUndoRemoval}>
            Undo removal
          </button>
        )}
        <button
          className="subtle"
          disabled={!upNextCount}
          onClick={onClearQueue}
        >
          Clear queue
        </button>
        <p>One song. Then another.</p>
      </footer>
    </aside>
  );
}
