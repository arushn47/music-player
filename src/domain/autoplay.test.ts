import { expect, it, vi } from 'vitest';
import { autoplayCandidates, resolveAutoplayCandidate } from './autoplay';
import { defaults, type Track } from './types';
import { restoreSession } from './session';
import type { CatalogTrack } from '../adapters/native';
it('autoplay excludes queued aliases and allows other artists from the song radio', () => {
  const seed = { id: 'youtube:one', metadataSourceId: 'itunes:1', title: 'One!', artist: 'Singer, Guest' } as Track;
  const candidate = (id: string, title: string, artist = 'Singer') => ({ id, title, artist } as CatalogTrack);
  expect(autoplayCandidates([candidate('itunes:1', 'ONE'), candidate('saavn:two', 'Two'), candidate('itunes:2', 'Two!'), candidate('itunes:3', 'Three', 'Unrelated'), candidate('itunes:4', 'Four', 'Guest')], seed, [seed]).map(track => track.title)).toEqual(['Two', 'Three', 'Four']);
});
it('autoplay is opt-in and persists as a validated boolean', () => {
  expect(defaults().settings.autoplay).toBe(false);
  expect(restoreSession({ ...defaults(), settings: { ...defaults().settings, autoplay: true } }, []).settings.autoplay).toBe(true);
});
it('preserves Indic vowel marks when excluding already played titles', () => {
  const seed = { title: 'क', artist: 'Singer' } as Track;
  expect(autoplayCandidates([{ id: 'itunes:2', title: 'कि', artist: 'Singer' } as CatalogTrack], seed, [seed])).toHaveLength(1);
});

const choices = Array.from({ length: 8 }, (_, index) => ({ id: `itunes:${index + 1}`, title: `Song ${index}`, artist: 'Singer' } as CatalogTrack));
it('verifies candidates and skips failures and unresolved placeholders before selecting', async () => {
  const playable = { id: 'youtube:verified', format: 'webm', missing: false } as Track;
  const resolve = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockImplementationOnce(async track => track).mockResolvedValueOnce(playable);
  expect(await resolveAutoplayCandidate(choices, resolve, () => true)).toBe(playable);
  expect(resolve).toHaveBeenCalledTimes(4);
});
it('bounds unavailable source attempts and returns no recommendation', async () => {
  const resolve = vi.fn().mockRejectedValue(new Error('Unavailable'));
  expect(await resolveAutoplayCandidate(choices, resolve, () => true)).toBeNull();
  expect(resolve).toHaveBeenCalledTimes(5);
});
it('does not queue a resolved candidate after autoplay is cancelled', async () => {
  let active = true;
  const resolve = vi.fn(async () => { active = false; return { id: 'youtube:verified', format: 'webm' } as Track; });
  expect(await resolveAutoplayCandidate(choices, resolve, () => active)).toBeNull();
  expect(resolve).toHaveBeenCalledTimes(1);
});
it('excludes the same recording with a From album suffix', () => {
  const seed = { title: 'Nenjukkul Peidhidum', artist: 'Singer' } as Track;
  expect(autoplayCandidates([{ ...choices[0], title: 'Nenjukkul Peidhidum (From "Vaaranam Aayiram")' }], seed, [seed])).toEqual([]);
});

it('does not follow Maand with acoustic, reprise, slowed, remix or live editions', () => {
  const seed = { id: 'youtube:original', title: 'Maand', artist: 'Bayaan' } as Track;
  const titles = ['Maand (Acoustic)', 'Maand (Reprise)', 'Maand - Slowed + Reverb', 'Maand (Live at Studio)', 'Maand (Remix)', 'A different song'];
  expect(autoplayCandidates(titles.map((title, index) => ({ ...choices[0], id: `itunes:${index + 10}`, title, artist: 'Other singer' })), seed, [seed]).map(track => track.title)).toEqual(['A different song']);
});

it('starts a playable alternative without waiting for a slow first source', async () => {
  let finishSlow!: (track: Track) => void;
  const slow = new Promise<Track>(resolve => { finishSlow = resolve; });
  const playable = { id: 'youtube:fast', format: 'webm', missing: false } as Track;
  const resolve = vi.fn().mockReturnValueOnce(slow).mockResolvedValueOnce(playable);
  expect(await resolveAutoplayCandidate(choices, resolve, () => true)).toBe(playable);
  expect(resolve).toHaveBeenCalledTimes(2);
  finishSlow(playable);
});
