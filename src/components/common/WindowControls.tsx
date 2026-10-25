import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";

export interface WindowControlsProps {
  onError: (message: string) => void;
}

export function WindowControls({ onError }: WindowControlsProps) {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const win = getCurrentWindow();
    let disposed = false;
    const refresh = () => {
      void win
        .isMaximized()
        .then((value) => {
          if (!disposed) setMaximized(value);
        })
        .catch((error) => {
          if (!disposed)
            onError(`Could not read window state. ${String(error)}`);
        });
    };
    refresh();
    const listener = win.onResized(refresh).catch((error) => {
      if (!disposed) onError(`Could not watch window state. ${String(error)}`);
      return () => {};
    });
    return () => {
      disposed = true;
      void listener.then((unlisten) => unlisten());
    };
  }, [onError]);

  const run = (action: () => Promise<void>) => {
    void action().catch((error) =>
      onError(`Window action failed. ${String(error)}`),
    );
  };
  return (
    <div
      className="desktop-window-controls"
      role="group"
      aria-label="Window controls"
    >
      <button
        type="button"
        aria-label="Minimize window"
        title="Minimize"
        onClick={() => run(() => getCurrentWindow().minimize())}
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        aria-label={maximized ? "Restore window" : "Maximize window"}
        title={maximized ? "Restore" : "Maximize"}
        onClick={() => run(() => getCurrentWindow().toggleMaximize())}
      >
        {maximized ? <Copy size={12} /> : <Square size={12} />}
      </button>
      <button
        type="button"
        className="desktop-window-close"
        aria-label="Close window"
        title="Close"
        onClick={() => run(() => getCurrentWindow().close())}
      >
        <X size={16} />
      </button>
    </div>
  );
}
