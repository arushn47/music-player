import { describe, expect, it } from 'vitest';
import { checkpointListening, homeHistory } from './home-listening';
import { defaults, type Track } from './types';
import { restoreSession } from './session';
import type { ListeningRecord } from './listening';

const now = new Date('2026-10-24T12:00:00Z').getTime();
const day = 86400000;
const track = (id: string, album = id): Track => ({ id, title: id, artist: id, album, duration: 200, fileName: `${id}.mp3`, missing: false, format: 'MP3' });
const a = track('a', 'Album'), b = track('b', 'Album');
function session() { return { ...defaults(), queue: [{ id: 'qa', trackId: 'a' }, { id: 'qb', trackId: 'b' }], currentId: 'qa' }; }
function record(t: Track, days: number, id = t.id): ListeningRecord { return { id, trackId: t.id, title: t.title, artist: t.artist, album: t.album, artworkUrl: null, providerId: null, sourceId: null, startedAt: now - days * day, updatedAt: now - days * day, listenedMs: 100000, days: {} }; }

describe('Home listening state', () => {
  it('saves real position, queue and shuffle across session restoration', () => {
    const s = session();
    s.settings.shuffle = true;
    s.shuffleOrder = ['qb', 'qa'];
    const saved = checkpointListening(s, [a, b], 47, false, now);
    const restored = restoreSession(JSON.parse(JSON.stringify(saved)), [a, b]);
    expect(restored.listeningResumes).toEqual(saved.listeningResumes);
    expect(restored.listeningResumes?.[0]).toMatchObject({ kind: 'album', title: 'Album', position: 47, currentId: 'qa', shuffleOrder: ['qb', 'qa'], shuffle: true });
  });
  it('identifies playlists, keeps separate queues and replaces existing checkpoints', () => {
    const s = { ...session(), playlists: [{ id: 'p', name: 'My playlist', items: session().queue }] };
    const saved = checkpointListening(s, [a, b], 30, false, now);
    expect(saved.listeningResumes?.[0]).toMatchObject({ id: 'playlist:p', kind: 'playlist', title: 'My playlist' });
    expect(checkpointListening(saved, [a, b], 50).listeningResumes).toHaveLength(1);
    expect(checkpointListening(session(), [a, track('b')], 30).listeningResumes?.[0].kind).toBe('queue');
  });
  it('does not invent progress, retain completed collections or restore missing files', () => {
    expect(checkpointListening(session(), [a, b], 0).listeningResumes).toBeUndefined();
    const saved = checkpointListening(session(), [a, b], 40);
    expect(checkpointListening({ ...saved, currentId: 'qb' }, [a, b], 200, true).listeningResumes).toEqual([]);
    expect(restoreSession(saved, []).listeningResumes).toEqual([]);
    expect(checkpointListening(session(), [{ ...a, missing: true }, b], 40)).toEqual(session());
  });
  it('keeps activity chronological even when recent songs also belong to rotation or favorites', () => {
    const recent = track('recent'), frequent = track('frequent'), loved = track('loved'), ignored = track('ignored');
    const rows = [record(recent, 1), ...[1, 2, 3].map((d, i) => record(frequent, d, `f${i}`)), record(loved, 60), { ...record(ignored, 1), listenedMs: 3000 }];
    const shelves = homeHistory(rows, [recent, frequent, loved, ignored], ['loved'], false, now);
    expect(shelves.recent.map(t => t.id)).toEqual(['recent', 'frequent', 'loved']);
    expect(shelves.rotation.map(t => t.id)).toEqual(['frequent']);
    expect(shelves.forgotten.map(t => t.id)).toEqual(['loved']);
    expect(homeHistory([], [a, b], ['a'], true, now)).toEqual({ recent: [], rotation: [], forgotten: [] });
  });
  it('matches Tracker start-time ordering, deduplicates repeat plays and includes new qualified activity', () => {
    const older = track('older'), latest = track('latest');
    const oldRecord = { ...record(older, 2), updatedAt: now };
    const latestRecord = record(latest, 1);
    const records = [oldRecord, latestRecord, record(latest, 3, 'repeat')];
    expect(homeHistory(records, [older, latest], [], false, now).recent.map(t => t.id)).toEqual(['latest', 'older']);
    const justPlayed = { ...record(older, 0, 'new-play'), listenedMs: 10000 };
    expect(homeHistory([...records, justPlayed], [older, latest], [], false, now).recent.map(t => t.id)).toEqual(['older', 'latest']);
  });
  it('omits removed local files and unavailable online history', () => {
    expect(homeHistory([record(a, 1)], [], [], true, now).recent).toEqual([]);
    const remote = { ...record(a, 1), providerId: 'youtube', sourceId: 'abcdefghijk' };
    expect(homeHistory([remote], [], [], false, now).recent).toEqual([]);
    expect(homeHistory([remote], [], [], true, now).recent).toHaveLength(1);
  });
  it('finds genuinely neglected favorites in a young library without inventing listens', () => {
    const old = track('old'), repeat = track('repeat'), fresh = track('fresh');
    const rows = [record(old, 5), ...[5, 4, 3.5].map((age, i) => record(repeat, age, `repeat${i}`)), ...[2, 1, .5].map((age, i) => record(fresh, age, `fresh${i}`))];
    const result = homeHistory(rows, [old, repeat, fresh], [old.id], false, now);
    expect(result.forgotten.map(t => t.id)).toEqual(['repeat', 'old']);
    expect(result.rotation.map(t => t.id)).toEqual(['fresh']);
    expect(homeHistory([record(old, 1)], [old], [old.id], false, now).forgotten).toEqual([]);
  });
});
