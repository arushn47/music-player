import { expect, it } from 'vitest';
import { capturePlaylistEdits, mergePlaylistReplica, replicaTracks, restoreReplica, type SyncState } from './device-sync';
import { defaults, type Session } from './types';
import { catalogQueueTrack } from './catalog-track';
import { restoreSession } from './session';
import { withoutTrack } from './collections';

const tracks = [1, 2, 3].map(n => catalogQueueTrack({ id: `itunes:${n}`, title: `Song ${n}`, artist: 'Artist', album: '', duration: 100, artists: [] }));
const state = (id: string, s?: Session): SyncState => ({ deviceId: id, clock: s?.replica?.clock || 0, revision: 0, cells: Object.values(s?.replica?.cells || {}), historyEnabled: false });
const merge = (a: Session, b: Session, id: string) => mergePlaylistReplica(a, state(id, b), tracks);
const edit = (s: Session, playlists: Session['playlists']) => capturePlaylistEdits(s, { ...s, playlists }, tracks);
function pair() {
  const a = mergePlaylistReplica({ ...defaults(), playlists: [{ id: 'mix', name: 'Mix', items: [{ id: 'one', trackId: tracks[0].id }] }] }, state('A'), tracks);
  const b = merge(mergePlaylistReplica(defaults(), state('B'), tracks), a, 'B');
  return { a, b };
}
it('merges concurrent additions in either direction without conflict copies or duplicate retries', () => {
  let { a, b } = pair();
  a = edit(a, [{ ...a.playlists[0], items: [...a.playlists[0].items, { id: 'two', trackId: tracks[1].id }] }]);
  b = edit(b, [{ ...b.playlists[0], items: [...b.playlists[0].items, { id: 'three', trackId: tracks[2].id }] }]);
  const ab = merge(a, b, 'A'), ba = merge(b, a, 'B');
  expect(ab.playlists).toEqual(ba.playlists);
  expect(ab.playlists[0].items).toHaveLength(3);
  expect(merge(ab, b, 'A').playlists).toEqual(ab.playlists);
});
it('keeps intentional removals despite stale replicas and concurrent order/metadata edits', () => {
  const { a, b } = pair();
  const removed = edit(a, [{ ...a.playlists[0], items: [] }]);
  const renamed = edit(b, [{ ...b.playlists[0], name: 'Renamed' }]);
  const result = merge(removed, renamed, 'A');
  expect(result.playlists[0].name).toBe('Renamed');
  expect(result.playlists[0].items).toEqual([]);
  expect(merge(result, b, 'A').playlists[0].items).toEqual([]);
  const readded = edit(result, [{ ...result.playlists[0], items: [{ id: 'intentional-new-entry', trackId: tracks[0].id }] }]);
  expect(merge(readded, b, 'A').playlists[0].items).toHaveLength(1);
});
it('resolves simultaneous renames deterministically and never resurrects a deleted playlist', () => {
  const { a, b } = pair();
  const x = edit(a, [{ ...a.playlists[0], name: 'Alpha' }]), y = edit(b, [{ ...b.playlists[0], name: 'Beta' }]);
  expect(merge(x,y,'A').playlists).toEqual(merge(y,x,'B').playlists);
  const removed = edit(x, []);
  expect(merge(removed,y,'A').playlists).toEqual([]);
  expect(merge(y,removed,'B').playlists).toEqual([]);
  const reopened = restoreSession(JSON.parse(JSON.stringify(removed)), tracks);
  expect(merge(reopened,a,'A').playlists).toEqual([]);
});
it('migrates old imports by original identity without merging distinct repeat entries or settings', () => {
  const original = { ...defaults(), playlists: [{ id: 'origin', name: 'Mix', items: [{ id: 'x', trackId: tracks[0].id }, { id: 'y', trackId: tracks[0].id }] }] };
  const imported = { ...defaults(), playlists: [{ ...original.playlists[0], id: 'copy', syncSource: 'origin', items: original.playlists[0].items.map((e,i)=>({ ...e,id:`old-${i}` })) }] };
  const a = mergePlaylistReplica(original,state('A'),tracks), b = mergePlaylistReplica(imported,state('B'),tracks);
  const result = merge(a,b,'A');
  expect(result.playlists).toHaveLength(1); expect(result.playlists[0].items).toHaveLength(2);
  expect(result.settings).toBe(a.settings); expect(result.queue).toBe(a.queue); expect(result.favorites).toEqual(a.favorites);
});

const artist = { id: 'saavn:artist:12', name: 'Artist' };
const album = { id: 'saavn:album:34', title: 'Album', artist: 'Artist' };
const initialize = (s: Session, id: string) => mergePlaylistReplica(s, state(id), tracks);
const favorite = (s: Session, values: Partial<Session>) => capturePlaylistEdits(s, { ...s, ...values }, tracks);

it('unions existing favorites on first pairing, including an upgraded playlist replica', () => {
  const a = initialize({ ...defaults(), favorites: [tracks[0].id], favoriteArtists: [artist] }, 'A');
  const b = initialize({ ...defaults(), replica: { deviceId: 'B', clock: 5, cells: {} }, favorites: [tracks[1].id], favoriteAlbums: [album] }, 'B');
  for (const result of [merge(a, b, 'A'), merge(b, a, 'B')]) {
    expect(result.favorites).toEqual([tracks[0].id, tracks[1].id].sort());
    expect(result.favoriteArtists).toEqual([artist]);
    expect(result.favoriteAlbums).toEqual([album]);
  }
  expect(merge(a, initialize(defaults(), 'C'), 'A').favorites).toEqual(a.favorites);
});

it('persists offline unlikes for all types and permits intentional re-likes without stale resurrection', () => {
  let a = initialize({ ...defaults(), favorites: [tracks[0].id], favoriteArtists: [artist], favoriteAlbums: [album] }, 'A');
  const b = merge(initialize(defaults(), 'B'), a, 'B');
  a = favorite(a, { favorites: [], favoriteArtists: [], favoriteAlbums: [] });
  a = restoreSession(JSON.parse(JSON.stringify(a)), tracks);
  for (const result of [merge(a,b,'A'), merge(b,a,'B')]) {
    expect(result.favorites).toEqual([]); expect(result.favoriteArtists).toEqual([]); expect(result.favoriteAlbums).toEqual([]);
  }
  a = favorite(a, { favorites: [tracks[0].id], favoriteArtists: [artist], favoriteAlbums: [album] });
  expect(merge(a,b,'A').favorites).toEqual([tracks[0].id]);
  expect(merge(b,a,'B').favoriteArtists).toEqual([artist]);
  expect(merge(b,a,'B').favoriteAlbums).toEqual([album]);
});

it('resolves concurrent like/unlike versions deterministically and retries idempotently', () => {
  const initial = initialize({ ...defaults(), favorites: [tracks[0].id], favoriteArtists: [artist], favoriteAlbums: [album] }, 'A');
  let a = merge(initialize(defaults(), 'A'), initial, 'A');
  let b = merge(initialize(defaults(), 'B'), initial, 'B');
  a = favorite(a, { favoriteArtists: [artist, { id: 'saavn:artist:99', name: 'Other' }] });
  b = favorite(b, { favorites: [], favoriteArtists: [], favoriteAlbums: [] });
  b = favorite(b, { favorites: [tracks[0].id], favoriteArtists: [artist], favoriteAlbums: [album] });
  a = favorite(a, { favorites: [], favoriteArtists: [], favoriteAlbums: [] });
  const ab = merge(a,b,'A'), ba = merge(b,a,'B');
  expect(ab.favorites).toEqual(ba.favorites); expect(ab.favoriteArtists).toEqual(ba.favoriteArtists); expect(ab.favoriteAlbums).toEqual(ba.favoriteAlbums);
  expect(ab.favorites).toEqual([tracks[0].id]); expect(ab.favoriteArtists).toEqual([artist]); expect(ab.favoriteAlbums).toEqual([album]);
  expect(merge(ab,b,'A').favorites).toEqual(ab.favorites);
});

it('preserves local-only likes and maps portable track aliases without leaking paths', () => {
  const local = { ...tracks[0], id: 'local-only', metadataSourceId: undefined, source: undefined, format: 'mp3', fileName: 'C:/private/song.mp3' };
  const downloaded = { ...tracks[0], id: 'downloaded', metadataSourceId: 'itunes:1', fileName: 'C:/private/download.m4a', offline: true };
  const a = mergePlaylistReplica({ ...defaults(), favorites: [local.id, downloaded.id] }, state('A'), [local, downloaded]);
  const cells = Object.values(a.replica!.cells);
  expect(JSON.stringify(cells)).not.toContain('C:/private');
  expect(replicaTracks(cells).map(t=>t.id)).toEqual([tracks[0].id]);
  const removed = capturePlaylistEdits(a, { ...a, favorites: [local.id] }, [local, downloaded]);
  expect(mergePlaylistReplica(a, state('A',removed), [local,downloaded]).favorites).toEqual([local.id]);
});

it('keeps edits while disabled, replays on enable, and never reseeds tombstoned likes', () => {
  const a = initialize({ ...defaults(), favorites: [tracks[0].id] }, 'A');
  const b = favorite(merge(initialize(defaults(),'B'),a,'B'), { favorites: [] });
  const disabled = mergePlaylistReplica(a, { ...state('A',b), favoritesEnabled: false }, tracks);
  expect(disabled.favorites).toEqual(a.favorites);
  const enabled = mergePlaylistReplica(disabled, { ...state('A'), favoritesEnabled: true }, tracks);
  expect(enabled.favorites).toEqual([]);
  const upgraded = { ...a, replica: { ...b.replica!, favoritesInitialized: undefined } };
  expect(mergePlaylistReplica(upgraded,state('A'),tracks).favorites).toEqual([]);
});

it('rejects malformed favorite replicas and imports only live liked-track metadata', () => {
  const a = initialize({ ...defaults(), favorites: [tracks[0].id] }, 'A');
  const cells = Object.values(a.replica!.cells);
  const bad = { ...a.replica!, cells: { [cells[0].key]: { ...cells[0], value: true } } };
  expect(restoreReplica(bad)).toBeUndefined();
  const removed = favorite(a,{ favorites: [] });
  expect(replicaTracks([...cells,...Object.values(removed.replica!.cells)])).toEqual([]);
});
it('retains offline edits over reload and rejects malformed replica state', () => {
  const { a } = pair();
  const offline = edit(a,[{ ...a.playlists[0],name:'Offline name' }]);
  expect(restoreSession(JSON.parse(JSON.stringify(offline)),tracks).replica).toEqual(offline.replica);
  expect(restoreReplica({ deviceId:'A',clock:1,cells:{ bad:{key:'invalid',clock:1,device:'A',value:true} } })).toBeUndefined();
});
it('captures library removal and never imports retired metadata back into the library', () => {
  const { a, b } = pair();
  const removed = capturePlaylistEdits(a, withoutTrack(a, tracks[0].id), tracks);
  const result = merge(removed, b, 'A');
  expect(result.playlists[0].items).toEqual([]);
  expect(replicaTracks(Object.values(result.replica!.cells))).toEqual([]);
  expect(replicaTracks(Object.values(edit(a, []).replica!.cells))).toEqual([]);
});
