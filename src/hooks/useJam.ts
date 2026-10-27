import { useEffect, useRef, useState } from 'react';
import { collections } from '../adapters/collections';
import type { Track } from '../domain/types';
import { portableTrack, type SharedState } from '../domain/nearby';
import { player, playbackTracks } from '../player/service';
import type { Playback } from '../player/controller';
import { isQueuedCatalog, playSelection, resolveQueueEntry } from '../domain/queue';
import type { Session } from '../domain/types';

export interface JamGuest { id: string; joinedAt: number }

export function useJam(options: {
  ready: boolean;
  session: Session;
  tracks: Track[];
  track?: Track;
  playback: Playback;
  update: (fn: (s: Session) => Session) => void;
  resolve: (track: Track) => Promise<Track>;
}) {
  const latest = useRef(options); latest.current = options;

  const [hostLink, setHostLink] = useState('');
  const [guestLink, setGuestLink] = useState('');
  const [following, setFollowingState] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<SharedState | null>(null);

  const generation = useRef(0);
  const failed = useRef('');
  const lastPosition = useRef<number | null>(null);
  const ownedLoading = useRef<string | null>(null);

  // Host: start a new Jam session, returns the link guests use to join
  async function startJam() {
    setBusy(true); setError('');
    try {
      const link = await collections.startSharing();
      setHostLink(link);
      try { localStorage.setItem('lumaire-jam-host', link); } catch { /**/ }
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  // Guest: connect to a Jam link
  async function joinJam(link: string) {
    setBusy(true); setError(''); generation.current++;
    try {
      const data = await collections.fetch(link);
      setSnapshot(data); setGuestLink(link);
      try { localStorage.setItem('lumaire-jam-guest', link); } catch { /**/ }
      setFollowingState(true);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function endJam() {
    generation.current++; setFollowingState(false); setGuestLink(''); setHostLink(''); setSnapshot(null); setError('');
    try { localStorage.removeItem('lumaire-jam-host'); localStorage.removeItem('lumaire-jam-guest'); } catch { /**/ }
    try { await collections.stopSharing(true); } catch (e) { setError(String(e)); }
  }

  // Host: publish current playback state every 1.5 s
  useEffect(() => {
    if (!hostLink) return;
    let stopped = false;
    async function publish() {
      const { session, tracks, track, playback } = latest.current;
      const playlists = session.playlists.slice(0, 50).map(pl => ({
        id: pl.id, name: pl.name,
        tracks: pl.items.slice(0, Math.floor(500 / Math.max(1, session.playlists.length))).flatMap(entry => {
          const value = portableTrack(tracks.find(t => t.id === entry.trackId));
          return value ? [value] : [];
        }),
      }));
      const portable = portableTrack(track);
      try {
        await collections.publish({
          playlists,
          now: portable ? { track: portable, position: playback.time, playing: playback.status === 'playing' } : null,
        });
      } catch (e) { if (!stopped) setError(String(e)); }
    }
    void publish();
    const timer = window.setInterval(() => void publish(), 1500);
    return () => { stopped = true; clearInterval(timer); };
  }, [hostLink]);

  // Guest: poll host every 1.5 s and mirror playback
  useEffect(() => {
    if (!following || !guestLink) return;
    let stopped = false, inFlight = false, failures = 0;
    const token = ++generation.current;
    async function poll() {
      if (inFlight || stopped) return; inFlight = true;
      try {
        const started = performance.now();
        const state = await collections.fetch(guestLink);
        if (stopped || token !== generation.current) return;
        failures = 0; setSnapshot(state);
        const now = state.now;
        if (!now) { await player.pause(); return; }
        const received = performance.now();
        const current = latest.current.track;
        const identity = current?.metadataSourceId || current?.id;
        const target = now.track.metadataSourceId || now.track.id;
        const position = now.position + (now.playing ? (performance.now() - started) / 2000 : 0);
        if (identity !== target) {
          if (failed.current === target) return;
          const pending = player.beginLoading(now.track.id, false);
          ownedLoading.current = pending;
          const selected = playSelection(latest.current.session, now.track, false);
          latest.current.update(() => selected);
          try {
            const track = isQueuedCatalog(now.track) ? await latest.current.resolve(now.track) : now.track;
            if (stopped || token !== generation.current || player.state.playbackId !== pending) return;
            playbackTracks.set(track.id, track);
            latest.current.update(session => resolveQueueEntry(session, selected.currentId!, now.track.id, track));
            const loading = player.load(track.id, now.playing, position + (now.playing ? (performance.now() - received) / 1000 : 0));
            ownedLoading.current = player.state.playbackId || null;
            await loading; failed.current = '';
          } catch (e) {
            failed.current = target;
            player.failLoading(pending, String(e));
            setError(`This device could not play the host's track. ${String(e)}`);
          }
        } else if (!['loading', 'buffering', 'error'].includes(player.state.status)) {
          ownedLoading.current = null;
          if (Math.abs(player.state.time - position) > 2 || (lastPosition.current !== null && position < lastPosition.current - 1)) await player.seek(position);
          if (now.playing && player.state.status !== 'playing') await player.play();
          if (!now.playing && player.state.status === 'playing') await player.pause();
        }
        lastPosition.current = position;
      } catch (e) {
        if (!stopped) {
          setError(String(e));
          if (++failures >= 3) { setFollowingState(false); await player.pause(); }
        }
      } finally { inFlight = false; }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 1500);
    return () => {
      stopped = true; generation.current++;
      clearInterval(timer);
      if (ownedLoading.current === player.state.playbackId && player.state.status === 'loading') player.stop();
      ownedLoading.current = null;
    };
  }, [following, guestLink]);

  // Restore persisted session across reloads (host only — guests must re-join)
  useEffect(() => {
    if (!options.ready) return;
    try {
      const saved = localStorage.getItem('lumaire-jam-host');
      if (saved) { setHostLink(saved); }
    } catch { /**/ }
    return () => { generation.current++; void collections.stopSharing().catch(() => {}); };
  }, [options.ready]);

  function setFollowing(value: boolean) {
    generation.current++; failed.current = ''; lastPosition.current = null;
    setError(''); setFollowingState(value);
  }

  const isHost = !!hostLink;
  const isGuest = !!guestLink && following;
  const active = isHost || isGuest;

  return { hostLink, guestLink, following, snapshot, error, busy, startJam, joinJam, endJam, setFollowing, isHost, isGuest, active };
}
