import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('analyses a copied stream without rerouting or duplicating audible playback', async () => {
  const connect = vi.fn();
  const createMediaElementSource = vi.fn();
  const analyser = { fftSize: 0, smoothingTimeConstant: 0, connect: vi.fn(), getByteFrequencyData: vi.fn((buffer: Uint8Array) => { buffer[0] = 120; }) };
  const stream = { getAudioTracks: () => [{}] };
  class Media { paused = false; captureStream = () => stream; addEventListener = vi.fn(); }
  class Context { state = 'running'; createMediaElementSource = createMediaElementSource; createMediaStreamSource = vi.fn(() => ({ connect })); createAnalyser = () => analyser; }
  vi.stubGlobal('HTMLMediaElement', Media);
  vi.stubGlobal('window', { AudioContext: Context, addEventListener: vi.fn() });
  const api = await import('./audio-analyser');
  api.registerAudioElement(new Media() as unknown as HTMLMediaElement);
  expect(api.sampleAudioFrequencies(new Uint8Array(32))).toBe('signal');
  expect(connect).toHaveBeenCalledWith(analyser);
  expect(createMediaElementSource).not.toHaveBeenCalled();
  expect(analyser.connect).not.toHaveBeenCalled();
});

it('leaves playback alone when stream capture is unavailable or blocked by CORS', async () => {
  const reroute = vi.fn();
  class Media { paused = false; captureStream = () => { throw new DOMException('Cross origin', 'SecurityError'); }; addEventListener = vi.fn(); }
  class Context { state = 'running'; createMediaElementSource = reroute; }
  vi.stubGlobal('HTMLMediaElement', Media);
  vi.stubGlobal('window', { AudioContext: Context, addEventListener: vi.fn() });
  const api = await import('./audio-analyser');
  const audio = new Media(); api.registerAudioElement(audio as unknown as HTMLMediaElement);
  expect(api.sampleAudioFrequencies(new Uint8Array(32))).toBe('unavailable');
  expect(audio.paused).toBe(false);
  expect(reroute).not.toHaveBeenCalled();
});

it('suspends the analysis context and copied tracks without pausing or rerouting the original song', async () => {
  const stop = vi.fn(), disconnect = vi.fn(), suspend = vi.fn().mockResolvedValue(undefined);
  const audioTrack = { stop, muted: false, readyState: 'live' };
  class Media { paused = false; captureStream = () => ({ getAudioTracks: () => [audioTrack], getTracks: () => [audioTrack] }); addEventListener = vi.fn(); }
  class Context {
    state = 'running'; suspend = suspend;
    createMediaStreamSource = () => ({ connect: vi.fn(), disconnect });
    createAnalyser = () => ({ fftSize: 0, smoothingTimeConstant: 0, getByteFrequencyData: (values: Uint8Array) => { values[0] = 1; } });
  }
  vi.stubGlobal('HTMLMediaElement', Media);
  vi.stubGlobal('window', { AudioContext: Context, addEventListener: vi.fn() });
  const api = await import('./audio-analyser');
  const audio = new Media(); api.registerAudioElement(audio as unknown as HTMLMediaElement);
  expect(api.sampleAudioFrequencies(new Uint8Array(32))).toBe('signal');
  api.suspendAudioAnalysis();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledOnce();
  expect(suspend).toHaveBeenCalledOnce();
  expect(audio.paused).toBe(false);
});
