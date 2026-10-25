import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { discoveryPreferences, setDiscoveryLanguages } from "../../adapters/discovery-home";
import { MusicLanguagePicker } from "../common/MusicLanguagePicker";

export function MusicLanguageOnboarding() {
  const [open, setOpen] = useState(() => !discoveryPreferences().onboarded);
  const [languages, setLanguages] = useState(() => discoveryPreferences().languages);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current!;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, [open]);
  const finish = (skip: boolean) => {
    setDiscoveryLanguages(skip ? discoveryPreferences().languages : languages);
    ref.current?.close();
    setOpen(false);
  };
  if (!open) return null;
  const content = <dialog ref={ref} className="music-language-onboarding" aria-labelledby="music-languages-title" aria-describedby="music-languages-description" onCancel={event => { event.preventDefault(); finish(true); }}>
    <p className="eyebrow">WELCOME TO LUMAIRE</p>
    <h2 id="music-languages-title">Which languages do you listen to?</h2>
    <p id="music-languages-description">Choose a few to shape your Home recommendations. You can change them anytime in Settings → Music preferences.</p>
    <MusicLanguagePicker value={languages} onChange={setLanguages} />
    <div className="dialog-actions"><button type="button" className="subtle" onClick={() => finish(true)}>Skip</button><button type="button" className="primary" onClick={() => finish(false)}>Continue</button></div>
  </dialog>;
  return typeof document === "undefined" ? content : createPortal(content, document.body);
}
