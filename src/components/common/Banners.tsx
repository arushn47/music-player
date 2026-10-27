import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CircleAlert, X } from "lucide-react";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface BannersProps {
  error?: string | null;
  playbackError?: string | null;
  playbackErrorId?: string | null;
  message?: string | null;
  messageAction?: ToastAction | null;
  hasTrack?: boolean;
  onRetryPlayback?: () => void;
  onDismissError: () => void;
  onDismissMessage: () => void;
}
interface ErrorToast { id: string; text: string; playback: boolean }

export function Banners({ error, playbackError, playbackErrorId, message, messageAction, hasTrack, onRetryPlayback, onDismissError, onDismissMessage }: BannersProps) {
  const [errors, setErrors] = useState<ErrorToast[]>([]);
  const [host, setHost] = useState<Element | null>(null);
  const playbackId = `playback:${playbackErrorId || ''}:${playbackError || ''}`;
  const remember = (item: ErrorToast) => setErrors(previous => previous.some(old => old.id === item.id) ? previous : [...previous, item]);
  useEffect(() => {
    if (error) remember({ id: `error:${error}`, text: error, playback: false });
  }, [error]);
  useEffect(() => {
    if (playbackError) remember({ id: playbackId, text: playbackError, playback: true });
  }, [playbackError, playbackId]);
  useEffect(() => {
    let active = true;
    // Wait for sibling dialogs to open/close before selecting their top-layer host.
    queueMicrotask(() => {
      if (!active) return;
      const dialogs = document.querySelectorAll('dialog[open]');
      setHost(dialogs[dialogs.length - 1] || document.body);
    });
    return () => { active = false; };
  });

  if (!errors.length && !message) return null;
  const content = <section className="notification-stack" aria-label="Notifications">
    {errors.map(item => <aside key={item.id} className="apple-toast banner error" role="alert">
      <CircleAlert className="toast-symbol" size={18} aria-hidden="true" />
      <div className="toast-content">
        <p className="toast-text">{item.text}</p>
        {item.playback && item.id === playbackId && playbackError && hasTrack && onRetryPlayback && <button type="button" className="toast-retry" onClick={onRetryPlayback}>Retry playback</button>}
      </div>
      <button type="button" className="apple-toast-close" aria-label="Dismiss error" onClick={() => {
        setErrors(previous => previous.filter(old => old.id !== item.id));
        if (!item.playback && item.text === error) onDismissError();
      }}><X size={15} /></button>
    </aside>)}
    {message && <aside className="apple-toast success" role="status" aria-live="polite">
      <Check className="toast-symbol" size={17} aria-hidden="true" />
      <span className="toast-text">{message}</span>
      {messageAction && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            messageAction.onClick();
            onDismissMessage();
          }}
        >
          {messageAction.label}
        </button>
      )}
      <button type="button" className="apple-toast-close" aria-label="Dismiss notification" onClick={onDismissMessage}><X size={15} /></button>
    </aside>}
  </section>;
  return host ? createPortal(content, host) : null;
}
