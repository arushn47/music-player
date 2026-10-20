export interface PlaybackEvent { trackId: string; stage: string; candidateId?: string; reason?: string; count?: number; query?: string }

// Local, bounded diagnostics only. Stream URLs, credentials and native paths are never logged.
export function playbackEvent(event: PlaybackEvent): void {
  console.debug("[Lumaire playback]", JSON.stringify(event));
}
