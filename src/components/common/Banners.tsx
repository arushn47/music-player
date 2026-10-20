import React from "react";
import { Check, X } from "lucide-react";
import { IconButton } from "./IconButton";

export interface BannersProps {
  error?: string | null;
  playbackError?: string | null;
  message?: string | null;
  hasTrack?: boolean;
  onRetryPlayback?: () => void;
  onDismissError: () => void;
  onDismissMessage: () => void;
}

export function Banners({
  error,
  playbackError,
  message,
  hasTrack,
  onRetryPlayback,
  onDismissError,
  onDismissMessage,
}: BannersProps) {
  const activeError = error || playbackError;

  return (
    <>
      {activeError && (
        <div className="banner error" role="alert">
          <span>{activeError}</span>
          <button
            onClick={() => {
              onDismissError();
              if (playbackError && hasTrack && onRetryPlayback) {
                onRetryPlayback();
              }
            }}
          >
            Retry
          </button>
          <IconButton label="Dismiss error" onClick={onDismissError}>
            <X size={16} />
          </IconButton>
        </div>
      )}
      {message && (
        <aside className="apple-toast" role="status" aria-live="polite">
          <span className="apple-toast-icon" aria-hidden="true">
            <Check size={12} strokeWidth={2.5} />
          </span>
          <span className="apple-toast-text">{message}</span>
          <button
            type="button"
            className="apple-toast-close"
            aria-label="Dismiss notification"
            onClick={onDismissMessage}
          >
            <X size={12} strokeWidth={2} />
          </button>
        </aside>
      )}
    </>
  );
}
