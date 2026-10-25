import { useState } from "react";
import { DISCOVERY_LANGUAGES, discoveryPreferences, setDiscoveryLanguages, type DiscoveryLanguage } from "../../adapters/discovery-home";

export function MusicLanguagePicker({ value, onChange }: { value: DiscoveryLanguage[]; onChange: (value: DiscoveryLanguage[]) => void }) {
  return <fieldset className="music-language-picker">
    <legend>Languages you listen to</legend>
    <div className="music-language-options">{DISCOVERY_LANGUAGES.map(language => <label key={language}>
      <input type="checkbox" checked={value.includes(language)} onChange={event => onChange(event.target.checked ? [...value, language] : value.filter(item => item !== language))} />
      <span>{language.charAt(0).toUpperCase() + language.slice(1)}</span>
    </label>)}</div>
  </fieldset>;
}

export function MusicPreferences() {
  const [languages, setLanguages] = useState(() => discoveryPreferences().languages);
  return <>
    <p className="category-subtitle">Pick as many as you like. These guide your Home recommendations while leaving room to discover other music. No selection is required.</p>
    <MusicLanguagePicker value={languages} onChange={value => { setLanguages(value); setDiscoveryLanguages(value); }} />
    <p>Saved automatically on this device.</p>
  </>;
}
