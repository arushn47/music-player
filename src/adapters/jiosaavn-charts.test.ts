import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadJioChart } from './jiosaavn-charts';
import { library, type ChartDetails } from './native';
vi.mock('./native', () => ({ library: { lookupChart: vi.fn() } }));
const details = (id: string): ChartDetails => ({ info: { id, title: 'Tamil: Top 50', subtitle: 'JioSaavn' }, partial: false,
  tracks: [{ id: 'saavn:abcdefgh', title: 'Song', artist: 'Singer', artists: [], album: 'Album', duration: 180 }] });
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());
it('coalesces chart details and serves navigation from cache without repeating tracklist requests', async () => {
  vi.mocked(library.lookupChart).mockResolvedValue(details('saavn:chart:91'));
  const [first, second] = await Promise.all([loadJioChart('saavn:chart:91'), loadJioChart('saavn:chart:91')]);
  expect(first).toEqual(second); await loadJioChart('saavn:chart:91'); expect(library.lookupChart).toHaveBeenCalledTimes(1);
});
it('refreshes expired details and falls back to labeled saved data for at most a day', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-24T10:00:00Z'));
  vi.mocked(library.lookupChart).mockResolvedValueOnce(details('saavn:chart:92')).mockRejectedValue(Error('Provider offline'));
  await loadJioChart('saavn:chart:92');
  await vi.advanceTimersByTimeAsync(11 * 60000);
  expect((await loadJioChart('saavn:chart:92')).warning).toContain('last saved tracklist');
  await vi.advanceTimersByTimeAsync(86400000);
  await expect(loadJioChart('saavn:chart:92')).rejects.toThrow('Provider offline');
});
it('supports manual refresh and retries failed requests instead of caching rejected promises', async () => {
  vi.mocked(library.lookupChart).mockRejectedValueOnce(Error('Timeout')).mockResolvedValue(details('saavn:chart:93'));
  await expect(loadJioChart('saavn:chart:93')).rejects.toThrow('Timeout');
  await loadJioChart('saavn:chart:93'); await loadJioChart('saavn:chart:93', true);
  expect(library.lookupChart).toHaveBeenCalledTimes(3);
});
it('rejects invalid IDs, wrong returned charts and empty tracklists', async () => {
  await expect(loadJioChart('https://evil.test')).rejects.toThrow('Invalid'); expect(library.lookupChart).not.toHaveBeenCalled();
  vi.mocked(library.lookupChart).mockResolvedValueOnce(details('saavn:chart:999')).mockResolvedValueOnce({ ...details('saavn:chart:94'), tracks: [] });
  await expect(loadJioChart('saavn:chart:94')).rejects.toThrow('no available tracks');
  await expect(loadJioChart('saavn:chart:94')).rejects.toThrow('no available tracks');
});
