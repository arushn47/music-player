import { useEffect, useRef, useState } from "react";
import type { CatalogTrack } from "../adapters/native";

export interface AlbumDownloadProgress {
  done: number;
  total: number;
  failed: string[];
  active: boolean;
  paused: boolean;
  cancelled: boolean;
  title: string;
  stage: string;
  percent?: number;
}

type Download = (track: CatalogTrack, onStage?: (stage: string, percent?: number) => void, signal?: AbortSignal) => Promise<boolean>;
type Job = { controller: AbortController; progress: AlbumDownloadProgress; wake?: () => void };

// Owned by App so page navigation never abandons an album job.
export function useAlbumDownloads(download: Download) {
  const [progress, setProgress] = useState<Record<string, AlbumDownloadProgress>>({});
  const jobs = useRef(new Map<string, Job>());
  const publish = (id: string, job: Job) => setProgress(previous => ({ ...previous, [id]: { ...job.progress } }));

  useEffect(() => () => {
    for (const job of jobs.current.values()) { job.controller.abort(); job.wake?.(); }
  }, []);

  async function start(id: string, tracks: CatalogTrack[]) {
    if (!tracks.length || jobs.current.has(id)) return;
    const job: Job = { controller: new AbortController(), progress: {
      done: 0, total: tracks.length, failed: [], active: true, paused: false,
      cancelled: false, title: "", stage: "Preparing",
    } };
    jobs.current.set(id, job);
    const state = job.progress;
    publish(id, job);
    try {
      for (const track of tracks) {
        if (state.paused && !job.controller.signal.aborted) await new Promise<void>(resolve => { job.wake = resolve; });
        job.wake = undefined;
        if (job.controller.signal.aborted) break;
        state.percent = undefined;
        state.title = track.title;
        state.stage = "Finding audio source";
        publish(id, job);
        let success = false;
        try {
          success = await download(track, (stage, percent) => { state.stage = stage; state.percent = percent; publish(id, job); }, job.controller.signal);
        } catch { /* A failed track must not abandon the rest of the album. */ }
        if (job.controller.signal.aborted && !success) break;
        if (!success) state.failed = [...state.failed, track.title];
        state.done++;
        state.percent = undefined;
        state.stage = "Waiting";
        publish(id, job);
      }
    } finally {
      state.active = false;
      state.paused = false;
      state.cancelled = job.controller.signal.aborted;
      jobs.current.delete(id);
      publish(id, job);
    }
  }

  function pause(id: string) {
    const job = jobs.current.get(id);
    if (!job || job.controller.signal.aborted) return;
    job.progress.paused = !job.progress.paused;
    if (!job.progress.paused) job.wake?.();
    publish(id, job);
  }

  function cancel(id: string) {
    const job = jobs.current.get(id);
    if (!job) return;
    job.controller.abort();
    job.progress.cancelled = true;
    job.wake?.();
    publish(id, job);
  }

  return { progress, start, pause, cancel };
}
