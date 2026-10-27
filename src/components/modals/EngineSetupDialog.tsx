import { useEffect, useRef } from "react";
import { EngineSetupCard, type EngineSetupProps } from "../common/EngineSetupCard";

export function EngineSetupDialog(props: EngineSetupProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="update-dialog engine-setup-dialog" aria-labelledby="engine-setup-title" onCancel={event => event.preventDefault()}>
    <header><h2 id="engine-setup-title">Set up online playback</h2></header>
    <EngineSetupCard {...props} required />
  </dialog>;
}
