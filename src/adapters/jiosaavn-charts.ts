import { library, type ChartDetails } from './native';

const cache = new Map<string, { at: number; value: ChartDetails }>();
const pending = new Map<string, Promise<ChartDetails>>();

export function loadJioChart(id: string, refresh = false): Promise<ChartDetails> {
  if (!/^saavn:chart:[1-9]\d{0,19}$/.test(id)) return Promise.reject(new Error('Invalid JioSaavn chart ID.'));
  const saved = cache.get(id);
  if (!refresh && saved && Date.now() - saved.at < 10 * 60000) return Promise.resolve(saved.value);
  const existing = pending.get(id);
  if (existing) return existing;
  const request = library.lookupChart(id).then(value => {
    if (value.info.id !== id || !value.tracks.length) throw new Error('This chart has no available tracks.');
    if (cache.size >= 16) cache.delete(cache.keys().next().value!);
    cache.set(id, { at: Date.now(), value });
    return value;
  }).catch(error => {
    if (saved && Date.now() - saved.at < 86400000) return { ...saved.value, warning: "JioSaavn couldn't refresh this chart. Showing the last saved tracklist." };
    throw error;
  }).finally(() => pending.delete(id));
  pending.set(id, request);
  return request;
}
