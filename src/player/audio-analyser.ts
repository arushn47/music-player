let attachedAudio: HTMLMediaElement | null = null;
let audioCtx: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let connectedElement: HTMLMediaElement | null = null;
let connectedSource: string | null = null;
let blockedSource: string | null = null;
let capturedStream: MediaStream | null = null;

function resumeAnalysis(): void {
  if (audioCtx?.state === 'suspended' && !attachedAudio?.paused) void audioCtx.resume().catch(() => {});
}

/**
 * Registers the active media element to analyze.
 * Decoupled from controller/service imports for test and SSR safety.
 */
export function registerAudioElement(audio: HTMLMediaElement | null): void {
  if (attachedAudio !== audio) blockedSource = null;
  attachedAudio = audio;
}

/** Stop analysis only; the original media element keeps its normal playback route. */
export function suspendAudioAnalysis(): void {
  sourceNode?.disconnect();
  capturedStream?.getTracks().forEach(track => track.stop());
  capturedStream = null;
  sourceNode = null;
  analyserNode = null;
  connectedElement = null;
  connectedSource = null;
  window.removeEventListener?.('pointerdown', resumeAnalysis);
  window.removeEventListener?.('keydown', resumeAnalysis);
  if (audioCtx?.state === 'running') void audioCtx.suspend().catch(() => {});
}

/**
 * Lazily initializes and returns the Web Audio API AnalyserNode
 * connected to the registered player audio element.
 * Never throws; returns null in unsupported or headless environments.
 */
export function getAudioAnalyser(): AnalyserNode | null {
  if (typeof window === "undefined") return null;

  const audioElement =
    attachedAudio ||
    (typeof document !== "undefined"
      ? (document.querySelector("audio") as HTMLMediaElement | null)
      : null);

  if (!audioElement || !(audioElement instanceof HTMLMediaElement)) {
    return null;
  }

  const capture = (audioElement as HTMLMediaElement & { captureStream?: () => MediaStream }).captureStream;
  if (!capture) return null;
  const currentSource = audioElement.currentSrc || audioElement.src || '';
  if (blockedSource === currentSource) return null;

  if (analyserNode && connectedElement === audioElement && connectedSource === currentSource) {
    if (audioCtx && audioCtx.state === "suspended" && !audioElement.paused) {
      void audioCtx.resume().catch(() => {});
    }
    return analyserNode;
  }

  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtxClass) return null;

  try {
    if (!audioCtx) {
      audioCtx = new AudioCtxClass();
    }

    if (!sourceNode || connectedElement !== audioElement || connectedSource !== currentSource) {
      // Analyse a copy. MediaElementSource can silence cross-origin streams even when normal playback works.
      const stream = capture.call(audioElement);
      if (!stream.getAudioTracks().length) { if (audioElement.readyState >= 2) blockedSource = currentSource; return null; }
      sourceNode?.disconnect();
      capturedStream?.getTracks().forEach(track => track.stop());
      capturedStream = stream;
      sourceNode = audioCtx.createMediaStreamSource(stream);
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 64; // 32 frequency bins
      analyserNode.smoothingTimeConstant = 0.8;

      sourceNode.connect(analyserNode);
      connectedElement = audioElement;
      connectedSource = currentSource;
    }

    audioElement.addEventListener("play", resumeAnalysis);
    window.addEventListener("pointerdown", resumeAnalysis, { once: true });
    window.addEventListener("keydown", resumeAnalysis, { once: true });

    if (audioCtx.state === "suspended" && !audioElement.paused) {
      void audioCtx.resume().catch(() => {});
    }

    return analyserNode;
  } catch (err) {
    blockedSource = currentSource;
    console.warn("[Lumaire] Audio analyser connection:", err);
    return null;
  }
}

/**
 * Samples current audio frequency data into the provided target buffer.
 * Distinguish actual silence from capture blocked by a provider or browser.
 */
export function sampleAudioFrequencies(target: Uint8Array): 'signal' | 'silent' | 'unavailable' {
  const analyser = getAudioAnalyser();
  if (!analyser) return 'unavailable';

  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
    return 'unavailable';
  }
  if (capturedStream?.getAudioTracks().every(track => track.muted || track.readyState === 'ended')) return 'unavailable';

  analyser.getByteFrequencyData(target as unknown as Uint8Array<ArrayBuffer>);

  for (let i = 0; i < target.length; i++) {
    if (target[i] > 0) return 'signal';
  }
  return 'silent';
}
