import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { UpdaterCard } from "../views/UpdaterCard";

export function UpdateDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog className="update-dialog" ref={ref} aria-labelledby="update-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2 id="update-dialog-title">Updates & release notes</h2><button autoFocus className="icon-button" aria-label="Close updates" onClick={onClose}><X size={18} /></button></header>
    <UpdaterCard />
  </dialog>;
}
